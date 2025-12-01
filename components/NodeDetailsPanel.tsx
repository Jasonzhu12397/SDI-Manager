import React from 'react';
import { X, Server, Activity, Clock, Cpu, HardDrive, Network } from 'lucide-react';
import { Device, Link, DeviceType } from '../types';

interface NodeDetailsPanelProps {
  device: Device | null;
  links: Link[];
  onClose: () => void;
}

const NodeDetailsPanel: React.FC<NodeDetailsPanelProps> = ({ device, links, onClose }) => {
  if (!device) return null;

  // Find connections related to this device
  const connections = links.filter(l => l.source === device.id || l.target === device.id);

  return (
    <div className={`fixed inset-y-0 right-0 w-96 bg-slate-900 border-l border-slate-700 shadow-2xl transform transition-transform duration-300 z-40 overflow-y-auto ${device ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="p-6">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${device.status === 'ONLINE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
              <Server size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{device.name}</h2>
              <p className="text-sm text-slate-400 font-mono">{device.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Activity size={14} /> Status
            </div>
            <div className={`font-semibold ${device.status === 'ONLINE' ? 'text-emerald-400' : 'text-red-400'}`}>
              {device.status}
            </div>
          </div>
          <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
             <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Network size={14} /> IP Address
            </div>
            <div className="font-mono text-slate-200 text-sm">{device.ip}</div>
          </div>
          <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
             <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Clock size={14} /> Uptime
            </div>
            <div className="text-slate-200 text-sm">{device.uptime}</div>
          </div>
          <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
             <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Cpu size={14} /> Load
            </div>
            <div className="text-slate-200 text-sm">{device.cpuLoad}% / {device.memoryUsage}%</div>
          </div>
        </div>

        {/* Technical Details */}
        <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">Configuration</h3>
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                <div className="flex justify-between p-3 border-b border-slate-700/50">
                    <span className="text-slate-400 text-sm">Device Type</span>
                    <span className="text-slate-200 text-sm">{device.type}</span>
                </div>
                <div className="flex justify-between p-3 border-b border-slate-700/50">
                    <span className="text-slate-400 text-sm">SSH Port</span>
                    <span className="text-slate-200 text-sm font-mono">{device.port}</span>
                </div>
                <div className="flex justify-between p-3 border-b border-slate-700/50">
                    <span className="text-slate-400 text-sm">Auth User</span>
                    <span className="text-slate-200 text-sm">{device.username}</span>
                </div>
                {device.authType && (
                     <div className="flex justify-between p-3">
                        <span className="text-slate-400 text-sm">Auth Method</span>
                        <span className="text-slate-200 text-sm">{device.authType}</span>
                    </div>
                )}
            </div>
        </div>

        {/* Connections / Neighbors */}
        <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider flex items-center gap-2">
                Connected Neighbors
                <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{connections.length}</span>
            </h3>
            
            <div className="space-y-2">
                {connections.length === 0 ? (
                    <div className="text-center p-4 text-slate-500 bg-slate-800/50 rounded-lg border border-slate-700 border-dashed">
                        No active connections detected.
                    </div>
                ) : (
                    connections.map((link, idx) => {
                        const isSource = link.source === device.id;
                        const neighborId = isSource ? link.target : link.source;
                        // Determine generic neighbor name if not available in main list (for links to outside)
                        
                        return (
                            <div key={idx} className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-400 text-xs">Neighbor ID</span>
                                    <span className="text-blue-400 font-medium text-sm">{neighborId}</span>
                                </div>
                                <div className="h-px bg-slate-700/50"></div>
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                         <span className="text-[10px] text-slate-500 uppercase">Port Mapping</span>
                                         <span className="text-slate-300 font-mono text-xs">{link.label || 'Unknown'}</span>
                                    </div>
                                    <div className={`px-2 py-1 rounded text-[10px] font-bold ${link.status === 'UP' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {link.status}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

export default NodeDetailsPanel;
