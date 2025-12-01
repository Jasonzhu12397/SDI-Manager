import React, { useState, useEffect } from 'react';
import { NetconfDeviceConfig, DeviceType } from '../types';
import { Plus, Trash2, Server, Save, X } from 'lucide-react';
import { api } from '../services/apiService';

const DeviceManager: React.FC = () => {
  const [devices, setDevices] = useState<NetconfDeviceConfig[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newDevice, setNewDevice] = useState<Partial<NetconfDeviceConfig>>({
    port: 830,
    type: DeviceType.ROUTER,
    username: 'admin',
    password: ''
  });

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    const fetched = await api.getDevices();
    setDevices(fetched);
  };

  const handleSave = async () => {
    if (newDevice.name && newDevice.ip && newDevice.username) {
      const devicePayload: NetconfDeviceConfig = {
        id: `dev-${Date.now()}`,
        name: newDevice.name,
        ip: newDevice.ip,
        port: newDevice.port || 830,
        username: newDevice.username,
        password: newDevice.password,
        type: newDevice.type || DeviceType.ROUTER
      };
      
      await api.addDevice(devicePayload);
      await loadDevices();
      
      setIsAdding(false);
      setNewDevice({ port: 830, type: DeviceType.ROUTER, username: 'admin', password: '' });
    }
  };

  const handleRemove = async (id: string) => {
    if(window.confirm("Are you sure you want to remove this device?")) {
        await api.removeDevice(id);
        await loadDevices();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-xl font-bold text-white">Device Management</h2>
           <p className="text-slate-400 text-sm">Configure NETCONF targets for monitoring</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-lg shadow-blue-900/20"
        >
          <Plus size={18} /> Add Device
        </button>
      </div>

      {isAdding && (
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">Add New Device</h3>
            <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Hostname</label>
              <input 
                type="text" 
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white" 
                placeholder="Core-Router-01"
                value={newDevice.name || ''}
                onChange={e => setNewDevice({...newDevice, name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">IP Address</label>
              <input 
                type="text" 
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white" 
                placeholder="192.168.1.1"
                value={newDevice.ip || ''}
                onChange={e => setNewDevice({...newDevice, ip: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">NETCONF Port</label>
              <input 
                type="number" 
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white" 
                placeholder="830"
                value={newDevice.port || 830}
                onChange={e => setNewDevice({...newDevice, port: parseInt(e.target.value)})}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Username</label>
              <input 
                type="text" 
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white" 
                placeholder="admin"
                value={newDevice.username || ''}
                onChange={e => setNewDevice({...newDevice, username: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
              <input 
                type="password" 
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white" 
                placeholder="******"
                value={newDevice.password || ''}
                onChange={e => setNewDevice({...newDevice, password: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Device Type</label>
              <select 
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                value={newDevice.type}
                onChange={e => setNewDevice({...newDevice, type: e.target.value as any})}
              >
                <option value={DeviceType.ROUTER}>Router</option>
                <option value={DeviceType.SWITCH}>Switch</option>
                <option value={DeviceType.FIREWALL}>Firewall</option>
                <option value={DeviceType.SERVER}>Server</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button 
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors font-medium"
            >
              <Save size={18} /> Save Device
            </button>
          </div>
        </div>
      )}

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-900/50 text-xs uppercase text-slate-400 font-semibold">
            <tr>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">IP Address</th>
              <th className="px-6 py-4">Port</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Auth</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {devices.map((device) => (
              <tr key={device.id} className="hover:bg-slate-700/30 transition-colors">
                <td className="px-6 py-4 font-medium text-white flex items-center gap-2">
                  <Server size={16} className="text-slate-500"/>
                  {device.name}
                </td>
                <td className="px-6 py-4 font-mono">{device.ip}</td>
                <td className="px-6 py-4 font-mono text-slate-400">{device.port}</td>
                <td className="px-6 py-4">
                  <span className="bg-slate-700 px-2 py-1 rounded text-xs">{device.type}</span>
                </td>
                <td className="px-6 py-4 text-slate-400">{device.username}</td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => handleRemove(device.id)}
                    className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded transition-colors"
                    title="Remove Device"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {devices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  No devices configured. Click "Add Device" to start.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DeviceManager;
