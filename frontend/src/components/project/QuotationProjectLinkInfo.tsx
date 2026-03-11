/**
 * Quotation to Project Link Info Component
 * Menampilkan informasi linking antara Quotation dan Project
 */

import { useApp } from '../../contexts/AppContext';

import { Link2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

interface QuotationProjectLinkInfoProps {
  quotationId?: string;
  projectId?: string;
}

export function QuotationProjectLinkInfo({ quotationId, projectId }: QuotationProjectLinkInfoProps) {
  const { quotationList, projectList } = useApp();

  if (!quotationId && !projectId) return null;

  // If quotationId is provided, find the linked project
  if (quotationId) {
    const quotation = quotationList.find(q => q.id === quotationId);
    if (!quotation) return null;

    const linkedProject = quotation.projectId 
      ? projectList.find(p => p.id === quotation.projectId)
      : null;

    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            <Link2 className="text-blue-600" size={20} />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-blue-900 mb-1">Quotation Link Info</div>
            <div className="text-sm text-blue-800 mb-2">
              Quotation: <span className="font-mono font-semibold">{quotation.nomorQuotation}</span>
            </div>
            
            {quotation.status === 'Approved' && linkedProject ? (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="text-green-600 flex-shrink-0" size={16} />
                <span className="text-green-800">
                  Project created: <span className="font-mono font-semibold">{linkedProject.kodeProject}</span>
                </span>
                <ArrowRight size={14} className="text-green-600" />
                <span className="text-green-800">{linkedProject.namaProject}</span>
              </div>
            ) : quotation.status === 'Approved' && !linkedProject ? (
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="text-amber-600 flex-shrink-0" size={16} />
                <span className="text-amber-800">
                  Quotation approved but project not found (ID: {quotation.projectId})
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="text-gray-600 flex-shrink-0" size={16} />
                <span className="text-gray-700">
                  Status: <span className="font-semibold">{quotation.status}</span> - Project will be created when approved
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // If projectId is provided, find the linked quotation
  if (projectId) {
    const project = projectList.find(p => p.id === projectId);
    if (!project) return null;

    const linkedQuotation = project.quotationId
      ? quotationList.find(q => q.id === project.quotationId)
      : null;

    if (!linkedQuotation) {
      return (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-gray-400 flex-shrink-0 mt-1" size={20} />
            <div className="text-sm text-gray-600">
              This project was created manually (not from quotation)
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            <Link2 className="text-green-600" size={20} />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-green-900 mb-1">Project Link Info</div>
            <div className="text-sm text-green-800 mb-2">
              Project: <span className="font-mono font-semibold">{project.kodeProject}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="text-green-600 flex-shrink-0" size={16} />
              <span className="text-green-800">
                Created from Quotation: <span className="font-mono font-semibold">{linkedQuotation.nomorQuotation}</span>
              </span>
              <ArrowRight size={14} className="text-green-600" />
              <span className="text-green-800">{linkedQuotation.perihal}</span>
            </div>

            <div className="mt-2 pt-2 border-t border-green-200 text-xs text-green-700">
              <div className="grid grid-cols-2 gap-2">
                <div>Customer: {linkedQuotation.customer?.nama || 'N/A'}</div>
                <div>Approved Date: {linkedQuotation.tanggal}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}