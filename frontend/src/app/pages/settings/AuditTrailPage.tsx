import { useState, useMemo } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  Download, 
  Shield, 
  Clock, 
  User, 
  Database, 
  Activity,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ChevronRight,
  ArrowUpRight
} from 'lucide-react';
import { useApp, type AuditLog } from '../../contexts/AppContext';
import { motion } from 'motion/react';

export default function AuditTrailPage() {
  const { auditLogs } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const matchSearch = 
        log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchModule = moduleFilter === 'all' || log.module === moduleFilter;
      const matchStatus = statusFilter === 'all' || log.status === statusFilter;
      
      return matchSearch && matchModule && matchStatus;
    });
  }, [auditLogs, searchTerm, moduleFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: auditLogs.length,
    today: auditLogs.filter(l => new Date(l.timestamp).toDateString() === new Date().toDateString()).length,
    security: auditLogs.filter(l => l.module === 'Security').length,
    warnings: auditLogs.filter(l => l.status === 'Warning').length
  }), [auditLogs]);

  const modules = Array.from(new Set(auditLogs.map(l => l.module)));

  return (
    <div className="p-8 space-y-8 bg-[#F8FAFC] min-h-screen">
      {/* Executive Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
           <div className="w-20 h-20 bg-slate-900 text-white rounded-[2.5rem] flex items-center justify-center shadow-2xl rotate-3">
              <Shield size={40} />
           </div>
           <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">System Audit Trail</h1>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1 italic">Enterprise Governance & Compliance Ledger</p>
           </div>
        </div>
        <div className="flex gap-3">
           <button className="px-8 py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 shadow-sm flex items-center gap-2">
              <Download size={16} /> Export Forensic Log
           </button>
        </div>
      </div>

      {/* Security Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         {[
           { label: 'Total Events', val: stats.total, color: 'text-slate-900', icon: <Database size={20} /> },
           { label: 'Today Records', val: stats.today, color: 'text-blue-600', icon: <Activity size={20} /> },
           { label: 'Security Alerts', val: stats.security, color: 'text-indigo-600', icon: <Lock size={20} /> },
           { label: 'Anomalies', val: stats.warnings, color: 'text-rose-600', icon: <AlertTriangle size={20} /> },
         ].map((stat, i) => (
           <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm transition-all hover:translate-y-[-4px]">
              <div className="flex items-center justify-between mb-4">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                 <div className={`${stat.color} opacity-30`}>{stat.icon}</div>
              </div>
              <h3 className={`text-3xl font-black italic ${stat.color}`}>{stat.val}</h3>
           </div>
         ))}
      </div>

      {/* Audit Engine Container */}
      <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-sm overflow-hidden">
         <div className="p-10 border-b border-slate-50 bg-slate-50/30 flex flex-wrap items-center justify-between gap-6">
            <div className="relative flex-1 max-w-xl">
               <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={24} />
               <input 
                 type="text" 
                 placeholder="Search user, action, or digital trace..." 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="w-full pl-16 pr-8 py-5 bg-white border-none rounded-2xl text-sm font-bold uppercase italic outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-sm"
               />
            </div>
            <div className="flex gap-4">
               <select 
                 value={moduleFilter}
                 onChange={(e) => setModuleFilter(e.target.value)}
                 className="px-6 py-4 bg-white rounded-xl text-[10px] font-black uppercase tracking-widest outline-none border border-slate-100 shadow-sm"
               >
                  <option value="all">All Modules</option>
                  {modules.map(m => <option key={m} value={m}>{m}</option>)}
               </select>
               <select 
                 value={statusFilter}
                 onChange={(e) => setStatusFilter(e.target.value)}
                 className="px-6 py-4 bg-white rounded-xl text-[10px] font-black uppercase tracking-widest outline-none border border-slate-100 shadow-sm"
               >
                  <option value="all">All Status</option>
                  <option value="Success">Success</option>
                  <option value="Warning">Warning</option>
                  <option value="Failed">Failed</option>
               </select>
            </div>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="bg-slate-900 text-white">
                     <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest italic">Digital Trace ID</th>
                     <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest italic">Authority (User)</th>
                     <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest italic">Command Action</th>
                     <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest italic">System Impact / Details</th>
                     <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest italic text-center">Status</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-all group">
                       <td className="px-10 py-8">
                          <div className="flex flex-col">
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{log.id}</span>
                             <span className="text-[10px] text-indigo-600 font-bold uppercase mt-1 italic flex items-center gap-1">
                                <Clock size={10} /> {new Date(log.timestamp).toLocaleString('id-ID')}
                             </span>
                          </div>
                       </td>
                       <td className="px-10 py-8">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-black italic">
                                {log.userName.charAt(0)}
                             </div>
                             <div>
                                <p className="text-sm font-black text-slate-900 uppercase italic tracking-tight">{log.userName}</p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase">UID: {log.userId}</p>
                             </div>
                          </div>
                       </td>
                       <td className="px-10 py-8">
                          <div className="flex items-center gap-2">
                             <span className="px-3 py-1 bg-slate-100 rounded-lg text-[9px] font-black uppercase italic text-slate-500">{log.module}</span>
                             <span className="text-sm font-black text-slate-700 uppercase italic tracking-tight">{log.action}</span>
                          </div>
                       </td>
                       <td className="px-10 py-8">
                          <p className="text-sm font-bold text-slate-500 uppercase italic line-clamp-1 max-w-xs group-hover:line-clamp-none transition-all">{log.details}</p>
                       </td>
                       <td className="px-10 py-8 text-center">
                          <span className={`inline-flex px-4 py-1.5 rounded-full text-[9px] font-black uppercase italic border-2 ${
                             log.status === 'Success' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                             log.status === 'Warning' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                             'bg-rose-50 text-rose-600 border-rose-100'
                          }`}>
                             {log.status}
                          </span>
                       </td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr>
                       <td colSpan={5} className="px-10 py-20 text-center">
                          <div className="flex flex-col items-center opacity-30">
                             <History size={64} className="mb-4" />
                             <p className="text-sm font-black uppercase tracking-widest italic">Forensic records empty or filtered</p>
                          </div>
                       </td>
                    </tr>
                  )}
               </tbody>
            </table>
         </div>

         <div className="p-10 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] italic flex items-center gap-2">
               <Shield size={14} className="text-emerald-500" /> Tamper-Proof Audit System Active v4.0
            </p>
            <div className="flex gap-4">
               <button className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-all">Clear Session Logs</button>
            </div>
         </div>
      </div>
    </div>
  );
}
