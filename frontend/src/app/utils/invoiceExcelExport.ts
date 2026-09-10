import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import gmLogo from "figma:asset/661f558dc14c79fa090b7039a885f26b843f5c04.png";
import ownerSignature from '../../assets/owner-signature.png';

const thin = { style: 'thin' as const, color: { argb: 'FF000000' } };
const medium = { style: 'medium' as const, color: { argb: 'FF000000' } };
const box = { top: thin, left: thin, bottom: thin, right: thin };
const money = '#,##0';
const fontName = 'Book Antiqua';

async function addInvoiceTextBoxes(workbookBuffer: ExcelJS.Buffer) {
  const zip = await JSZip.loadAsync(workbookBuffer as ArrayBuffer);
  const drawingPath = Object.keys(zip.files).find(path => /^xl\/drawings\/drawing\d+\.xml$/.test(path));
  if (!drawingPath) throw new Error('Drawing Excel untuk TextBox INVOICE tidak ditemukan');

  const drawingFile = zip.file(drawingPath);
  if (!drawingFile) throw new Error('Drawing Excel tidak dapat dibaca');
  let drawingXml = await drawingFile.async('string');
  const usedIds = [...drawingXml.matchAll(/<xdr:cNvPr[^>]*\sid="(\d+)"/g)].map(match => Number(match[1]));
  const headerShapeId = Math.max(0, ...usedIds) + 1;
  const titleShapeId = headerShapeId + 1;
  const headerTextBoxXml = `<xdr:twoCellAnchor editAs="oneCell">
    <xdr:from><xdr:col>2</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>7</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>5</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:sp macro="" textlink="">
      <xdr:nvSpPr><xdr:cNvPr id="${headerShapeId}" name="Company Header TextBox"/><xdr:cNvSpPr txBox="1"/></xdr:nvSpPr>
      <xdr:spPr bwMode="auto"><a:xfrm/><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></xdr:spPr>
      <xdr:txBody>
        <a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" rtlCol="0" anchor="t"><a:spAutoFit/></a:bodyPr><a:lstStyle/>
        <a:p><a:pPr marL="0" marR="0" lvl="0"/><a:r><a:rPr lang="en-US" sz="1500" b="1" i="1"><a:latin typeface="Book Antiqua"/></a:rPr><a:t>GEMA TEKNIK PERKASA</a:t></a:r><a:endParaRPr lang="en-US" sz="1500"/></a:p>
        <a:p><a:pPr marL="0" marR="0" lvl="0"/><a:r><a:rPr lang="en-US" sz="900" b="1" i="1"><a:latin typeface="Book Antiqua"/></a:rPr><a:t>REFRACTORY FURNACE AND BOILER</a:t></a:r><a:endParaRPr lang="en-US" sz="900"/></a:p>
        <a:p><a:pPr marL="0" marR="0" lvl="0"/><a:r><a:rPr lang="en-US" sz="800" i="1"><a:latin typeface="Book Antiqua"/></a:rPr><a:t>Jl. Nurushoba II No 13 Setia Mekar Tambun Selatan Bekasi 17510</a:t></a:r><a:endParaRPr lang="en-US" sz="800"/></a:p>
        <a:p><a:pPr marL="0" marR="0" lvl="0"/><a:r><a:rPr lang="en-US" sz="800" i="1"><a:latin typeface="Book Antiqua"/></a:rPr><a:t>Phone : 085100420221, 021.88354139   Fax : 021.88354139</a:t></a:r><a:endParaRPr lang="en-US" sz="800"/></a:p>
        <a:p><a:pPr marL="0" marR="0" lvl="0"/><a:r><a:rPr lang="en-US" sz="800" i="1"><a:solidFill><a:srgbClr val="0000CC"/></a:solidFill><a:latin typeface="Book Antiqua"/></a:rPr><a:t>Email : gemateknik@gmail.com</a:t></a:r><a:endParaRPr lang="en-US" sz="800"/></a:p>
      </xdr:txBody>
    </xdr:sp>
    <xdr:clientData/>
  </xdr:twoCellAnchor>`;
  const textBoxXml = `<xdr:twoCellAnchor editAs="oneCell">
    <xdr:from><xdr:col>5</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>4</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>7</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>6</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:sp macro="" textlink="">
      <xdr:nvSpPr><xdr:cNvPr id="${titleShapeId}" name="INVOICE TextBox"/><xdr:cNvSpPr txBox="1"/></xdr:nvSpPr>
      <xdr:spPr bwMode="auto"><a:xfrm/><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="12700"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln></xdr:spPr>
      <xdr:txBody><a:bodyPr wrap="square" rtlCol="0" anchor="ctr"><a:spAutoFit/></a:bodyPr><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="1800" b="1"><a:latin typeface="Book Antiqua"/></a:rPr><a:t>INVOICE</a:t></a:r><a:endParaRPr lang="en-US" sz="1800"/></a:p></xdr:txBody>
    </xdr:sp>
    <xdr:clientData/>
  </xdr:twoCellAnchor>`;

  if (!drawingXml.includes('</xdr:wsDr>')) throw new Error('Format drawing Excel tidak dikenali');
  drawingXml = drawingXml.replace('</xdr:wsDr>', `${headerTextBoxXml}${textBoxXml}</xdr:wsDr>`);
  zip.file(drawingPath, drawingXml);
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}

async function imageBase64(source: string) {
  const blob = await (await fetch(source)).blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function setOuterBorder(ws: ExcelJS.Worksheet, top: number, left: number, bottom: number, right: number) {
  for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) {
    ws.getCell(row, col).border = {
      top: row === top ? thin : undefined, bottom: row === bottom ? thin : undefined,
      left: col === left ? thin : undefined, right: col === right ? thin : undefined,
    };
  }
}

export async function exportInvoiceToXlsx(inv: any) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PT Gema Teknik Perkasa';
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;
  const ws = wb.addWorksheet('INVOICE', { pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1, margins: { left: .25, right: .25, top: .25, bottom: .25, header: 0, footer: 0 } } });
  ws.views = [{ showGridLines: false }];
  ws.properties.defaultRowHeight = 15;
  ws.columns = [{ width: 8 }, { width: 9 }, { width: 27 }, { width: 16 }, { width: 4 }, { width: 16 }, { width: 19 }];

  const logo = wb.addImage({ base64: await imageBase64(gmLogo), extension: 'png' });
  ws.addImage(logo, { tl: { col: .05, row: .15 }, ext: { width: 100, height: 59 } });
  // Identitas perusahaan di samping logo ditambahkan sebagai TextBox Excel asli.
  ws.getRow(1).height = 19; [2, 3, 4, 5].forEach(row => { ws.getRow(row).height = 12; });
  for (let col = 1; col <= 7; col++) ws.getCell(6, col).border = { bottom: medium };
  // Judul INVOICE ditambahkan sebagai TextBox Excel asli setelah workbook dibuat.
  ws.mergeCells('E7:G7'); ws.getCell('E7').value = `No : ${inv.noInvoice || '-'}`; ws.getCell('E7').font = { name: fontName, size: 11, bold: true }; ws.getCell('E7').alignment = { horizontal: 'center' };
  ws.getRow(8).height = 7;

  ws.mergeCells('A9:D9'); ws.getCell('A9').value = 'CUSTOMER'; ws.getCell('A9').font = { name: fontName, size: 10, bold: true };
  ws.mergeCells('E9:G9'); ws.getCell('E9').value = 'DETAIL INVOICE'; ws.getCell('E9').font = { name: fontName, size: 10, bold: true };
  const customerRows = [['Name', inv.customer || '-'], ['Alamat', inv.alamat || '-'], ['U/P', inv.up || inv.customerContact || 'Accounting Department']];
  customerRows.forEach(([label, value], index) => {
    const row = 10 + index * 2; ws.getCell(row, 1).value = label; ws.getCell(row, 2).value = ':';
    ws.mergeCells(row, 3, row + 1, 4); ws.getCell(row, 3).value = value; ws.getCell(row, 3).alignment = { wrapText: true, vertical: 'top' };
  });
  const detailRows = [['Date', inv.tanggal || '-'], ['PO Number', inv.noPO || '-'], ['PO Date', inv.poDate || inv.tanggalPO || '-'], ['DUE DATE', inv.jatuhTempo || inv.dueDate || inv.terminLabel || 'CASH']];
  detailRows.forEach(([label, value], index) => { const row = 10 + index; ws.getCell(row, 5).value = label; ws.getCell(row, 6).value = ':'; ws.getCell(row, 7).value = value; ws.getCell(row, 7).alignment = { wrapText: true }; });
  setOuterBorder(ws, 9, 1, 15, 4); setOuterBorder(ws, 9, 5, 15, 7); ws.getRow(16).height = 7;

  const tableHeaderRow = 17;
  ws.mergeCells(`A${tableHeaderRow}:B${tableHeaderRow}`); ws.mergeCells(`C${tableHeaderRow}:F${tableHeaderRow}`);
  ws.getCell(`A${tableHeaderRow}`).value = 'Qty'; ws.getCell(`C${tableHeaderRow}`).value = 'DESCRIPTION'; ws.getCell(`G${tableHeaderRow}`).value = 'TOTAL PRICE';
  ['A', 'C', 'G'].forEach(column => { const cell = ws.getCell(`${column}${tableHeaderRow}`); cell.font = { name: fontName, size: 9, bold: true }; cell.alignment = { horizontal: 'center' }; cell.border = box; });

  const items = Array.isArray(inv.items) ? inv.items : [];
  const minimumBodyRows = Math.max(10, items.length);
  const itemStartRow = tableHeaderRow + 1;
  for (let index = 0; index < minimumBodyRows; index++) {
    const row = itemStartRow + index; const item = items[index];
    ws.mergeCells(row, 1, row, 2); ws.mergeCells(row, 3, row, 6);
    if (item) {
      const qty = Number(item.qty || 0), unit = item.satuan || item.unit || 'Lot', unitPrice = Number(item.hargaSatuan || item.unitPrice || 0);
      const lineTotal = Number(item.jumlah ?? item.total ?? qty * unitPrice);
      ws.getCell(row, 1).value = `${qty}  ${unit}`; ws.getCell(row, 3).value = item.deskripsi || item.description || '-';
      ws.getCell(row, 7).value = lineTotal; ws.getCell(row, 7).numFmt = money;
      ws.getRow(row).height = Math.max(22, String(item.deskripsi || item.description || '').length > 55 ? 34 : 22);
    } else ws.getRow(row).height = 18;
    ws.getCell(row, 1).alignment = { horizontal: 'center', vertical: 'top', wrapText: true }; ws.getCell(row, 3).alignment = { vertical: 'top', wrapText: true };
    ws.getCell(row, 7).alignment = { horizontal: 'right', vertical: 'top' };
    ['A', 'C', 'G'].forEach(column => { ws.getCell(`${column}${row}`).border = box; });
  }

  let summaryRow = itemStartRow + minimumBodyRows;
  const subtotal = Number(inv.subtotal || items.reduce((sum: number, item: any) => sum + Number(item.jumlah ?? item.total ?? (item.qty || 0) * (item.hargaSatuan || 0)), 0));
  const ppn = Number(inv.ppn || 0), terminPercent = Number(inv.terminPercent || 0);
  const terminBase = terminPercent > 0 ? Math.round(subtotal * terminPercent / 100) : subtotal;
  const grandTotal = Number(inv.totalBayar ?? inv.totalNominal ?? (terminBase + ppn - Number(inv.pph || 0)));
  const addSummary = (label: string, value: number, bold = false) => {
    ws.mergeCells(summaryRow, 4, summaryRow, 5); ws.getCell(summaryRow, 4).value = label; ws.getCell(summaryRow, 4).alignment = { horizontal: 'right' };
    ws.getCell(summaryRow, 6).value = 'Rp'; ws.getCell(summaryRow, 7).value = value; ws.getCell(summaryRow, 7).numFmt = money;
    for (let col = 4; col <= 7; col++) { ws.getCell(summaryRow, col).border = box; ws.getCell(summaryRow, col).font = { name: fontName, size: 9, bold }; } summaryRow++;
  };
  addSummary('Subtotal', subtotal);
  if (inv.terminLabel || terminPercent > 0) addSummary(inv.terminLabel || `Termin ${terminPercent}%`, terminBase);
  if (ppn > 0) addSummary('PPN', ppn);
  if (Number(inv.pph || 0) > 0) addSummary('Potongan PPh', -Number(inv.pph));
  addSummary('Grand Total', grandTotal, true);

  const paymentTop = itemStartRow + minimumBodyRows + 1;
  ws.mergeCells(paymentTop, 1, paymentTop + 4, 3); const payment = ws.getCell(paymentTop, 1);
  payment.value = `Payment Details\n${inv.paymentBank || 'Bank Mandiri Cabang Bulak Kapal Bekasi'}\nA/n. ${inv.paymentAccountName || 'PT. Gema Teknik Perkasa'}\nNo : ${inv.paymentAccountNumber || '156 - 001 - 340 - 8283'}`;
  payment.alignment = { wrapText: true, vertical: 'top' }; payment.font = { name: fontName, size: 9, bold: true }; payment.border = box;

  const signatureTop = summaryRow + 1;
  const signatureData = typeof inv.signature === 'string' && inv.signature.startsWith('data:image/') ? inv.signature : await imageBase64(ownerSignature);
  const signatureImage = wb.addImage({ base64: signatureData, extension: signatureData.startsWith('data:image/jpeg') ? 'jpeg' : 'png' });
  ws.addImage(signatureImage, { tl: { col: 5.35, row: signatureTop - 1 }, ext: { width: 115, height: 60 } });
  const signerRow = signatureTop + 4; ws.mergeCells(signerRow, 6, signerRow, 7); ws.getCell(signerRow, 6).value = 'Syamsudin';
  ws.getCell(signerRow, 6).font = { name: fontName, size: 10, bold: true }; ws.getCell(signerRow, 6).alignment = { horizontal: 'center' };
  ws.eachRow(row => row.eachCell({ includeEmpty: true }, cell => { if (!cell.font?.name) cell.font = { ...cell.font, name: fontName, size: cell.font?.size || 9 }; }));
  ws.pageSetup.printArea = `A1:G${Math.max(signerRow + 1, paymentTop + 5)}`; ws.headerFooter.oddFooter = '&CPage &P of &N';

  const buffer = await wb.xlsx.writeBuffer();
  const bufferWithTextBox = await addInvoiceTextBoxes(buffer);
  const blob = new Blob([bufferWithTextBox], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }); const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `Invoice_${String(inv.noInvoice || 'export').replace(/[\\/:*?"<>|]/g, '_')}.xlsx`;
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
}
