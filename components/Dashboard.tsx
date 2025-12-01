import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Device, Alarm, AlarmSeverity, DeviceStatus, DeviceType } from '../types';
import { Activity, Server, AlertTriangle, Network, ExternalLink, Box } from 'lucide-react';

interface DashboardProps {
  devices: Device[];
  alarms: Alarm[];
  onNavigate: (tab: 'dashboard' | 'topology' | 'alarms' | 'config' | 'devices') => void;
}

const trafficData = [
  { time: '00:00', ingress: 400, egress: 240 },
  { time: '04:00', ingress: 300, egress: 139 },
  { time: '08:00', ingress: 200, egress: 980 },
  { time: '12:00', ingress: 278, egress: 390 },
  { time: '16:00', ingress: 189, egress: 480 },
  { time: '20:00', ingress: 239, egress: 380 },
  { time: '24:00', ingress: 349, egress: 430 },
];

const Dashboard: React.FC<DashboardProps> = ({ devices, alarms, onNavigate }) => {
  // Categorize Devices
  const computeNodes = devices.filter(d => d.type === DeviceType.SERVER);
  const networkDevices = devices.filter(d => d.type === DeviceType.SWITCH || d.type === DeviceType.ROUTER);
  
  const totalAlarms = alarms.length;
  const criticalAlarms = alarms.filter(a => a.severity === AlarmSeverity.CRITICAL).length;

  const deviceTypeCount = [
    { name: 'Compute', count: computeNodes.length },
    { name: 'Network', count: networkDevices.length },
    { name: 'Other', count: devices.length - computeNodes.length - networkDevices.length },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Compute Nodes Card */}
        <div 
            onClick={() => onNavigate('topology')}
            className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg flex items-center justify-between cursor-pointer hover:bg-slate-750 hover:border-blue-500/50 transition-all transform hover:scale-[1.02] group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <ExternalLink size={14} className="text-slate-500" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium group-hover:text-blue-400 transition-colors">Compute Nodes</p>
            <h3 className="text-2xl font-bold text-white mt-1">{computeNodes.length}</h3>
            <span className="text-xs text-emerald-400 flex items-center gap-1 mt-1">
                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Online
            </span>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
            <Server className="w-6 h-6 text-blue-400" />
          </div>
        </div>

        {/* Network Devices Card */}
        <div 
            onClick={() => onNavigate('topology')}
            className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg flex items-center justify-between cursor-pointer hover:bg-slate-750 hover:border-purple-500/50 transition-all transform hover:scale-[1.02] group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <ExternalLink size={14} className="text-slate-500" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium group-hover:text-purple-400 transition-colors">Network Devices</p>
            <h3 className="text-2xl font-bold text-white mt-1">{networkDevices.length}</h3>
            <span className="text-xs text-slate-400 mt-1 block">Switches & Routers</span>
          </div>
          <div className="p-3 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
            <Network className="w-6 h-6 text-purple-400" />
          </div>
        </div>

        {/* Alarms Card */}
        <div 
            onClick={() => onNavigate('alarms')}
            className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg flex items-center justify-between cursor-pointer hover:bg-slate-750 hover:border-red-500/50 transition-all transform hover:scale-[1.02] group relative overflow-hidden"
        >
           <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <ExternalLink size={14} className="text-slate-500" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium group-hover:text-red-400 transition-colors">Total Alarms</p>
            <h3 className="text-2xl font-bold text-red-500 mt-1">{totalAlarms}</h3>
            <span className="text-xs text-red-400 mt-1 block">{criticalAlarms} Critical</span>
          </div>
          <div className="p-3 bg-red-500/10 rounded-lg group-hover:bg-red-500/20 transition-colors">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
        </div>

        {/* Total Assets Card */}
        <div 
            onClick={() => onNavigate('devices')}
            className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg flex items-center justify-between cursor-pointer hover:bg-slate-750 hover:border-amber-500/50 transition-all transform hover:scale-[1.02] group relative overflow-hidden"
        >
           <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <ExternalLink size={14} className="text-slate-500" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium group-hover:text-amber-400 transition-colors">Total Assets</p>
            <h3 className="text-2xl font-bold text-white mt-1">{devices.length}</h3>
            <span className="text-xs text-slate-400 mt-1 block">Managed Entities</span>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-lg group-hover:bg-amber-500/20 transition-colors">
            <Box className="w-6 h-6 text-amber-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
          <h3 className="text-lg font-semibold text-white mb-6">Aggregate Network Traffic (24h)</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficData}>
                <defs>
                  <linearGradient id="colorIngress" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorEgress" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                  itemStyle={{ color: '#e2e8f0' }}
                />
                <Area type="monotone" dataKey="ingress" stroke="#3b82f6" fillOpacity={1} fill="url(#colorIngress)" />
                <Area type="monotone" dataKey="egress" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorEgress)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
          <h3 className="text-lg font-semibold text-white mb-6">Inventory Breakdown</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deviceTypeCount} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" />
                <YAxis dataKey="name" type="category" width={80} stroke="#94a3b8" />
                <Tooltip 
                  cursor={{fill: 'transparent'}}
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;