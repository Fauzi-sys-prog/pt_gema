import gmLogo from 'figma:asset/661f558dc14c79fa090b7039a885f26b843f5c04.png';

const esc = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const imageDataUrl = async (url: string) => {
  if (url.startsWith('data:')) return url;
  const blob = await (await fetch(url)).blob();
  return await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
};

export const generateWordDocument = async (ba: any) => {
  const logo = await imageDataUrl(gmLogo);
  const date = new Date(ba.tanggal || Date.now()).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const firstName = ba.pihakPertamaNama || 'Syamsudin', firstCompany = ba.pihakPertama || 'PT. Gema Teknik Perkasa';
  const secondName = ba.pihakKeduaNama || '-', secondCompany = ba.pihakKedua || '-';
  const rawContent = String(ba.contentHTML || '');
  // Data lama hasil auto-fill SJ menyimpan judul dan identitas pihak di dalam isi.
  // Exporter sudah membentuk bagian tersebut sendiri, jadi mulai dari paragraf isi agar tidak dobel.
  const statementIndex = /BERITA ACARA\s*<br\s*\/?/i.test(rawContent)
    ? rawContent.search(/<p[^>]*>\s*Dengan ini menyatakan/i)
    : -1;
  const content = statementIndex >= 0 ? rawContent.slice(statementIndex) : rawContent;
  return `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(ba.noBA)} - Berita Acara</title><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><style>
  @page{size:A4;margin:16mm 18mm}body{font-family:"Book Antiqua","Times New Roman",serif;font-size:10.5pt;line-height:1.3;color:#000}table{border-collapse:collapse}.head{width:100%;border:0}.head td{border:0;padding:0;vertical-align:middle}.logo{width:100pt}.company{padding-left:9pt!important;font-style:italic}.name{font-size:17pt;font-weight:bold;line-height:1}.business{font-size:10.5pt;font-weight:bold}.contact{font-size:9pt;line-height:1.12}.rule{border-top:3pt solid #000;margin:5pt 0 10pt}.date{margin:0 0 14pt}.title{text-align:center;font-size:13pt;font-weight:bold;letter-spacing:4pt;text-decoration:underline;margin:0}.number{text-align:center;margin:2pt 0 16pt}.body{font-size:10.5pt;text-align:justify}.party{width:100%;margin:6pt 0 2pt}.party td{border:0;padding:1.5pt 2pt;vertical-align:top}.party .label{width:95pt}.party .colon{width:10pt}.designation{font-style:italic;margin:5pt 0 8pt}.content p{margin:5pt 0}.sign{width:100%;margin-top:26pt;page-break-inside:avoid}.sign td{width:50%;border:0;text-align:center;vertical-align:top}.space{height:58pt}.signer{display:inline-block;min-width:140pt;border-bottom:1pt solid #000;font-weight:bold}.role{font-size:9pt}</style></head><body>
  <table class="head"><tr><td style="width:105pt"><img class="logo" src="${logo}"></td><td class="company"><div class="name">GEMA TEKNIK PERKASA</div><div class="business">REFRACTORY FURNACE AND BOILER</div><div class="contact">Jl. Nurushoba II No 13 Setia Mekar Tambun Selatan Bekasi 17510<br>Phone : 085 100 420 221, 021.88354 139 &nbsp; Fax : 021.88354 139<br>Email : <span style="color:#00f">gemateknik@gmail.com</span></div></td></tr></table><div class="rule"></div>
  <p class="date">Bekasi, ${esc(date)}</p><p class="title">B E R I T A &nbsp; A C A R A</p><p class="number">No : ${esc(ba.noBA || ba.noBeritaAcara || '-')}</p><div class="body"><p>Yang bertanda tangan di bawah ini:</p>
  <table class="party"><tr><td class="label">Nama</td><td class="colon">:</td><td>${esc(firstName)}</td></tr><tr><td>Jabatan</td><td>:</td><td>${esc(ba.pihakPertamaJabatan || 'Direktur')}</td></tr><tr><td>Perusahaan</td><td>:</td><td>${esc(firstCompany)}</td></tr><tr><td>Alamat</td><td>:</td><td>${esc(ba.pihakPertamaAlamat || 'Jl. Nurushoba II No 13 Setia Mekar Tambun Selatan Bekasi 17510')}</td></tr></table><p class="designation">Selanjutnya disebut sebagai Pihak Pertama.</p>
  <table class="party"><tr><td class="label">Nama</td><td class="colon">:</td><td>${esc(secondName)}</td></tr><tr><td>Jabatan</td><td>:</td><td>${esc(ba.pihakKeduaJabatan || '-')}</td></tr><tr><td>Perusahaan</td><td>:</td><td>${esc(secondCompany)}</td></tr><tr><td>Alamat</td><td>:</td><td>${esc(ba.pihakKeduaAlamat || ba.lokasi || '-')}</td></tr></table><p class="designation">Selanjutnya disebut sebagai Pihak Kedua.</p>
  <div class="content">${content || `<p>Kedua belah pihak menerangkan bahwa pekerjaan/barang terkait ${esc(ba.jenisBA || 'serah terima')} telah diperiksa dan diterima dengan baik.</p>${ba.refSuratJalan ? `<p>Referensi Surat Jalan: ${esc(ba.refSuratJalan)}</p>` : ''}`}</div></div>
  <table class="sign"><tr><td>Pihak Pertama<br><span class="role">${esc(firstCompany)}</span></td><td>Pihak Kedua<br><span class="role">${esc(secondCompany)}</span></td></tr><tr><td class="space"></td><td class="space"></td></tr><tr><td><span class="signer">${esc(firstName)}</span><br>${esc(ba.pihakPertamaJabatan || '')}</td><td><span class="signer">${esc(secondName)}</span><br>${esc(ba.pihakKeduaJabatan || '')}</td></tr></table></body></html>`;
};

export const downloadWordDocument = async (ba: any, filename: string) => {
  const content = await generateWordDocument(ba), blob = new Blob(['\ufeff', content], { type: 'application/msword' }), url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
};
