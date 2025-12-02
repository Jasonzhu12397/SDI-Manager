import React, { useState, useEffect } from 'react';
import { NetconfDeviceConfig, DeviceType, AuthType, Device } from '../types';
import { Plus, Trash2, Server, Save, X, Key, Network, Box, Router, ChevronRight, Monitor, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { api } from '../services/apiService';
import DeviceDetails from './DeviceDetails';

interface DeviceManagerProps {
  filterCategory?: 'COMPUTE' | 'NETWORK';
}

const DeviceManager: React.FC<DeviceManagerProps> = ({ filterCategory }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  
  const defaultType = filterCategory === 'COMPUTE' ? DeviceType.SERVER : DeviceType.ROUTER;

  const [newDevice, setNewDevice] = useState<Partial<NetconfDeviceConfig>>({
    port: 830,
    type: defaultType,
    username: 'admin',
    password: '',
    authType: AuthType.PASSWORD,
    sshKey: ''
  });

  useEffect(() => {
    loadDevices();
  }, []);

  useEffect(() => {
    setNewDevice(prev => ({
        ...prev,
        type: filterCategory === 'COMPUTE' ? DeviceType.SERVER : DeviceType.ROUTER
    }));
    setIsAdding(false);
    setSelectedDevice(null);
  }, [filterCategory]);

  const loadDevices = async () => {
    const snapshot = await api.getSnapshot();
    setDevices(snapshot.nodes); 
  };

  const displayedDevices = devices.filter(device => {
      if (!filterCategory) return true; 
      if (filterCategory === 'COMPUTE') return device.type === DeviceType.SERVER;
      if (filterCategory === 'NETWORK') return device.type !== DeviceType.SERVER;
      return true;
  });

  const getTitle = () => {
      if (filterCategory === 'COMPUTE') return 'Compute Nodes';
      if (filterCategory === 'NETWORK') return 'Network Devices';
      return 'Device Management';
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
        authType: newDevice.authType || AuthType.PASSWORD,
        sshKey: newDevice.sshKey,
        type: newDevice.type || DeviceType.ROUTER
      };
      
      await api.addDevice(devicePayload);
      await loadDevices();
      
      setIsAdding(false);
      setNewDevice({ 
        port: 830, 
        type: defaultType, 
        username: 'admin', 
        password: '',
        authType: AuthType.PASSWORD,
        sshKey: ''
      });
    }
  };

  const handleRemove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(window.confirm("Are you sure you want to remove this device?")) {
        await api.removeDevice(id);
        await loadDevices();
    }
  };

  if (selectedDevice) {
      return <DeviceDetails device={selectedDevice} onBack={() => setSelectedDevice(null)} />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-xl font-bold text-white">{getTitle()}</h2>
           <p className="text-slate-400 text-sm">
             {filterCategory ? `Manage ${filterCategory.toLowerCase()} resources` : 'Configure NETCONF targets for monitoring'}
           </p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-lg shadow-blue-900/20"
        >
          <Plus size={18} /> Add {filterCategory === 'COMPUTE' ? 'Node' : 'Device'}
        </button>
      </div>

      {isAdding && (
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">Add New {filterCategory === 'COMPUTE' ? 'Node' : 'Device'}</h3>
            <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Hostname</label>
              <input 
                type="text" 
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white" 
                placeholder={filterCategory === 'COMPUTE' ? "worker-node-01" : "Core-Router-01"}
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
              <label className="block text-xs font-medium text-slate-400 mb-1">Device Type</label>
              <select 
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                value={newDevice.type}
                onChange={e => setNewDevice({...newDevice, type: e.target.value as any})}
                disabled={!!filterCategory}
              >
                 {(!filterCategory || filterCategory === 'NETWORK') && (
                    <>
                        <option value={DeviceType.ROUTER}>Router</option>
                        <option value={DeviceType.SWITCH}>Switch</option>
                        <option value={DeviceType.FIREWALL}>Firewall</option>
                    </>
                )}
                {(!filterCategory || filterCategory === 'COMPUTE') && (
                    <option value={DeviceType.SERVER}>Server</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Authentication Method</label>
              <select 
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                value={newDevice.authType}
                onChange={e => setNewDevice({...newDevice, authType: e.target.value as any})}
              >
                <option value={AuthType.PASSWORD}>Password</option>
                <option value={AuthType.KEY}>SSH Key</option>
              </select>
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

            {newDevice.authType === AuthType.PASSWORD ? (
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
            ) : (
              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-slate-400 mb-1">SSH Private Key</label>
                <textarea 
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono text-xs" 
                  rows={4}
                  placeholder="-----BEGIN RSA PRIVATE KEY-----..."
                  value={newDevice.sshKey || ''}
                  onChange={e => setNewDevice({...newDevice, sshKey: e.target.value})}
                />
                <div className="mt-2">
                   <label className="block text-xs font-medium text-slate-400 mb-1">Key Passphrase (Optional)</label>
                   <input 
                    type="password" 
                    className="w-full max-w-sm bg-slate-950 border border-slate-700 rounded-lg p-2 text-white" 
                    placeholder="Passphrase"
                    value={newDevice.password || ''}
                    onChange={e => setNewDevice({...newDevice, password: e.target.value})}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <button 
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors font-medium"
            >
              <Save size={18} /> Save {filterCategory === 'COMPUTE' ? 'Node' : 'Device'}
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
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Connection Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {displayedDevices.map((device) => (
              <tr 
                key={device.id} 
                className="hover:bg-slate-700/30 transition-colors cursor-pointer group"
                onClick={() => setSelectedDevice(device)}
              >
                <td className="px-6 py-4 font-medium text-white flex items-center gap-3">
                  {device.type === DeviceType.SERVER ? <Server size={18} className="text-blue-400"/> : <Router size={18} className="text-purple-400"/>}
                  {device.name}
                </td>
                <td className="px-6 py-4 font-mono text-slate-400">{device.ip}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${device.type === DeviceType.SERVER ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}>
                      {device.type}
                  </span>
                </td>
                <td className="px-6 py-4">
                   {device.status === 'ONLINE' ? (
                        <span className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20 w-fit" title="NETCONF Authenticated & Connected">
                            <CheckCircle size={14} /> Connected
                        </span>
                   ) : device.status === 'WARNING' ? (
                        <span className="flex items-center gap-2 text-xs font-bold text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20 w-fit" title="Connected but with issues">
                            <AlertTriangle size={14} /> Warning
                        </span>
                   ) : (
                        <span className="flex items-center gap-2 text-xs font-bold text-red-400 bg-red-400/10 px-3 py-1 rounded-full border border-red-400/20 w-fit" title="NETCONF Failed: Authentication or Network Error">
                            <XCircle size={14} /> Failed
                        </span>
                   )}
                </td>
                <td className="px-6 py-4 text-right flex items-center justify-end">
                  <span className="text-slate-500 opacity-0 group-hover:opacity-100 transition-all text-xs mr-3 flex items-center gap-1">
                     View Details <ChevronRight size={12}/>
                  </span>
                  <button 
                    onClick={(e) => handleRemove(device.id, e)}
                    className="text-slate-500 hover:text-red-400 p-2 hover:bg-red-500/10 rounded-lg transition-colors z-10"
                    title="Remove Device"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {displayedDevices.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-3">
                     <Box size={24} className="opacity-50"/>
                     <p>No {filterCategory ? filterCategory.toLowerCase() : ''} devices configured.</p>
                     <button onClick={() => setIsAdding(true)} className="text-blue-400 hover:text-blue-300 text-sm font-medium mt-1">
                        Add your first device
                     </button>
                  </div>
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
