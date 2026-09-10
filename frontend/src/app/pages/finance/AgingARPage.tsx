import { useState, useMemo } from 'react';
import { Search, Download, AlertCircle } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

interface AgingAR {
  id: string;
  customer: string;
  totalOutstanding: number;
  current: number;   // not yet due
  days30: number;    // 1-30 days overdue
  days60: number;    // 31-60 days overdue
  days90: number;    // 61-90 days overdue
  over90: number;    // >90 days overdue
  invoiceCount: number;
}

export default function AgingARPage() {
  const { invoiceList = [], customerInvoiceList = [] } = useApp();
  const [searchTerm, setSearchTerm] = useState('');

  const today = new Date();

  // Merge both invoice sources, deduplicate by noInvoice
  // customerInvoiceList has accurate outstandingAmount after payments
  // invoiceList covers invoices not yet in AR (Draft/Sent)
  const agingList = useMemo<AgingAR[]>(() => {
    const byCustomer: Record<string, AgingAR> = {};

    const processEntry = (customer: string, outstanding: number, dueDate: string | undefined, count: number) => {
      if (!byCustomer[customer]) {
        byCustomer[customer] = { id: customer, customer, totalOutstanding: 0, current: 0, days30: 0, days60: 0, days90: 0, over90: 0, invoiceCount: 0 };
      }
      byCustomer[customer].totalOutstanding += outstanding;
      byCustomer[customer].invoiceCount += count;
      if (dueDate) {
        const overdueDays = Math.ceil((today.getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
        if (overdueDays <= 0) byCustomer[customer].current += outstanding;
        else if (overdueDays <= 30) byCustomer[customer].days30 += outstanding;
        else if (overdueDays <= 60) byCustomer[customer].days60 += outstanding;
        else if (overdueDays <= 90) byCustomer[customer].days90 += outstanding;
        else byCustomer[customer].over90 += outstanding;
      } else {
        byCustomer[customer].current += outstanding;
      }
    };

    // Primary: customerInvoiceList has real outstandingAmount post-payment
    const arInvoiceNos = new Set<string>();
    customerInvoiceList
      .filter(inv => !['Paid', 'Cancelled'].includes(inv.status) && inv.outstandingAmount > 0)
      .forEach(inv => {
        arInvoiceNos.add(inv.noInvoice);
        processEntry(inv.customerName || inv.customerId, inv.outstandingAmount, inv.dueDate, 1);
      });

    // Secondary: invoiceList entries not yet in AR (Draft/Sent, not tracked in customerInvoiceList)
    invoiceList
      .filter(inv => !['Paid', 'Partial'].includes(inv.status) && !arInvoiceNos.has(inv.noInvoice))
      .forEach(inv => {
        const outstanding = inv.totalBayar - (inv.paidAmount || 0);
        if (outstanding > 0) processEntry(inv.customer || 'Unknown', outstanding, inv.jatuhTempo, 1);
      });

    return Object.values(byCustomer).sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  }, [invoiceList, customerInvoiceList]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);
  };

  const filteredData = agingList.filter(item =>
    item.customer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalOutstanding = agingList.reduce((sum, item) => sum + item.totalOutstanding, 0);
  const totalCurrent = agingList.reduce((sum, item) => sum + item.current, 0);
  const total30 = agingList.reduce((sum, item) => sum + item.days30, 0);
  const total60 = agingList.reduce((sum, item) => sum + item.days60, 0);
  const total90 = agingList.reduce((sum, item) => sum + item.days90, 0);
  const totalOver90 = agingList.reduce((sum, item) => sum + item.over90, 0);

  const getRowColor = (item: AgingAR) => {
    if (item.over90 > 0) return 'bg-red-50';
    if (item.days90 > 0) return 'bg-orange-50';
    if (item.days60 > 0) return 'bg-yellow-50';
    return '';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900">Aging AR (Account Receivable)</h1>
          <p className="text-gray-600">Monitoring umur piutang customer</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Download size={20} />
          Export Report
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-gray-600 mb-2">Total Outstanding</div>
          <div className="text-gray-900">{formatCurrency(totalOutstanding)}</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-gray-600 mb-2">Current (0-30 days)</div>
          <div className="text-green-600">{formatCurrency(totalCurrent + total30)}</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-gray-600 mb-2">Overdue (&gt;30 days)</div>
          <div className="text-red-600">{formatCurrency(total60 + total90 + totalOver90)}</div>
        </div>
      </div>

      {/* Alert for Overdue */}
      {totalOver90 > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-600 mt-1" size={20} />
            <div>
              <div className="text-red-900">Critical: Overdue &gt; 90 Days</div>
              <div className="text-red-700 mt-1">
                Ada piutang lebih dari 90 hari: {formatCurrency(totalOver90)}. Segera lakukan penagihan!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Cari customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-gray-600">Customer</th>
                <th className="px-6 py-3 text-left text-gray-600">Total Outstanding</th>
                <th className="px-6 py-3 text-left text-gray-600">Current</th>
                <th className="px-6 py-3 text-left text-gray-600">1-30 Days</th>
                <th className="px-6 py-3 text-left text-gray-600">31-60 Days</th>
                <th className="px-6 py-3 text-left text-gray-600">61-90 Days</th>
                <th className="px-6 py-3 text-left text-gray-600">&gt; 90 Days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    {agingList.length === 0 ? 'Tidak ada piutang outstanding — semua invoice sudah lunas.' : 'Tidak ada hasil pencarian.'}
                  </td>
                </tr>
              )}
              {filteredData.map((item) => (
                <tr key={item.id} className={`hover:bg-gray-50 ${getRowColor(item)}`}>
                  <td className="px-6 py-4 text-gray-900">
                    <div>{item.customer}</div>
                    <div className="text-xs text-gray-400">{item.invoiceCount} invoice</div>
                  </td>
                  <td className="px-6 py-4 text-gray-900">{formatCurrency(item.totalOutstanding)}</td>
                  <td className="px-6 py-4 text-green-600">{formatCurrency(item.current)}</td>
                  <td className="px-6 py-4 text-blue-600">{formatCurrency(item.days30)}</td>
                  <td className="px-6 py-4 text-yellow-600">{formatCurrency(item.days60)}</td>
                  <td className="px-6 py-4 text-orange-600">{formatCurrency(item.days90)}</td>
                  <td className="px-6 py-4 text-red-600">{formatCurrency(item.over90)}</td>
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-gray-100">
                <td className="px-6 py-4 text-gray-900">TOTAL</td>
                <td className="px-6 py-4 text-gray-900">{formatCurrency(totalOutstanding)}</td>
                <td className="px-6 py-4 text-green-600">{formatCurrency(totalCurrent)}</td>
                <td className="px-6 py-4 text-blue-600">{formatCurrency(total30)}</td>
                <td className="px-6 py-4 text-yellow-600">{formatCurrency(total60)}</td>
                <td className="px-6 py-4 text-orange-600">{formatCurrency(total90)}</td>
                <td className="px-6 py-4 text-red-600">{formatCurrency(totalOver90)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-gray-900 mb-4">Aging Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Current (0 days)</span>
              <span className="text-green-600">{formatCurrency(totalCurrent)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">1-30 Days</span>
              <span className="text-blue-600">{formatCurrency(total30)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">31-60 Days</span>
              <span className="text-yellow-600">{formatCurrency(total60)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">61-90 Days</span>
              <span className="text-orange-600">{formatCurrency(total90)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">&gt; 90 Days</span>
              <span className="text-red-600">{formatCurrency(totalOver90)}</span>
            </div>
            <div className="border-t pt-3 flex justify-between items-center">
              <span className="text-gray-900">Total</span>
              <span className="text-gray-900">{formatCurrency(totalOutstanding)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-gray-900 mb-4">Aging Distribution</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-gray-600 mb-1">
                <span>Current</span>
                <span>{totalOutstanding > 0 ? ((totalCurrent / totalOutstanding) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${totalOutstanding > 0 ? (totalCurrent / totalOutstanding) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-gray-600 mb-1">
                <span>1-30 Days</span>
                <span>{totalOutstanding > 0 ? ((total30 / totalOutstanding) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${totalOutstanding > 0 ? (total30 / totalOutstanding) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-gray-600 mb-1">
                <span>31-60 Days</span>
                <span>{totalOutstanding > 0 ? ((total60 / totalOutstanding) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-yellow-600 h-2 rounded-full"
                  style={{ width: `${totalOutstanding > 0 ? (total60 / totalOutstanding) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-gray-600 mb-1">
                <span>61-90 Days</span>
                <span>{totalOutstanding > 0 ? ((total90 / totalOutstanding) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-orange-600 h-2 rounded-full"
                  style={{ width: `${totalOutstanding > 0 ? (total90 / totalOutstanding) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-gray-600 mb-1">
                <span>&gt; 90 Days</span>
                <span>{totalOutstanding > 0 ? ((totalOver90 / totalOutstanding) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-red-600 h-2 rounded-full"
                  style={{ width: `${totalOutstanding > 0 ? (totalOver90 / totalOutstanding) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}