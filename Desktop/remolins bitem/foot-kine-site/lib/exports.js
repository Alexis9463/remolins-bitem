/** Escapa un valor per a un camp CSV (delimitador ";", compatible amb Excel). */
function csvField(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[;"\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function toCSV(headers, rows) {
  const lines = [headers.map(csvField).join(';')];
  rows.forEach(r => lines.push(r.map(csvField).join(';')));
  return lines.join('\r\n');
}

/** Inicia la descàrrega d'un fitxer CSV (amb BOM UTF-8 per a Excel). */
export function downloadCSV(filename, csvContent) {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Genera i descarrega un gràfic de línies (PNG) a partir d'un o diversos panells apilats.
 * panels: [{ label, unit, color, points: [{ x: 'DD/MM/YYYY', y: number|null }] }]
 */
export function exportLineChartPNG({ filename, title, subtitle, panels }) {
  const width = 1000;
  const panelHeight = 220;
  const headerHeight = 80;
  const footerHeight = 30;
  const height = headerHeight + panels.length * panelHeight + footerHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Fons
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Capçalera
  ctx.fillStyle = '#101A2B';
  ctx.font = 'bold 22px Arial';
  ctx.fillText(title, 30, 36);
  if (subtitle) {
    ctx.fillStyle = '#51637A';
    ctx.font = '13px Arial';
    ctx.fillText(subtitle, 30, 58);
  }

  panels.forEach((panel, i) => {
    const top = headerHeight + i * panelHeight;
    drawPanel(ctx, { x0: 60, y0: top + 20, width: width - 100, height: panelHeight - 55, panel });
  });

  ctx.fillStyle = '#8C9BB0';
  ctx.font = '11px Arial';
  ctx.fillText('Generat des de Staff Fisio — ' + new Date().toLocaleDateString('ca-ES'), 30, height - 10);

  canvas.toBlob(blob => triggerDownload(blob, filename), 'image/png');
}

function drawPanel(ctx, { x0, y0, width, height, panel }) {
  const { label, unit, color, points } = panel;
  const valid = points.filter(p => p.y != null && !isNaN(p.y));

  ctx.fillStyle = '#101A2B';
  ctx.font = 'bold 14px Arial';
  ctx.fillText(`${label}${unit ? ' (' + unit + ')' : ''}`, x0, y0 - 6);

  // Cadre + grille
  ctx.strokeStyle = '#D6E0EE';
  ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) {
    const y = y0 + (height / 4) * g;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + width, y); ctx.stroke();
  }

  if (valid.length === 0) {
    ctx.fillStyle = '#8C9BB0';
    ctx.font = '13px Arial';
    ctx.fillText('Dades insuficients', x0 + 10, y0 + height / 2);
    return;
  }

  const min = Math.min(...valid.map(p => p.y));
  const max = Math.max(...valid.map(p => p.y));
  const range = (max - min) || 1;
  const pad = range * 0.1;
  const yMin = min - pad, yMax = max + pad;

  const stepX = points.length > 1 ? width / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({
    x: x0 + i * stepX,
    y: p.y != null ? y0 + height - ((p.y - yMin) / (yMax - yMin)) * height : null,
  }));

  // Línia
  ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath();
  let started = false;
  coords.forEach(c => {
    if (c.y == null) { started = false; return; }
    if (!started) { ctx.moveTo(c.x, c.y); started = true; } else { ctx.lineTo(c.x, c.y); }
  });
  ctx.stroke();

  // Punts
  ctx.fillStyle = color;
  coords.forEach(c => { if (c.y != null) { ctx.beginPath(); ctx.arc(c.x, c.y, 3.5, 0, Math.PI * 2); ctx.fill(); } });

  // Etiquetes Y (mín/màx)
  ctx.fillStyle = '#8C9BB0'; ctx.font = '11px Arial';
  ctx.fillText(max.toFixed(1), x0 - 5, y0 + 4);
  ctx.fillText(min.toFixed(1), x0 - 5, y0 + height);

  // Etiquetes X (algunes dates)
  const maxLabels = 8;
  const labelStep = Math.max(1, Math.ceil(points.length / maxLabels));
  ctx.fillStyle = '#8C9BB0'; ctx.font = '10px Arial'; ctx.textAlign = 'center';
  points.forEach((p, i) => {
    if (i % labelStep === 0 || i === points.length - 1) {
      ctx.fillText(p.x, coords[i].x, y0 + height + 16);
    }
  });
  ctx.textAlign = 'left';
}
