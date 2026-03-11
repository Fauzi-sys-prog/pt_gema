import React from 'react';
import { FileText, Download, CheckCircle, Printer } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useApp } from '../../contexts/AppContext';

interface BeritaAcaraGeneratorProps {
  project: any;
}

export const BeritaAcaraGenerator: React.FC<BeritaAcaraGeneratorProps> = ({ project }) => {
  const { addBeritaAcara, currentUser } = useApp();

  const buildDocNo = (type: string) => {
    const code = type === 'Serah Terima' ? 'BAST' : 'BAOPN';
    const y = new Date().getFullYear();
    return `${code}/GTP/${y}/${String(Date.now()).slice(-4)}`;
  };

  const handleGenerateBA = (type: string) => {
    const noBA = buildDocNo(type);
    const today = new Date().toISOString().split('T')[0];
    addBeritaAcara({
      id: `BA-${Date.now()}`,
      noBA,
      tanggal: today,
      jenisBA: type === 'Serah Terima' ? 'Penerimaan Pekerjaan' : 'Inspeksi',
      pihakPertama: 'PT Gema Teknik Perkasa',
      pihakKedua: project?.customer || '-',
      lokasi: project?.quotationSnapshot?.lokasi || project?.location || '-',
      contentHTML: `<p>Berita Acara ${type} untuk project ${project?.namaProject || '-'}</p>`,
      projectId: project?.id,
      projectName: project?.namaProject || '-',
      status: 'Draft',
      createdBy: currentUser?.username || 'system',
      createdAt: new Date().toISOString(),
    });
    toast.success(`Berita Acara ${type} dibuat`, {
      description: `No BA: ${noBA}`,
    });
  };

  return (
    <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden group shadow-2xl">
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-blue-600/20 transition-all duration-700"></div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 rotate-3 group-hover:rotate-0 transition-transform">
            <FileText size={28} />
          </div>
          <div>
            <h3 className="text-2xl font-black italic uppercase tracking-tighter">Document Automator</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Official Project Documentation Engine</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button 
            onClick={() => handleGenerateBA('Serah Terima')}
            className="p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-all text-left flex items-start gap-4 group/btn"
          >
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl group-hover/btn:scale-110 transition-transform">
              <CheckCircle size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Berita Acara</p>
              <h4 className="text-sm font-black uppercase italic tracking-tighter">Serah Terima Pekerjaan (BAST)</h4>
              <p className="text-[9px] text-slate-500 mt-2 font-bold uppercase tracking-tight">Generate BAST otomatis berdasarkan progress 100%</p>
            </div>
          </button>

          <button 
            onClick={() => handleGenerateBA('Kemajuan Pekerjaan')}
            className="p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-all text-left flex items-start gap-4 group/btn"
          >
            <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl group-hover/btn:scale-110 transition-transform">
               <Printer size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Berita Acara</p>
              <h4 className="text-sm font-black uppercase italic tracking-tighter">Kemajuan Pekerjaan (Opname)</h4>
              <p className="text-[9px] text-slate-500 mt-2 font-bold uppercase tracking-tight">Generate BA Opname berdasarkan progress {project.progress}%</p>
            </div>
          </button>
        </div>

        <div className="mt-8 flex justify-center">
           <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
              <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
              Powered by GTP DocEngine v2.0
              <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
           </p>
        </div>
      </div>
    </div>
  );
};
