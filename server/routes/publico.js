// Perfil público voluntario y directorio de talleres del producto. Nunca publica clientes, vehículos ni trabajos.
import { uno, todos } from '../db.js';
import { ErrorUsuario } from '../util.js';
import { tallerPublico } from '../datos.js';
import { agendaDe, franjasDe } from './agenda.js';

export default function rutas(r) {
  r.get('/api/publico/directorio', (ctx) => {
    const filas = todos(ctx.db, 'SELECT * FROM talleres WHERE activo = 1 AND publico = 1 AND en_directorio = 1 ORDER BY nombre');
    return { talleres: filas.map((t) => { const p = tallerPublico(t); return { slug: p.slug, nombre: p.nombre, localidad: p.localidad, servicios: p.servicios.slice(0, 6), tieneLogo: p.tieneLogo }; }) };
  }, { auth: false });

  r.get('/api/publico/:slug', (ctx) => {
    const t = uno(ctx.db, 'SELECT * FROM talleres WHERE slug = ? AND activo = 1 AND publico = 1', String(ctx.params.slug || '').toLowerCase());
    if (!t) throw new ErrorUsuario(404, 'No encontramos ese taller o no tiene página pública.');
    const p = tallerPublico(t);
    const c = JSON.parse(t.config || '{}');
    const a = agendaDe({ config: c });
    return { taller: { ...p, turnosOnline: !!c.turnosOnline, agenda: c.turnosOnline ? { dias: a.dias, desde: a.desde, hasta: a.hasta, franjas: franjasDe(a) } : null } };
  }, { auth: false });
}
