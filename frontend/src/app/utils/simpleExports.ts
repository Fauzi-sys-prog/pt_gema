// Simplified export utilities for quick implementation

export const createSimpleWordExport = (title: string, data: any[], filename: string) => {
  // For now, create CSV that can be opened in Word
  const headers = Object.keys(data[0] || {});
  
  let csvContent = `"${title}"\n"PT GEMA TEKNIK PERKASA"\n"Generated: ${new Date().toLocaleString('id-ID')}"\n\n`;
  csvContent += headers.map(h => `"${h}"`).join(',') + '\n';
  csvContent += data.map(row => 
    headers.map(h => `"${row[h] || ''}"`).join(',')
  ).join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const createSimpleExcelExport = (title: string, data: any[], filename: string) => {
  createSimpleWordExport(title, data, filename);
};
