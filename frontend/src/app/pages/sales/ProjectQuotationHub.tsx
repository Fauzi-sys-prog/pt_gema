import {
  Calculator,
  FileText,
  TrendingUp,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import PenawaranPage from './PenawaranPage';
import { motion } from 'motion/react';

export default function ProjectQuotationHub() {

  return (
    <div className="space-y-8 animate-in fade-in duration-700 p-6 bg-slate-50 min-h-screen">
      {/* Premium Hub Header */}
      <div className="bg-white p-10 rounded-[3.5rem] border-2 border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-50 rounded-full -mr-32 -mt-32 opacity-30" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative z-10">
          <div className="flex items-center gap-8">
            <div className="w-20 h-20 bg-slate-900 rounded-[2rem] flex items-center justify-center text-white shadow-2xl rotate-3">
              <Calculator size={40} />
            </div>
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Project Quotation Hub</h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.3em] italic">PT GTP Unified Sales & Engineering Center</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-5 py-3 bg-blue-50 rounded-2xl border border-blue-100">
            <FileText size={16} className="text-blue-600" />
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">Commercial View</span>
          </div>
        </div>
      </div>

      {/* Integration Info Banner - Matching Figma Image 3 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-blue-600 p-8 rounded-[3rem] text-white shadow-2xl shadow-blue-200 flex items-center gap-8 group hover:scale-[1.02] transition-transform">
          <div className="w-16 h-16 bg-white/20 rounded-[1.5rem] flex items-center justify-center shadow-lg">
            <Zap size={32} />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase opacity-60 tracking-[0.2em] leading-tight mb-1">Synced Data</p>
            <p className="text-lg font-black uppercase italic tracking-tight">Real-time Pipeline Sync</p>
          </div>
        </div>
        <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl shadow-slate-300 flex items-center gap-8 group hover:scale-[1.02] transition-transform">
          <div className="w-16 h-16 bg-white/10 rounded-[1.5rem] flex items-center justify-center shadow-lg">
            <ShieldCheck size={32} className="text-indigo-400" />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase opacity-60 tracking-[0.2em] leading-tight mb-1">Compliance</p>
            <p className="text-lg font-black uppercase italic tracking-tight">Multi-level Approval Active</p>
          </div>
        </div>
        <div className="bg-emerald-500 p-8 rounded-[3rem] text-white shadow-2xl shadow-emerald-200 flex items-center gap-8 group hover:scale-[1.02] transition-transform">
          <div className="w-16 h-16 bg-white/20 rounded-[1.5rem] flex items-center justify-center shadow-lg">
            <TrendingUp size={32} />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase opacity-60 tracking-[0.2em] leading-tight mb-1">Performance</p>
            <p className="text-lg font-black uppercase italic tracking-tight">94% Conversion Rate</p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <PenawaranPage />
        </motion.div>
      </div>
    </div>
  );
}
