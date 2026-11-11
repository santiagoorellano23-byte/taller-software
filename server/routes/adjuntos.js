// Archivos privados (fotos, videos, PDF) y biblioteca técnica propia.
// Se guardan fuera de la carpeta pública, separados por taller, y solo se descargan con sesión del mismo taller.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { uno, todos, insertar, ejecutar } from '../db.js';
import { exigir, puede } from '../permisos.js';
import { delTaller } from '../datos.js';
import { ErrorUsuario, falla, requerido, opcional, texto, normTexto, isoAhora, idEntero } from '../util.js';
import { carpetaArchivos } from '../config.js';
import {claveIngreso,TIPOS_FOTO_INGRESO} from '../estado-ingreso.js';

const TIPOS = {
  'image/jpeg': { ext: 'jpg', firma: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: 'png', firma: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/webp': { ext: 'webp', firma: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
  'application/pdf': { ext: 'pdf', firma: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  'video/mp4': { ext: 'mp4', firma: (b) => b.subarray(4, 8).toString('latin1') === 'ftyp' },
  'video/quicktime': { ext: 'mov', firma: (b) => b.subarray(4, 8).toString('latin1') === 'ftyp' }
};

export function guardarArchivo(ctx, { ambito, visitaId = null, vehiculoId = null, descripcion = null }) {
  const buf = ctx.archivo;
  if (!buf || !buf.length) falla('No llegó ningún archivo. Elegilo de nuevo.');
  const mime = String(ctx.req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  const tipo = TIPOS[mime];
  if (!tipo) falla('Ese tipo de archivo no se acepta. Usá fotos (JPG, PNG, WEBP), videos MP4/MOV o documentos PDF.');
  if (!tipo.firma(buf)) falla('El contenido del archivo no coincide con su tipo. Probá exportarlo de nuevo.');
  let nombre = 'archivo';
  try { nombre = decodeURIComponent(String(ctx.req.headers['x-nombre-archivo'] || 'archivo')); } catch { /* nombre por defecto */ }
  nombre = nombre.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 150) || 'archivo';
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  const rel = path.join(String(ctx.taller.id), isoAhora().slice(0, 7), `${crypto.randomBytes(12).toString('hex')}.${tipo.ext}`);
  const destino = path.join(carpetaArchivos(), rel);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, buf, { flag: 'wx' });
  try {
    return insertar(ctx.db, 'INSERT INTO adjuntos (taller_id, ambito, visita_id, vehiculo_id, nombre_original, mime, bytes, ruta, sha256, descripcion, creado_por, creado_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ctx.taller.id, ambito, visitaId, vehiculoId, nombre, mime, buf.length, rel.split(path.sep).join('/'), sha, descripcion, ctx.usuario.id, isoAhora());
  } catch (e) {
    fs.rmSync(destino, { force: true });
    throw e;
  }
}

export function enviarArchivo(res, adj, { descargar = false } = {}) {
  const archivo = path.join(carpetaArchivos(), adj.ruta);
  if (!archivo.startsWith(carpetaArchivos()) || !fs.existsSync(archivo)) throw new ErrorUsuario(404, 'El archivo no está disponible en el servidor. Avisá al administrador para restaurarlo desde el respaldo.');
  res.writeHead(200, {
    'Content-Type': adj.mime,
    'Content-Length': fs.statSync(archivo).size,
    'Content-Disposition': `${descargar ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(adj.nombre_original)}`,
    'Cache-Control': 'private, no-store'
  });
  fs.createReadStream(archivo).pipe(res);
}

export default function rutas(r) {
  r.post('/api/recepcion/fotos',ctx=>{
    exigir(ctx.usuario,'visita.recibir');
    const {clave,tipo,token}=ctx.query;
    if(!claveIngreso(clave)||!claveIngreso(token)||!TIPOS_FOTO_INGRESO.includes(tipo))falla('Reabrí la recepción y elegí el tipo de foto.','fotosIngreso');
    if(!['image/jpeg','image/png','image/webp'].includes(String(ctx.req.headers['content-type']||'').split(';')[0].trim().toLowerCase()))falla('Elegí una foto JPG, PNG o WEBP.','fotosIngreso');
    const n=uno(ctx.db,'SELECT COUNT(*) n FROM adjuntos WHERE taller_id=? AND creado_por=? AND ingreso_clave=?',ctx.taller.id,ctx.usuario.id,clave).n;
    if(n>=36)falla('Este borrador ya tiene muchas fotos preparadas. Iniciá una nueva recepción y elegí solo las necesarias.','fotosIngreso');
    const id=guardarArchivo(ctx,{ambito:'visita',descripcion:`Foto de ingreso en preparación · ${tipo}`});
    ejecutar(ctx.db,'UPDATE adjuntos SET ingreso_clave=?,ingreso_tipo=?,ingreso_token=? WHERE taller_id=? AND id=?',clave,tipo,token,ctx.taller.id,id);
    ctx.auditar('Foto de ingreso preparada (todavía sin orden)','adjunto',id,tipo);
    return {id,tipo};
  },{archivo:true});

  r.get('/api/recepcion/fotos',ctx=>{
    exigir(ctx.usuario,'visita.recibir');
    if(!claveIngreso(ctx.query.clave))falla('No se pudo recuperar ese borrador.');
    return {fotos:todos(ctx.db,'SELECT id,ingreso_tipo AS tipo,ingreso_token AS token FROM adjuntos WHERE taller_id=? AND creado_por=? AND ingreso_clave=? AND visita_id IS NULL AND archivado_at IS NULL',ctx.taller.id,ctx.usuario.id,ctx.query.clave)};
  });
  r.post('/api/adjuntos', (ctx) => {
    exigir(ctx.usuario, 'adjuntos.subir');
    const ambito = ctx.query.ambito === 'vehiculo' ? 'vehiculo' : 'visita';
    let visitaId = null, vehiculoId = null;
    if (ambito === 'visita') {
      const v = delTaller(ctx.db, 'visitas', ctx.taller.id, idEntero(ctx.query.visitaId), 'No encontramos esa visita.');
      if (v.anulada_at) falla('La visita está anulada.');
      visitaId = v.id; vehiculoId = v.vehiculo_id;
    } else {
      vehiculoId = delTaller(ctx.db, 'vehiculos', ctx.taller.id, idEntero(ctx.query.vehiculoId), 'No encontramos ese auto.').id;
    }
    const descripcion = opcional(ctx.query.descripcion, 300);
    const id = guardarArchivo(ctx, { ambito, visitaId, vehiculoId, descripcion });
    ctx.auditar('Archivo agregado (privado)', ambito === 'visita' ? 'visita' : 'vehiculo', visitaId || vehiculoId, `${descripcion || ''}`.trim() || 'Sin descripción');
    return { id };
  }, { archivo: true });

  r.get('/api/adjuntos/:id', (ctx) => {
    exigir(ctx.usuario, 'ver.taller');
    const a = delTaller(ctx.db, 'adjuntos', ctx.taller.id, idEntero(ctx.params.id), 'No encontramos ese archivo en este taller.');
    if (a.archivado_at && !puede(ctx.usuario, 'adjuntos.archivar')) throw new ErrorUsuario(404, 'Ese archivo está archivado.');
    enviarArchivo(ctx.res, a, { descargar: ctx.query.descargar === '1' });
    return undefined;
  });

  r.post('/api/adjuntos/:id/archivar', (ctx) => {
    exigir(ctx.usuario, 'adjuntos.archivar', 'Solo el dueño archiva archivos.');
    const a = delTaller(ctx.db, 'adjuntos', ctx.taller.id, idEntero(ctx.params.id), 'No encontramos ese archivo.');
    if(a.ingreso_tipo&&a.visita_id)falla('Esta foto forma parte del estado registrado al ingresar. Se conserva en la orden; agregá una nota si necesitás aclararla.');
    const motivo = requerido(ctx.cuerpo.motivo, 'Escribí por qué se archiva.', 'motivo', 300);
    ejecutar(ctx.db, 'UPDATE adjuntos SET archivado_at = ?, archivado_motivo = ? WHERE id = ?', isoAhora(), motivo, a.id);
    ctx.auditar('Archivo archivado (no se borra)', a.visita_id ? 'visita' : 'adjunto', a.visita_id || a.id, motivo);
    return { ok: true };
  });

  // ----- Biblioteca técnica propia -----
  r.get('/api/biblioteca', (ctx) => {
    exigir(ctx.usuario, 'biblioteca.ver');
    const q = normTexto(ctx.query.q || '');
    const filas = todos(ctx.db, `SELECT b.*, a.nombre_original, a.mime, a.bytes, u.nombre AS por FROM biblioteca b JOIN adjuntos a ON a.id = b.adjunto_id LEFT JOIN usuarios u ON u.id = b.creado_por
      WHERE b.taller_id = ? AND b.archivado_at IS NULL ORDER BY b.marca, b.modelo, b.titulo`, ctx.taller.id);
    const anio = Number(ctx.query.anio) || null;
    return {
      documentos: filas.filter((d) => {
        if (q && !normTexto([d.titulo, d.marca, d.modelo, d.sistema, d.etiquetas, d.procedencia].join(' ')).includes(q)) return false;
        if (ctx.query.marca && normTexto(d.marca) !== normTexto(ctx.query.marca)) return false;
        if (anio && ((d.anio_desde && anio < d.anio_desde) || (d.anio_hasta && anio > d.anio_hasta))) return false;
        return true;
      })
    };
  });

  r.post('/api/biblioteca', (ctx) => {
    exigir(ctx.usuario, 'biblioteca.cargar');
    const q = ctx.query;
    const titulo = requerido(q.titulo, 'Escribí un título que permita encontrarlo.', 'titulo', 200);
    const procedencia = requerido(q.procedencia, 'Indicá de dónde viene el documento (manual del fabricante, apunte propio, curso…).', 'procedencia', 200);
    if (q.derechos !== '1') falla('Confirmá que el taller tiene derecho a guardar y usar este material.', 'derechos');
    const desde = q.anioDesde ? Number(q.anioDesde) : null, hasta = q.anioHasta ? Number(q.anioHasta) : null;
    if ((desde && (desde < 1900 || desde > 2100)) || (hasta && (hasta < 1900 || hasta > 2100)) || (desde && hasta && desde > hasta)) falla('Revisá los años (desde y hasta).', 'anioDesde');
    const adjId = guardarArchivo(ctx, { ambito: 'biblioteca', descripcion: titulo });
    const id = insertar(ctx.db, 'INSERT INTO biblioteca (taller_id, titulo, adjunto_id, marca, modelo, sistema, anio_desde, anio_hasta, procedencia, version_doc, derechos, etiquetas, creado_por, creado_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ctx.taller.id, titulo, adjId, opcional(q.marca, 60), opcional(q.modelo, 80), opcional(q.sistema, 80), desde, hasta, procedencia, opcional(q.version, 60),
      `Confirmado por ${ctx.usuario.nombre} el ${isoAhora().slice(0, 10)}`, opcional(q.etiquetas, 300), ctx.usuario.id, isoAhora());
    ctx.auditar('Documento agregado a la biblioteca técnica', 'biblioteca', id, titulo);
    return { id };
  }, { archivo: true });

  r.post('/api/biblioteca/:id/archivar', (ctx) => {
    exigir(ctx.usuario, 'config.taller', 'Solo el dueño archiva documentos de la biblioteca.');
    const b = delTaller(ctx.db, 'biblioteca', ctx.taller.id, idEntero(ctx.params.id), 'No encontramos ese documento.');
    const motivo = requerido(ctx.cuerpo.motivo, 'Escribí el motivo.', 'motivo', 300);
    ejecutar(ctx.db, 'UPDATE biblioteca SET archivado_at = ? WHERE id = ?', isoAhora(), b.id);
    ctx.auditar('Documento de biblioteca archivado', 'biblioteca', b.id, motivo);
    return { ok: true };
  });
}
