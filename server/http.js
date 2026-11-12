// Capa HTTP mínima sin dependencias: rutas, sesión, protección CSRF, idempotencia y transacciones.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { ErrorUsuario, isoAhora, json as leerJson } from './util.js';
import { sesionDesdeToken } from './auth.js';
import { transaccion, uno, insertar, ejecutar } from './db.js';
import { config } from './config.js';

// Detrás de un proxy propio (TALLERES_PROXY=1) la IP del cliente es la última que agregó ese proxy.
// Sin esa variable se ignora X-Forwarded-For: cualquiera podría inventarla.
export function ipCliente(req) {
  if (config.proxy) {
    const xff = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (xff.length) return xff.at(-1);
  }
  return req.socket.remoteAddress;
}

export const COOKIE = 'glt_sesion';
const LIMITE_JSON = 1_000_000;
export const LIMITE_ARCHIVO = 15 * 1024 * 1024;

// El orden de las propiedades JSON no cambia el significado de una solicitud.
function canonico(valor) {
  if (Array.isArray(valor)) return valor.map(canonico);
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.keys(valor).sort().map((k) => [k, canonico(valor[k])]));
  return valor;
}

export class Enrutador {
  constructor() { this.rutas = []; }
  agregar(metodo, patron, fn, opciones = {}) {
    const claves = [];
    const re = new RegExp('^' + patron.replace(/:([a-zA-Z]+)/g, (_, k) => { claves.push(k); return '([^/]+)'; }) + '$');
    this.rutas.push({ metodo, re, claves, fn, opciones });
  }
  get(p, fn, o) { this.agregar('GET', p, fn, o); }
  post(p, fn, o) { this.agregar('POST', p, fn, o); }
  put(p, fn, o) { this.agregar('PUT', p, fn, o); }
  delete(p, fn, o) { this.agregar('DELETE', p, fn, o); }
  buscar(metodo, ruta) {
    for (const r of this.rutas) {
      if (r.metodo !== metodo) continue;
      const m = r.re.exec(ruta);
      if (m) return { ...r, params: Object.fromEntries(r.claves.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
    }
    return null;
  }
}

export function leerCookies(req) {
  const out = {};
  for (const par of (req.headers.cookie || '').split(';')) {
    const i = par.indexOf('=');
    if (i > 0) out[par.slice(0, i).trim()] = decodeURIComponent(par.slice(i + 1).trim());
  }
  return out;
}

export function cookieSesion(token, expira, seguro) {
  const partes = [`${COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (expira) partes.push(`Expires=${new Date(expira).toUTCString()}`);
  else partes.push('Max-Age=0');
  if (seguro) partes.push('Secure');
  return partes.join('; ');
}

export function cabecerasSeguridad(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "script-src 'self'",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '));
}

export function enviarJson(res, estado, datos, extra = {}) {
  const cuerpo = JSON.stringify(datos);
  res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
  res.end(cuerpo);
}

function leerCuerpo(req, limite) {
  return new Promise((resolve, reject) => {
    const trozos = [];
    let total = 0;
    req.on('data', (c) => {
      total += c.length;
      if (total > limite) {
        reject(new ErrorUsuario(413, limite === LIMITE_ARCHIVO ? 'El archivo supera los 15 MB. Probá con una foto más liviana o un PDF comprimido.' : 'Los datos enviados son demasiado grandes.'));
        req.destroy();
        return;
      }
      trozos.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(trozos)));
    req.on('error', reject);
  });
}

// Crea el manejador principal. `opciones.publico` sirve archivos estáticos; `seguro` agrega Secure a la cookie.
export function crearManejador({ db, enrutador, publico, seguro, extras }) {
  return async function manejar(req, res) {
    cabecerasSeguridad(res);
    const url = new URL(req.url, 'http://local');
    const ruta = url.pathname;
    try {
      if (ruta.startsWith('/api/')) return await manejarApi(req, res, url);
      if (extras) {
        const hecho = await extras(req, res, url);
        if (hecho) return;
      }
      return servirEstatico(res, publico, ruta);
    } catch (e) {
      responderError(res, e);
    }
  };

  async function manejarApi(req, res, url) {
    const r = enrutador.buscar(req.method, url.pathname);
    if (!r) throw new ErrorUsuario(404, 'Esa función no existe.');
    const muta = req.method !== 'GET';
    // Protección CSRF: las operaciones que cambian datos exigen una cabecera que un sitio ajeno no puede enviar
    // sin permiso CORS (que no se otorga) además de la cookie SameSite.
    if (muta && req.headers['x-talleres'] !== '1') throw new ErrorUsuario(403, 'Solicitud rechazada por seguridad. Recargá la página.');

    const cookies = leerCookies(req);
    const usuario = sesionDesdeToken(db, cookies[COOKIE]);
    if (r.opciones.auth !== false && !usuario) throw new ErrorUsuario(401, 'Tu sesión terminó. Volvé a ingresar; lo que estabas escribiendo sigue en pantalla.');

    let taller = null;
    if (usuario) {
      taller = uno(db, 'SELECT * FROM talleres WHERE id = ?', usuario.tallerId);
      taller.config = leerJson(taller.config, {});
    }

    let cuerpo = {};
    let archivo = null;
    if (muta) {
      if (r.opciones.archivo) {
        archivo = await leerCuerpo(req, LIMITE_ARCHIVO);
      } else {
        const crudo = await leerCuerpo(req, LIMITE_JSON);
        if (crudo.length) {
          try { cuerpo = JSON.parse(crudo.toString('utf8')); } catch { throw new ErrorUsuario(400, 'Los datos enviados no se pudieron leer.'); }
          if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) throw new ErrorUsuario(400, 'Los datos enviados no se pudieron leer.');
        }
      }
    }

    const ctx = {
      db, req, res, url, params: r.params, query: Object.fromEntries(url.searchParams), cuerpo, archivo,
      usuario, taller, seguro,
      ip: ipCliente(req)
    };
    ctx.auditar = (accion, entidad, entidadId, detalle) => {
      if (!ctx.taller) return;
      insertar(db, 'INSERT INTO auditoria (taller_id, usuario_id, accion, entidad, entidad_id, detalle, fecha) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ctx.taller.id, ctx.usuario?.id ?? null, accion, entidad ?? null, entidadId ?? null, detalle == null ? null : (typeof detalle === 'string' ? detalle : JSON.stringify(detalle)), isoAhora());
    };

    // Respuestas especiales (archivos, HTML) las escribe el propio manejador y devuelven undefined.
    const clave = muta ? String(req.headers['idempotency-key'] || '').slice(0, 100) : '';
    const huella = clave ? createHash('sha256').update(JSON.stringify([req.method, url.pathname, url.search, req.headers['content-type'] || '', canonico(cuerpo)]))
      .update(archivo || Buffer.alloc(0)).digest('hex') : null;
    if (muta && clave && taller) {
      const previa = uno(db, 'SELECT * FROM idempotencia WHERE taller_id = ? AND clave = ?', taller.id, clave);
      if (previa) {
        if (previa.usuario_id !== usuario.id || previa.ruta !== url.pathname || previa.solicitud_hash !== huella) throw new ErrorUsuario(409, 'Esta operación ya tiene un registro, pero no se puede confirmar que coincida con estos datos. Revisá los movimientos antes de registrar otro pago o una nueva operación.');
        return enviarJson(res, previa.estado, { ...JSON.parse(previa.respuesta), repetido: true });
      }
    }

    const ejecutarFn = () => {
      const resultado = r.fn(ctx);
      if (resultado instanceof Promise) throw new Error('Los manejadores con transacción deben ser síncronos.');
      if (muta && clave && taller && resultado !== undefined) {
        insertar(db, 'INSERT INTO idempotencia (taller_id, clave, usuario_id, ruta, estado, respuesta, fecha, solicitud_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          taller.id, clave, usuario.id, url.pathname, 200, JSON.stringify(resultado ?? {}), isoAhora(), huella);
      }
      return resultado;
    };

    let resultado;
    if (muta && r.opciones.tx !== false) resultado = transaccion(db, ejecutarFn);
    else resultado = await r.fn(ctx);
    if (resultado === undefined) return; // ya respondió
    const extra = ctx.cookie ? { 'Set-Cookie': ctx.cookie } : {};
    enviarJson(res, 200, resultado, extra);
  }
}

export function responderError(res, e) {
  if (res.headersSent) { res.end(); return; }
  if (e instanceof ErrorUsuario) return enviarJson(res, e.estado, { error: e.message, campo: e.campo || null, ...(e.datos || {}) });
  const msg = String(e?.message || '');
  if (/UNIQUE constraint failed: (compra_documentos|movimientos_stock)/.test(msg)) {
    return enviarJson(res, 409, { error: 'Ese registro ya existe: no se carga dos veces. Revisá la lista antes de repetir.' });
  }
  if (/FOREIGN KEY constraint failed/.test(msg)) {
    return enviarJson(res, 400, { error: 'Uno de los datos elegidos no pertenece a este taller o ya no existe. Recargá y elegí de nuevo.' });
  }
  console.error(new Date().toISOString(), e);
  enviarJson(res, 500, { error: 'No se pudo completar la operación por un error interno. No se guardó nada de esta acción. Probá de nuevo; si sigue, avisá al administrador.' });
}

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2'
};
export function servirEstatico(res, raiz, ruta) {
  let rel = decodeURIComponent(ruta);
  if (rel === '/' || rel === '') rel = '/index.html';
  const archivo = path.normalize(path.join(raiz, rel));
  if (!archivo.startsWith(path.normalize(raiz))) throw new ErrorUsuario(404, 'No encontrado');
  let st;
  try { st = fs.statSync(archivo); } catch { st = null; }
  if (!st || !st.isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><meta charset="utf-8"><title>No encontrado</title><p>No encontramos esta página. <a href="/">Ir al inicio</a></p>');
    return;
  }
  const ext = path.extname(archivo).toLowerCase();
  res.writeHead(200, {
    'Content-Type': TIPOS[ext] || 'application/octet-stream',
    'Content-Length': st.size,
    // Código y estilos se revalidan siempre (una actualización no deja pantallas viejas); fuentes e imágenes se guardan.
    'Cache-Control': ['.woff2', '.png', '.jpg', '.svg', '.ico'].includes(ext) ? 'public, max-age=86400' : 'no-cache'
  });
  fs.createReadStream(archivo).pipe(res);
}

export { ejecutar };
