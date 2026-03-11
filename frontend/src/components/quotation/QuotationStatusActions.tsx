import { XCircle, Send, Info } from 'lucide-react'; import type { Quotation } from '../../contexts/AppContext';

interface QuotationStatusActionsProps {
  quotation: Quotation;
  onReject: (quotation: Quotation) => void;
  onSend: (quotation: Quotation) => void;
}

export function QuotationStatusActions({ quotation, onReject, onSend }: QuotationStatusActionsProps) {
  const status = String(quotation.status || "").trim().toUpperCase();

  return (
    <>
      {/* Send Button - Only for Draft */}
      {status === 'DRAFT' && (
        <button
          onClick={() => onSend(quotation)}
          className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
          title="Send to Customer"
        >
          <Send size={18} />
        </button>
      )}
      
      {/* Sent state actions */}
      {status === 'SENT' && (
        <>
          <span
            className="p-2 text-blue-600 bg-blue-50 rounded-lg transition-colors"
            title="Approval final diproses di Project Ledger"
          >
            <Info size={18} />
          </span>
          <button
            onClick={() => onReject(quotation)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Reject Quotation"
          >
            <XCircle size={18} />
          </button>
        </>
      )}
      
      {/* Badge if Project Created */}
      {quotation.projectId && (
        <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium whitespace-nowrap">
          ✅ Project
        </span>
      )}
    </>
  );
}
