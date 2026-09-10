import type { Quotation } from '../contexts/AppContext';

interface UseQuotationActionsProps {
  updateQuotation: (id: string, updates: Partial<Quotation>) => void;
  formatCurrency: (value: number) => string;
  calculateTotalValue: (quotation: Quotation) => number;
}

export function useQuotationActions({ 
  updateQuotation, 
  formatCurrency, 
  calculateTotalValue 
}: UseQuotationActionsProps) {
  
  const handleApprove = (quotation: Quotation) => {
    if (quotation.projectId) {
      alert('⚠️ Quotation ini sudah di-approve dan project sudah dibuat!');
      return;
    }
    
    const confirmMsg = 
      `✅ APPROVE QUOTATION?\n\n` +
      `Quotation: ${quotation.nomorQuotation}\n` +
      `Customer: ${quotation.customer.nama}\n` +
      `Value: ${formatCurrency(calculateTotalValue(quotation))}\n\n` +
      `✨ Project baru akan otomatis dibuat dari quotation ini!`;
    
    if (confirm(confirmMsg)) {
      const manualProjectCode = prompt('Masukkan Kode Project untuk Project baru ini:', `PRJ-${quotation.nomorQuotation.split('/').pop()}`);
      
      if (manualProjectCode === null) {
        alert('Approval dibatalkan karena Kode Project tidak diisi.');
        return;
      }

      updateQuotation(quotation.id, { 
        status: 'Approved',
        manualKodeProject: manualProjectCode 
      } as any);
      
      // Show success message with project info
      setTimeout(() => {
        alert(
          '🎉 QUOTATION APPROVED!\n\n' +
          '✅ Status: Approved\n' +
          '✅ Project baru telah dibuat!\n\n' +
          '📋 Data yang ditransfer:\n' +
          '• BOQ Materials\n' +
          '• Manpower\n' +
          '• Schedule → Milestones\n' +
          '• Consumables → Other Budget\n' +
          '• Equipment Budget\n\n' +
          '👉 Buka menu "Project" untuk melihat project baru!'
        );
      }, 100);
    }
  };

  const handleReject = (quotation: Quotation) => {
    const confirmMsg = 
      `❌ REJECT QUOTATION?\n\n` +
      `Quotation: ${quotation.nomorQuotation}\n` +
      `Customer: ${quotation.customer.nama}\n\n` +
      `Quotation akan ditandai sebagai Rejected.`;
    
    if (confirm(confirmMsg)) {
      updateQuotation(quotation.id, { status: 'Rejected' });
      alert('❌ Quotation telah ditolak.');
    }
  };

  const handleSendToCustomer = (quotation: Quotation) => {
    const confirmMsg = 
      `📧 SEND QUOTATION?\n\n` +
      `Quotation: ${quotation.nomorQuotation}\n` +
      `Customer: ${quotation.customer.nama}\n\n` +
      `Status akan diubah menjadi "Sent".`;
    
    if (confirm(confirmMsg)) {
      updateQuotation(quotation.id, { status: 'Sent' });
      alert('✅ Quotation telah dikirim ke customer!');
    }
  };

  return {
    handleApprove,
    handleReject,
    handleSendToCustomer,
  };
}
