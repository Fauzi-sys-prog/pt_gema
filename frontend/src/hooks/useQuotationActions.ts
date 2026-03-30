import type { Quotation } from '../types/quotation';
import { toast } from 'sonner';

interface UseQuotationActionsProps {
  updateQuotation: (id: string, updates: Partial<Quotation>) => Promise<void>;
  formatCurrency: (value: number) => string;
  calculateTotalValue: (quotation: Quotation) => number;
}

export function useQuotationActions({ 
  updateQuotation, 
  formatCurrency, 
  calculateTotalValue 
}: UseQuotationActionsProps) {
  
  const handleApprove = async (quotation: Quotation) => {
    const confirmMsg =
      `Project approval sekarang diproses di Project Ledger.\n\n` +
      `Quotation: ${quotation.nomorQuotation}\n` +
      `Customer: ${quotation.customer.nama}\n` +
      `Value: ${formatCurrency(calculateTotalValue(quotation))}\n\n` +
      `Ubah status ke "Sent" untuk lanjut review project?`;

    if (window.confirm(confirmMsg)) {
      try {
        await updateQuotation(quotation.id, { status: 'Sent' } as any);
        toast.success('Quotation ditandai Sent. Approval final dilakukan di Project Ledger oleh OWNER/SPV.');
      } catch {
        // Error toast handled in AppContext
      }
    }
  };

  const handleReject = async (quotation: Quotation) => {
    const confirmMsg = 
      `❌ REJECT QUOTATION?\n\n` +
      `Quotation: ${quotation.nomorQuotation}\n` +
      `Customer: ${quotation.customer.nama}\n\n` +
      `Quotation akan ditandai sebagai Rejected.`;
    
    if (window.confirm(confirmMsg)) {
      try {
        await updateQuotation(quotation.id, { status: 'Rejected' });
        toast.success('Quotation telah ditolak.');
      } catch {
        // Error toast handled in AppContext
      }
    }
  };

  const handleSendToCustomer = async (quotation: Quotation) => {
    const confirmMsg = 
      `📧 SEND QUOTATION?\n\n` +
      `Quotation: ${quotation.nomorQuotation}\n` +
      `Customer: ${quotation.customer.nama}\n\n` +
      `Status akan diubah menjadi "Sent".`;
    
    if (window.confirm(confirmMsg)) {
      try {
        await updateQuotation(quotation.id, { status: 'Sent' });
        toast.success('Quotation telah dikirim ke customer.');
      } catch {
        // Error toast handled in AppContext
      }
    }
  };

  return {
    handleApprove,
    handleReject,
    handleSendToCustomer,
  };
}
