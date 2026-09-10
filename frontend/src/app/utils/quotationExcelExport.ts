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
  ws.addImage(logo, { tl: { col: .08, row: .2 }, ext: { width: 88, height: 66 } });
  for (let r = 1; r <= 5; r++) ws.mergeCells(r, 2, r, 5);
  const head = [
    ['GEMA TEKNIK PERKASA', 18, true, 'FF000000'],
    ['REFRACTORY FURNACE AND BOILER', 11, true, 'FF000000'],
    ['Jl. Nurushoba II No 13 Setia Mekar Tambun Selatan Bekasi 17510', 10, false, 'FF000000'],
    ['Phone : 085 100 420 221, 021.88354 139   Fax : 021.88354 139', 10, false, 'FF000000'],
    ['Email : gemateknik@gmail.com', 10, true, 'FF0000CC'],
  ] as const;
  head.forEach(([value, size, bold, color], index) => {
    const cell = ws.getCell(index + 1, 2);
    cell.value = value;
    cell.font = { name: 'Times New Roman', size, bold, italic: true, color: { argb: color } };
    cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 5 };
  });
  ws.getRow(1).height = 24; [2,3,4,5].forEach(r => ws.getRow(r).height = 15);
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
  const header=ws.addRow(['No','Keterangan','Harga/Unit','Jumlah','Total Harga']);
  header.eachCell(c=>{c.font={name:'Times New Roman',size:11,bold:true};c.alignment={horizontal:'center',vertical:'middle'};c.border=border;});

  const sections=q.sections?.length?q.sections:[{nama:q.jenisQuotation==='Jasa'?'Jasa Kerja':'Material / Equipment',items:q.items||q.materials||[]}];
  let itemNo=0; const sectionTotalRows:number[]=[]; const grouped=q.jenisQuotation==='Jasa'||sections.length>1;
  sections.forEach((section:any,si:number)=>{
    const first=ws.rowCount+1; let last=first;
    (section.items||[]).forEach((item:any,ii:number)=>{
      itemNo++; const qty=n(item.qty??item.quantity??item.jumlah), price=n(item.hargaJualUnit??item.hargaUnit??item.unitPrice), total=n(item.hargaJual??item.totalPrice??item.total??qty*price);
      const desc=`${ii===0?`${section.nama||section.title||section.label||'Keterangan'}\n`:''}${item.keterangan||item.description||item.materialName||'-'}${item.subKeterangan?`\n${item.subKeterangan}`:''}`;
      const row=ws.addRow([grouped?(ii===0?si+1:''):itemNo,desc,price,`${qty} ${item.satuan||item.unit||'Lot'}`,total]); last=row.number;
      row.height=Math.max(19,desc.split('\n').length*15); row.eachCell(c=>{c.font={name:'Times New Roman',size:10};c.alignment={vertical:'top',wrapText:true};c.border=border;});
      row.getCell(1).alignment={horizontal:'center',vertical:'top'}; row.getCell(3).numFmt='"Rp" #,##0'; row.getCell(3).alignment={horizontal:'right'}; row.getCell(4).alignment={horizontal:'center'}; row.getCell(5).numFmt='"Rp" #,##0'; row.getCell(5).alignment={horizontal:'right'};
      if(ii===0) row.getCell(2).font={name:'Times New Roman',size:10,bold:true};
    });
    if(grouped){const r=ws.addRow(['','','',`Total ${si+1}`,{formula:`SUM(E${first}:E${last})`}]);sectionTotalRows.push(r.number);r.eachCell(c=>{c.border=border;c.font={name:'Times New Roman',size:10,bold:c.col>=4};});r.getCell(5).numFmt='"Rp" #,##0';}
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
