/**
 * Debug Component: Quotation to Project Flow
 * 
 * Component ini menampilkan status linking antara Quotation dan Project
 * untuk membantu debugging dan verifikasi fitur auto-create project
 */

import { useApp } from '../../contexts/AppContext';

import { CheckCircle, XCircle, Link2, AlertCircle } from 'lucide-react';

export default function QuotationProjectDebug() {
  const { quotationList, projectList } = useApp();

  // Find approved quotations
  const approvedQuotations = quotationList.filter(q => q.status === 'Approved');

  // Find projects created from quotations
  const projectsFromQuotations = projectList.filter(p => p.quotationId);

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg border-2 border-blue-500 p-4 max-w-md z-50">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
        <AlertCircle className="text-blue-600" size={20} />
        <h3 className="font-bold text-gray-900">Quotation → Project Debug</h3>
      </div>

      {/* Approved Quotations */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">
          Approved Quotations ({approvedQuotations.length})
        </h4>
        <div className="space-y-2">
          {approvedQuotations.map(q => {
            const hasProject = !!q.projectId;
            const linkedProject = projectList.find(p => p.id === q.projectId);

            return (
              <div
                key={q.id}
                className={`p-2 rounded border ${
                  hasProject ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-900 truncate">
                      {q.nomorQuotation}
                    </div>
                    <div className="text-xs text-gray-600 truncate">
                      {q.perihal}
                    </div>
                    {hasProject && (
                      <div className="text-xs text-green-700 flex items-center gap-1 mt-1">
                        <Link2 size={10} />
                        Project: {linkedProject?.kodeProject || q.projectId}
                      </div>
                    )}
                  </div>
                  <div>
                    {hasProject ? (
                      <CheckCircle className="text-green-600 flex-shrink-0" size={16} />
                    ) : (
                      <XCircle className="text-red-600 flex-shrink-0" size={16} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {approvedQuotations.length === 0 && (
            <div className="text-xs text-gray-500 italic">
              No approved quotations
            </div>
          )}
        </div>
      </div>

      {/* Projects from Quotations */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">
          Projects from Quotations ({projectsFromQuotations.length})
        </h4>
        <div className="space-y-2">
          {projectsFromQuotations.map(p => {
            const linkedQuotation = quotationList.find(q => q.id === p.quotationId);

            return (
              <div
                key={p.id}
                className="p-2 rounded border bg-blue-50 border-blue-200"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-900 truncate">
                      {p.kodeProject}
                    </div>
                    <div className="text-xs text-gray-600 truncate">
                      {p.namaProject}
                    </div>
                    {linkedQuotation && (
                      <div className="text-xs text-blue-700 flex items-center gap-1 mt-1">
                        <Link2 size={10} />
                        Quotation: {linkedQuotation.nomorQuotation}
                      </div>
                    )}
                  </div>
                  <CheckCircle className="text-blue-600 flex-shrink-0" size={16} />
                </div>
              </div>
            );
          })}
          {projectsFromQuotations.length === 0 && (
            <div className="text-xs text-gray-500 italic">
              No projects from quotations
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-gray-600">Total Quotations</div>
            <div className="font-bold text-gray-900">{quotationList.length}</div>
          </div>
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-gray-600">Total Projects</div>
            <div className="font-bold text-gray-900">{projectList.length}</div>
          </div>
          <div className="bg-green-50 p-2 rounded">
            <div className="text-green-700">Approved</div>
            <div className="font-bold text-green-900">{approvedQuotations.length}</div>
          </div>
          <div className="bg-blue-50 p-2 rounded">
            <div className="text-blue-700">From Quotations</div>
            <div className="font-bold text-blue-900">{projectsFromQuotations.length}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
