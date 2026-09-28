/** Converteix un array d'objectes a CSV i inicia la descàrrega al navegador. */
export function downloadCSV(filename, rows, columns) {
  // columns: [{ key, label }]
  const escape = (val) => {
    if (val == null) return '';
    const s = String(val);
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const header = columns.map((c) => escape(c.label)).join(';');
  const lines = rows.map((row) => columns.map((c) => escape(row[c.key])).join(';'));
  const csv = '\uFEFF' + [header, ...lines].join('\n'); // BOM per a Excel + accents catalans
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : filename + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
