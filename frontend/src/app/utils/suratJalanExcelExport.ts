import ExcelJS from 'exceljs';
import gmLogo from 'figma:asset/661f558dc14c79fa090b7039a885f26b843f5c04.png';

const thin={style:'thin' as const,color:{argb:'FF000000'}};const box={top:thin,left:thin,bottom:thin,right:thin};
async function logo(){const blob=await(await fetch(gmLogo)).blob();return await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob);});}
function grid(ws:ExcelJS.Worksheet,r1:number,r2:number,c1:number,c2:number){for(let r=r1;r<=r2;r+=1)for(let c=c1;c<=c2;c+=1)ws.getCell(r,c).border=box;}

/** Excel delivery note matching the GTP Surat Jalan form. */
export async function exportSuratJalanToXlsx(s:any){
 const isEquipment=s.sjType==='Equipment Loan';
 const workbook=new ExcelJS.Workbook();const ws=workbook.addWorksheet('SURAT JALAN',{pageSetup:{paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:1,margins:{left:.25,right:.25,top:.25,bottom:.25,header:0,footer:0}}});ws.views=[{showGridLines:false}];ws.columns=[{width:14},{width:14},{width:20},{width:20},{width:17},{width:17}];for(let r=1;r<=30;r+=1)ws.getRow(r).height=20;
 const image=workbook.addImage({base64:await logo(),extension:'png'});ws.addImage(image,{tl:{col:.15,row:.25},ext:{width:112,height:64}});
 ws.mergeCells('B1:D1');ws.getCell('B1').value='GEMA TEKNIK PERKASA';ws.getCell('B1').font={name:'Times New Roman',size:16,bold:true,italic:true};
 ws.mergeCells('B2:D2');ws.getCell('B2').value='REFRACTORY FURNACE AND BOILER';ws.getCell('B2').font={name:'Times New Roman',size:9,bold:true,italic:true};
 ws.mergeCells('B3:D3');ws.getCell('B3').value='Jl. Nurushoba II No. 13 Setia Mekar Tambun Selatan Bekasi 17510';ws.mergeCells('B4:D4');ws.getCell('B4').value='Phone: 085100420221  Fax: 021.88354139';ws.mergeCells('B5:D5');ws.getCell('B5').value='Email: gemateknik@gmail.com';['B3','B4','B5'].forEach(cell=>ws.getCell(cell).font={name:'Arial',size:7});
 ws.mergeCells('E1:F2');ws.getCell('E1').value=`No. : ${s.noSurat||'-'}`;ws.getCell('E1').alignment={horizontal:'left',vertical:'middle'};ws.getCell('E1').font={name:'Arial',size:9};
 for(let c=1;c<=6;c+=1)ws.getCell(6,c).border={bottom:{style:'medium',color:{argb:'FF000000'}}};
 ws.mergeCells('D7:F7');ws.getCell('D7').value=isEquipment?'SURAT JALAN ALAT':'SURAT JALAN';ws.getCell('D7').font={name:'Arial',size:15,bold:true};ws.getCell('D7').alignment={horizontal:'center',vertical:'middle'};
 ws.mergeCells('A8:C12');ws.getCell('A8').value=`Kepada : ${s.tujuan||'-'}\n${s.alamat||''}${s.upPerson?`\nU/P: ${s.upPerson}`:''}`;ws.getCell('A8').alignment={wrapText:true,vertical:'top'};
 ws.mergeCells('D8:F12');ws.getCell('D8').value=`Tanggal        : ${s.tanggal||'-'}\nPO / Referensi : ${s.noPO||'-'}\n${isEquipment?`Rencana Kembali: ${s.expectedReturnDate||'-'}\n`:''}No. Kend.     : ${s.noPolisi||'-'}\nSopir          : ${s.sopir||'-'}`;ws.getCell('D8').alignment={wrapText:true,vertical:'top'};ws.getRow(8).height=76;grid(ws,8,12,1,6);
 ws.mergeCells('A13:B13');ws.getCell('A13').value='Banyaknya';ws.getCell('A13').alignment={horizontal:'center'};ws.mergeCells('C13:F13');ws.getCell('C13').value='Keterangan';ws.getCell('C13').alignment={horizontal:'center'};['A13','C13'].forEach(cell=>{ws.getCell(cell).font={name:'Arial',size:10,bold:true};});grid(ws,13,13,1,6);
 let row=14;(s.items||[]).forEach((item:any)=>{ws.mergeCells(row,1,row,2);ws.getCell(row,1).value=`${item.jumlah||0} ${item.satuan||''}`;ws.getCell(row,1).alignment={horizontal:'center',vertical:'middle'};ws.mergeCells(row,3,row,6);ws.getCell(row,3).value=`${item.namaItem||'-'}${item.keterangan?` — ${item.keterangan}`:''}`;ws.getCell(row,3).alignment={wrapText:true,vertical:'middle'};grid(ws,row,row,1,6);ws.getRow(row).height=24;row+=1;});
 while(row<=25){ws.mergeCells(row,1,row,2);ws.mergeCells(row,3,row,6);grid(ws,row,row,1,6);ws.getRow(row).height=24;row+=1;}
 if(isEquipment){
  ws.mergeCells('A27:B27');ws.getCell('A27').value='Membuat,';ws.mergeCells('C27:D27');ws.getCell('C27').value='Menyetujui,';ws.mergeCells('E27:F27');ws.getCell('E27').value='Mengetahui,';
  ['A27','C27','E27'].forEach(c=>ws.getCell(c).alignment={horizontal:'center'});
  ws.mergeCells('A30:B30');ws.getCell('A30').value=s.pengirim||'Gudang GTP';ws.mergeCells('C30:D30');ws.getCell('C30').value='Syamsudin';ws.mergeCells('E30:F30');ws.getCell('E30').value=s.upPerson||s.tujuan||'-';
  ['A30','C30','E30'].forEach(c=>{ws.getCell(c).alignment={horizontal:'center'};ws.getCell(c).font={name:'Arial',size:9,bold:true};});
 }else{
  ws.mergeCells('A27:C27');ws.getCell('A27').value='Diterima,';ws.getCell('A27').alignment={horizontal:'center'};ws.mergeCells('D27:F27');ws.getCell('D27').value='Hormat kami,';ws.getCell('D27').alignment={horizontal:'center'};ws.mergeCells('D30:F30');ws.getCell('D30').value='PT. GEMA TEKNIK PERKASA';ws.getCell('D30').alignment={horizontal:'center'};ws.getCell('D30').font={name:'Arial',size:9,bold:true};
 }
 ws.pageSetup.printArea='A1:F30';
 const buffer=await workbook.xlsx.writeBuffer();const url=URL.createObjectURL(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));const anchor=document.createElement('a');anchor.href=url;anchor.download=`Surat_Jalan_${String(s.noSurat||'export').replace(/[\\/:*?"<>|]/g,'_')}.xlsx`;anchor.click();URL.revokeObjectURL(url);
}
