import ExcelJS from 'exceljs';
import gmLogo from 'figma:asset/661f558dc14c79fa090b7039a885f26b843f5c04.png';

const thin = { style: 'thin' as const, color: { argb: 'FF000000' } };
const box = { top: thin, left: thin, bottom: thin, right: thin };
const money = '#,##0';
const n = (value: unknown) => Math.max(0, Number(value || 0) || 0);

async function getLogo() {
  const blob = await (await fetch(gmLogo)).blob();
  return await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
}
function border(ws: ExcelJS.Worksheet, r1: number, r2: number, c1: number, c2: number) { for (let r=r1;r<=r2;r+=1) for (let c=c1;c<=c2;c+=1) ws.getCell(r,c).border=box; }
function rupiah(ws: ExcelJS.Worksheet, row: number, label: string, value: number) { ws.mergeCells(`A${row}:C${row}`); ws.getCell(`A${row}`).value=label; ws.getCell(`D${row}`).value='Rp'; ws.getCell(`E${row}`).value=value; ws.getCell(`E${row}`).numFmt=money; }

/** One sheet per permanent employee. THL is deliberately excluded from this payroll slip export. */
export async function exportEmployeePayrollSlips(rows: any[], period: string) {
  const workbook = new ExcelJS.Workbook(); const logo = workbook.addImage({ base64: await getLogo(), extension: 'png' });
  const employees = rows.filter((row) => String(row.employmentType || '').toUpperCase() !== 'THL');
  employees.forEach((employee, index) => {
    const employeeName = String(employee.employeeName || employee.name || `Karyawan ${index+1}`);
    const ws = workbook.addWorksheet(employeeName.slice(0,31), { pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage:true, fitToWidth:1, fitToHeight:1, margins:{left:.18,right:.18,top:.22,bottom:.22,header:0,footer:0} } });
    ws.views=[{showGridLines:false}]; ws.columns=[{width:19},{width:5},{width:8},{width:14},{width:15},{width:19},{width:5},{width:14}];
    for(let row=1;row<=33;row+=1) ws.getRow(row).height=16;
    ws.addImage(logo,{tl:{col:.16,row:.18},ext:{width:88,height:52}});
    ws.mergeCells('B1:E1'); ws.getCell('B1').value='PT. GEMA TEKNIK PERKASA'; ws.getCell('B1').font={name:'Arial',size:11,bold:true};
    [['B2','Jl. Nurushoba II No 13 Setia Mekar'],['B3','Tambun Selatan Bekasi 17510'],['B4','Telp. 021-88354139']].forEach(([cell,value])=>{ws.mergeCells(`${cell}:${String.fromCharCode(cell.charCodeAt(0)+3)}${cell.slice(1)}`);ws.getCell(cell).value=value;ws.getCell(cell).font={name:'Arial',size:8};});
    ws.mergeCells('F1:H2');ws.getCell('F1').value='SLIP GAJI';ws.getCell('F1').font={name:'Arial',size:15,bold:true};ws.getCell('F1').alignment={horizontal:'center',vertical:'middle'};
    ws.mergeCells('F3:H4');ws.getCell('F3').value=`Periode ${period}`;ws.getCell('F3').alignment={horizontal:'center',vertical:'middle'};ws.getCell('F3').font={name:'Arial',size:8};border(ws,1,4,1,8);
    ws.mergeCells('A5:E5');ws.getCell('A5').value=`Nama:   ${employeeName}`;
    if (Array.isArray(employee.overtimeReferences) && employee.overtimeReferences.length > 0) {
      ws.mergeCells('A6:E6'); ws.getCell('A6').value = `SPK Lembur: ${employee.overtimeReferences.join(', ')}`; ws.getCell('A6').font = { name: 'Arial', size: 8, italic: true };
    }
    const employerBpjs = n(employee.bpjsKetEmployer);
    const otherIncome = n(employee.positionAllowance) + n(employee.bonus) + n(employee.otherIncome);
    [['Upah Pokok',n(employee.baseSalary ?? employee.salary)],['Tunjangan Transport',n(employee.transportAllowance)],['Tunjangan Makan',n(employee.mealAllowance)],['Tunjangan Insentif',n(employee.maximumIncentive ?? employee.incentiveAllowance)],['Tunjangan JPK / BPJS Perusahaan',employerBpjs],['Tunjangan Lembur & Lainnya',n(employee.overtimePay)+otherIncome]].forEach(([label,value],i)=>rupiah(ws,7+i,String(label),Number(value)));
    ws.mergeCells('A13:C13');ws.getCell('A13').value='Sub Total';ws.getCell('D13').value='Rp';ws.getCell('E13').value={formula:'SUM(E7:E12)'};ws.getCell('E13').numFmt=money;
    const koperasiLoan=n(employee.koperasiLoanDeduction ?? employee.koperasiDeduction);const koperasiSaving=n(employee.koperasiMandatorySavingDeduction);
    [['Potongan Kasbon',n(employee.kasbonDeduction ?? employee.totalKasbon)],['Admin Kasbon 2,5%',n(employee.kasbonAdminFee)],['Potongan Koperasi',koperasiLoan+koperasiSaving],['Potongan BPJSTK Perusahaan',employerBpjs],['Potongan BPJSTK Pekerja',n(employee.bpjsKetEmployee ?? employee.bpjsTk)],['Potongan JKN - KIS',n(employee.bpjsKesEmployee ?? employee.jkn ?? employee.bpjsKes)],['Insentif, PPh 21 & Lain',n(employee.incentiveDeductionAmount ?? employee.absenceDeduction)+n(employee.pph21)+n(employee.otherDeductions)]].forEach(([label,value],i)=>rupiah(ws,16+i,String(label),Number(value)));
    ws.mergeCells('A23:C23');ws.getCell('A23').value='Total Potongan';ws.getCell('D23').value='Rp';ws.getCell('E23').value={formula:'SUM(E16:E22)'};ws.getCell('E23').numFmt=money;
    ws.mergeCells('A25:C25');ws.getCell('A25').value='Total';ws.getCell('D25').value='Rp';ws.getCell('E25').value={formula:'E13-E23'};ws.getCell('E25').numFmt=money;
    [['Alpha',employee.alpha],['Izin',employee.izin],['Sakit',employee.sakit],['Libur Nasional',employee.liburNasional],['Cuti',employee.cuti]].forEach(([label,value],i)=>{ws.getCell(`F${6+i}`).value=label;ws.getCell(`G${6+i}`).value=':';ws.getCell(`H${6+i}`).value=n(value);});
    ws.mergeCells('F13:H13');ws.getCell('F13').value='Potongan Insentif Jika Tidak Masuk';
    [1,2,3,4].forEach((day,i)=>{ws.getCell(`F${14+i}`).value=`${day} Hari`;ws.getCell(`G${14+i}`).value='Rp';ws.getCell(`H${14+i}`).value=n(employee.insentifRatePerDay ?? employee.dailyIncentive)*day;ws.getCell(`H${14+i}`).numFmt=money;});
    const kasbon=n(employee.kasbonDeduction ?? employee.totalKasbon);const kasbonAdmin=n(employee.kasbonAdminFee);[['Jumlah Kasbon',kasbon],['Admin 2,5%',kasbonAdmin]].forEach(([label,value],i)=>{ws.getCell(`F${22+i}`).value=label;ws.getCell(`G${22+i}`).value='Rp';ws.getCell(`H${22+i}`).value=Number(value);ws.getCell(`H${22+i}`).numFmt=money;});
    ws.getCell('F24').value='Total Kasbon';ws.getCell('G24').value='Rp';ws.getCell('H24').value={formula:'SUM(H22:H23)'};ws.getCell('H24').numFmt=money;ws.getCell('F25').value='THP';ws.getCell('G25').value='Rp';ws.getCell('H25').value={formula:'E25'};ws.getCell('H25').numFmt=money;
    border(ws,5,13,1,5);border(ws,5,12,6,8);border(ws,13,18,6,8);border(ws,14,25,1,5);border(ws,19,25,6,8);[13,23,25].forEach(r=>{for(let c=1;c<=8;c+=1)ws.getCell(r,c).font={name:'Arial',size:9,bold:true};});
    // Keep the THP total on row 25; the date belongs to its own footer row.
    ws.mergeCells('A26:H26');ws.getCell('A26').value=`Bekasi, ${new Date().toLocaleDateString('id-ID')}`;ws.getCell('A26').alignment={horizontal:'center'};
    [['A28','Mengetahui,'],['D28','Menyetujui,'],['G28','Menerima,'],['A33','SYAMSUDIN'],['D33','SRI RAHAYU'],['G33',employeeName.toUpperCase()]].forEach(([cell,value])=>{ws.getCell(cell).value=value;ws.getCell(cell).alignment={horizontal:'center'};ws.getCell(cell).font={name:'Arial',size:9};});border(ws,27,33,1,8);ws.pageSetup.printArea='A1:H33';
  });
  const buffer=await workbook.xlsx.writeBuffer();const url=URL.createObjectURL(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));const anchor=document.createElement('a');anchor.href=url;anchor.download=`Slip_Gaji_Karyawan_${period.replace(/\s/g,'_')}.xlsx`;anchor.click();URL.revokeObjectURL(url);
}
