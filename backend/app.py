import os
import time
import json
import random
import uuid
import tempfile
import xml.etree.ElementTree as ET
from datetime import datetime
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import mariadb
from apscheduler.schedulers.background import BackgroundScheduler
from ncclient import manager

app = Flask(__name__)
CORS(app)

DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'mariadb'),
    'user': os.environ.get('DB_USER', 'netadmin'),
    'password': os.environ.get('DB_PASSWORD', 'netpassword'),
    'database': os.environ.get('DB_DATABASE', 'netwarden'),
    'port': 3306
}

def get_db_connection():
    retries = 5
    while retries > 0:
        try:
            conn = mariadb.connect(**DB_CONFIG)
            return conn
        except mariadb.Error:
            time.sleep(5)
            retries -= 1
    return None

def init_db():
    conn = get_db_connection()
    if not conn:
        return
    
    cur = conn.cursor()
    try:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL
            )
        """)
        
        try:
            cur.execute("INSERT INTO users (username, password) VALUES (?, ?)", ('admin', 'admin'))
            conn.commit()
        except mariadb.IntegrityError:
            pass

        cur.execute("""
            CREATE TABLE IF NOT EXISTS devices (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(100),
                ip VARCHAR(50),
                port INT,
                username VARCHAR(50),
                password VARCHAR(100),
                type VARCHAR(20),
                auth_type VARCHAR(10) DEFAULT 'PASSWORD',
                ssh_key TEXT
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS device_status (
                device_id VARCHAR(50) PRIMARY KEY,
                status VARCHAR(20),
                uptime VARCHAR(50),
                cpu_load INT,
                memory_usage INT,
                topology_json LONGTEXT,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
            )
        """)
        
        try:
            cur.execute("ALTER TABLE device_status ADD COLUMN topology_json LONGTEXT")
        except mariadb.Error:
            pass

        cur.execute("""
            CREATE TABLE IF NOT EXISTS alarms (
                id VARCHAR(50) PRIMARY KEY,
                device_id VARCHAR(50),
                severity VARCHAR(20),
                message TEXT,
                timestamp DATETIME,
                FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
            )
        """)
        
        conn.commit()
    except mariadb.Error:
        pass
    finally:
        conn.close()

# --- Parsing Logic ---

def strip_namespace(tag):
    return tag.split("}", 1)[1] if "}" in tag else tag

def xml_to_dict(elem):
    result = {}
    for child in elem:
        tag = strip_namespace(child.tag)
        if tag in result:
            if not isinstance(result[tag], list):
                result[tag] = [result[tag]]
            result[tag].append(child.text if len(child) == 0 else xml_to_dict(child))
        else:
            result[tag] = child.text if len(child) == 0 else xml_to_dict(child)
    return result

def extract_all_data(data):
    combined_list = []
    equipment = data.get("Equipment", {})
    
    # 1. Parse Switches explicitly (to ensure isolated switches appear)
    switches = equipment.get("Switch", [])
    if not isinstance(switches, list):
        switches = [switches]
    
    for sw in switches:
        sw_id = ""
        # Handle case where Switch is just a text tag <Switch>S1</Switch>
        if isinstance(sw, str):
            sw_id = sw
        # Handle case where Switch is a complex object <Switch><id>S1</id>...</Switch>
        elif isinstance(sw, dict):
            sw_id = sw.get("switchId") or sw.get("id") or sw.get("name")
        
        if sw_id:
             combined_list.append({
                 "type": "Switch",
                 "switchId": sw_id,
                 "status": "ONLINE"
             })

    # 2. Parse Computer Systems & Interfaces
    computer_systems = equipment.get("ComputerSystem", [])
    if not isinstance(computer_systems, list):
        computer_systems = [computer_systems]

    semc_function = data.get("SemcFunction", {})
    networks_data = semc_function.get("Networks", {})
    ipv4_networks = networks_data.get("IPv4Network", [])
    if not isinstance(ipv4_networks, list):
        ipv4_networks = [ipv4_networks]

    network_info = []
    for ipv4 in ipv4_networks:
        if isinstance(ipv4, dict):
            network_name = ipv4.get("iPv4NetworkId", "")
            network_info.append({
                "networkName": network_name,
                "ipAddress": ipv4.get("semAddrActive", "")
            })

    for system in computer_systems:
        if not isinstance(system, dict): continue
        
        system_id = system.get("computerSystemId", "")
        uu_id = system.get("uuId", "")
        vpod_name = system.get("vpod", "")
        interfaces = system.get("SystemEthernetInterface", [])
        agents = system.get("Agent", [])
        agent_ip_address = ""

        if not isinstance(interfaces, list):
            interfaces = [interfaces]
        if not isinstance(agents, list):
            agents = [agents]

        for agent in agents:
            if isinstance(agent, dict) and agent.get("agentId") == "1":
                agent_ip_address = agent.get("ipAddress", "")
        
        # If no interfaces, still add the system
        if not interfaces:
             combined_list.append({
                "type": "computerSystem",
                "computerSystemId": system_id,
                "uuId": uu_id,
                "vpod_name": vpod_name,
                "interfaceId": "",
                "macAddress": "",
                "switchPortId": "",
                "switchId": "",
                "switchType": "",
                "bmc IPaddress": agent_ip_address,
                "networkName": "",
                "ipAddress": ""
            })

        for iface in interfaces:
            if not isinstance(iface, dict): continue
            
            connected_to = iface.get("connectedTo", "")
            switch_info = {item.split("=")[0]: item.split("=")[1] for item in connected_to.split(",")} if connected_to else {}
            switch_id = switch_info.get("Bridge", "") or switch_info.get("DataBridge", "")
            port_id = switch_info.get("BridgePort", "")

            switch_type = ""
            if switch_id:
                switch_type = "leaf" if switch_id.lower().startswith("l") else "control" if switch_id.lower().startswith("c") else ""

            base_entry = {
                "type": "NetworkInterface",
                "computerSystemId": system_id,
                "uuId": uu_id,
                "vpod_name": vpod_name,
                "interfaceId": iface.get("systemEthernetInterfaceId", ""),
                "macAddress": iface.get("macAddress", ""),
                "udevName": iface.get("udevName", ""),
                "pciAddress": iface.get("pciAddress", ""),
                "switchPortId": port_id,
                "switchId": switch_id,
                "switchType": switch_type,
                "bmc IPaddress": agent_ip_address,
                "networkName": "",
                "ipAddress": ""
            }

            if vpod_name and network_info:
                for info in network_info:
                    entry = base_entry.copy()
                    entry["networkName"] = info["networkName"]
                    entry["ipAddress"] = info["ipAddress"]
                    combined_list.append(entry)
            else:
                combined_list.append(base_entry)

    return combined_list

def fetch_netconf_data():
    conn = get_db_connection()
    if not conn:
        return

    cur = conn.cursor()
    try:
        cur.execute("SELECT id, name, ip, port, username, password, type, auth_type, ssh_key FROM devices")
    except mariadb.Error:
        cur.execute("SELECT id, name, ip, port, username, password, type, 'PASSWORD', '' FROM devices")
        
    devices = cur.fetchall()

    for dev in devices:
        dev_id, name, ip, port, user, password, dtype, auth_type, ssh_key = dev
        
        parsed_data = []
        connection_success = False
        
        try:
            m = None
            if auth_type == 'KEY' and ssh_key:
                with tempfile.NamedTemporaryFile(mode='w', delete=False) as key_file:
                    key_file.write(ssh_key)
                    key_file_path = key_file.name
                
                m = manager.connect(host=ip, port=port, username=user, key_filename=key_file_path,
                                    hostkey_verify=False, timeout=60, allow_agent=False, look_for_keys=False,
                                    device_params={'name': 'default'})
                os.unlink(key_file_path)
            else:
                m = manager.connect(host=ip, port=port, username=user, password=password, 
                                    hostkey_verify=False, timeout=60, allow_agent=False, look_for_keys=False,
                                    device_params={'name': 'default'})
            
            if m:
                connection_success = True
                response = m.get() 
                root = ET.fromstring(response.xml)
                response_dict = xml_to_dict(root)
                
                data_node = response_dict.get("data", {}).get("ManagedElement", {})
                if isinstance(data_node, list) and len(data_node) > 0:
                    data_node = data_node[0]
                
                if isinstance(data_node, dict):
                    parsed_data = extract_all_data(data_node)
                
                m.close_session()

        except Exception as e:
            print(f"Fetch Error {ip}: {e}")
            pass

        if not connection_success:
             parsed_data = []
             # Mock data
             for i in range(1, 4):
                 parsed_data.append({
                     "computerSystemId": f"mock-server-{i}",
                     "vpod_name": f"vpod-mock",
                     "switchId": "mock-leaf-01",
                     "switchPortId": f"1/1/{i}",
                     "interfaceId": f"eth{i-1}",
                     "bmc IPaddress": f"10.0.0.{100+i}",
                     "type": "NetworkInterface"
                 })

        try:
            json_str = json.dumps(parsed_data)
            status_val = 'ONLINE' if connection_success else 'WARNING'
            if not connection_success and len(parsed_data) == 0:
                status_val = 'OFFLINE'

            cur.execute("""
                INSERT INTO device_status (device_id, status, uptime, cpu_load, memory_usage, topology_json)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                status=VALUES(status), topology_json=VALUES(topology_json)
            """, (dev_id, status_val, 'Unknown', 0, 0, json_str))

            conn.commit()
        except mariadb.Error as e:
            print(f"DB Error: {e}")

    conn.close()

scheduler = BackgroundScheduler()
scheduler.add_job(fetch_netconf_data, 'cron', hour=0, minute=0)
scheduler.start()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT password FROM users WHERE username = ?", (data['username'],))
    row = cur.fetchone()
    conn.close()
    
    if row and row[0] == data['password']:
        return jsonify({'success': True})
    return jsonify({'success': False}), 401

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("INSERT INTO users (username, password) VALUES (?, ?)", (data['username'], data['password']))
        conn.commit()
        return jsonify({'success': True})
    except mariadb.IntegrityError:
        return jsonify({'error': 'Username already exists'}), 400
    finally:
        conn.close()

@app.route('/api/change_password', methods=['POST'])
def change_password():
    data = request.json
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute("SELECT password FROM users WHERE username = ?", (data['username'],))
    row = cur.fetchone()
    
    if row and row[0] == data['oldPassword']:
        cur.execute("UPDATE users SET password = ? WHERE username = ?", (data['newPassword'], data['username']))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    
    conn.close()
    return jsonify({'error': 'Invalid old password'}), 400

@app.route('/api/devices', methods=['GET', 'POST', 'DELETE'])
def manage_devices():
    conn = get_db_connection()
    cur = conn.cursor()

    if request.method == 'GET':
        try:
            cur.execute("SELECT id, name, ip, port, username, type, auth_type FROM devices")
        except mariadb.Error:
             cur.execute("SELECT id, name, ip, port, username, type FROM devices")
        
        rows = cur.fetchall()
        devices = []
        for r in rows:
            auth = 'PASSWORD'
            if len(r) > 6:
                auth = r[6]
            devices.append({
                'id': r[0], 'name': r[1], 'ip': r[2], 'port': r[3], 'username': r[4], 'type': r[5], 'authType': auth
            })
        conn.close()
        return jsonify(devices)

    if request.method == 'POST':
        d = request.json
        try:
            auth_type = d.get('authType', 'PASSWORD')
            ssh_key = d.get('sshKey', '')
            
            cur.execute(
                "INSERT INTO devices (id, name, ip, port, username, password, type, auth_type, ssh_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (d['id'], d['name'], d['ip'], d['port'], d['username'], d['password'], d['type'], auth_type, ssh_key)
            )
            cur.execute(
                "INSERT INTO device_status (device_id, status, uptime, cpu_load, memory_usage) VALUES (?, ?, ?, ?, ?)",
                (d['id'], 'WARNING', '0d', 0, 0)
            )
            conn.commit()
            conn.close()
            scheduler.add_job(fetch_netconf_data, 'date', run_date=datetime.now())
            return jsonify({'success': True})
        except Exception as e:
            conn.close()
            return jsonify({'error': str(e)}), 500

    if request.method == 'DELETE':
        dev_id = request.args.get('id')
        cur.execute("DELETE FROM devices WHERE id = ?", (dev_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True})

@app.route('/api/snapshot', methods=['GET'])
def get_snapshot():
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute("SELECT id, name, ip, type FROM devices")
    devices = {r[0]: {'id': r[0], 'name': r[1], 'ip': r[2], 'type': r[3], 'status': 'ONLINE'} for r in cur.fetchall()}
    
    try:
        cur.execute("SELECT device_id, status, topology_json FROM device_status")
    except mariadb.Error:
        return jsonify({'nodes': list(devices.values()), 'links': [], 'alarms': []})

    discovered_nodes = {}
    discovered_links = []
    
    for r in cur.fetchall():
        dev_id = r[0]
        if dev_id in devices:
            devices[dev_id]['status'] = r[1]
        
        topo_json = r[2]
        if topo_json:
            try:
                records = json.loads(topo_json)
                for item in records:
                    # 1. Server Node
                    sys_id = item.get('computerSystemId')
                    if sys_id and sys_id not in discovered_nodes:
                        discovered_nodes[sys_id] = {
                            'id': sys_id,
                            'name': sys_id,
                            'ip': item.get('bmc IPaddress') or 'N/A',
                            'type': 'SERVER',
                            'status': 'ONLINE',
                            'uptime': '10d',
                            'cpuLoad': 10,
                            'memoryUsage': 20
                        }
                    
                    # 2. Switch Node
                    sw_id = item.get('switchId')
                    if sw_id and sw_id not in discovered_nodes:
                         discovered_nodes[sw_id] = {
                            'id': sw_id,
                            'name': sw_id,
                            'ip': 'N/A',
                            'type': 'SWITCH',
                            'status': 'ONLINE',
                            'uptime': '100d',
                            'cpuLoad': 5,
                            'memoryUsage': 10
                         }

                    # 3. Link
                    if sys_id and sw_id:
                        link_key = f"{sys_id}-{sw_id}"
                        is_duplicate = False
                        for l in discovered_links:
                            if l['source'] == sys_id and l['target'] == sw_id:
                                is_duplicate = True
                                break
                        
                        if not is_duplicate:
                            # Format label
                            iface = item.get('interfaceId', '')
                            port = item.get('switchPortId', '')
                            label = f"{iface} ↔ {port}" if iface and port else (port or iface)

                            discovered_links.append({
                                'source': sys_id,
                                'target': sw_id,
                                'bandwidth': '10Gbps',
                                'status': 'UP',
                                'label': label
                            })

            except json.JSONDecodeError:
                pass

    final_nodes = list(devices.values()) + list(discovered_nodes.values())

    conn.close()
    return jsonify({'nodes': final_nodes, 'links': discovered_links, 'alarms': []})

@app.route('/api/fetch', methods=['POST'])
def trigger_fetch():
    fetch_netconf_data()
    return jsonify({'success': True})

@app.route('/api/alarms/<alarm_id>', methods=['DELETE'])
def delete_alarm(alarm_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM alarms WHERE id = ?", (alarm_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

if __name__ == '__main__':
    time.sleep(5)
    init_db()
    app.run(host='0.0.0.0', port=5000)
