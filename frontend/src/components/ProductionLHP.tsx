import React from 'react';
import { 
  ClipboardCheck, 
  User, 
  Clock, 
  PlayCircle, 
  CheckCircle2, 
  AlertCircle,
  Plus,
  LayoutGrid,
  FileText
} from 'lucide-react';

const lhpData = [
  { 
    id: 1, 
    worker: 'Soleh', 
    machine: '3', 
    tasks: [
      { time: '08:00 - 11:00', task: 'Manual Bending Anchor SS 310', qty: 450, unit: 'Pcs', status: 'Selesai' },
      { time: '11:00 - 14:00', task: 'Istirahat / Lainnya', qty: '-', unit: '', status: '-' },
      { time: '14:00 - 15:30', task: 'Packing Anchor', qty: 150, unit: 'Pcs', status: 'Selesai' },
      { time: '15:30 - 17:00', task: 'Manual Bending', qty: '-', unit: 'Pcs', status: 'Progress' }
    ]
  },
  { 
    id: 2, 
    worker: 'Deni', 
    machine: '-', 
    tasks: [
      { time: '08:00 - 15:00', task: '2x Roll Bend Anc Clip Ty.BM Dia. 12x120/163mm SUS 310', qty: 610, unit: 'Pcs', status: 'Selesai' },
      { time: '15:00 - 16:00', task: 'Inserting cap Anc', qty: '-', unit: '-', status: 'Progress' },
      { time: '16:00 - 22:00', task: 'Repair Anc clip yang lecet dan bengkok', qty: '-', unit: '-', status: 'Progress' }
    ]
  },
  { 
    id: 3, 
    worker: 'Niri', 
    machine: '-', 
    tasks: [
      { time: '08:00 - 09:00', task: 'Cleaning, Demob tools pelita', qty: '-', unit: '-', status: 'Selesai' },
      { time: '10:00 - 14:00', task: 'Cutting as 12mm for Anc Clip Ty.BM Dia.12x120/163mm SUS 310', qty: 160, unit: 'Pcs', status: 'Selesai' },
      { time: '14:00 - 16:00', task: 'Cutting as 10mm for Anc Y spiral Dia.10x270mm SUS 310', qty: 324, unit: 'Pcs', status: 'Selesai' },
      { time: '16:00 - 22:00', task: 'Cutting as 8mm for Anc V claw Dia.8x50mm SUS 310', qty: 124, unit: 'Pcs', status: 'Selesai' },
      { time: '16:00 - 22:00', task: 'Roll Bend as 10mm for Anc Y spiral Dia.10x270mm SUS 310', qty: 324, unit: 'Pcs', status: 'Selesai' },
      { time: '16:00 - 22:00', task: 'Packing Anchor', qty: 324, unit: 'Pcs', status: 'Selesai' }
    ]
  },
  { 
    id: 4, 
    worker: 'Sarji', 
    machine: '-', 
    tasks: [
      { time: '08:00 - 11:00', task: 'Grinding as 12mm for Anc Clip Ty.BM Dia. 12x120/163mm SUS 310', qty: 160, unit: 'Pcs', status: 'Selesai' },
      { time: '11:00 - 12:00', task: 'Press Anc V claw Dia.8x50mm SUS 310', qty: 128, unit: 'Pcs', status: 'Selesai' },
      { time: '13:00 - 16:00', task: 'Press Anc Y spiral Dia.10x270mm SUS 310', qty: 324, unit: 'Pcs', status: 'Selesai' },
      { time: '19:00 - 22:00', task: 'Press Anc V claw Dia.8x50mm SUS 310 & Cleaning', qty: 128, unit: 'Pcs', status: 'Selesai' }
    ]
  }
];

const progressTracker = [
  { 
    item: 'Anc Clip Ty.BM Dia. 12x120/163mm SUS 310', 
    target: 860,
    steps: [
      { process: 'Cutting', qty: 860, status: 'Selesai' },
      { process: 'Grind', qty: 860, status: 'Selesai' },
      { process: 'Roll Bend', qty: 860, status: 'Selesai' },
      { process: 'Press 1', qty: 860, status: 'Progress' },
      { process: 'Packing', qty: 860, status: 'Progress' }
    ]
  },
  { 
    item: 'Anc Y Spiral Dia. 10x270mm SUS 310', 
    target: 324,
    steps: [
      { process: 'Cutting', qty: 324, status: 'Selesai' },
      { process: 'Grind', qty: 324, status: 'Selesai' },
      { process: 'Roll Bend', qty: 324, status: 'Selesai' },
      { process: 'Press 1', qty: 324, status: 'Selesai' },
      { process: 'Packing', qty: 324, status: 'Selesai' }
    ]
  },
  { 
    item: 'Anc V claw Dia. 8x50mm SUS 310', 
    target: 128,
    steps: [
      { process: 'Cutting', qty: 128, status: 'Selesai' },
      { process: 'Grind', qty: 128, status: 'Selesai' },
      { process: 'Roll Bend', qty: 128, status: 'Selesai' },
      { process: 'Press 1', qty: 128, status: 'Selesai' },
      { process: 'Packing', qty: 128, status: 'Selesai' }
    ]
  }
];

export const ProductionLHP = () => {
  return (
    <div className="space-y-8">
      {/* Header Info */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">LHP</div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">LAPORAN HARIAN PRODUKSI</h1>
            <p className="text-sm text-slate-500 font-mono">No. Dok: LHP16052024 | Lokasi: Workshop Gema Teknik</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <div className="text-slate-500 font-medium">Hari / Tanggal:</div>
          <div className="font-bold">Thursday, May 16, 2024</div>
          <div className="text-slate-500 font-medium">Shift / Jam Kerja:</div>
          <div className="font-bold">1 / 08:00 - 22:00</div>
          <div className="text-slate-500 font-medium">Customer:</div>
          <div className="font-bold text-red-600">PT. Indoporlen, PT. Shinagawa</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Worker Details Table */}
        <div className="xl:col-span-8 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <User size={18} className="text-red-600" /> Rincian Kegiatan Pekerja
            </h3>
            <button className="text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors border border-red-100">
              + Tambah Pekerjaan
            </button>
          </div>
          
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3 w-16 text-center">No</th>
                  <th className="px-4 py-3">Nama Pekerja / Mesin</th>
                  <th className="px-4 py-3">Kegiatan Pekerjaan</th>
                  <th className="px-4 py-3 w-24 text-center">Jam</th>
                  <th className="px-4 py-3 w-20 text-center">Output</th>
                  <th className="px-4 py-3 w-24 text-center">Status</th>
                </tr>
              </thead>
              {lhpData.map((worker, idx) => (
                <tbody key={worker.id} className="divide-y divide-slate-100 border-b border-slate-100 last:border-0">
                  {worker.tasks.map((task, taskIdx) => (
                    <tr key={`${worker.id}-${taskIdx}`} className="hover:bg-slate-50 transition-colors">
                      {taskIdx === 0 && (
                        <td rowSpan={worker.tasks.length} className="px-4 py-4 text-center font-bold text-slate-400 border-r border-slate-50 align-top">
                          {worker.id}
                        </td>
                      )}
                      {taskIdx === 0 && (
                        <td rowSpan={worker.tasks.length} className="px-4 py-4 border-r border-slate-50 align-top">
                          <p className="font-bold text-slate-900">{worker.worker}</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Mesin: {worker.machine}</p>
                        </td>
                      )}
                      <td className="px-4 py-3 text-slate-700 leading-tight">
                        {task.task}
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-mono text-slate-500 whitespace-nowrap">
                        {task.time}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-slate-900">
                        {task.qty}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          task.status === 'Selesai' ? 'bg-emerald-100 text-emerald-700' :
                          task.status === 'Progress' ? 'bg-orange-100 text-orange-700' :
                          'bg-slate-100 text-slate-400'
                        }`}>
                          {task.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </div>

        {/* Item Progress Tracker */}
        <div className="xl:col-span-4 space-y-4">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 px-2">
            <LayoutGrid size={18} className="text-red-600" /> Item Progress Tracking
          </h3>
          
          <div className="space-y-4">
            {progressTracker.map((item, idx) => (
              <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 leading-tight mb-1">{item.item}</h4>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Target: {item.target} Pcs</span>
                  </div>
                  <div className="p-1.5 bg-slate-50 rounded-lg">
                    <FileText size={14} className="text-slate-400" />
                  </div>
                </div>
                
                <div className="space-y-3">
                  {item.steps.map((step, sIdx) => (
                    <div key={sIdx} className="flex items-center gap-3">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        step.status === 'Selesai' ? 'bg-emerald-500' : 'bg-orange-400 animate-pulse'
                      }`}></div>
                      <div className="flex-1 flex justify-between items-center text-[10px]">
                        <span className="font-bold text-slate-600 uppercase w-20">{step.process}</span>
                        <div className="flex-1 h-1 bg-slate-100 rounded-full mx-2 overflow-hidden">
                          <div className={`h-full ${step.status === 'Selesai' ? 'bg-emerald-500 w-full' : 'bg-orange-400 w-1/2'}`}></div>
                        </div>
                        <span className={`font-mono font-bold ${step.status === 'Selesai' ? 'text-emerald-600' : 'text-orange-600'}`}>
                          {step.status === 'Selesai' ? step.qty : '...'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 pt-4 border-t border-slate-50 flex justify-between items-center">
                  <div className="text-[10px] font-bold text-slate-400">OVERALL PROGRESS</div>
                  <div className="text-xs font-bold text-red-600">75%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
