/**
 * Utility untuk standarisasi penomoran dokumen PT Gema Teknik Perkasa
 */
export const generateDocNumber = (type: 'PO' | 'SJ' | 'GRN' | 'WO', sequence: number) => {
  const year = new Date().getFullYear();
  const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
  const seq = sequence.toString().padStart(4, '0');
  
  // Format: GTP/[TYPE]/[YYYY][MM]/[SEQ]
  // Contoh: GTP/PO/202601/0001
  return `GTP/${type}/${year}${month}/${seq}`;
};

export type ApprovalStatus = 'Draft' | 'Pending' | 'Approved' | 'Rejected';
export type QCStatus = 'Good' | 'Damaged' | 'Incomplete';
