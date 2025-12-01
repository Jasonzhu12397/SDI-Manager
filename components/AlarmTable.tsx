import React from 'react';
import { Alarm, AlarmSeverity } from '../types';
import { AlertCircle, AlertTriangle, Info, Bell, Trash2, CheckCircle } from 'lucide-react';

interface AlarmTableProps {
  alarms: Alarm[];
  onClearAlarm?: (id: string) => void;
}

const AlarmTable: React.FC<AlarmTableProps> = ({ alarms, onClearAlarm }) => {
  
  const getSeverityBadge = (severity: AlarmSeverity) => {
    switch (severity) {
      case AlarmSeverity.CRITICAL:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20"><AlertCircle size={12}/> Critical</span>;
      case AlarmSeverity.MAJOR:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-500/10 text-orange-500 border border-orange-500/20"><AlertTriangle size={12}/> Major</span>;
      case AlarmSeverity.MINOR:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"><Bell size={12}/> Minor</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20"><Info size={12}/> Warning</span>;
    }
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg animate-fade-in">
      <div className="p-4 border-b border-slate-700 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">Active Alarms</h3>
        <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded">{alarms.length} Total</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-900/50 text-xs uppercase text-slate-400 font-semibold">
            <tr>
              <th className="px-6 py-4">Severity</th>
              <th className="px-6 py-4">Device</th>
              <th className="px-6 py-4">Message</th>
              <th className="px-6 py-4">Time</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {alarms.map((alarm) => (
              <tr key={alarm.id} className="hover:bg-slate-700/30 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">{getSeverityBadge(alarm.severity)}</td>
                <td className="px-6 py-4 font-medium text-white">{alarm.deviceName} <span className="text-slate-500 text-xs block">{alarm.deviceId}</span></td>
                <td className="px-6 py-4">{alarm.message}</td>
                <td className="px-6 py-4 text-slate-400 whitespace-nowrap">{alarm.timestamp}</td>
                <td className="px-6 py-4 text-right">
                  {onClearAlarm && (
                      <button 
                        onClick={() => onClearAlarm(alarm.id)}
                        className="text-slate-400 hover:text-red-400 p-2 hover:bg-slate-700 rounded-full transition-colors flex items-center gap-1 ml-auto"
                        title="Dismiss Alarm"
                      >
                        <Trash2 size={16} />
                        <span className="text-xs hidden md:inline">Dismiss</span>
                      </button>
                  )}
                </td>
              </tr>
            ))}
            {alarms.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle className="w-8 h-8 text-emerald-500/50" />
                    <p>No active alarms. System healthy.</p>
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

export default AlarmTable;
