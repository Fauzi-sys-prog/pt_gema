/**
 * Quotation to Project Stats Component
 * Menampilkan statistik konversi dari Quotation ke Project
 */

import { useApp } from '../../contexts/AppContext';

import { TrendingUp, CheckCircle, FileText, Briefcase, Layers } from 'lucide-react';

export function QuotationToProjectStats() {
  const { quotationList, projectList } = useApp();
  const toWorkflowStatus = (value: unknown): 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED' => {
    const status = String(value || "").trim().toUpperCase();
    if (status === 'SENT') return 'SENT';
    if (status === 'APPROVED') return 'APPROVED';
    if (status === 'REJECTED') return 'REJECTED';
    return 'DRAFT';
  };

  // Calculate statistics
  const totalQuotations = quotationList.length;
  const draftQuotations = quotationList.filter(q => toWorkflowStatus(q.status) === 'DRAFT').length;
  const sentQuotations = quotationList.filter(q => toWorkflowStatus(q.status) === 'SENT').length;
  const approvedQuotations = quotationList.filter(q => toWorkflowStatus(q.status) === 'APPROVED').length;
  const rejectedQuotations = quotationList.filter(q => toWorkflowStatus(q.status) === 'REJECTED').length;
  
  const projectsFromQuotations = projectList.filter(p => p.quotationId).length;
  const syncRate = totalQuotations > 0 
    ? Math.round((projectsFromQuotations / totalQuotations) * 100) 
    : 0;

  // Calculate total value
  const totalQuotationValue = quotationList.reduce((sum, q) => {
      const materials = q.materials?.reduce((s, m) => s + (m.totalPrice || 0), 0) || 0;
      const manpower = q.manpower?.reduce((s, m) => s + (m.totalCost || 0), 0) || 0;
      const consumables = q.consumables?.reduce((s, c) => s + (c.totalCost || 0), 0) || 0;
      const equipment = q.equipment?.reduce((s, e) => s + (e.totalCost || 0), 0) || 0;
      const subtotal = materials + manpower + consumables + equipment;
      const ppnAmount = subtotal * (q.ppn / 100);
      return sum + subtotal + ppnAmount;
    }, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg p-6 text-white shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-white/20 rounded-lg">
          <Layers size={24} />
        </div>
        <div>
          <h3 className="text-xl font-bold">Quotation ⇄ Project Auto-Sync</h3>
          <p className="text-blue-100 text-sm">All quotations automatically become projects</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Total Quotations */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={18} className="text-blue-200" />
            <div className="text-xs text-blue-200">Total Quotations</div>
          </div>
          <div className="text-2xl font-bold">{totalQuotations}</div>
          <div className="text-xs text-blue-200 mt-1">
            Draft: {draftQuotations} • Sent: {sentQuotations}
          </div>
        </div>

        {/* Approved Quotations */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={18} className="text-green-300" />
            <div className="text-xs text-blue-200">Approved</div>
          </div>
          <div className="text-2xl font-bold text-green-300">{approvedQuotations}</div>
          <div className="text-xs text-blue-200 mt-1">
            Rejected: {rejectedQuotations}
          </div>
        </div>

        {/* Projects Synced */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase size={18} className="text-amber-300" />
            <div className="text-xs text-blue-200">Projects Synced</div>
          </div>
          <div className="text-2xl font-bold text-amber-300">{projectsFromQuotations}</div>
          <div className="text-xs text-blue-200 mt-1">
            Auto-created
          </div>
        </div>

        {/* Sync Rate */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={18} className="text-purple-300" />
            <div className="text-xs text-blue-200">Sync Rate</div>
          </div>
          <div className="text-2xl font-bold text-purple-300">{syncRate}%</div>
          <div className="text-xs text-blue-200 mt-1">
            Real-time
          </div>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="mb-6">
        <div className="text-sm text-blue-200 mb-3">Quotation Status Breakdown</div>
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-gray-500/30 rounded p-2 text-center">
            <div className="text-xs text-blue-200">Draft</div>
            <div className="text-lg font-bold">{draftQuotations}</div>
          </div>
          <div className="bg-blue-500/30 rounded p-2 text-center">
            <div className="text-xs text-blue-200">Sent</div>
            <div className="text-lg font-bold">{sentQuotations}</div>
          </div>
          <div className="bg-green-500/30 rounded p-2 text-center">
            <div className="text-xs text-blue-200">Approved</div>
            <div className="text-lg font-bold">{approvedQuotations}</div>
          </div>
          <div className="bg-red-500/30 rounded p-2 text-center">
            <div className="text-xs text-blue-200">Rejected</div>
            <div className="text-lg font-bold">{rejectedQuotations}</div>
          </div>
        </div>
      </div>

      {/* Total Value */}
      <div className="pt-6 border-t border-white/20">
        <div className="text-blue-200 text-sm mb-1">Total Quotation Value (All Status)</div>
        <div className="text-3xl font-bold">{formatCurrency(totalQuotationValue)}</div>
      </div>

      {/* Quick Info */}
      <div className="mt-4 p-3 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
        <div className="text-xs text-blue-100">
          ⚡ <span className="font-semibold">Auto-Sync:</span> Every quotation (Draft, Sent, Approved, Rejected) 
          automatically creates/updates a project. No manual action needed!
        </div>
      </div>
    </div>
  );
}
