// QR: generación con la librería incluida (MIT, Kazuhiko Arase) y lectura con BarcodeDetector cuando el navegador lo tiene.
// La lectura siempre ofrece alternativa manual. Un código ajeno al panel nunca se abre.

export function qrSVG(texto, { margen = 2 } = {}) {
  const qr = window.qrcode(0, 'M');
  qr.addData(texto);
  qr.make();
  const n = qr.getModuleCount(), t = n + margen * 2;
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) d += `M${x + margen},${y + margen}h1v1h-1z`;
  return `<svg viewBox="0 0 ${t} ${t}" role="img" aria-label="Código QR" shape-rendering="crispEdges"><rect width="${t}" height="${t}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

export const lectorDisponible = () => 'BarcodeDetector' in window;

// Interpreta un código leído o escrito. Devuelve { ruta } solo para destinos propios del panel.
export function interpretarCodigo(texto) {
  const t = String(texto || '').trim();
  if (!t) return { error: 'No se leyó ningún código.' };
  try {
    const u = new URL(t);
    if (u.origin !== location.origin) return { ajeno: t };
    if (/^#\/(visitas|autos)\/\d+/.test(u.hash)) return { ruta: u.hash.replace(/[^#/\w?=&-]/g, '') };
    if (/^\/t\/[a-z0-9-]+\/?$/.test(u.pathname)) return { externo: u.pathname };
    return { ajeno: t };
  } catch { /* no es una URL */ }
  if (/^\d{1,7}$/.test(t)) return { numeroVisita: Number(t) };
  if (/^[A-Za-z0-9 -]{4,12}$/.test(t)) return { patente: t };
  return { ajeno: t };
}
