import React from 'react';
import { Device, DeviceType } from '../types';
import { ArrowLeft, Server, HardDrive, Network, Activity, Wifi, Cpu } from 'lucide-react';

interface DeviceDetailsProps {
  device: Device;
  onBack: () => void;
}

const DeviceDetails: React.FC<DeviceDetailsProps> = ({ device, onBack }) => {
  const isCompute = device.type === DeviceType.SERVER;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-md">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            {isCompute ? <Server className="text-blue-400"/> : <Network className="text-purple-400"/>}
            {device.name}
          </h2>
          <div className="flex gap-6 text-sm text-slate-400 mt-1">
            <span className="font-mono bg-slate-900 px-2 py-0.5 rounded text-slate-300">{device.ip}</span>
            <span className="flex items-center gap-1">
              <Activity size={14} className={device.status === 'ONLINE' ? 'text-emerald-400' : 'text-red-400'} /> 
              {device.status}
            </span>
            {device.cpuLoad > 0 && (
                <span className="flex items-center gap-1">
                   <Cpu size={14}/> Load: {device.cpuLoad}%
                </span>
            )}
            <span>Uptime: {device.uptime}</span>
          </div>
        </div>
      </div>

      {/* Compute Node Specifics */}
      {isCompute && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Network Interfaces */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
            <div className="p-4 border-b border-slate-700 flex items-center gap-2 bg-slate-800/50">
              <Network size={18} className="text-blue-400"/>
              <h3 className="font-semibold text-white">Network Interfaces</h3>
            </div>
            <div className="p-0">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3">Interface</th>
                    <th className="px-4 py-3">MAC Address</th>
                    <th className="px-4 py-3">Connection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700 text-slate-300">
                  {device.details?.interfaces?.map((iface, idx) => (
                    <tr key={idx} className="hover:bg-slate-700/30">
                      <td className="px-4 py-3 font-medium text-white">{iface.id}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">{iface.mac || '-'}</td>
                      <td className="px-4 py-3">
                        {iface.connectedSwitch ? (
                          <span className="flex items-center gap-1.5 text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded border border-emerald-500/20 w-fit">
                            <Wifi size={12}/> {iface.connectedSwitch} <span className="text-slate-500">::</span> {iface.connectedPort}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs italic">Disconnected</span>
                        )}
                      </td>
                    </tr>
                  )) || <tr><td colSpan={3} className="p-6 text-center text-slate-500">No interfaces found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Disks */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
            <div className="p-4 border-b border-slate-700 flex items-center gap-2 bg-slate-800/50">
              <HardDrive size={18} className="text-amber-400"/>
              <h3 className="font-semibold text-white">Storage Devices</h3>
            </div>
            <div className="p-0">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3">Disk ID</th>
                    <th className="px-4 py-3">Capacity</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700 text-slate-300">
                  {device.details?.disks?.map((disk, idx) => (
                    <tr key={idx} className="hover:bg-slate-700/30">
                      <td className="px-4 py-3 font-medium text-white">{disk.id}</td>
                      <td className="px-4 py-3">{disk.size || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-xs border border-emerald-500/20">
                          {disk.status || 'OK'}
                        </span>
                      </td>
                    </tr>
                  )) || <tr><td colSpan={3} className="p-6 text-center text-slate-500">No disks found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Network Device Specifics */}
      {!isCompute && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
           <div className="p-4 border-b border-slate-700 flex items-center gap-2 bg-slate-800/50">
              <Network size={18} className="text-purple-400"/>
              <h3 className="font-semibold text-white">Switch Ports Status</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase">
                  <tr>
                    <th className="px-6 py-3">Port ID</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Speed</th>
                    <th className="px-6 py-3">Connected Neighbor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700 text-slate-300">
                   {device.details?.ports?.map((port, idx) => (
                    <tr key={idx} className="hover:bg-slate-700/30">
                      <td className="px-6 py-3 font-medium text-white">{port.id}</td>
                      <td className="px-6 py-3">
                         <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${port.status === 'UP' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>
                          {port.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-mono text-xs">{port.speed}</td>
                      <td className="px-6 py-3">
                        {port.connectedDevice ? (
                           <span className="text-blue-300 flex items-center gap-1">
                             <Server size={12}/> {port.connectedDevice}
                           </span>
                        ) : (
                            <span className="text-slate-600">-</span>
                        )}
                      </td>
                    </tr>
                   )) || <tr><td colSpan={4} className="p-6 text-center text-slate-500">No ports information available</td></tr>}
                </tbody>
              </table>
            </div>
        </div>
      )}
    </div>
  );
};

export default DeviceDetails;
