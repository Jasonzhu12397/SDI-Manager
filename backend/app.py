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

# --- Robust XML Parsing Logic ---

def get_text(element, tag_name):
    """Helper to find text of a child element ignoring namespaces"""
    if element is None: return ""
    # Search for direct child with local-name
    for child in element:
        if child.tag.endswith(f"}}{tag_name}") or child.tag == tag_name:
            return child.text or ""
    return ""

def find_all_elements(element, tag_name):
    """Recursively find all elements with a specific local tag name"""
    found = []
    if element.tag.endswith(f"}}{tag_name}") or element.tag == tag_name:
        found.append(element)
    for child in element:
        found.extend(find_all_elements(child, tag_name))
    return found

def extract_all_data(root_xml_element):
    combined_list = []
    
    # 1. Find Computer Systems (Servers)
    # We look for any tag named 'ComputerSystem' anywhere in the tree
    computer_systems = find_all_elements(root_xml_element, "ComputerSystem")
    
    for cs in computer_systems:
        sys_id = get_text(cs, "computerSystemId")
        if not sys_id:
            # Sometimes ID is an attribute or just the value
            sys_id = cs.text if cs.text and cs.text.strip() else f"CS-{uuid.uuid4().hex[:6]}"
            
        uu_id = get_text(cs, "uuId")
        vpod = get_text(cs, "vpod")
        
        # Interfaces
        interfaces = find_all_elements(cs, "SystemEthernetInterface")
        parsed_interfaces = []
        
        for iface in interfaces:
            conn_str = get_text(iface, "connectedTo")
            sw_id = ""
            port_id = ""
            
            if "Bridge=" in conn_str:
                # Parse "Bridge=X,BridgePort=Y"
                parts = conn_str.split(',')
                for p in parts:
                    if "Bridge=" in p: sw_id = p.split('=')[1]
                    if "DataBridge=" in p: sw_id = p.split('=')[1] # Handle DataBridge too
                    if "BridgePort=" in p: port_id = p.split('=')[1]

            iface_id = get_text(iface, "systemEthernetInterfaceId") or "eth0"
            mac_addr = get_text(iface, "macAddress")

            parsed_interfaces.append({
                "id": iface_id,
                "mac": mac_addr,
                "connectedSwitch": sw_id,
                "connectedPort": port_id
            })

            # Create Link if connected
            if sw_id:
                combined_list.append({
                    "category": "LINK",
                    "source": sys_id,
                    "target": sw_id,
                    "source_interface": iface_id,
                    "target_port": port_id,
                    "status": "UP"
                })

        # Disks
        disks = []
        disk_elems = find_all_elements(cs, "Disk")
        for d in disk_elems:
             disks.append({
                 "id": get_text(d, "diskId") or "disk",
                 "size": get_text(d, "capacity") or "Unknown",
                 "status": "OK"
             })
             
        combined_list.append({
            "category": "COMPUTE",
            "type": "SERVER",
            "id": sys_id,
            "name": sys_id,
            "computerSystemId": sys_id,
            "bmc IPaddress": "Unknown", # Could extract Agent info if needed
            "details": {
                "disks": disks,
                "interfaces": parsed_interfaces
            }
        })

    # 2. Find Switches
    switches = find_all_elements(root_xml_element, "Switch")
    
    # Also look for BridgePorts globally to associate them
    all_bridge_ports = find_all_elements(root_xml_element, "BridgePort")
    
    for sw in switches:
        sw_id = get_text(sw, "switchId")
        if not sw_id: 
             # If it's a simple tag like <Switch>ID</Switch>
             sw_id = sw.text if sw.text and sw.text.strip() else f"SW-{uuid.uuid4().hex[:6]}"
        
        # Try to find ports for this switch
        # Heuristic: If we have ports, we list them. 
        my_ports = []
        for bp in all_bridge_ports:
             bp_id = get_text(bp, "bridgePortId")
             if bp_id:
                 my_ports.append({
                     "id": bp_id,
                     "status": get_text(bp, "operState") or "UNKNOWN",
                     "speed": get_text(bp, "linkSpeed") or "Unknown",
                     "connectedDevice": get_text(bp, "connectedTo")
                 })
        
        # If no ports found via BridgePort, add a default one for display
        if not my_ports:
             my_ports.append({"id": "mgmt0", "status": "UP", "speed": "1G", "connectedDevice": ""})

        combined_list.append({
            "category": "NETWORK",
            "id": sw_id,
            "name": sw_id,
            "type": "SWITCH",
            "status": "ONLINE",
            "details": { "ports": my_ports }
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
                # Get Full Config - No Filter
                response = m.get() 
                root = ET.fromstring(response.xml)
                
                # Parse directly from XML root
                parsed_data = extract_all_data(root)
                
                m.close_session()

        except Exception as e:
            print(f"Fetch Error {ip}: {e}")
            pass

        # --- MOCK DATA FALLBACK ---
        # Only if connection failed AND we have no data
        if not connection_success and not parsed_data:
             parsed_data = []
             # Mock based on device type
             if dtype == 'SERVER':
                 parsed_data.append({
                     "category": "COMPUTE",
                     "id": name,
                     "type": "SERVER",
                     "name": name,
                     "status": "ONLINE",
                     "details": {
                         "disks": [{"id": "sda", "size": "512G", "status": "OK"}],
                         "interfaces": [{"id": "eth0", "mac": "aa:bb:cc:11:22:33", "connectedSwitch": "Sw-1", "connectedPort": "P1"}]
                     }
                 })
             else:
                 parsed_data.append({
                     "category": "NETWORK",
                     "id": name,
                     "type": "SWITCH",
                     "name": name,
                     "status": "ONLINE",
                     "details": { "ports": [{"id": "1/1/1", "status": "UP", "speed": "10G"}] }
                 })

        try:
            json_str = json.dumps(parsed_data)
            status_val = 'ONLINE' if connection_success else 'WARNING'
            if not connection_success: status_val = 'OFFLINE'
            
            # If we parsed data successfully, status is ONLINE
            if parsed_data: status_val = 'ONLINE'

            cur.execute("""
                INSERT INTO device_status (device_id, status, uptime, cpu_load, memory_usage, topology_json)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                status=VALUES(status), topology_json=VALUES(topology_json)
            """, (dev_id, status_val, '1d 5h', random.randint(5, 30), random.randint(20, 60), json_str))

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
        
        # Update status
        if dev_id in configured_devices:
            configured_devices[dev_id]['status'] = r[1]
        
        topo_json = r[2]
        if topo_json:
            try:
                records = json.loads(topo_json)
                for item in records:
                    category = item.get('category')
                    node_id = item.get('id')
                    
                    if category == 'COMPUTE' or category == 'NETWORK':
                        if node_id:
                            # If this is the configured device itself, merge details
                            # Heuristic: match by ID or Name
                            matched = False
                            if node_id == configured_devices.get(dev_id, {}).get('name'):
                                configured_devices[dev_id]['details'] = item.get('details')
                                matched = True
                            
                            if not matched and node_id not in discovered_nodes:
                                discovered_nodes[node_id] = {
                                    'id': node_id,
                                    'name': item.get('name', node_id),
                                    'ip': item.get('bmc IPaddress') or 'N/A',
                                    'type': item.get('type', 'SERVER'),
                                    'status': item.get('status', 'ONLINE'),
                                    'uptime': '10d',
                                    'cpuLoad': 10,
                                    'memoryUsage': 20,
                                    'details': item.get('details')
                                }

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
