import { CheckCircle, XCircle, Send } from 'lucide-react';
import type { Quotation } from '../../contexts/AppContext';

interface QuotationStatusActionsProps {
  quotation: Quotation;
  onApprove: (quotation: Quotation) => void;
  onReject: (quotation: Quotation) => void;
  onSend: (quotation: Quotation) => void;
}

export function QuotationStatusActions({ quotation, onApprove, onReject, onSend }: QuotationStatusActionsProps) {
  return (
    <>
      {/* Send Button - Only for Draft */}
      {quotation.status === 'Draft' && (
        <button
          onClick={() => onSend(quotation)}
          className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
          title="Send to Customer"
        >
          <Send size={18} />
        </button>
      )}
      
      {/* Approve & Reject Buttons - Only for Sent */}
      {quotation.status === 'Sent' && (
        <>
          <button
            onClick={() => onApprove(quotation)}
            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            title="Approve Quotation - Auto Create Project"
          >
            <CheckCircle size={18} />
          </button>
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
