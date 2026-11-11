// Comunicación con el servidor. Distingue: guardado confirmado, error con mensaje del servidor y falta de conexión.
export class ErrorApi extends Error {
  constructor(mensaje, estado, datos = {}) { super(mensaje); this.estado = estado; this.datos = datos; this.campo = datos.campo || null; }
}

let alPerderSesion = () => {};
export const configurarApi = ({ sesionPerdida }) => { alPerderSesion = sesionPerdida; };

// Se conserva en el mismo formulario si se pierde la confirmación del servidor.
// No regenerar al reintentar: el servidor comprueba también el contenido enviado.
export function claveDeEnvio(form) {
  return form.dataset.clave ||= crypto.randomUUID();
}

export async function api(metodo, ruta, cuerpo, { idempotencia = false, archivo = null, cabeceras = {} } = {}) {
  const h = { 'X-Talleres': '1', ...cabeceras };
  let body;
  if (archivo) { body = archivo; h['Content-Type'] = archivo.type || 'application/octet-stream'; }
  else if (cuerpo !== undefined) { h['Content-Type'] = 'application/json'; body = JSON.stringify(cuerpo); }
  if (idempotencia) h['Idempotency-Key'] = typeof idempotencia === 'string' ? idempotencia : (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
  const sinConfirmacion = () => new ErrorApi(metodo === 'GET'
    ? 'No se pudo consultar el servidor. Lo escrito sigue en pantalla; probá de nuevo cuando vuelva la conexión.'
    : 'No se pudo confirmar si se guardó la operación. Lo escrito sigue en pantalla. ' + (typeof idempotencia === 'string'
      ? 'Reintentá desde este mismo formulario sin cambiar los datos ni recargar: se comprobará el registro para evitar duplicarlo.'
      : 'Revisá el registro antes de repetir la operación.'), 0, { sinConexion: true, guardadoSinConfirmar: metodo !== 'GET' });
  let res;
  try {
    res = await fetch(ruta, { method: metodo, headers: h, body, credentials: 'same-origin' });
  } catch {
    throw sinConfirmacion();
  }
  let datos = {};
  const tipo = res.headers.get('content-type') || '';
  if (tipo.includes('application/json')) { try { datos = await res.json(); } catch { throw sinConfirmacion(); } }
  else if (res.ok) throw sinConfirmacion();
  if (!res.ok) {
    if (res.status === 401 && !ruta.startsWith('/api/sesion/ingresar') && !ruta.startsWith('/api/acceso')) alPerderSesion();
    throw new ErrorApi(datos.error || `No se pudo completar (código ${res.status}).`, res.status, datos);
  }
  return datos;
}
export const get = (r) => api('GET', r);
export const post = (r, c, o) => api('POST', r, c, o);
export const put = (r, c, o) => api('PUT', r, c, o);
