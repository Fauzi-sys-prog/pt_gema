import React from 'react';
import { FileText, DollarSign, FolderKanban, Receipt, ArrowRight, CheckCircle } from 'lucide-react';

interface SalesFlowTrackerProps {
  dataCollectionCount: number;
  quotationCount: number;
  projectCount: number;
  invoiceCount: number;
  fromSurveyQuotations: number;
  fromQuotationProjects: number;
  fromQuotationInvoices: number;
}

export const SalesFlowTracker: React.FC<SalesFlowTrackerProps> = ({
  dataCollectionCount,
  quotationCount,
  projectCount,
  invoiceCount,
  fromSurveyQuotations,
  fromQuotationProjects,
  fromQuotationInvoices
}) => {
  const stages = [
    {
      id: 'survey',
      icon: FileText,
      label: 'Data Collection',
      count: dataCollectionCount,
      color: 'blue',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-700',
      iconColor: 'text-blue-600'
    },
    {
      id: 'quotation',
      icon: DollarSign,
      label: 'Quotation',
      count: quotationCount,
      linkCount: fromSurveyQuotations,
      linkLabel: 'from survey',
      color: 'purple',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      textColor: 'text-purple-700',
      iconColor: 'text-purple-600'
    },
    {
      id: 'project',
      icon: FolderKanban,
      label: 'Project',
      count: projectCount,
      linkCount: fromQuotationProjects,
      linkLabel: 'from quotation',
      color: 'green',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-700',
      iconColor: 'text-green-600'
    },
    {
      id: 'invoice',
      icon: Receipt,
      label: 'Invoice (AR)',
      count: invoiceCount,
      linkCount: fromQuotationInvoices,
      linkLabel: 'from quotation',
      color: 'emerald',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      textColor: 'text-emerald-700',
      iconColor: 'text-emerald-600'
    }
  ];

  const integrationRate = quotationCount > 0 
    ? ((fromSurveyQuotations / quotationCount) * 100).toFixed(0)
    : 0;

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">Commercial Sales Flow</h3>
          <p className="text-sm text-gray-600 mt-1">Zero Re-typing Integration Chain</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span>Integration Rate:</span>
          </div>
          <div className="text-2xl font-bold text-green-600">{integrationRate}%</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {stages.map((stage, index) => (
          <React.Fragment key={stage.id}>
            {/* Stage Card */}
            <div className={`flex-1 ${stage.bgColor} border-2 ${stage.borderColor} rounded-lg p-4`}>
              <div className="flex items-start justify-between mb-3">
                <stage.icon className={`w-6 h-6 ${stage.iconColor}`} />
                <div className="text-right">
                  <div className={`font-bold text-2xl ${stage.textColor}`}>{stage.count}</div>
                  <div className="text-xs text-gray-500 uppercase font-semibold">{stage.label}</div>
                </div>
              </div>
              
              {stage.linkCount !== undefined && stage.linkCount > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center gap-1 text-xs">
                    <div className={`w-2 h-2 rounded-full bg-gradient-to-r from-${stage.color}-400 to-${stage.color}-600`}></div>
                    <span className="font-semibold text-gray-700">{stage.linkCount}</span>
                    <span className="text-gray-500">{stage.linkLabel}</span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    ({((stage.linkCount / stage.count) * 100).toFixed(0)}% automated)
                  </div>
                </div>
              )}
            </div>

            {/* Arrow */}
            {index < stages.length - 1 && (
              <ArrowRight className="w-6 h-6 text-gray-400 flex-shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Flow Benefits */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-3 border border-blue-200">
          <div className="text-xs text-blue-700 font-semibold mb-1">⚡ Smart Pricing</div>
          <div className="text-[10px] text-gray-600">Auto markup & margin calc</div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-green-50 rounded-lg p-3 border border-purple-200">
          <div className="text-xs text-purple-700 font-semibold mb-1">🔗 Zero Re-typing</div>
          <div className="text-[10px] text-gray-600">Data flows automatically</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-3 border border-green-200">
          <div className="text-xs text-green-700 font-semibold mb-1">📊 Full Traceability</div>
          <div className="text-[10px] text-gray-600">Track from survey to revenue</div>
        </div>
      </div>

      {/* Integration Status Indicator */}
      <div className="mt-4 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-xs font-semibold text-gray-700">Integration Chain Active</span>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-gray-600">
            <div>Survey → Quotation ✓</div>
            <div>Quotation → Project ✓</div>
            <div>Quotation → Invoice ✓</div>
          </div>
        </div>
      </div>
    </div>
  );
};
