export const generateSPTMasaWordDocument = (ppnData: any) => {
  const { transactions, period, totalPPNIn, totalPPNOut, netPPN } = ppnData;
  
  const wordHTML = `
<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
<head>
  <meta charset='utf-8'>
  <title>SPT Masa PPN - ${period}</title>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
    </w:WordDocument>
  </xml>
  <style>
    @page {
      size: A4;
      margin: 2cm 2cm 2cm 2cm;
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.3;
      color: black;
    }
    
    /* Header */
    .header-container {
      border-bottom: 3pt solid black;
      padding-bottom: 10pt;
      margin-bottom: 20pt;
    }
    .header-table {
      width: 100%;
      border: none;
    }
    .header-table td {
      border: none;
      vertical-align: top;
      padding: 0;
    }
    .logo-cell {
      width: 100px;
      padding-right: 10pt;
    }
    .logo-box {
      width: 90px;
      height: 60px;
      background-color: #CC0000;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2pt solid black;
    }
    .logo-text {
      color: white;
      font-size: 28pt;
      font-weight: bold;
      font-family: Arial Black, sans-serif;
    }
    .company-info {
      padding-left: 5pt;
    }
    .company-name {
      font-size: 12pt;
      font-weight: bold;
      margin: 0 0 2pt 0;
      color: #CC0000;
    }
    .company-subtitle {
      font-size: 8pt;
      font-weight: bold;
      margin: 0 0 3pt 0;
    }
    .company-address {
      font-size: 7.5pt;
      line-height: 1.2;
      margin: 0;
    }
    
    /* Title */
    .doc-title {
      text-align: center;
      margin: 20pt 0;
    }
    .doc-title h1 {
      font-size: 14pt;
      font-weight: bold;
      margin: 0 0 5pt 0;
      letter-spacing: 4pt;
    }
    .doc-subtitle {
      font-size: 10pt;
      margin: 0;
    }
    
    /* Company Info Box */
    .company-box {
      margin: 20pt 0;
      padding: 12pt;
      background-color: #f8f9fa;
      border: 1pt solid #dee2e6;
    }
    .info-row {
      margin: 5pt 0;
      font-size: 9pt;
    }
    .info-label {
      display: inline-block;
      width: 150px;
      font-weight: bold;
    }
    
    /* Summary Section */
    .summary-section {
      margin: 25pt 0;
    }
    .summary-title {
      font-size: 11pt;
      font-weight: bold;
      margin-bottom: 10pt;
      padding-bottom: 5pt;
      border-bottom: 2pt solid #1e293b;
    }
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10pt 0;
    }
    .summary-table td {
      padding: 8pt;
      border: 1pt solid #cbd5e1;
      font-size: 9pt;
    }
    .summary-table td:first-child {
      font-weight: bold;
      width: 60%;
      background-color: #f8fafc;
    }
    .summary-table td:last-child {
      text-align: right;
      width: 40%;
    }
    .summary-total {
      background-color: #1e293b;
      color: white;
      font-weight: bold;
      font-size: 10pt;
    }
    .ppn-in {
      color: #059669;
    }
    .ppn-out {
      color: #dc2626;
    }
    
    /* Transactions Table */
    .transactions-table {
      width: 100%;
      border-collapse: collapse;
      margin: 15pt 0;
      font-size: 8pt;
    }
    .transactions-table th {
      background-color: #1e293b;
      color: white;
      font-weight: bold;
      padding: 8pt;
      text-align: left;
      border: 1pt solid #333;
      font-size: 7.5pt;
    }
    .transactions-table th.text-right {
      text-align: right;
    }
    .transactions-table td {
      padding: 6pt;
      border: 1pt solid #cbd5e1;
      vertical-align: top;
    }
    .transactions-table tbody tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .text-right {
      text-align: right;
    }
    
    /* Signature */
    .signature-section {
      margin-top: 50pt;
    }
    .signature-table {
      width: 100%;
      border: none;
    }
    .signature-table td {
      border: none;
      width: 50%;
      padding: 0 15pt;
      vertical-align: top;
      text-align: center;
    }
    .sig-label {
      font-size: 9pt;
      margin-bottom: 3pt;
      font-weight: bold;
    }
    .sig-space {
      height: 60pt;
    }
    .sig-name {
      font-size: 9pt;
      border-top: 1pt solid black;
      padding-top: 3pt;
      display: inline-block;
      min-width: 150px;
      font-weight: bold;
    }
    
    /* Footer */
    .footer {
      margin-top: 30pt;
      padding-top: 10pt;
      border-top: 1pt solid #cbd5e1;
      font-size: 7pt;
      color: #64748b;
      text-align: center;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header-container">
    <table class="header-table">
      <tr>
        <td class="logo-cell">
          <div class="logo-box">
            <span class="logo-text">GM</span>
          </div>
        </td>
        <td class="company-info">
          <p class="company-name">PT GEMA TEKNIK PERKASA</p>
          <p class="company-subtitle">SPESIALIS FABRIKASI & JASA PEMASANGAN PIPA</p>
          <p class="company-address">
            Jl. Nurushoba II No 13 Setia Mekar, Tambun Selatan Bekasi 17510<br/>
            Telp: 0878396237, 081388788177 | Fax: 02181012310<br/>
            NPWP: 01.234.567.8-901.000
          </p>
        </td>
      </tr>
    </table>
  </div>

  <!-- Title -->
  <div class="doc-title">
    <h1>SPT MASA PPN</h1>
    <p class="doc-subtitle">Surat Pemberitahuan Pajak Pertambahan Nilai</p>
    <p class="doc-subtitle">Masa Pajak: ${period || 'Februari 2026'}</p>
  </div>

  <!-- Company Tax Info -->
  <div class="company-box">
    <div class="info-row">
      <span class="info-label">Nama Perusahaan:</span>
      <strong>PT GEMA TEKNIK PERKASA</strong>
    </div>
    <div class="info-row">
      <span class="info-label">NPWP:</span>
      01.234.567.8-901.000
    </div>
    <div class="info-row">
      <span class="info-label">Alamat:</span>
      Jl. Nurushoba II No 13 Setia Mekar, Tambun Selatan Bekasi 17510
    </div>
    <div class="info-row">
      <span class="info-label">Jenis Usaha:</span>
      Jasa Fabrikasi & Pemasangan Pipa
    </div>
  </div>

  <!-- Summary Section -->
  <div class="summary-section">
    <p class="summary-title">RINGKASAN PERHITUNGAN PPN</p>
    
    <table class="summary-table">
      <tr>
        <td>1. Pajak Keluaran (PPN atas Penjualan)</td>
        <td class="ppn-out">Rp ${(totalPPNOut || 0).toLocaleString('id-ID')}</td>
      </tr>
      <tr>
        <td>2. Pajak Masukan (PPN atas Pembelian)</td>
        <td class="ppn-in">Rp ${(totalPPNIn || 0).toLocaleString('id-ID')}</td>
      </tr>
      <tr class="summary-total">
        <td>PPN yang harus dibayar / (Lebih Bayar)</td>
        <td>${netPPN >= 0 ? 'Rp ' + netPPN.toLocaleString('id-ID') : '(Rp ' + Math.abs(netPPN).toLocaleString('id-ID') + ')'}</td>
      </tr>
    </table>
  </div>

  <!-- Detail Transactions -->
  <div class="summary-section">
    <p class="summary-title">RINCIAN TRANSAKSI PPN</p>
    
    <table class="transactions-table">
      <thead>
        <tr>
          <th style="width: 5%;">No</th>
          <th style="width: 15%;">Tanggal</th>
          <th style="width: 20%;">No. Faktur</th>
          <th style="width: 25%;">Keterangan</th>
          <th style="width: 10%;">Jenis</th>
          <th style="width: 12%;" class="text-right">DPP</th>
          <th style="width: 13%;" class="text-right">PPN 11%</th>
        </tr>
      </thead>
      <tbody>
        ${transactions && transactions.length > 0 ? transactions.map((trx: any, idx: number) => `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td>${new Date(trx.date || Date.now()).toLocaleDateString('id-ID')}</td>
          <td>${trx.invoiceNo || '-'}</td>
          <td>${trx.description || trx.projectName || 'Transaction'}</td>
          <td style="text-align: center;">
            <strong style="color: ${trx.type === 'OUT' ? '#dc2626' : '#059669'};">${trx.type || 'OUT'}</strong>
          </td>
          <td class="text-right">Rp ${((trx.amount || 0) / 1.11).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</td>
          <td class="text-right"><strong>Rp ${(trx.ppnAmount || 0).toLocaleString('id-ID')}</strong></td>
        </tr>
        `).join('') : '<tr><td colspan="7" style="text-align: center; padding: 20pt;">Tidak ada transaksi PPN pada periode ini</td></tr>'}
      </tbody>
    </table>
  </div>

  <!-- Declaration -->
  <div style="margin: 30pt 0; padding: 12pt; background-color: #fef3c7; border: 1pt solid #f59e0b;">
    <p style="font-size: 8pt; margin: 0; text-align: justify;">
      <strong>Pernyataan:</strong> Dengan menyadari sepenuhnya akan segala akibatnya termasuk sanksi-sanksi sesuai dengan ketentuan perundang-undangan yang berlaku, saya menyatakan bahwa apa yang telah saya beritahukan di atas beserta lampiran-lampirannya adalah benar, lengkap dan jelas.
    </p>
  </div>

  <!-- Signature -->
  <div class="signature-section">
    <table class="signature-table">
      <tr>
        <td>
          <p class="sig-label">Mengetahui,<br/>Direktur</p>
          <div class="sig-space"></div>
          <p class="sig-name">Syamsudin</p>
        </td>
        <td>
          <p class="sig-label">Disiapkan oleh,<br/>Finance Manager</p>
          <div class="sig-space"></div>
          <p class="sig-name">_____________________</p>
        </td>
      </tr>
    </table>
  </div>

  <!-- Footer -->
  <div class="footer">
    <p>Dokumen ini digenerate otomatis dari sistem Premium Warehouse Ledger - PT Gema Teknik Perkasa</p>
    <p>Confidential Tax Document | For Tax Office Submission</p>
  </div>
</body>
</html>
  `;

  return wordHTML;
};

export const downloadSPTMasaWordDocument = (ppnData: any, filename: string) => {
  const wordContent = generateSPTMasaWordDocument(ppnData);
  const blob = new Blob(['\ufeff', wordContent], {
    type: 'application/msword'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
