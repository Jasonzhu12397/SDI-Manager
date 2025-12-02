import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Network, AlertOctagon, FileDiff, Download, Menu, Share2, Settings, Lock, X, Server, Switch, RefreshCw, LogOut, User } from 'lucide-react';
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
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('sdi_auth_token') === 'true';
  });
  const [currentUser, setCurrentUser] = useState(() => {
    return localStorage.getItem('sdi_user') || 'admin';
  });

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
    if (data && data.nodes) {
        setDevices(data.nodes);
        setLinks(data.links || []);
        setAlarms(data.alarms || []);
    }
    setLoading(false);
  };

  const handleManualFetch = async () => {
    setLoading(true);
    await api.triggerFetch();
    // Wait a moment for backend to process fetch then reload UI
    setTimeout(() => {
        fetchData();
    }, 2000);
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
    localStorage.setItem('sdi_auth_token', 'true');
    localStorage.setItem('sdi_user', user);
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('sdi_auth_token');
    localStorage.removeItem('sdi_user');
    setIsAuthenticated(false);
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

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'compute', label: 'Compute Nodes', icon: Server },
    { id: 'network', label: 'Network Devices', icon: Switch },
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
        lg:relative lg:translate-x-0 flex flex-col
      `}>
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/30">
            <Share2 className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">SDI Manager</h1>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
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

        {/* User Profile & Logout Section */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
           <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 border border-slate-600">
                    <User size={16} />
                 </div>
                 <div className="flex flex-col">
                    <span className="text-sm font-semibold text-white">{currentUser}</span>
                    <span className="text-[10px] text-slate-400 uppercase">Administrator</span>
                 </div>
              </div>
              <button 
                  onClick={() => { setShowPasswordModal(true); setPwdMsg({type:'',text:''}); }}
                  className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-700 rounded-full transition-colors"
                  title="Change Password"
              >
                  <Lock size={14} />
              </button>
           </div>
           
           <button 
              onClick={handleLogout} 
              className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 px-4 py-2 rounded-lg transition-all duration-200 font-medium text-sm group"
           >
              <LogOut size={16} className="group-hover:-translate-x-0.5 transition-transform"/>
              Sign Out
           </button>
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
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-medium rounded-lg transition-colors shadow-sm min-w-[120px] justify-center"
             >
                {loading ? (
                   <>
                     <RefreshCw size={16} className="animate-spin"/>
                     Syncing...
                   </>
                ) : (
                   'Sync Data'
                )}
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
          
          {/* Device Manager Routes */}
          {activeTab === 'devices' && <DeviceManager />}
          {activeTab === 'compute' && <DeviceManager filterCategory="COMPUTE" />}
          {activeTab === 'network' && <DeviceManager filterCategory="NETWORK" />}
          
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
