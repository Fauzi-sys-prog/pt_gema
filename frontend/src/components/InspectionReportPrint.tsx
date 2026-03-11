import React from 'react';
import type { QCInspection } from '../contexts/AppContext';

interface InspectionReportPrintProps {
  inspection: QCInspection;
}

export function InspectionReportPrint({ inspection }: InspectionReportPrintProps) {
  return (
    <div className="bg-white p-12 max-w-[210mm] mx-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* HEADER */}
      <div className="border-2 border-black mb-6">
        <div className="grid grid-cols-3 border-b-2 border-black">
          {/* LEFT: Company Logo/Info */}
          <div className="col-span-1 border-r-2 border-black p-4">
            <div className="text-center">
              <div className="text-xl font-bold">GTP</div>
              <div className="text-[8px] leading-tight mt-1">
                PT GEMA TEKNIK PERKASA
              </div>
            </div>
          </div>
          
          {/* CENTER: Title */}
          <div className="col-span-1 border-r-2 border-black p-4 flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-wide">INSPEKSI REPORT</h1>
            </div>
          </div>
          
          {/* RIGHT: Certifications */}
          <div className="col-span-1 p-2 text-[8px] leading-tight">
            <div className="grid grid-cols-2 gap-1">
              <div className="border border-black p-1 text-center">ISO 9001</div>
              <div className="border border-black p-1 text-center">SNI 3478</div>
              <div className="border border-black p-1 text-center col-span-2">IHI GROUP</div>
            </div>
          </div>
        </div>
        
        {/* INFO ROW */}
        <div className="grid grid-cols-2 text-[10px]">
          <div className="col-span-1 border-r-2 border-black p-2">
            <table className="w-full">
              <tbody>
                <tr>
                  <td className="font-bold w-32">CUSTOMER</td>
                  <td>: {inspection.customerName || '-'}</td>
                </tr>
                <tr>
                  <td className="font-bold">NAMA PRODUK</td>
                  <td>: {inspection.itemNama}</td>
                </tr>
                <tr>
                  <td className="font-bold">BATCH NO</td>
                  <td>: {inspection.batchNo}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="col-span-1 p-2">
            <table className="w-full">
              <tbody>
                <tr>
                  <td className="font-bold w-32">DOC NO</td>
                  <td>: {inspection.id}</td>
                </tr>
                <tr>
                  <td className="font-bold">TANGGAL</td>
                  <td>: {inspection.tanggal}</td>
                </tr>
                <tr>
                  <td className="font-bold">INSPECTOR</td>
                  <td>: {inspection.inspectorName}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* LEFT: Drawing */}
        <div className="border-2 border-black">
          <div className="bg-gray-100 border-b-2 border-black p-2 text-center font-bold text-xs">
            DRAWING TEKNIS
          </div>
          <div className="p-4 min-h-[300px] flex items-center justify-center bg-gray-50">
            {inspection.drawingUrl ? (
              <img 
                src={inspection.drawingUrl} 
                alt="Technical Drawing" 
                className="max-w-full max-h-[280px] object-contain"
              />
            ) : inspection.photoUrl ? (
              <img 
                src={inspection.photoUrl} 
                alt="Product Photo" 
                className="max-w-full max-h-[280px] object-contain"
              />
            ) : (
              <div className="text-gray-400 text-sm">No drawing available</div>
            )}
          </div>
        </div>

        {/* RIGHT: Dimension Table */}
        <div className="border-2 border-black">
          <div className="bg-gray-100 border-b-2 border-black p-2 text-center font-bold text-xs">
            TABEL DIMENSI
          </div>
          <div className="overflow-hidden">
            <table className="w-full text-[9px] border-collapse">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border border-black p-1">PARAM</th>
                  <th className="border border-black p-1">SPEC</th>
                  <th className="border border-black p-1">S1</th>
                  <th className="border border-black p-1">S2</th>
                  <th className="border border-black p-1">S3</th>
                  <th className="border border-black p-1">S4</th>
                  <th className="border border-black p-1">RESULT</th>
                </tr>
              </thead>
              <tbody>
                {inspection.dimensions && inspection.dimensions.length > 0 ? (
                  inspection.dimensions.map((dim, idx) => (
                    <tr key={idx}>
                      <td className="border border-black p-1 font-bold text-center">{dim.parameter}</td>
                      <td className="border border-black p-1 text-center">{dim.specification}</td>
                      <td className="border border-black p-1 text-center">{dim.sample1}</td>
                      <td className="border border-black p-1 text-center">{dim.sample2}</td>
                      <td className="border border-black p-1 text-center">{dim.sample3}</td>
                      <td className="border border-black p-1 text-center">{dim.sample4}</td>
                      <td className={`border border-black p-1 text-center font-bold ${
                        dim.result === 'OK' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {dim.result}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="border border-black p-4 text-center text-gray-400">
                      No dimension data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* INSPECTION CHECKLIST */}
      <div className="border-2 border-black mb-6">
        <div className="bg-gray-100 border-b-2 border-black p-2 text-center font-bold text-xs">
          HASIL PEMERIKSAAN
        </div>
        <div className="p-4">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 border-2 border-black ${inspection.visualCheck ? 'bg-black' : ''}`}></div>
              <span className="text-xs font-bold">VISUAL CHECK</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 border-2 border-black ${inspection.dimensionCheck ? 'bg-black' : ''}`}></div>
              <span className="text-xs font-bold">DIMENSION CHECK</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 border-2 border-black ${inspection.materialCheck ? 'bg-black' : ''}`}></div>
              <span className="text-xs font-bold">MATERIAL CHECK</span>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <span className="font-bold">QTY INSPECTED:</span>
              <span className="ml-2 border-b border-black px-2">{inspection.qtyInspected} pcs</span>
            </div>
            <div>
              <span className="font-bold">QTY PASSED:</span>
              <span className="ml-2 border-b border-black px-2 text-green-600">{inspection.qtyPassed} pcs</span>
            </div>
            <div>
              <span className="font-bold">QTY REJECTED:</span>
              <span className="ml-2 border-b border-black px-2 text-red-600">{inspection.qtyRejected} pcs</span>
            </div>
          </div>
        </div>
      </div>

      {/* REMARK */}
      <div className="border-2 border-black mb-6">
        <div className="bg-gray-100 border-b-2 border-black p-2 font-bold text-xs">
          REMARK / CATATAN
        </div>
        <div className="p-4 min-h-[80px] text-xs">
          {inspection.remark || inspection.notes || '-'}
        </div>
      </div>

      {/* STATUS FINAL */}
      <div className="border-2 border-black mb-6">
        <div className="bg-gray-100 border-b-2 border-black p-2 text-center font-bold text-xs">
          STATUS FINAL
        </div>
        <div className="p-4 text-center">
          <div className={`inline-block px-8 py-2 border-2 font-bold text-lg ${
            inspection.status === 'Passed' ? 'border-green-600 text-green-600 bg-green-50' :
            inspection.status === 'Rejected' ? 'border-red-600 text-red-600 bg-red-50' :
            'border-orange-600 text-orange-600 bg-orange-50'
          }`}>
            {inspection.status === 'Passed' ? 'RELEASE - PASSED' :
             inspection.status === 'Rejected' ? 'HOLD - REJECTED' :
             'PARTIAL RELEASE'}
          </div>
        </div>
      </div>

      {/* SIGNATURE */}
      <div className="grid grid-cols-3 gap-6 text-xs">
        <div className="border-2 border-black p-4">
          <div className="text-center font-bold mb-12">DIBUAT OLEH</div>
          <div className="border-t-2 border-black pt-2 text-center">
            <div className="font-bold">{inspection.inspectorName}</div>
            <div className="text-[10px] text-gray-600">QC Inspector</div>
          </div>
        </div>
        <div className="border-2 border-black p-4">
          <div className="text-center font-bold mb-12">DIPERIKSA OLEH</div>
          <div className="border-t-2 border-black pt-2 text-center">
            <div className="font-bold">_____________</div>
            <div className="text-[10px] text-gray-600">QC Supervisor</div>
          </div>
        </div>
        <div className="border-2 border-black p-4">
          <div className="text-center font-bold mb-12">DISETUJUI OLEH</div>
          <div className="border-t-2 border-black pt-2 text-center">
            <div className="font-bold">_____________</div>
            <div className="text-[10px] text-gray-600">Production Manager</div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="mt-6 text-center text-[8px] text-gray-500">
        <p>PT GEMA TEKNIK PERKASA - Jl. Nurusamba II No.13, Setta Mekar 16M, Rawa Selatan, Bekasi 17510</p>
        <p>This document is generated by Premium Warehouse Ledger ERP System</p>
      </div>
    </div>
  );
}
