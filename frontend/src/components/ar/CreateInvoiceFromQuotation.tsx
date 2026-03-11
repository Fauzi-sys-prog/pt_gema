import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, X, ArrowRight, DollarSign, Calendar, Users, Zap, Building2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface CreateInvoiceFromQuotationProps {
  show: boolean;
  onClose: () => void;
  quotationList: any[];
  customerList: any[];
  onCreateInvoice: (invoiceData: any) => void;
}

export const CreateInvoiceFromQuotation: React.FC<CreateInvoiceFromQuotationProps> = ({
  show,
  onClose,
  quotationList,
  customerList,
  onCreateInvoice
}) => {
  const normalizeWorkflowStatus = (value: unknown): 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED' => {
    const status = String(value || '').trim().toUpperCase();
    if (status === 'SENT') return 'SENT';
    if (status === 'APPROVED') return 'APPROVED';
    if (status === 'REJECTED') return 'REJECTED';
    return 'DRAFT';
  };
  const [selectedQuotation, setSelectedQuotation] = useState<any>(null);
  const [invoiceDetails, setInvoiceDetails] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    termin: '',
    noPO: '',
    noKontrak: '',
    remark: ''
  });

  // Get approved quotations only
  const approvedQuotations = quotationList.filter(q => 
    normalizeWorkflowStatus(q.status) === 'APPROVED' || normalizeWorkflowStatus(q.status) === 'SENT'
  );

  const handleSelectQuotation = (quotation: any) => {
    setSelectedQuotation(quotation);
    
    // Auto-populate invoice details from quotation
    const paymentTerms = quotation.paymentTerms?.termins?.[0];
    setInvoiceDetails(prev => ({
      ...prev,
      termin: paymentTerms?.label || '',
      dueDate: new Date(Date.now() + (quotation.paymentTerms?.paymentDueDays || 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    }));
  };

  const handleCreateInvoice = () => {
    if (!selectedQuotation) {
      toast.error('Pilih quotation terlebih dahulu!');
      return;
    }

    // Find or create customer
    let customer = customerList.find(c => 
      c.namaCustomer?.toLowerCase() === selectedQuotation.kepada?.toLowerCase()
    );

    if (!customer) {
      // Auto-create customer from quotation
      customer = {
        id: `CUST-${Date.now()}`,
        kodeCustomer: `CUST-${String(customerList.length + 1).padStart(3, '0')}`,
        namaCustomer: selectedQuotation.kepada || '',
        alamat: selectedQuotation.lokasi || '',
        kontak: selectedQuotation.up || '',
        paymentTerms: `NET ${selectedQuotation.paymentTerms?.paymentDueDays || 30}`,
        rating: 5,
        createdAt: new Date().toISOString()
      };
    }

    // Transform quotation pricing items to invoice items
    const invoiceItems: any[] = [];
    
    if (selectedQuotation.pricingItems) {
      // New format with pricing items
      const categories = ['manpower', 'materials', 'equipment', 'consumables'];
      const categoryLabels: any = {
        manpower: 'Tenaga Kerja',
        materials: 'Material',
        equipment: 'Peralatan',
        consumables: 'Consumables'
      };

      categories.forEach(cat => {
        const items = selectedQuotation.pricingItems[cat] || [];
        items.forEach((item: any, idx: number) => {
          invoiceItems.push({
            id: `ITEM-${Date.now()}-${idx}`,
            deskripsi: `${categoryLabels[cat]} - ${item.description}`,
            qty: item.quantity || 1,
            satuan: item.unit || 'Unit',
            hargaSatuan: item.sellingPrice || 0,
            jumlah: item.sellingPrice || 0
          });
        });
      });

      // Add overhead if exists
      if (selectedQuotation.overhead && selectedQuotation.overhead > 0) {
        invoiceItems.push({
          id: `ITEM-OH-${Date.now()}`,
          deskripsi: `Overhead (${selectedQuotation.pricingConfig?.overheadPercent || 0}%)`,
          qty: 1,
          satuan: 'Lot',
          hargaSatuan: selectedQuotation.overhead,
          jumlah: selectedQuotation.overhead
        });
      }

      // Add contingency if exists
      if (selectedQuotation.contingency && selectedQuotation.contingency > 0) {
        invoiceItems.push({
          id: `ITEM-CON-${Date.now()}`,
          deskripsi: `Contingency (${selectedQuotation.pricingConfig?.contingencyPercent || 0}%)`,
          qty: 1,
          satuan: 'Lot',
          hargaSatuan: selectedQuotation.contingency,
          jumlah: selectedQuotation.contingency
        });
      }

      // Apply discount if exists
      if (selectedQuotation.discount && selectedQuotation.discount > 0) {
        invoiceItems.push({
          id: `ITEM-DISC-${Date.now()}`,
          deskripsi: `Diskon (${selectedQuotation.pricingConfig?.discountPercent || 0}%) - ${selectedQuotation.pricingConfig?.discountReason || ''}`,
          qty: 1,
          satuan: 'Lot',
          hargaSatuan: -selectedQuotation.discount,
          jumlah: -selectedQuotation.discount
        });
      }
    } else if (selectedQuotation.sections) {
      // Old format with sections
      selectedQuotation.sections.forEach((section: any) => {
        section.items.forEach((item: any) => {
          invoiceItems.push({
            id: `ITEM-${Date.now()}-${Math.random()}`,
            deskripsi: `${section.title} - ${item.keterangan}`,
            qty: item.jumlah || 1,
            satuan: item.satuan || 'Unit',
            hargaSatuan: item.hargaUnit || 0,
            jumlah: item.total || 0
          });
        });
      });
    }

    const subtotal = invoiceItems.reduce((sum, item) => sum + (item.jumlah || 0), 0);
    const ppn = subtotal * 0.11; // 11% PPN
    const total = subtotal + ppn;

    const invoiceData = {
      quotationId: selectedQuotation.id,
      quotationNo: selectedQuotation.noPenawaran,
      customerId: customer.id,
      customerName: customer.namaCustomer,
      perihal: selectedQuotation.perihal || `Invoice untuk ${selectedQuotation.noPenawaran}`,
      items: invoiceItems,
      subtotal,
      ppn,
      pph: 0,
      totalNominal: total,
      ...invoiceDetails,
      // Include payment terms from quotation
      paymentTermsReference: selectedQuotation.paymentTerms,
      commercialTermsReference: selectedQuotation.commercialTerms,
      // Include margin tracking
      quotationMargin: selectedQuotation.marginPercent,
      quotationGrandTotal: selectedQuotation.grandTotal,
    };

    onCreateInvoice(invoiceData);
    onClose();
    setSelectedQuotation(null);
    toast.success('Invoice berhasil dibuat dari Quotation!', {
      description: `${selectedQuotation.noPenawaran} → Invoice`
    });
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-emerald-600 to-teal-600">
            <div className="flex items-center justify-between text-white">
              <div>
                <h2 className="font-bold text-xl flex items-center gap-2">
                  <Zap className="w-6 h-6" />
                  Create Invoice from Quotation
                </h2>
                <p className="text-sm text-emerald-100 mt-1">
                  Instantly convert approved quotations into invoices
                </p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex h-[calc(90vh-140px)]">
            {/* Left: Quotation List */}
            <div className="w-1/2 border-r border-gray-200 overflow-y-auto p-6">
              <h3 className="font-bold text-gray-900 mb-4">Select Approved Quotation</h3>
              <div className="space-y-3">
                {approvedQuotations.map(quotation => (
                  <div
                    key={quotation.id}
                    onClick={() => handleSelectQuotation(quotation)}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      selectedQuotation?.id === quotation.id
                        ? 'border-emerald-600 bg-emerald-50 shadow-md'
                        : 'border-gray-200 hover:border-emerald-400 hover:bg-emerald-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-semibold text-emerald-700">{quotation.noPenawaran}</div>
                        <div className="text-sm text-gray-600 mt-1">{quotation.kepada}</div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        normalizeWorkflowStatus(quotation.status) === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {normalizeWorkflowStatus(quotation.status) === 'APPROVED' ? 'Approved' : 'Sent'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mb-2">{quotation.perihal}</div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        {new Date(quotation.tanggal).toLocaleDateString('id-ID')}
                      </span>
                      <div className="font-bold text-emerald-700">
                        Rp {(quotation.grandTotal || 0).toLocaleString('id-ID')}
                      </div>
                    </div>
                    {quotation.marginPercent !== undefined && (
                      <div className="mt-2 text-xs text-gray-600">
                        Margin: <span className="font-semibold text-purple-700">{quotation.marginPercent.toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                ))}

                {approvedQuotations.length === 0 && (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-600 font-medium mb-2">No Approved Quotations</p>
                    <p className="text-sm text-gray-500">Approve quotations first to create invoices</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Invoice Details */}
            <div className="w-1/2 overflow-y-auto p-6">
              {selectedQuotation ? (
                <>
                  <h3 className="font-bold text-gray-900 mb-4">Invoice Details</h3>
                  
                  {/* Quotation Summary */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <DollarSign className="w-5 h-5 text-emerald-600" />
                      <span className="font-semibold text-emerald-900">From Quotation</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">No. Quotation:</span>
                        <span className="font-medium">{selectedQuotation.noPenawaran}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Customer:</span>
                        <span className="font-medium">{selectedQuotation.kepada}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Grand Total:</span>
                        <span className="font-bold text-emerald-700">
                          Rp {(selectedQuotation.grandTotal || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                      {selectedQuotation.marginPercent !== undefined && (
                        <div className="flex justify-between border-t border-emerald-300 pt-2">
                          <span className="text-gray-600">Project Margin:</span>
                          <span className="font-semibold text-purple-700">
                            {selectedQuotation.marginPercent.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Payment Terms from Quotation */}
                  {selectedQuotation.paymentTerms && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        <span className="font-semibold text-blue-900">Payment Terms (from Quotation)</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        {selectedQuotation.paymentTerms.termins?.map((termin: any, idx: number) => (
                          <div key={idx} className="flex justify-between">
                            <span className="text-gray-600">{termin.label}:</span>
                            <span className="font-medium">{termin.percent}% - {termin.timing}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Invoice Form */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date</label>
                        <input
                          type="date"
                          value={invoiceDetails.tanggal}
                          onChange={(e) => setInvoiceDetails({ ...invoiceDetails, tanggal: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                        <input
                          type="date"
                          value={invoiceDetails.dueDate}
                          onChange={(e) => setInvoiceDetails({ ...invoiceDetails, dueDate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Termin/Stage</label>
                      <input
                        type="text"
                        value={invoiceDetails.termin}
                        onChange={(e) => setInvoiceDetails({ ...invoiceDetails, termin: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
                        placeholder="e.g., DP, Termin 1, Pelunasan"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">No. PO (Optional)</label>
                        <input
                          type="text"
                          value={invoiceDetails.noPO}
                          onChange={(e) => setInvoiceDetails({ ...invoiceDetails, noPO: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
                          placeholder="PO Number"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">No. Kontrak (Optional)</label>
                        <input
                          type="text"
                          value={invoiceDetails.noKontrak}
                          onChange={(e) => setInvoiceDetails({ ...invoiceDetails, noKontrak: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
                          placeholder="Contract Number"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Remark</label>
                      <textarea
                        value={invoiceDetails.remark}
                        onChange={(e) => setInvoiceDetails({ ...invoiceDetails, remark: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
                        rows={3}
                        placeholder="Additional notes..."
                      />
                    </div>
                  </div>

                  {/* Items Preview */}
                  <div className="mt-6">
                    <h4 className="font-semibold text-gray-900 mb-2">Items to be Invoiced</h4>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                      {selectedQuotation.pricingItems ? (
                        <div className="space-y-1 text-xs">
                          {['manpower', 'materials', 'equipment', 'consumables'].map(cat => {
                            const items = selectedQuotation.pricingItems[cat] || [];
                            if (items.length === 0) return null;
                            return (
                              <div key={cat}>
                                <div className="font-semibold text-gray-700 mb-1 capitalize">{cat}</div>
                                {items.map((item: any, idx: number) => (
                                  <div key={idx} className="text-gray-600 ml-2">
                                    • {item.description} - Rp {(item.sellingPrice || 0).toLocaleString('id-ID')}
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-600">
                          {selectedQuotation.sections?.length || 0} section(s) will be converted to invoice items
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <Building2 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-600 font-medium">Select a quotation to continue</p>
                  <p className="text-sm text-gray-500 mt-1">Choose from the approved quotations on the left</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateInvoice}
              disabled={!selectedQuotation}
              className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:shadow-lg font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowRight className="w-5 h-5" />
              Create Invoice
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
