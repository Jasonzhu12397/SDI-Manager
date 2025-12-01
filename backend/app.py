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

# Optimized Filter provided by user
NETCONF_FILTER = """
<filter>
  <ManagedElement>
    <managedElementId>1</managedElementId>
    <Equipment>
      <ComputerSystem>
        <uuId/>
        <computerSystemId/>
        <SystemEthernetInterface/>
        <Agent/>
      </ComputerSystem>
      <RedfishAsset>
        <ipAddress/>
      </RedfishAsset>
      <Switch/>
    </Equipment>
  </ManagedElement>
</filter>
"""

def get_db_connection():
    try:
        conn = mariadb.connect(**DB_CONFIG)
        return conn
    except mariadb.Error as e:
        return None

def wait_for_db():
    retries = 30
    while retries > 0:
        conn = get_db_connection()
        if conn:
            conn.close()
            print("Database connected successfully.")
            return True
        print(f"Waiting for Database... ({retries} retries left)")
        time.sleep(2)
        retries -= 1
    return False

def init_db():
    if not wait_for_db():
        return

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
    except mariadb.Error as e:
        print(f"DB Init Error: {e}")
    finally:
        conn.close()

# --- Robust Parsing Logic ---

def strip_namespace(tag):
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag

def xml_to_dict(elem):
    result = {}
    for child in elem:
        tag = strip_namespace(child.tag)
        child_data = child.text if len(child) == 0 else xml_to_dict(child)
        
        if tag in result:
            if not isinstance(result[tag], list):
                result[tag] = [result[tag]]
            result[tag].append(child_data)
        else:
            result[tag] = child_data
    return result

def find_keys_recursive(data, key_name):
    """Recursively find all values for a specific key in nested dict/list"""
    results = []
    if isinstance(data, dict):
        for k, v in data.items():
            if k == key_name:
                if isinstance(v, list):
                    results.extend(v)
                else:
                    results.append(v)
            else:
                results.extend(find_keys_recursive(v, key_name))
    elif isinstance(data, list):
        for item in data:
            results.extend(find_keys_recursive(item, key_name))
    return results

def extract_all_data(data):
    combined_list = []
    
    # Use recursive search to ensure we find elements regardless of hierarchy
    computer_systems = find_keys_recursive(data, "ComputerSystem")
    switches = find_keys_recursive(data, "Switch")
    
    # 1. Process Switches
    for sw in switches:
        sw_id = ""
        if isinstance(sw, str):
            sw_id = sw
        elif isinstance(sw, dict):
            sw_id = sw.get("switchId") or sw.get("id") or sw.get("name")
        
        if sw_id:
             combined_list.append({
                 "category": "NETWORK",
                 "id": sw_id,
                 "name": sw_id,
                 "type": "SWITCH",
                 "status": "ONLINE",
                 "details": { "ports": [] } # Filter does not request ports, so empty details
             })

    # 2. Process Computer Systems
    for system in computer_systems:
        if not isinstance(system, dict): 
            # Simple ID case
            if isinstance(system, str):
                combined_list.append({
                    "category": "COMPUTE",
                    "type": "SERVER",
                    "id": system,
                    "name": system,
                    "status": "ONLINE",
                    "details": { "disks": [], "interfaces": [] }
                })
            continue
        
        system_id = system.get("computerSystemId") or system.get("id", "Unknown")
        
        # Extract Interfaces
        interfaces = system.get("SystemEthernetInterface", [])
        if not isinstance(interfaces, list): interfaces = [interfaces]
        
        parsed_interfaces = []
        for iface in interfaces:
            if isinstance(iface, dict):
                # Check for connections to switches
                conn = iface.get("connectedTo", "")
                sw_id = ""
                port_id = ""
                if "Bridge=" in conn:
                    # Parse comma-separated string: "Bridge=S1,BridgePort=P1"
                    parts = conn.split(',')
                    for p in parts:
                        if "Bridge=" in p: sw_id = p.split('=')[1]
                        if "BridgePort=" in p: port_id = p.split('=')[1]

                parsed_interfaces.append({
                    "id": iface.get("systemEthernetInterfaceId", "eth0"),
                    "mac": iface.get("macAddress", "00:00:00:00:00:00"),
                    "connectedSwitch": sw_id,
                    "connectedPort": port_id
                })

                # Add Topology Link if connected
                if sw_id:
                    combined_list.append({
                        "category": "LINK",
                        "source": system_id,
                        "target": sw_id,
                        "source_interface": iface.get("systemEthernetInterfaceId", ""),
                        "target_port": port_id,
                        "status": "UP"
                    })

        combined_list.append({
            "category": "COMPUTE",
            "type": "SERVER",
            "id": system_id,
            "name": system_id,
            "computerSystemId": system_id,
            "bmc IPaddress": "Unknown", 
            "details": {
                "disks": [], # Filter doesn't request disks
                "interfaces": parsed_interfaces
            }
        })

    return combined_list

def fetch_netconf_data():
    conn = get_db_connection()
    if not conn:
        print("Fetch failed: No DB connection")
        return

    cur = conn.cursor()
    try:
        cur.execute("SELECT id, name, ip, port, username, password, type, auth_type, ssh_key FROM devices")
    except mariadb.Error:
        try:
            cur.execute("SELECT id, name, ip, port, username, password, type, 'PASSWORD', '' FROM devices")
        except:
             conn.close()
             return
        
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
                # Attempt with specific filter
                try:
                    response = m.get(filter=NETCONF_FILTER) 
                    root = ET.fromstring(response.xml)
                    response_dict = xml_to_dict(root)
                    
                    data_node = response_dict.get("data", {})
                    if not data_node: data_node = response_dict
                    
                    parsed_data = extract_all_data(data_node)
                except Exception as e:
                    print(f"Filter failed, trying full get: {e}")
                    # Fallback to full get if filter syntax is rejected by device
                    response = m.get()
                    root = ET.fromstring(response.xml)
                    response_dict = xml_to_dict(root)
                    parsed_data = extract_all_data(response_dict.get("data", response_dict))
                
                m.close_session()

        except Exception as e:
            print(f"Fetch Error {ip}: {e}")
            pass

        if not connection_success:
             parsed_data = []
             # Basic Mock
             parsed_data.append({
                 "category": "COMPUTE",
                 "id": "Mock-Server-01",
                 "type": "SERVER",
                 "details": {"interfaces": []}
             })

        try:
            json_str = json.dumps(parsed_data)
            status_val = 'ONLINE' if connection_success else 'WARNING'
            
            cur.execute("""
                INSERT INTO device_status (device_id, status, uptime, cpu_load, memory_usage, topology_json)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                status=VALUES(status), topology_json=VALUES(topology_json)
            """, (dev_id, status_val, '1d 5h', 15, 40, json_str))

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
    if not conn: return jsonify({'error': 'Database unavailable'}), 500
    cur = conn.cursor()
    cur.execute("SELECT password FROM users WHERE username = ?", (data['username'],))
    row = cur.fetchone()
    conn.close()
    if row and row[0] == data['password']: return jsonify({'success': True})
    return jsonify({'success': False}), 401

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    conn = get_db_connection()
    if not conn: return jsonify({'error': 'Database unavailable'}), 500
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
    if not conn: return jsonify({'error': 'Database unavailable'}), 500
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
    if not conn: return jsonify({'error': 'Database unavailable'}), 500
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
            if len(r) > 6: auth = r[6]
            devices.append({'id': r[0], 'name': r[1], 'ip': r[2], 'port': r[3], 'username': r[4], 'type': r[5], 'authType': auth})
        conn.close()
        return jsonify(devices)

    if request.method == 'POST':
        d = request.json
        try:
            auth_type = d.get('authType', 'PASSWORD')
            ssh_key = d.get('sshKey', '')
            cur.execute("INSERT INTO devices (id, name, ip, port, username, password, type, auth_type, ssh_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (d['id'], d['name'], d['ip'], d['port'], d['username'], d['password'], d['type'], auth_type, ssh_key))
            cur.execute("INSERT INTO device_status (device_id, status, uptime, cpu_load, memory_usage, topology_json) VALUES (?, ?, ?, ?, ?, ?)",
                (d['id'], 'WARNING', '0d', 0, 0, "[]"))
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
    if not conn: return jsonify({'nodes': [], 'links': [], 'alarms': []})
    cur = conn.cursor()
    
    cur.execute("SELECT id, name, ip, type FROM devices")
    configured_devices = {r[0]: {'id': r[0], 'name': r[1], 'ip': r[2], 'type': r[3], 'status': 'ONLINE'} for r in cur.fetchall()}
    
    try:
        cur.execute("SELECT device_id, status, topology_json FROM device_status")
    except mariadb.Error:
        return jsonify({'nodes': list(configured_devices.values()), 'links': [], 'alarms': []})

    discovered_nodes = {}
    discovered_links = []
    
    for r in cur.fetchall():
        dev_id = r[0]
        
        if dev_id in configured_devices:
            configured_devices[dev_id]['status'] = r[1]
        
        topo_json = r[2]
        if topo_json:
            try:
                records = json.loads(topo_json)
                for item in records:
                    category = item.get('category')
                    
                    if category == 'COMPUTE' or category == 'NETWORK':
                        node_id = item.get('id')
                        if node_id:
                            node_type = item.get('type', 'SERVER')
                            # If not already in configured devices, add to discovered
                            if node_id not in configured_devices:
                                discovered_nodes[node_id] = {
                                    'id': node_id,
                                    'name': item.get('name', node_id),
                                    'ip': item.get('bmc IPaddress') or 'N/A',
                                    'type': node_type,
                                    'status': item.get('status', 'ONLINE'),
                                    'uptime': '10d',
                                    'cpuLoad': 10,
                                    'memoryUsage': 20,
                                    'details': item.get('details')
                                }
                            else:
                                # Merge details into configured device
                                configured_devices[node_id]['details'] = item.get('details')

                    elif category == 'LINK':
                        src = item.get('source')
                        tgt = item.get('target')
                        if src and tgt:
                            label = item.get('label') or f"{item.get('source_interface','')} - {item.get('target_port','')}"
                            discovered_links.append({
                                'source': src,
                                'target': tgt,
                                'bandwidth': '10Gbps',
                                'status': 'UP',
                                'label': label
                            })

            except json.JSONDecodeError:
                pass

    final_nodes = list(configured_devices.values()) + list(discovered_nodes.values())
    conn.close()
    return jsonify({'nodes': final_nodes, 'links': discovered_links, 'alarms': []})

@app.route('/api/fetch', methods=['POST'])
def trigger_fetch():
    fetch_netconf_data()
    return jsonify({'success': True})

@app.route('/api/alarms/<alarm_id>', methods=['DELETE'])
def delete_alarm(alarm_id):
    conn = get_db_connection()
    if not conn: return jsonify({'error': 'DB Error'}), 500
    cur = conn.cursor()
    cur.execute("DELETE FROM alarms WHERE id = ?", (alarm_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000)
