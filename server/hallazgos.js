import crypto from 'node:crypto';
import { uno, todos, insertar, ejecutar } from './db.js';
import { exigir } from './permisos.js';
import { delTaller } from './datos.js';
import { requerido, opcional, enLista, idEntero, falla, conflicto, prohibido, isoAhora } from './util.js';

export function registrarHallazgo(ctx, anteriorId = null) {
  exigir(ctx.usuario, 'revision.registrar');
  const v = delTaller(ctx.db, 'visitas', ctx.taller.id, idEntero(ctx.params.id), 'No encontramos esta orden.');
  if (v.entregada_at || v.anulada_at) falla('La orden está cerrada. El hallazgo se conserva para consulta.');
  if (ctx.usuario.rol === 'mecanico' && v.responsable_id && v.responsable_id !== ctx.usuario.id) prohibido('Esta orden está asignada a otra persona.');
  if (uno(ctx.db, 'SELECT id FROM controles WHERE taller_id=? AND visita_id=? AND vigente=1', ctx.taller.id, v.id)) falla('El resultado ya está comprobado. Conservá ese control y abrí una visita relacionada si hace falta otra inspección.');
  let anterior = null;
  if (anteriorId) {
    anterior = delTaller(ctx.db, 'hallazgos', ctx.taller.id, idEntero(anteriorId), 'No encontramos este hallazgo.');
    if (anterior.visita_id !== v.id) falla('El hallazgo pertenece a otra orden.');
    if (!anterior.vigente || Number(ctx.cuerpo.versionActual) !== anterior.version_num) conflicto('Otra persona actualizó este hallazgo. Recargá para ver la versión; lo escrito sigue en pantalla.');
  }
  const b = ctx.cuerpo;
  const observacion = requerido(b.observacion, 'Describí lo observado.', 'observacion', 2000);
  const gravedad = enLista(b.gravedad, ['informativo','recomendado','prioritario'], 'Elegí la gravedad del hallazgo.', 'gravedad');
  const propuesta = opcional(b.propuesta, 2000);
  const motivo = anterior ? requerido(b.motivoEdicion, 'Explicá por qué actualizás el hallazgo.', 'motivoEdicion', 500) : null;
  const foto = idEntero(b.adjuntoId);
  if (foto) {
    const a = delTaller(ctx.db, 'adjuntos', ctx.taller.id, foto, 'Elegí una foto de esta orden.');
    if (a.visita_id !== v.id || a.archivado_at || !['image/jpeg','image/png','image/webp'].includes(a.mime)) falla('La foto debe estar activa y pertenecer a esta orden.', 'adjuntoId');
  }
  if (anterior) ejecutar(ctx.db, 'UPDATE hallazgos SET vigente=0 WHERE id=?', anterior.id);
  const id = insertar(ctx.db, `INSERT INTO hallazgos(taller_id,visita_id,clave,version_num,observacion,gravedad,propuesta,adjunto_id,motivo_edicion,creado_por,creado_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    ctx.taller.id, v.id, anterior?.clave || crypto.randomUUID(), (anterior?.version_num || 0)+1, observacion, gravedad, propuesta, foto, motivo, ctx.usuario.id, isoAhora());
  ejecutar(ctx.db, 'UPDATE visitas SET version=version+1 WHERE id=? AND taller_id=?', v.id, ctx.taller.id);
  ctx.auditar(anterior ? 'Hallazgo actualizado; versión anterior conservada' : 'Hallazgo registrado; no autoriza ni cobra trabajos', 'visita', v.id, observacion);
  return { id };
}

export function leerHallazgos(db, tallerId, visitaId) {
  const filas = todos(db, `SELECT h.*,u.nombre AS por,a.nombre_original AS foto_nombre,a.mime AS foto_mime,a.archivado_at AS foto_archivada FROM hallazgos h LEFT JOIN usuarios u ON u.id=h.creado_por LEFT JOIN adjuntos a ON a.id=h.adjunto_id AND a.taller_id=h.taller_id WHERE h.taller_id=? AND h.visita_id=? ORDER BY h.id`, tallerId, visitaId);
  return filas.filter(h=>h.vigente).map(h=>({...h, anteriores:filas.filter(a=>a.clave===h.clave&&!a.vigente)}));
}
