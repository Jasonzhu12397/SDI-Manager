import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Network, AlertOctagon, FileDiff, Download, Menu, Share2, Settings, Lock, X, Server, Router } from 'lucide-react';
import Dashboard from './components/Dashboard';
import TopologyGraph from './components/TopologyGraph';
import AlarmTable from './components/AlarmTable';
import ConfigCompare from './components/ConfigCompare';
import Login from './components/Login';
import DeviceManager from './components/DeviceManager';
import NodeDetailsPanel from './components/NodeDetailsPanel';
import { api } from './services/apiService';
import { Device, Link, Alarm } from './types';

// Main App Component
const App: React.FC = () => {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState('admin');

  // Add new tabs: 'compute' and 'network'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'topology' | 'alarms' | 'config' | 'devices' | 'compute' | 'network'>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Runtime Data State
  const [devices, setDevices] = useState<Device[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [loading, setLoading] = useState(false);

  // Interaction State
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  // Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwdForm, setPwdForm] = useState({ old: '', new: '', confirm: '' });
  const [pwdMsg, setPwdMsg] = useState({ type: '', text: '' });
  
  // Initial Load upon login
  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const fetchData = async () => {
    setLoading(true);
    const data = await api.getSnapshot();
    setDevices(data.nodes);
    setLinks(data.links);
    setAlarms(data.alarms);
    setLoading(false);
  };

  const handleManualFetch = async () => {
    setLoading(true);
    await api.triggerFetch();
    // Wait a moment for backend to process mock/real fetch then reload UI
    setTimeout(() => {
        fetchData();
    }, 1500);
  };

  const handleClearAlarm = async (id: string) => {
    if(window.confirm('Are you sure you want to dismiss this alarm?')) {
        await api.clearAlarm(id);
        fetchData();
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwdForm.new !== pwdForm.confirm) {
        setPwdMsg({ type: 'error', text: 'New passwords do not match' });
        return;
    }
    const res = await api.changePassword(currentUser, pwdForm.old, pwdForm.new);
    if (res.success) {
        setPwdMsg({ type: 'success', text: 'Password changed successfully' });
        setTimeout(() => setShowPasswordModal(false), 1500);
        setPwdForm({ old: '', new: '', confirm: '' });
    } else {
        setPwdMsg({ type: 'error', text: res.message || 'Failed to change password' });
    }
  };

  const handleDownload = () => {
    const data = {
      timestamp: new Date().toISOString(),
      topology: { nodes: devices, links },
      alarms
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `network-snapshot-${new Date().getTime()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleLoginSuccess = (user: string) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleNavigate = (tab: any) => {
    setActiveTab(tab);
  };

  const handleNodeClick = (device: Device) => {
    setSelectedDevice(device);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLoginSuccess} />;
  }

  // Updated Sidebar Items
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'compute', label: 'Compute Nodes', icon: Server },
    { id: 'network', label: 'Network Devices', icon: Router },
    { id: 'devices', label: 'Device Manager', icon: Settings },
    { id: 'topology', label: 'Topology Map', icon: Network },
    { id: 'alarms', label: 'Alarms & Events', icon: AlertOctagon },
    { id: 'config', label: 'Config Compare', icon: FileDiff },
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 border-r border-slate-800 transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}>
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-slate-800 flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/30">
              <Share2 className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">SDI Manager</h1>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as any);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === item.id 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-800">
             <div className="bg-slate-800/50 rounded-lg p-4 mb-4 border border-slate-700">
                <p className="text-xs text-slate-400 mb-2">Authenticated as</p>
                <div className="flex items-center gap-2 mb-3">
                   <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                   <span className="text-sm font-semibold text-white">{currentUser}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <button 
                        onClick={() => { setShowPasswordModal(true); setPwdMsg({type:'',text:''}); }}
                        className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1.5 rounded text-slate-200 transition-colors flex items-center justify-center gap-1"
                    >
                        <Lock size={12}/> Password
                    </button>
                    <button 
                        onClick={() => setIsAuthenticated(false)} 
                        className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 px-2 py-1.5 rounded transition-colors"
                    >
                        Sign Out
                    </button>
                </div>
             </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <header className="h-16 bg-slate-900/50 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-slate-400 hover:text-white"
            >
              <Menu />
            </button>
            <h2 className="text-lg font-semibold text-white capitalize">{activeTab.replace('-', ' ')}</h2>
          </div>

          <div className="flex items-center gap-3">
             <button 
                onClick={handleManualFetch}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-medium rounded-lg transition-colors shadow-sm"
             >
                {loading ? 'Executing NETCONF...' : 'Fetch Data'}
             </button>

             <button 
                onClick={handleDownload}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" 
                title="Download JSON Snapshot"
             >
                <Download size={20} />
             </button>
          </div>
        </header>

        {/* Viewport */}
        <div className="flex-1 overflow-y-auto p-6 scroll-smooth relative">
          {activeTab === 'dashboard' && (
            <Dashboard 
              devices={devices} 
              alarms={alarms} 
              onNavigate={handleNavigate}
            />
          )}
          
          {/* New Device Manager Routes with Filtering */}
          {activeTab === 'devices' && (
            <DeviceManager />
          )}
          {activeTab === 'compute' && (
            <DeviceManager filterCategory="COMPUTE" />
          )}
          {activeTab === 'network' && (
            <DeviceManager filterCategory="NETWORK" />
          )}
          
          {activeTab === 'topology' && (
            <TopologyGraph 
                nodes={devices} 
                links={links} 
                onRefresh={fetchData} 
                onNodeClick={handleNodeClick}
            />
          )}
          {activeTab === 'alarms' && <AlarmTable alarms={alarms} onClearAlarm={handleClearAlarm} />}
          {activeTab === 'config' && <ConfigCompare />}
        </div>
        
        {/* Node Details Slide-over */}
        <NodeDetailsPanel 
            device={selectedDevice} 
            links={links} 
            onClose={() => setSelectedDevice(null)} 
        />

        {/* Change Password Modal */}
        {showPasswordModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm p-6 shadow-2xl relative">
                    <button 
                        onClick={() => setShowPasswordModal(false)}
                        className="absolute top-4 right-4 text-slate-400 hover:text-white"
                    >
                        <X size={20}/>
                    </button>
                    <h3 className="text-lg font-bold text-white mb-4">Change Password</h3>
                    <form onSubmit={handlePasswordChange} className="space-y-4">
                        <div>
                            <label className="text-xs text-slate-400 uppercase font-semibold">Old Password</label>
                            <input 
                                type="password" 
                                required
                                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white mt-1 focus:border-blue-500 outline-none"
                                value={pwdForm.old}
                                onChange={e => setPwdForm({...pwdForm, old: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 uppercase font-semibold">New Password</label>
                            <input 
                                type="password" 
                                required
                                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white mt-1 focus:border-blue-500 outline-none"
                                value={pwdForm.new}
                                onChange={e => setPwdForm({...pwdForm, new: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 uppercase font-semibold">Confirm New Password</label>
                            <input 
                                type="password" 
                                required
                                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white mt-1 focus:border-blue-500 outline-none"
                                value={pwdForm.confirm}
                                onChange={e => setPwdForm({...pwdForm, confirm: e.target.value})}
                            />
                        </div>
                        
                        {pwdMsg.text && (
                            <div className={`text-xs p-2 rounded ${pwdMsg.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                {pwdMsg.text}
                            </div>
                        )}

                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded transition-colors">
                            Update Password
                        </button>
                    </form>
                </div>
            </div>
        )}
      </main>
    </div>
  );
};

export default App;
