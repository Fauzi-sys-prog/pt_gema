import React from 'react';
import { CheckCircle2, Circle, Clock, AlertCircle, Truck, Wrench, Zap, FileText, ShoppingCart, CheckCircle } from 'lucide-react'; import type { Project, WorkOrder } from '../../contexts/AppContext';

interface TimelineTrackerProps {
  project: Project;
  workOrders: WorkOrder[];
}

export function TimelineTracker({ project, workOrders }: TimelineTrackerProps) {
  const stages = [
    { 
      id: 'quotation', 
      label: 'Quotation', 
      icon: FileText, 
      status: project.quotationId ? 'completed' : 'pending',
      date: project.startDate // Simplified
    },
    { 
      id: 'spk', 
      label: 'SPK/PO', 
      icon: Zap, 
      status: project.spkList && project.spkList.length > 0 ? 'completed' : 'pending',
      date: project.spkList?.[0]?.tanggal 
    },
    { 
      id: 'production', 
      label: 'Workshop', 
      icon: Wrench, 
      status: project.progress > 0 ? (project.progress >= 100 ? 'completed' : 'in-progress') : 'pending',
      progress: project.progress,
      details: `${workOrders.filter(wo => wo.status === 'Completed').length}/${workOrders.length} WO Done`
    },
    { 
      id: 'qc', 
      label: 'Quality Control', 
      icon: CheckCircle, 
      status: workOrders.length > 0 && workOrders.every(wo => wo.status === 'Completed' || wo.status === 'QC') ? 'completed' : 'pending' 
    },
    { 
      id: 'delivery', 
      label: 'Delivery/SJ', 
      icon: Truck, 
      status: project.status === 'Completed' ? 'completed' : 'pending' 
    }
  ];

  return (
    <div className="py-8 px-4">
      <div className="relative">
        {/* Progress Line */}
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -translate-y-1/2 z-0"></div>
        
        <div className="flex justify-between items-center relative z-10">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            const isCompleted = stage.status === 'completed';
            const isInProgress = stage.status === 'in-progress';
            
            return (
              <div key={stage.id} className="flex flex-col items-center group">
                <div 
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 border-2 ${
                    isCompleted 
                      ? 'bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-200' 
                      : isInProgress
                        ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-100 animate-pulse'
                        : 'bg-white border-slate-200 text-slate-400'
                  }`}
                >
                  <Icon size={20} />
                </div>
                
                <div className="mt-4 text-center">
                  <p className={`text-[10px] font-black uppercase tracking-widest ${
                    isCompleted ? 'text-slate-900' : isInProgress ? 'text-blue-600' : 'text-slate-400'
                  }`}>
                    {stage.label}
                  </p>
                  {stage.date && (
                    <p className="text-[8px] font-bold text-slate-400 mt-0.5">{stage.date}</p>
                  )}
                  {stage.progress !== undefined && stage.progress > 0 && stage.progress < 100 && (
                    <div className="mt-2 w-16 h-1 bg-slate-100 rounded-full overflow-hidden mx-auto">
                      <div 
                        className="h-full bg-blue-600" 
                        style={{ width: `${stage.progress}%` }}
                      ></div>
                    </div>
                  )}
                  {stage.details && (
                    <p className="text-[8px] font-black text-blue-500 uppercase mt-1">{stage.details}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Tracker Legend / Info */}
      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center gap-4">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-900 border border-slate-200 shadow-sm">
             <Clock size={20} />
          </div>
          <div>
            <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Auto-Sync Engine</h4>
            <p className="text-[9px] text-slate-500 font-bold uppercase">Status is automatically linked to Work Order finish signals & LHP entries.</p>
          </div>
        </div>
        
        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 flex items-center gap-4">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 border border-blue-200 shadow-sm">
             <AlertCircle size={20} />
          </div>
          <div>
            <h4 className="text-[10px] font-black text-blue-900 uppercase tracking-widest">Conflict Awareness</h4>
            <p className="text-[9px] text-blue-700/70 font-bold uppercase">System monitors discrepancies between Production Output and BOQ targets.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
