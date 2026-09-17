import ExcelJS from 'exceljs';
import gmLogo from "figma:asset/661f558dc14c79fa090b7039a885f26b843f5c04.png";

const n = (v: unknown) => Number(v || 0);
const thin = { style: 'thin' as const, color: { argb: 'FF000000' } };
const border = { top: thin, left: thin, bottom: thin, right: thin };

async function logoBase64() {
  const blob = await (await fetch(gmLogo)).blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function exportQuotationToXlsx(q: any) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PT Gema Teknik Perkasa';
  const ws = wb.addWorksheet('Penawaran', { pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: .35, right: .35, top: .4, bottom: .4, header: 0, footer: 0 } } });
  ws.views = [{ showGridLines: false }];
  ws.columns = [{ width: 7 }, { width: 58 }, { width: 19 }, { width: 18 }, { width: 21 }];

  const logo = wb.addImage({ base64: await logoBase64(), extension: 'png' });
  ws.addImage(logo, {
    tl: { col: 0.12, row: 0.28 },
    ext: { width: 46, height: 46 },
  });

  for (let r = 1; r <= 5; r++) ws.mergeCells(r, 2, r, 5);

  const head = [
    ['GEMA TEKNIK PERKASA', 17, true, 'FF000000'],
    ['REFRACTORY FURNACE AND BOILER', 10, true, 'FF000000'],
    ['Jl. Nurushoba II No 13 Setia Mekar Tambun Selatan Bekasi 17510', 9, false, 'FF000000'],
    ['Phone : 085 100 420 221, 021.88354 139   Fax : 021.88354 139', 9, false, 'FF000000'],
    ['Email : gemateknik@gmail.com', 9, true, 'FF0000CC'],
  ] as const;

  head.forEach(([value, size, bold, color], index) => {
    const cell = ws.getCell(index + 1, 2);
    cell.value = value;
    cell.font = {
      name: 'Times New Roman',
      size,
      bold,
      italic: index <= 1,
      color: { argb: color },
    };
    cell.alignment = {
      horizontal: 'left',
      vertical: 'middle',
      indent: 0,
    };
  });

  ws.getRow(1).height = 22;
  ws.getRow(2).height = 16;
  ws.getRow(3).height = 14;
  ws.getRow(4).height = 14;
  ws.getRow(5).height = 14;
  ws.getRow(6).height = 7;
  for (let c = 1; c <= 5; c++) ws.getCell(6, c).border = { bottom: { style: 'thick', color: { argb: 'FF000000' } } };

  const noRow = ws.addRow(['No', ':', '', q.noPenawaran || q.nomorQuotation || '-']);
  const subjectRow = ws.addRow(['Perihal', ':', '', q.perihal || '-']);
  ws.mergeCells(noRow.number, 4, noRow.number, 5);
  ws.mergeCells(subjectRow.number, 4, subjectRow.number, 5);
  [noRow, subjectRow].forEach(row => {
    row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };
  });
  ws.addRow([]);
  const mergedLine = (text: string, bold = false) => { const row=ws.addRow([text]); ws.mergeCells(row.number,1,row.number,5); row.getCell(1).font={name:'Times New Roman',size:11,bold}; return row; };
  mergedLine('Kepada Yth,'); mergedLine(q.perusahaan || q.kepada || q.customer?.nama || '-', true);
  mergedLine('Di'); mergedLine(q.kotaCustomer || q.lokasi || q.customer?.alamat || '');
  if (q.up) mergedLine(`U/P : ${q.up}`, true);
  ws.addRow([]); mergedLine('Dengan hormat,');
  mergedLine(q.paragrafPembuka || `Sehubungan dengan permintaan Bapak/Ibu mengenai ${q.perihal || 'penawaran harga'}, maka dengan ini kami ajukan penawaran sebagai berikut:`);
  ws.addRow([]);
  const header = ws.addRow(['No', 'Keterangan', 'Harga/Unit', 'Jumlah', 'Total Harga']);
  header.height = 22;
  header.eachCell(c => {
    c.font = { name: 'Times New Roman', size: 11, bold: true };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = border;
  });

  const sections = q.sections?.length
    ? q.sections
    : [{
        nama: q.jenisQuotation === 'Jasa' ? 'Jasa Kerja' : 'Material / Equipment',
        items: q.items || q.materials || []
      }];

  let itemNo = 0;
  const sectionTotalRows: number[] = [];

  sections.forEach((section: any, si: number) => {
    const sectionName = section.nama || section.title || section.label || `Bagian ${si + 1}`;

    const sectionRow = ws.addRow(['', sectionName.toUpperCase(), '', '', '']);
    ws.mergeCells(sectionRow.number, 2, sectionRow.number, 5);
    sectionRow.height = 20;
    sectionRow.getCell(1).border = border;
    sectionRow.getCell(2).border = border;
    sectionRow.getCell(2).font = {
      name: 'Times New Roman',
      size: 10,
      bold: true
    };
    sectionRow.getCell(2).alignment = {
      horizontal: 'left',
      vertical: 'middle'
    };
    for (let c = 3; c <= 5; c++) ws.getCell(sectionRow.number, c).border = border;

    const firstItemRow = ws.rowCount + 1;
    let lastItemRow = firstItemRow - 1;

    (section.items || []).forEach((item: any) => {
      itemNo++;

      const qty = n(item.qty ?? item.quantity ?? item.jumlah);
      const price = n(item.hargaJualUnit ?? item.hargaUnit ?? item.unitPrice);
      const pricingMethod = String(item.pricingMethod || 'PER_UNIT').toUpperCase();
      const total = pricingMethod === 'LUMP_SUM' ? price : qty * price;

      const name =
        item.keterangan ||
        item.description ||
        item.materialName ||
        '-';

      const desc = item.subKeterangan
        ? `${name}\n${item.subKeterangan}`
        : name;

      const unit = item.satuan || item.unit || 'Lot';

      const row = ws.addRow([
        itemNo,
        desc,
        price,
        `${qty} ${unit}`,
        total
      ]);

      lastItemRow = row.number;
      row.height = Math.max(20, desc.split('\n').length * 15);

      row.eachCell(c => {
        c.font = { name: 'Times New Roman', size: 10 };
        c.alignment = { vertical: 'top', wrapText: true };
        c.border = border;
      });

      row.getCell(1).alignment = {
        horizontal: 'center',
        vertical: 'top'
      };

      row.getCell(2).alignment = {
        horizontal: 'left',
        vertical: 'top',
        wrapText: true
      };

      row.getCell(3).numFmt = '"Rp" #,##0';
      row.getCell(3).alignment = {
        horizontal: 'right',
        vertical: 'top'
      };

      row.getCell(4).alignment = {
        horizontal: 'center',
        vertical: 'top'
      };

      row.getCell(5).numFmt = '"Rp" #,##0';
      row.getCell(5).alignment = {
        horizontal: 'right',
        vertical: 'top'
      };
    });

    if (lastItemRow >= firstItemRow) {
      const r = ws.addRow([
        '',
        '',
        '',
        `Total ${sectionName}`,
        { formula: `SUM(E${firstItemRow}:E${lastItemRow})` }
      ]);

      sectionTotalRows.push(r.number);

      r.eachCell(c => {
        c.border = border;
        c.font = {
          name: 'Times New Roman',
          size: 10,
          bold: c.col >= 4
        };
      });

      r.getCell(4).alignment = { horizontal: 'right' };
      r.getCell(5).numFmt = '"Rp" #,##0';
      r.getCell(5).alignment = { horizontal: 'right' };
    }
  });
  const total=ws.addRow(['','','','Total',{formula:sectionTotalRows.length?sectionTotalRows.map(r=>`E${r}`).join('+'):`SUM(E${header.number+1}:E${ws.rowCount})`}]);
  const discount=n(q.pricingConfig?.discountPercent??q.diskonPersen??q.discountPercent); let discountRow=0;
  if(discount>0){const r=ws.addRow(['','','',`Diskon ${discount}%`,{formula:`E${total.number}*${discount}/100`}]);discountRow=r.number;}
  const includePpn=q.pricingConfig?.includePPN??q.includePpn??n(q.ppn)>0; let ppnRow=0;
  if(includePpn){const rate=n(q.ppnPercent||11),r=ws.addRow(['','','',`PPN ${rate}%`,{formula:`(E${total.number}${discountRow?`-E${discountRow}`:''})*${rate}/100`}]);ppnRow=r.number;}
  const grand=ws.addRow(['','','','Grand Total',{formula:`E${total.number}${discountRow?`-E${discountRow}`:''}${ppnRow?`+E${ppnRow}`:''}`}]);
  for(let r=total.number;r<=grand.number;r++){for(let c=4;c<=5;c++){const cell=ws.getCell(r,c);cell.border=border;cell.font={name:'Times New Roman',size:10,bold:true};}ws.getCell(r,5).numFmt='"Rp" #,##0';}

  ws.addRow([]); mergedLine('Catatan / Kondisi Penawaran:',true);
  const terms=q.commercialTerms?.conditions||q.terms||['Harga dan pembayaran mengikuti penawaran yang disepakati.'];
  (Array.isArray(terms)?terms:[terms]).forEach((x:string)=>mergedLine(`- ${x}`));
  ws.addRow([]); mergedLine('Demikian penawaran harga ini kami buat, atas kerjasamanya kami ucapkan terimakasih.'); ws.addRow([]);
  mergedLine(`${q.kotaPenandatangan||'Bekasi'}, ${q.tanggal||''}`); mergedLine('PT. Gema Teknik Perkasa'); ws.addRow([]);ws.addRow([]); mergedLine(q.namaPenandatangan||'Syamsudin',true);
  ws.getColumn(2).alignment={wrapText:true};
  const buffer=await wb.xlsx.writeBuffer(); const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`Penawaran_${String(q.noPenawaran||'export').replace(/[\\/:*?"<>|]/g,'_')}.xlsx`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
