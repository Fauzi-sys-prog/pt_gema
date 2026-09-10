export const generatePayrollWordDocument = (payrollData: any) => {
  const { payrollSummary, totalPayroll, period } = payrollData;
  
  const wordHTML = `
<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
<head>
  <meta charset='utf-8'>
  <title>Daftar Gaji Karyawan - ${period || 'Mei 2025'}</title>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
    </w:WordDocument>
  </xml>
  <style>
    @page {
      size: A4 landscape;
      margin: 1.5cm 1cm 1.5cm 1cm;
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 9pt;
      line-height: 1.2;
      color: black;
    }
    
    /* Header */
    .header-container {
      border-bottom: 3pt solid black;
      padding-bottom: 8pt;
      margin-bottom: 12pt;
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
      width: 90px;
      padding-right: 10pt;
    }
    .logo-box {
      width: 80px;
      height: 55px;
      background-color: #CC0000;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2pt solid black;
    }
    .logo-text {
      color: white;
      font-size: 24pt;
      font-weight: bold;
      font-family: Arial Black, sans-serif;
    }
    .company-info {
      padding-left: 5pt;
    }
    .company-name {
      font-size: 11pt;
      font-weight: bold;
      margin: 0 0 2pt 0;
      color: #CC0000;
    }
    .company-subtitle {
      font-size: 7.5pt;
      font-weight: bold;
      margin: 0 0 3pt 0;
    }
    .company-address {
      font-size: 7pt;
      line-height: 1.2;
      margin: 0;
    }
    
    /* Title */
    .doc-title {
      text-align: center;
      margin: 15pt 0;
    }
    .doc-title h1 {
      font-size: 14pt;
      font-weight: bold;
      margin: 0 0 5pt 0;
      letter-spacing: 4pt;
    }
    .doc-subtitle {
      font-size: 9pt;
      margin: 0;
      font-weight: normal;
    }
    
    /* Table */
    .payroll-table {
      width: 100%;
      border-collapse: collapse;
      margin: 15pt 0;
      font-size: 8pt;
    }
    .payroll-table th {
      background-color: #1e293b;
      color: white;
      font-weight: bold;
      padding: 8pt 6pt;
      text-align: left;
      border: 1pt solid #333;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.5pt;
    }
    .payroll-table th.text-right {
      text-align: right;
    }
    .payroll-table th.text-center {
      text-align: center;
    }
    .payroll-table td {
      padding: 6pt;
      border: 1pt solid #cbd5e1;
      font-size: 8pt;
    }
    .payroll-table tbody tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .payroll-table tbody tr:hover {
      background-color: #f1f5f9;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
    .font-bold {
      font-weight: bold;
    }
    .text-emerald {
      color: #059669;
    }
    .text-rose {
      color: #e11d48;
    }
    .text-slate {
      color: #64748b;
    }
    
    /* Summary */
    .summary-box {
      margin-top: 20pt;
      padding: 12pt;
      background-color: #f8fafc;
      border: 2pt solid #1e293b;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      margin: 5pt 0;
      font-size: 10pt;
    }
    .summary-label {
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1pt;
    }
    .summary-value {
      font-weight: bold;
      font-size: 12pt;
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
    
    .signature-section {
      margin-top: 40pt;
      display: flex;
      justify-content: space-between;
    }
    .signature-box {
      width: 200px;
      text-align: center;
    }
    .sig-label {
      font-size: 9pt;
      font-weight: bold;
      margin-bottom: 50pt;
    }
    .sig-name {
      font-size: 9pt;
      border-top: 1pt solid black;
      padding-top: 5pt;
      font-weight: bold;
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
            Telp: 0878396237, 081388788177 | Fax: 02181012310
          </p>
        </td>
      </tr>
    </table>
  </div>

  <!-- Title -->
  <div class="doc-title">
    <h1>DAFTAR GAJI KARYAWAN</h1>
    <p class="doc-subtitle">Periode: ${period || 'Mei 2025'} | Generated: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
  </div>

  <!-- Payroll Table -->
  <table class="payroll-table">
    <thead>
      <tr>
        <th style="width: 5%;">No</th>
        <th style="width: 20%;">Nama Karyawan</th>
        <th style="width: 15%;">Posisi</th>
        <th style="width: 10%;" class="text-center">Status</th>
        <th style="width: 8%;" class="text-center">Kehadiran</th>
        <th style="width: 12%;" class="text-right">Gaji Pokok</th>
        <th style="width: 12%;" class="text-right">Tunjangan/OT</th>
        <th style="width: 10%;" class="text-right">Kasbon</th>
        <th style="width: 13%;" class="text-right">Gaji Bersih</th>
      </tr>
    </thead>
    <tbody>
      ${payrollSummary.map((p: any, idx: number) => `
      <tr>
        <td class="text-center">${idx + 1}</td>
        <td class="font-bold">${p.name}</td>
        <td class="text-slate">${p.position}</td>
        <td class="text-center">
          <span style="font-size: 7pt; font-weight: bold;">${p.employmentType}</span>
        </td>
        <td class="text-center">
          <strong>${p.attendanceCount}</strong> hari<br/>
          <span style="font-size: 7pt; color: #64748b;">${p.totalHours} jam</span>
        </td>
        <td class="text-right font-bold">Rp ${p.salary.toLocaleString('id-ID')}</td>
        <td class="text-right text-emerald font-bold">Rp ${(p.overtimePay + p.mealAllowance).toLocaleString('id-ID')}</td>
        <td class="text-right text-rose font-bold">${p.totalKasbon > 0 ? 'Rp ' + p.totalKasbon.toLocaleString('id-ID') : '-'}</td>
        <td class="text-right font-bold" style="background-color: #f0fdf4;">Rp ${p.netSalary.toLocaleString('id-ID')}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>

  <!-- Summary -->
  <div class="summary-box">
    <div class="summary-row">
      <span class="summary-label">Total Karyawan:</span>
      <span class="summary-value">${payrollSummary.length} Personel</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Total Net Payroll:</span>
      <span class="summary-value" style="color: #059669;">Rp ${totalPayroll.toLocaleString('id-ID')}</span>
    </div>
  </div>

  <!-- Signatures -->
  <table style="width: 100%; margin-top: 40pt; border: none;">
    <tr>
      <td style="width: 50%; text-align: center; border: none; vertical-align: top;">
        <p class="sig-label">Disetujui oleh,<br/>Finance Manager</p>
        <div style="height: 50pt;"></div>
        <p class="sig-name">_____________________</p>
      </td>
      <td style="width: 50%; text-align: center; border: none; vertical-align: top;">
        <p class="sig-label">Disiapkan oleh,<br/>HRD</p>
        <div style="height: 50pt;"></div>
        <p class="sig-name">_____________________</p>
      </td>
    </tr>
  </table>

  <!-- Footer -->
  <div class="footer">
    <p>Dokumen ini digenerate otomatis dari sistem Premium Warehouse Ledger - PT Gema Teknik Perkasa</p>
    <p>Confidential Document | For Internal Use Only</p>
  </div>
</body>
</html>
  `;

  return wordHTML;
};

export const downloadPayrollWordDocument = (payrollData: any, filename: string) => {
  const wordContent = generatePayrollWordDocument(payrollData);
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
