import React, { useState } from 'react';

const MOCK_CONFIG_A = `
interface Ethernet1/1
  description Uplink to Core
  switchport mode trunk
  switchport trunk allowed vlan 10,20,30
  no shutdown
!
interface Ethernet1/2
  description Access Port
  switchport mode access
  switchport access vlan 10
  spanning-tree portfast
!
router ospf 1
  network 10.0.0.0 0.0.0.255 area 0
`;

const MOCK_CONFIG_B = `
interface Ethernet1/1
  description Uplink to Core
  switchport mode trunk
  switchport trunk allowed vlan 10,20,30,40
  no shutdown
!
interface Ethernet1/2
  description Access Port - User Segment
  switchport mode access
  switchport access vlan 20
  spanning-tree portfast
!
router ospf 1
  network 10.0.0.0 0.0.0.255 area 0
  network 192.168.1.0 0.0.0.255 area 1
`;

const ConfigCompare: React.FC = () => {
  const [mode, setMode] = useState<'split' | 'unified'>('split');

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg p-6 h-full flex flex-col animate-fade-in">
       <div className="flex justify-between items-center mb-6">
        <div>
           <h3 className="text-lg font-semibold text-white">Configuration Diff</h3>
           <p className="text-sm text-slate-400">Comparing running-config (left) vs startup-config (right)</p>
        </div>
        <div className="flex gap-2 bg-slate-900 p-1 rounded-lg">
          <button 
            onClick={() => setMode('split')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${mode === 'split' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Split View
          </button>
          <button 
             onClick={() => setMode('unified')}
             className={`px-3 py-1 text-xs rounded-md transition-colors ${mode === 'unified' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Unified View
          </button>
        </div>
       </div>

       <div className={`grid ${mode === 'split' ? 'grid-cols-2' : 'grid-cols-1'} gap-4 flex-1`}>
          {/* Config A */}
          <div className="flex flex-col">
            <div className="bg-slate-700 text-xs px-3 py-1 text-slate-300 rounded-t-lg font-mono flex justify-between">
                <span>Running Config (Version 23.4)</span>
                <span className="text-slate-400">10:00 AM</span>
            </div>
            <pre className="flex-1 bg-slate-950 p-4 text-xs font-mono text-slate-300 overflow-auto rounded-b-lg border border-slate-700 leading-relaxed">
                {MOCK_CONFIG_A}
            </pre>
          </div>

           {/* Config B */}
           <div className={`flex flex-col ${mode === 'unified' ? 'hidden' : ''}`}>
            <div className="bg-slate-700 text-xs px-3 py-1 text-slate-300 rounded-t-lg font-mono flex justify-between">
                <span>Candidate Config (NETCONF Push)</span>
                <span className="text-slate-400">10:05 AM</span>
            </div>
            <pre className="flex-1 bg-slate-950 p-4 text-xs font-mono text-emerald-300 overflow-auto rounded-b-lg border border-slate-700 leading-relaxed">
                {MOCK_CONFIG_B}
            </pre>
          </div>
       </div>
    </div>
  );
};

export default ConfigCompare;