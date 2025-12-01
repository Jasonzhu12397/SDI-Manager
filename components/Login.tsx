import React, { useState } from 'react';
import { Lock, User, ShieldCheck, UserPlus, ArrowLeft, WifiOff } from 'lucide-react';
import { api } from '../services/apiService';

interface LoginProps {
  onLogin: (username: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    if (isRegistering) {
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            setLoading(false);
            return;
        }
        const res = await api.register(username, password);
        if (res.success) {
            setSuccessMsg("Registration successful! Please sign in.");
            setIsRegistering(false);
            setPassword('');
            setConfirmPassword('');
        } else {
            setError(res.message || "Registration failed");
        }
    } else {
        const res = await api.login(username, password);
        if (res.success) {
            onLogin(username);
        } else {
            setError(res.error || 'Invalid username or password');
        }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-600/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-600/20 rounded-full blur-3xl"></div>

        <div className="relative z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-900/50">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">SDI Manager</h1>
            <p className="text-slate-400 text-sm">{isRegistering ? 'Create Administrator Account' : 'Secure Network Controller'}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="admin"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="•••••"
                />
              </div>
            </div>

            {isRegistering && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="•••••"
                    />
                  </div>
                </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm justify-center bg-red-400/10 py-3 rounded-lg border border-red-400/20 animate-pulse">
                {error.includes('Connection') ? <WifiOff size={16}/> : null}
                {error}
              </div>
            )}
            
            {successMsg && (
              <div className="text-emerald-400 text-sm text-center bg-emerald-400/10 py-2 rounded-lg border border-emerald-400/20">
                {successMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg shadow-lg shadow-blue-900/30 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : isRegistering ? 'Register Account' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            {!isRegistering ? (
                <button 
                    onClick={() => { setIsRegistering(true); setError(''); setSuccessMsg(''); }}
                    className="text-slate-400 hover:text-white text-sm flex items-center justify-center gap-2 mx-auto transition-colors"
                >
                    <UserPlus size={16} /> Create new account
                </button>
            ) : (
                <button 
                    onClick={() => { setIsRegistering(false); setError(''); setSuccessMsg(''); }}
                    className="text-slate-400 hover:text-white text-sm flex items-center justify-center gap-2 mx-auto transition-colors"
                >
                    <ArrowLeft size={16} /> Back to Sign In
                </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;