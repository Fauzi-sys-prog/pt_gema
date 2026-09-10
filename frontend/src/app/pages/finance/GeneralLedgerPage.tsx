import { useState, useMemo } from 'react';
import { 
  Plus,
  Search, 
  Download,
  Building2,
  TrendingUp,
  FileSpreadsheet,
  Wallet,
  CheckCircle2,
  X,
  Maximize2,
  ArrowUpRight,
  TrendingDown,
  Calendar,
  Filter,
  ArrowRight,
  Eye,
  Layers,
  FileText,
  AlertCircle,
  Users,
  Briefcase,
  Archive,
  Save,
  Loader2,
  DollarSign
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { exportGeneralLedgerToWord } from '../../utils/generalLedgerExport';

interface JournalEntry {
  id: string;
  date: string;
  reference: string;
  description: string;
  category: string;
  debit: number;
  credit: number;
  balance: number;
}

export default function GeneralLedgerPage() {
  const { poList, invoiceList, customerInvoiceList = [], expenseList = [], payrollList = [], payrollRunList = [], thlPayrollRunList = [], vendorInvoiceList = [], pettyCashList = [], pettyCashGudangList = [], workingExpenseSheets = [] } = useApp();
  const [activeTab, setActiveTab] = useState<'overview' | 'income' | 'expense'>('overview');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualEntries, setManualEntries] = useState<JournalEntry[]>([]);
  const [ledgerSearch, setLedgerSearch] = useState('');

  // Auto-generate journal entries from real ERP data
  const erpEntries = useMemo<JournalEntry[]>(() => {
    const entries: JournalEntry[] = [];

    const addLine = (line: Omit<JournalEntry, 'balance'>) => entries.push({
      ...line,
      balance: line.debit - line.credit,
    });

    // Invoice yang sudah diterbitkan mengakui piutang, pendapatan, dan pajak.
    customerInvoiceList
      .filter(inv => !['Draft', 'Pending', 'Revision', 'Rejected', 'Cancelled'].includes(inv.status))
      .forEach(inv => {
        const ref = `#GJ-AR-${inv.noInvoice}`;
        addLine({ id: `${inv.id}-ar`, date: inv.tanggal, reference: ref, description: `Piutang ${inv.noInvoice} — ${inv.customerName}`, category: 'Accounts Receivable', debit: inv.totalNominal, credit: 0 });
        addLine({ id: `${inv.id}-revenue`, date: inv.tanggal, reference: ref, description: `Pendapatan ${inv.noInvoice} — ${inv.customerName}`, category: 'Revenue Recognition', debit: 0, credit: inv.subtotal || 0 });
        if ((inv.ppn || 0) > 0) addLine({ id: `${inv.id}-vat`, date: inv.tanggal, reference: ref, description: `PPN keluaran ${inv.noInvoice}`, category: 'Output VAT', debit: 0, credit: inv.ppn });
        if ((inv.pph || 0) > 0) addLine({ id: `${inv.id}-pph`, date: inv.tanggal, reference: ref, description: `PPh dipotong customer ${inv.noInvoice}`, category: 'Prepaid Income Tax', debit: inv.pph, credit: 0 });
      });

    // Penerimaan dari customerInvoiceList (AR) — pakai paymentHistory agar granular per-termin/partial
    const arNoInvoices = new Set<string>();
    customerInvoiceList.forEach((inv) => {
      arNoInvoices.add(inv.noInvoice);
      inv.paymentHistory.forEach((pay, pidx) => {
        addLine({
          id: `erp-ar-${inv.id}-${pidx}`,
          date: pay.tanggal,
          reference: `#GJ-AR-${inv.noInvoice}-${pidx + 1}`,
          description: `Penerimaan ${inv.noInvoice} — ${inv.customerName}${pay.nominal < inv.totalNominal ? ' (partial)' : ''}`,
          category: 'Bank',
          debit: pay.nominal,
          credit: 0,
        });
        addLine({ id: `erp-ar-clear-${inv.id}-${pidx}`, date: pay.tanggal, reference: `#GJ-AR-${inv.noInvoice}-${pidx + 1}`, description: `Pelunasan piutang ${inv.noInvoice}`, category: 'Accounts Receivable', debit: 0, credit: pay.nominal });
      });
    });

    // Paid customer invoices dari invoiceList yang TIDAK ada di AR (legacy/manual tanpa AR entry)
    invoiceList
      .filter(inv => inv.status === 'Paid' && inv.tanggal && !arNoInvoices.has(inv.noInvoice))
      .forEach((inv, idx) => {
        addLine({
          id: `erp-inv-${inv.id}`,
          date: inv.tanggal,
          reference: `#GJ-INV-${String(idx + 1).padStart(3, '0')}`,
          description: `Pelunasan Invoice ${inv.noInvoice} — ${inv.customer}`,
          category: 'Bank',
          debit: inv.totalBayar || inv.subtotal || 0,
          credit: 0,
        });
        const paid = inv.totalBayar || inv.subtotal || 0;
        addLine({ id: `erp-inv-clear-${inv.id}`, date: inv.tanggal, reference: `#GJ-INV-${String(idx + 1).padStart(3, '0')}`, description: `Pelunasan piutang ${inv.noInvoice}`, category: 'Accounts Receivable', debit: 0, credit: paid });
      });

    // Tagihan vendor yang disetujui mengakui beban/pembelian, PPN masukan, dan utang.
    vendorInvoiceList
      .filter(vi => !['Draft', 'Pending', 'Rejected'].includes(vi.status) && Boolean(vi.tanggal))
      .forEach(vi => {
        const ref = `#GJ-AP-${vi.noInvoiceVendor}`;
        const vatRate = Math.max(0, vi.ppn || 0);
        const vatAmount = vatRate > 0 ? (vi.totalAmount || 0) * vatRate / (100 + vatRate) : 0;
        const base = Math.max(0, (vi.totalAmount || 0) - vatAmount);
        addLine({ id: `${vi.id}-expense`, date: vi.tanggal!, reference: ref, description: `Tagihan vendor ${vi.noInvoiceVendor} — ${vi.supplier}`, category: 'Purchase / Project Expense', debit: base, credit: 0 });
        if (vatAmount > 0) addLine({ id: `${vi.id}-input-vat`, date: vi.tanggal!, reference: ref, description: `PPN masukan ${vi.noInvoiceVendor}`, category: 'Input VAT', debit: vatAmount, credit: 0 });
        addLine({ id: `${vi.id}-ap`, date: vi.tanggal!, reference: ref, description: `Utang vendor ${vi.noInvoiceVendor}`, category: 'Accounts Payable', debit: 0, credit: vi.totalAmount || 0 });
      });

    // Paid vendor expenses → credit (AP cleared, cash out)
    expenseList
      .filter(e => e.status === 'Paid' && (e.paidAt || e.tanggal))
      .forEach((exp, idx) => {
        const paymentDate = (exp.paidAt || exp.tanggal).slice(0, 10);
        addLine({
          id: `erp-exp-${exp.id}`,
          date: paymentDate,
          reference: `#GJ-EXP-${String(idx + 1).padStart(3, '0')}`,
          description: `Pembayaran ${exp.kategori} — ${exp.vendorName}${exp.projectName ? ` (${exp.projectName})` : ''}`,
          category: 'Bank',
          debit: 0,
          credit: exp.totalNominal || 0,
        });
        addLine({ id: `erp-exp-cost-${exp.id}`, date: paymentDate, reference: `#GJ-EXP-${String(idx + 1).padStart(3, '0')}`, description: `Beban ${exp.kategori} — ${exp.vendorName}`, category: 'Project Expense', debit: exp.nominal || 0, credit: 0 });
        if ((exp.ppn || 0) > 0) addLine({ id: `erp-exp-vat-${exp.id}`, date: paymentDate, reference: `#GJ-EXP-${String(idx + 1).padStart(3, '0')}`, description: `PPN masukan — ${exp.vendorName}`, category: 'Input VAT', debit: exp.ppn || 0, credit: 0 });
      });

    // Vendor invoice payments — granular per-payment dari paymentHistory
    vendorInvoiceList.forEach((vi) => {
      if ((vi.paymentHistory || []).length > 0) {
        vi.paymentHistory!.forEach((pay, pidx) => {
          addLine({
            id: `erp-vi-${vi.id}-${pidx}`,
            date: pay.tanggal,
            reference: `#GJ-AP-${vi.noInvoiceVendor}-${pidx + 1}`,
            description: `Bayar Hutang ${vi.noInvoiceVendor} — ${vi.supplier}${pay.nominal < vi.totalAmount ? ' (partial)' : ''}`,
            category: 'Bank',
            debit: 0,
            credit: pay.nominal,
          });
          addLine({ id: `erp-vi-clear-${vi.id}-${pidx}`, date: pay.tanggal, reference: `#GJ-AP-${vi.noInvoiceVendor}-${pidx + 1}`, description: `Pelunasan utang ${vi.noInvoiceVendor}`, category: 'Accounts Payable', debit: pay.nominal, credit: 0 });
        });
      } else if (vi.status === 'Paid' && vi.tanggal) {
        addLine({
          id: `erp-vi-${vi.id}`,
          date: vi.tanggal,
          reference: `#GJ-AP-${vi.noInvoiceVendor}`,
          description: `Bayar Hutang ${vi.noInvoiceVendor} — ${vi.supplier}`,
          category: 'Bank',
          debit: 0,
          credit: vi.paidAmount || vi.totalAmount,
        });
        addLine({ id: `erp-vi-clear-${vi.id}`, date: vi.tanggal, reference: `#GJ-AP-${vi.noInvoiceVendor}`, description: `Pelunasan utang ${vi.noInvoiceVendor}`, category: 'Accounts Payable', debit: vi.paidAmount || vi.totalAmount, credit: 0 });
      }
    });

    // Disbursed payroll → credit (labor cost)
    payrollList
      .filter(p => p.status === 'Disbursed')
      .forEach((p, idx) => {
        addLine({
          id: `erp-pay-${p.id}`,
          date: `${p.year}-${String(p.month).padStart ? p.month : '01'}-01`,
          reference: `#GJ-PAY-${String(idx + 1).padStart(3, '0')}`,
          description: `Payroll Disbursement — ${p.employeeName || `${p.employeeCount} karyawan`} (${p.month}/${p.year})`,
          category: 'Payroll',
          debit: 0,
          credit: p.totalPayroll || 0,
        });
        addLine({ id: `erp-pay-cost-${p.id}`, date: `${p.year}-${String(p.month).padStart ? p.month : '01'}-01`, reference: `#GJ-PAY-${String(idx + 1).padStart(3, '0')}`, description: `Beban payroll — ${p.employeeName || `${p.employeeCount} karyawan`}`, category: 'Payroll Expense', debit: p.totalPayroll || 0, credit: 0 });
      });

    // Payroll Pro runs use the authoritative monthly payroll snapshot. Only
    // disbursed runs affect the ledger; calculated/approved runs remain off-book.
    payrollRunList
      // A closed payroll remains an executed disbursement and must stay on-book.
      .filter(run => run.status === 'Disbursed' || run.status === 'Closed')
      .forEach(run => {
        const date = (run.disbursedAt || run.processedDate || `${run.period}-01`).slice(0, 10);
        const ref = `#GJ-PAYROLL-${run.runNumber}`;
        addLine({ id: `erp-payroll-run-${run.id}-bank`, date, reference: ref, description: `Pembayaran payroll ${run.runNumber} — ${run.employeeCount} karyawan`, category: 'Bank', debit: 0, credit: run.totalTHP });
        addLine({ id: `erp-payroll-run-${run.id}-expense`, date, reference: ref, description: `Beban gaji ${run.runNumber}`, category: 'Payroll Expense', debit: run.totalGross, credit: 0 });
        if (run.totalGross !== run.totalTHP) {
          addLine({ id: `erp-payroll-run-${run.id}-deductions`, date, reference: ref, description: `Potongan payroll ${run.runNumber}`, category: 'Payroll Liabilities', debit: 0, credit: run.totalGross - run.totalTHP });
        }
      });

    // Gaji THL — disbursed runs menjadi pengeluaran kas / beban
    thlPayrollRunList
      .filter(run => run.status === 'Disbursed')
      .forEach(run => {
        const date = (run.disbursedAt || run.createdAt || `${run.period}-01`).slice(0, 10);
        const ref = `#GJ-THL-${run.runNumber || run.id}`;
        addLine({ id: `erp-thl-run-${run.id}-bank`, date, reference: ref, description: `Pembayaran gaji THL ${run.periodLabel} — ${run.thlCount} orang`, category: 'Bank', debit: 0, credit: run.totalNetto });
        addLine({ id: `erp-thl-run-${run.id}-expense`, date, reference: ref, description: `Beban gaji THL ${run.periodLabel}`, category: 'Payroll Expense', debit: run.totalNetto, credit: 0 });
      });

    // Petty Cash Kantor — credit = pengeluaran kas
    pettyCashList
      .filter(e => e.date && e.credit > 0 && e.accountCode !== '00000')
      .forEach((e, idx) => {
        addLine({
          id: `erp-pc-${e.id}`,
          date: e.date,
          reference: `#GJ-PC-${e.accountCode}-${String(idx + 1).padStart(3, '0')}`,
          description: `Kas Kecil [${e.accountCode}] — ${e.description}`,
          category: 'Expense (Petty Cash)',
          debit: 0,
          credit: e.credit,
        });
        addLine({ id: `erp-pc-cost-${e.id}`, date: e.date, reference: `#GJ-PC-${e.accountCode}-${String(idx + 1).padStart(3, '0')}`, description: `Beban kas kecil — ${e.description}`, category: 'Petty Cash Expense', debit: e.credit, credit: 0 });
      });

    // Petty Cash Gudang — credit = pengeluaran kas
    pettyCashGudangList
      .filter(e => e.date && e.credit > 0 && e.accountCode !== '00000')
      .forEach((e, idx) => {
        addLine({
          id: `erp-pcg-${e.id}`,
          date: e.date,
          reference: `#GJ-PCG-${e.accountCode}-${String(idx + 1).padStart(3, '0')}`,
          description: `Kas Gudang [${e.accountCode}] — ${e.description}`,
          category: 'Expense (Petty Cash)',
          debit: 0,
          credit: e.credit,
        });
        addLine({ id: `erp-pcg-cost-${e.id}`, date: e.date, reference: `#GJ-PCG-${e.accountCode}-${String(idx + 1).padStart(3, '0')}`, description: `Beban kas gudang — ${e.description}`, category: 'Warehouse Expense', debit: e.credit, credit: 0 });
      });

    // Biaya Kerja — approved sheets masuk sebagai expense langsung
    workingExpenseSheets
      .filter(s => s.status === 'Paid')
      .forEach(sheet => {
        const total = sheet.items.reduce((sum, i) => sum + i.nominal, 0);
        if (total <= 0) return;
        addLine({
          id: `erp-bk-${sheet.id}`,
          date: sheet.date.includes('-') ? sheet.date : new Date().toISOString().split('T')[0],
          reference: `#GJ-BK-${sheet.noHal}`,
          description: `Biaya Kerja ${sheet.noHal} — ${sheet.project} (${sheet.client})`,
          category: 'Expense (Biaya Kerja)',
          debit: 0,
          credit: total,
        });
        addLine({ id: `erp-bk-cost-${sheet.id}`, date: sheet.date.includes('-') ? sheet.date : new Date().toISOString().split('T')[0], reference: `#GJ-BK-${sheet.noHal}`, description: `Beban kerja ${sheet.noHal} — ${sheet.project}`, category: 'Working Expense', debit: total, credit: 0 });
      });

    return entries.sort((a, b) => b.date.localeCompare(a.date));
  }, [customerInvoiceList, invoiceList, expenseList, vendorInvoiceList, payrollList, payrollRunList, thlPayrollRunList, pettyCashList, pettyCashGudangList, workingExpenseSheets]);

  const allJournalEntries = erpEntries;
  const journalEntries = useMemo(() => {
    if (!ledgerSearch.trim()) return allJournalEntries;
    const q = ledgerSearch.toLowerCase();
    return allJournalEntries.filter(e =>
      (e.description || '').toLowerCase().includes(q) ||
      (e.reference || '').toLowerCase().includes(q) ||
      (e.category || '').toLowerCase().includes(q)
    );
  }, [allJournalEntries, ledgerSearch]);

  const [newEntry, setNewEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    category: 'Operating',
    debit: 0,
    credit: 0
  });

  const financialData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return months.map((m, i) => {
      const monthEntries = journalEntries.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === i;
      });
      const totalIncome = monthEntries.filter(e => e.category === 'Revenue Recognition').reduce((sum, e) => sum + e.credit, 0);
      const totalExpense = monthEntries.filter(e => e.category.includes('Expense')).reduce((sum, e) => sum + e.debit, 0);
      return {
        month: m,
        totalIncome,
        totalExpense,
        netProfit: totalIncome - totalExpense,
      };
    });
  }, [journalEntries]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setManualEntries([]);
    setShowAddModal(false);
    setIsSubmitting(false);
  };

  const handleExportLedger = async () => {
    toast.loading("Generating Ledger Summary Export...", { id: "ledger-export" });
    
    try {
      const totalRevenue = financialData.reduce((sum, d) => sum + d.totalIncome, 0);
      const totalExpenses = financialData.reduce((sum, d) => sum + d.totalExpense, 0);
      const netProfit = totalRevenue - totalExpenses;

      const arNos = new Set(customerInvoiceList.map(i => i.noInvoice));
      const totalAR = customerInvoiceList.filter(i => i.status !== 'Paid' && i.status !== 'Cancelled').reduce((s, i) => s + i.outstandingAmount, 0)
        + invoiceList.filter(i => !['Paid','Partial'].includes(i.status) && !arNos.has(i.noInvoice)).reduce((s, i) => s + (i.totalBayar - (i.paidAmount || 0)), 0);
      const totalAP = expenseList.filter(e => e.status !== 'Paid').reduce((s, e) => s + (e.totalNominal || 0), 0);
      await exportGeneralLedgerToWord({
        journalEntries,
        totalRevenue,
        totalExpenses,
        netProfit,
        ledgerHealth: journalEntries.length > 0 && Math.abs(journalEntries.reduce((s, e) => s + e.debit - e.credit, 0)) < 1 ? 100 : 0,
        totalAR,
        totalAP,
        availableCash: journalEntries.filter(e => e.category === 'Bank').reduce((s, e) => s + e.debit - e.credit, 0),
        reportType: 'summary',
      });

      toast.success("Ledger Export Complete", {
        id: "ledger-export",
        description: "Professional Word document (.doc) downloaded successfully"
      });
    } catch (error) {
      toast.error("Export failed", {
        id: "ledger-export",
        description: "Failed to generate ledger export. Please try again."
      });
    }
  };

  const handleGenerateFullReport = async () => {
    toast.loading("Generating Complete Financial Statement...", { id: "full-report" });
    
    try {
      const totalRevenue = financialData.reduce((sum, d) => sum + d.totalIncome, 0);
      const totalExpenses = financialData.reduce((sum, d) => sum + d.totalExpense, 0);
      const netProfit = totalRevenue - totalExpenses;

      const arNos2 = new Set(customerInvoiceList.map(i => i.noInvoice));
      const totalAR2 = customerInvoiceList.filter(i => i.status !== 'Paid' && i.status !== 'Cancelled').reduce((s, i) => s + i.outstandingAmount, 0)
        + invoiceList.filter(i => !['Paid','Partial'].includes(i.status) && !arNos2.has(i.noInvoice)).reduce((s, i) => s + (i.totalBayar - (i.paidAmount || 0)), 0);
      const totalAP2 = expenseList.filter(e => e.status !== 'Paid').reduce((s, e) => s + (e.totalNominal || 0), 0);
      await exportGeneralLedgerToWord({
        journalEntries,
        totalRevenue,
        totalExpenses,
        netProfit,
        ledgerHealth: journalEntries.length > 0 && Math.abs(journalEntries.reduce((s, e) => s + e.debit - e.credit, 0)) < 1 ? 100 : 0,
        totalAR: totalAR2,
        totalAP: totalAP2,
        availableCash: journalEntries.filter(e => e.category === 'Bank').reduce((s, e) => s + e.debit - e.credit, 0),
        reportType: 'full',
      });

      toast.success("Full Report Generated", {
        id: "full-report",
        description: "Complete financial statement with journal entries downloaded"
      });
    } catch (error) {
      toast.error("Export failed", {
        id: "full-report",
        description: "Failed to generate full report. Please try again."
      });
    }
  };


  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 bg-blue-600 text-white text-[10px] font-black rounded-lg uppercase tracking-widest">Master Ledger</span>
              <span className="text-slate-400 font-bold text-xs uppercase italic tracking-wider">PT Gema Teknik Perkasa</span>
           </div>
           <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-3">
              <Building2 className="text-blue-600" size={36} />
              General Ledger Control
           </h1>
           <p className="text-slate-500 font-bold text-sm uppercase italic tracking-wide">Pusat Digitalisasi Arus Kas & Verifikasi Transaksi Finansial</p>
        </div>
        <div className="flex flex-wrap gap-2">
           <button 
              onClick={handleExportLedger}
              className="bg-white border-2 border-slate-200 text-slate-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2 hover:bg-slate-50 transition-all"
           >
              <FileSpreadsheet size={18} /> Export Ledger
           </button>
        </div>
      </div>

      {/* Add Journal Entry Modal */}
        {false && showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <form onSubmit={handleAddEntry}>
                <div className="p-8 border-b-2 border-slate-50 flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase">New Journal Entry</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Recording Manual Financial Transaction</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="p-3 bg-slate-50 text-slate-400 hover:bg-slate-100 rounded-2xl transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-8 space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Transaction Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="date" 
                          required
                          value={newEntry.date}
                          onChange={(e) => setNewEntry({...newEntry, date: e.target.value})}
                          className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-blue-500 transition-all text-black" 
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                      <select 
                        value={newEntry.category}
                        onChange={(e) => setNewEntry({...newEntry, category: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-blue-500 transition-all appearance-none"
                      >
                        <option value="Operating">Operating</option>
                        <option value="Investment">Investment</option>
                        <option value="Financing">Financing</option>
                        <option value="Tax">Tax & Duty</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                    <textarea 
                      required
                      placeholder="Enter transaction details..."
                      value={newEntry.description}
                      onChange={(e) => setNewEntry({...newEntry, description: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-blue-500 transition-all min-h-[100px] resize-none text-black"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-1">Debit</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-bold">Rp</span>
                        <input 
                          type="number" 
                          required
                          value={newEntry.debit}
                          onChange={(e) => setNewEntry({...newEntry, debit: Number(e.target.value)})}
                          className="w-full pl-12 pr-4 py-4 bg-emerald-50/30 border-2 border-emerald-100 rounded-2xl text-sm font-bold outline-none focus:border-emerald-500 transition-all text-black" 
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-rose-600 uppercase tracking-widest ml-1">Credit</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-600 font-bold">Rp</span>
                        <input 
                          type="number" 
                          required
                          value={newEntry.credit}
                          onChange={(e) => setNewEntry({...newEntry, credit: Number(e.target.value)})}
                          className="w-full pl-12 pr-4 py-4 bg-rose-50/30 border-2 border-rose-100 rounded-2xl text-sm font-bold outline-none focus:border-rose-500 transition-all text-black" 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-8 bg-slate-50/50 flex justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-8 py-4 bg-white border-2 border-slate-200 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="px-10 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 flex items-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    Post Entry
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

      {/* Overview Cards */}
      {(() => {
        const totalRev = financialData.reduce((s, d) => s + d.totalIncome, 0);
        const totalExp = financialData.reduce((s, d) => s + d.totalExpense, 0);
        const netProfit = totalRev - totalExp;
        const fmt = (n: number) => n >= 1e9
          ? `Rp ${(n / 1e9).toFixed(1)}M`
          : n >= 1e6
          ? `Rp ${(n / 1e6).toFixed(0)}Jt`
          : `Rp ${n.toLocaleString('id-ID')}`;
        const imbalance = Math.abs(journalEntries.reduce((s, e) => s + e.debit - e.credit, 0));
        const ledgerHealth = journalEntries.length > 0 && imbalance < 1 ? '100.0' : '0.0';
        const stats = [
          { label: 'Total Revenue (YTD)', val: fmt(totalRev), icon: TrendingUp, color: 'text-emerald-600' },
          { label: 'Total Expenses (YTD)', val: fmt(totalExp), icon: TrendingDown, color: 'text-rose-600' },
          { label: 'Net Profit (YTD)', val: fmt(netProfit), icon: DollarSign, color: netProfit >= 0 ? 'text-blue-600' : 'text-rose-600' },
          { label: 'Ledger Health', val: `${ledgerHealth}%`, icon: CheckCircle2, color: 'text-emerald-500' },
        ];
        return (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <div key={i} className="bg-white rounded-[2rem] p-6 border-2 border-slate-100 shadow-sm relative overflow-hidden group">
                <div className="flex justify-between items-start mb-4">
                   <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all">
                      <stat.icon size={20} />
                   </div>
                   <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">{journalEntries.length} entri</span>
                </div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                <h3 className={`text-xl font-black tracking-tight ${stat.color}`}>{stat.val}</h3>
              </div>
            ))}
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white rounded-[3rem] border-2 border-slate-100 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
               <h3 className="text-sm font-black uppercase italic tracking-widest text-slate-900 flex items-center gap-2">
                  <TrendingUp className="text-blue-600" size={20} />
                  Verified Cash Movement Analysis
               </h3>
               <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                     <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                     <span className="text-[9px] font-black uppercase text-slate-400">Pemasukan</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <div className="w-3 h-3 bg-rose-500 rounded-full"></div>
                     <span className="text-[9px] font-black uppercase text-slate-400">Pengeluaran</span>
                  </div>
               </div>
            </div>
            <div className="w-full h-[300px] lg:h-[400px] relative min-w-0">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={financialData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                     <defs>
                        <linearGradient id="gl-colorIncome" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                           <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="gl-colorExpense" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                           <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                        </linearGradient>
                     </defs>
                     <CartesianGrid key="grid" strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis
                        key="x"
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                     />
                     <YAxis key="y" hide />
                     <Tooltip key="tip" formatter={(val: number) => `Rp ${val.toLocaleString('id-ID')}`} />
                     <Area key="gl-income" name="Income" isAnimationActive={false} type="monotone" dataKey="totalIncome" stroke="#2563eb" strokeWidth={4} fillOpacity={1} fill="url(#gl-colorIncome)" dot={false} />
                     <Area key="gl-expense" name="Expense" isAnimationActive={false} type="monotone" dataKey="totalExpense" stroke="#f43f5e" strokeWidth={4} fillOpacity={1} fill="url(#gl-colorExpense)" dot={false} />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-4 bg-slate-900 rounded-[3rem] p-8 text-white relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-10">
                <Wallet size={120} />
             </div>
             <h3 className="text-sm font-black uppercase italic tracking-widest mb-8 text-blue-400">Current Ledger Balance</h3>
             {(() => {
                const totalRevYTD = financialData.reduce((s, d) => s + d.totalIncome, 0);
                const totalExpYTD = financialData.reduce((s, d) => s + d.totalExpense, 0);
                const availCash = totalRevYTD - totalExpYTD;
                const arNos = new Set(customerInvoiceList.map(i => i.noInvoice));
      const totalAR = customerInvoiceList.filter(i => i.status !== 'Paid' && i.status !== 'Cancelled').reduce((s, i) => s + i.outstandingAmount, 0)
        + invoiceList.filter(i => !['Paid','Partial'].includes(i.status) && !arNos.has(i.noInvoice)).reduce((s, i) => s + (i.totalBayar - (i.paidAmount || 0)), 0);
                const totalAP = expenseList.filter(e => e.status !== 'Paid').reduce((s, e) => s + (e.totalNominal || 0), 0)
                  + vendorInvoiceList.filter(vi => vi.status !== 'Paid').reduce((s, vi) => s + (vi.totalAmount || 0), 0);
                const fmt2 = (n: number) => n >= 1e9 ? `Rp ${(n/1e9).toFixed(1)}M` : n >= 1e6 ? `Rp ${(n/1e6).toFixed(0)}Jt` : `Rp ${n.toLocaleString('id-ID')}`;
                return (
             <div className="space-y-8 relative z-10">
                <div>
                   <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Net Cash (YTD)</p>
                   <h2 className={`text-4xl font-black italic tracking-tighter ${availCash >= 0 ? 'text-white' : 'text-rose-400'}`}>{fmt2(availCash)}</h2>
                   <div className="mt-2 flex items-center gap-2 text-slate-400 text-xs font-bold">
                      <TrendingUp size={14} /> Revenue − Expense kumulatif
                   </div>
                </div>

                <div className="pt-8 border-t border-slate-800 space-y-4">
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Piutang (AR)</span>
                      <span className="text-sm font-black italic">{fmt2(totalAR)}</span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Hutang (AP)</span>
                      <span className="text-sm font-black italic">{fmt2(totalAP)}</span>
                   </div>
                </div>

                <button
                   onClick={handleGenerateFullReport}
                   className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-900/50"
                >
                   Generate Full Report
                </button>
             </div>
                );
             })()}
      </div>
      </div>

      <div className="bg-white rounded-[3.5rem] border-2 border-slate-100 shadow-sm overflow-hidden mb-12">
          <div className="p-8 border-b-2 border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-50/50">
             <div className="flex gap-4">
                {['overview', 'income', 'expense'].map((tab) => (
                  <button 
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-slate-900 text-white shadow-xl' : 'bg-white border-2 border-slate-200 text-slate-400 hover:border-slate-300'}`}
                  >
                    {tab}
                  </button>
                ))}
             </div>
             <div className="flex gap-2">
                <div className="relative">
                   <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                   <input type="text" value={ledgerSearch} onChange={e => setLedgerSearch(e.target.value)} placeholder="Search entries..." className="pl-10 pr-4 py-2 bg-white border-2 border-slate-200 rounded-xl text-[11px] font-bold text-black outline-none focus:border-blue-500 transition-all w-64" />
                </div>
                <button className="p-2.5 bg-white border-2 border-slate-200 rounded-xl hover:bg-slate-50 text-slate-400 transition-all">
                   <Filter size={18} />
                </button>
             </div>
          </div>

          <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
                <thead>
                   <tr className="bg-white text-slate-400 font-black uppercase tracking-widest text-[9px] border-b-2 border-slate-50">
                      <th className="px-8 py-6">Date</th>
                      <th className="px-8 py-6">Reference</th>
                      <th className="px-8 py-6">Description</th>
                      <th className="px-8 py-6">Category</th>
                      <th className="px-8 py-6 text-right">Debit (Income)</th>
                      <th className="px-8 py-6 text-right">Credit (Expense)</th>
                      <th className="px-8 py-6 text-right font-black text-slate-900">Balance</th>
                   </tr>
                </thead>
                <tbody className="divide-y-2 divide-slate-50">
                   {journalEntries.map((item, i) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                         <td className="px-8 py-5">
                            <span className="font-bold text-slate-500">{new Date(item.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                         </td>
                         <td className="px-8 py-5">
                            <span className="font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">{item.reference}</span>
                         </td>
                         <td className="px-8 py-5">
                            <div className="flex flex-col">
                               <span className="font-black text-slate-900 uppercase italic tracking-tight">{item.description}</span>
                               <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">Verified Journal Entry System</span>
                            </div>
                         </td>
                         <td className="px-8 py-5">
                            <span className="px-3 py-1 bg-slate-100 rounded-lg text-[9px] font-black uppercase text-slate-500 tracking-tighter">{item.category}</span>
                         </td>
                         <td className="px-8 py-5 text-right font-black text-emerald-600">{formatCurrency(item.debit)}</td>
                         <td className="px-8 py-5 text-right font-black text-rose-500">{formatCurrency(item.credit)}</td>
                         <td className="px-8 py-5 text-right font-black text-slate-900 text-[12px] italic">{formatCurrency(item.balance)}</td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>
      </div>
    </div>
  );
}
