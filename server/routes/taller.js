// Administración del taller: perfil y página pública, logo, usuarios, puestos, servicios, plantillas,
// calculadora de mano de obra, integraciones (condicionadas), registro de acciones y exportación.
import { uno, todos, insertar, ejecutar } from '../db.js';
import { exigir, ROLES, puede } from '../permisos.js';
import { delTaller, tallerPublico } from '../datos.js';
import {
  ErrorUsuario, falla, conflicto, requerido, opcional, texto, enLista, dinero, parseCantidad, isoAhora, idEntero, json, normTexto, minutosDe
} from '../util.js';
import { crearTokenAcceso, cerrarSesionesDe } from '../auth.js';
import { guardarArchivo } from './adjuntos.js';
import { agendaDe, normalizarAgenda } from './agenda.js';
import { ENTREGA_SALDO, reglaEntregaSaldo } from '../reglas.js';
import path from 'node:path';
import { config } from '../config.js';
import { estadoRespaldo } from '../respaldo.js';

function guardarConfig(ctx, cambios) {
  const t = uno(ctx.db, 'SELECT config, version FROM talleres WHERE id = ?', ctx.taller.id);
  const c = { ...json(t.config, {}), ...cambios };
  ejecutar(ctx.db, 'UPDATE talleres SET config = ?, version = version + 1 WHERE id = ?', JSON.stringify(c), ctx.taller.id);
  ctx.taller.config = c;
  return c;
}

export const INTEGRACIONES = [
  { clave: 'whatsapp_auto', nombre: 'Avisos automáticos por WhatsApp', necesita: 'Cuenta de WhatsApp Business habilitada con un proveedor, plantillas aprobadas y costos confirmados.', alternativa: 'Preparar el mensaje y abrir WhatsApp para enviarlo a mano (Pendientes y cada visita).' },
  { clave: 'correo_auto', nombre: 'Avisos automáticos por correo', necesita: 'Un servicio de envío de correo con dominio verificado.', alternativa: 'Copiar el texto del mensaje y enviarlo desde el correo del taller.' },
  { clave: 'ia_asistente', nombre: 'Asistente técnico con IA', necesita: 'Proveedor de IA elegido, acceso, costos y reglas de qué datos se envían.', alternativa: 'Biblioteca técnica propia con búsqueda y la ayuda «Cómo hago…».' },
  { clave: 'ia_estimacion', nombre: 'Estimación de mano de obra con IA', necesita: 'Proveedor de IA y antecedentes suficientes del taller.', alternativa: 'Calculadora de mano de obra con tarifas y tiempos del taller (funciona sin IA).' }
];

const TABLAS_EXPORT = ['contactos', 'vehiculos', 'vehiculo_contactos', 'lecturas', 'visitas', 'revisiones', 'hallazgos', 'presupuesto_versiones', 'presupuesto_lineas', 'respuestas', 'repuestos', 'reservas',
  'tareas_service', 'productos_usados', 'controles', 'seguimientos', 'avisos', 'turnos', 'puestos', 'servicios', 'plantillas_service', 'plantillas_trabajo', 'proveedores', 'articulos',
  'movimientos_stock', 'compras', 'compra_lineas', 'compra_documentos', 'pagos_proveedor', 'ventas', 'venta_lineas', 'cuenta_movimientos', 'documentos', 'adjuntos', 'biblioteca', 'auditoria'];

export default function rutas(r) {
  // ----- Perfil, página pública y preferencias -----
  r.get('/api/respaldos/estado', (ctx) => {
    exigir(ctx.usuario, 'config.taller');
    return estadoRespaldo(path.join(path.dirname(config.datos), 'respaldos'));
  });
  r.get('/api/taller', (ctx) => {
    exigir(ctx.usuario, 'config.taller');
    const t = ctx.taller;
    return {
      taller: { nombre: t.nombre, slug: t.slug, publico: !!t.publico, en_directorio: !!t.en_directorio, version: t.version, config: { ...t.config } },
      agenda: agendaDe(t), entregaSaldo: { regla: reglaEntregaSaldo(t), opciones: ENTREGA_SALDO }, integraciones: INTEGRACIONES.map((i) => ({ ...i, estado: 'inactiva' }))
    };
  });

  r.put('/api/taller', (ctx) => {
    exigir(ctx.usuario, 'config.taller');
    const b = ctx.cuerpo;
    if (Number(b.version) !== ctx.taller.version) conflicto();
    const nombre = requerido(b.nombre ?? ctx.taller.nombre, 'El taller necesita un nombre.', 'nombre', 120);
    const cambios = {};
    for (const k of ['lema', 'descripcion', 'telefono', 'whatsapp', 'email', 'direccion', 'localidad', 'horarios', 'mapa']) if (b[k] !== undefined) cambios[k] = opcional(b[k], k === 'descripcion' ? 1500 : 300);
    if (b.mapa && !/^https:\/\//.test(b.mapa)) falla('El enlace del mapa debe empezar con https://', 'mapa');
    if (b.serviciosPublicos !== undefined) cambios.serviciosPublicos = (Array.isArray(b.serviciosPublicos) ? b.serviciosPublicos : String(b.serviciosPublicos).split('\n')).map((s) => texto(s, 120)).filter(Boolean).slice(0, 30);
    if (b.validezDias !== undefined) {
      const n = Number(b.validezDias);
      if (!Number.isInteger(n) || n < 1 || n > 120) falla('La validez del presupuesto debe ser de 1 a 120 días.', 'validezDias');
      cambios.validez_presupuesto_dias = n;
    }
    if (b.valorHora !== undefined) cambios.valor_hora = b.valorHora === '' || b.valorHora === null ? null : dinero(b.valorHora, 'Escribí el valor de la hora de trabajo con números.', 'valorHora');
    if (b.agenda) {
      cambios.agenda = normalizarAgenda({ ...agendaDe(ctx.taller), ...b.agenda });
    }
    if (b.turnosOnline !== undefined) cambios.turnosOnline = !!b.turnosOnline;
    if (b.entregaSaldo !== undefined) cambios.entrega_saldo = enLista(b.entregaSaldo, Object.keys(ENTREGA_SALDO), 'Elegí quién puede entregar con saldo.', 'entregaSaldo');
    guardarConfig(ctx, cambios);
    const publico = b.publico === undefined ? ctx.taller.publico : (b.publico ? 1 : 0);
    const directorio = b.en_directorio === undefined ? ctx.taller.en_directorio : (b.en_directorio && publico ? 1 : 0);
    ejecutar(ctx.db, 'UPDATE talleres SET nombre = ?, publico = ?, en_directorio = ? WHERE id = ?', nombre, publico, directorio, ctx.taller.id);
    ctx.auditar('Datos y preferencias del taller actualizados', 'taller', ctx.taller.id, Object.keys(cambios).join(', '));
    return { ok: true };
  });

  r.post('/api/taller/logo', (ctx) => {
    exigir(ctx.usuario, 'config.taller');
    const mime = String(ctx.req.headers['content-type'] || '');
    if (!/^image\/(png|jpeg|webp)/.test(mime)) falla('El logo debe ser una imagen PNG, JPG o WEBP.');
    if (ctx.archivo.length > 400_000) falla('El logo debe pesar menos de 400 KB para que entre en los documentos.');
    const id = guardarArchivo(ctx, { ambito: 'logo', descripcion: 'Logo del taller' });
    guardarConfig(ctx, { logoAdjuntoId: id });
    ctx.auditar('Logo actualizado (los documentos ya emitidos conservan el anterior)', 'taller', ctx.taller.id);
    return { id };
  }, { archivo: true });

  // Quitar la marca actual conserva el archivo y las copias históricas emitidas.
  r.delete('/api/taller/logo', (ctx) => {
    exigir(ctx.usuario, 'config.taller');
    guardarConfig(ctx, { logoAdjuntoId: null });
    ctx.auditar('Logo quitado del taller (se conservan documentos anteriores)', 'taller', ctx.taller.id);
    return { ok: true };
  });

  // ----- Usuarios -----
  r.get('/api/usuarios', (ctx) => {
    // Lista básica para elegir responsables (todos); datos completos solo para el dueño.
    exigir(ctx.usuario, 'ver.taller');
    const completo = puede(ctx.usuario, 'usuarios.gestionar');
    const filas = todos(ctx.db, `SELECT u.id, u.nombre, u.rol, u.activo, ${completo ? 'u.email, u.ultimo_acceso, u.version, (u.pass_hash IS NULL) AS pendiente' : 'NULL AS email'} FROM usuarios u WHERE u.taller_id = ? ORDER BY u.activo DESC, u.nombre`, ctx.taller.id);
    return { usuarios: filas.map((u) => ({ ...u, rolTexto: ROLES[u.rol] })), roles: ROLES };
  });

  r.post('/api/usuarios', (ctx) => {
    exigir(ctx.usuario, 'usuarios.gestionar');
    const nombre = requerido(ctx.cuerpo.nombre, 'Escribí el nombre de la persona.', 'nombre', 120);
    const email = requerido(ctx.cuerpo.email, 'Escribí el correo con el que va a ingresar.', 'email', 160).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) falla('El correo no parece válido.', 'email');
    const rol = enLista(ctx.cuerpo.rol, Object.keys(ROLES), 'Elegí el perfil: dueño, recepción o mecánico.', 'rol');
    if (uno(ctx.db, 'SELECT id FROM usuarios WHERE email = ?', email)) falla('Ese correo ya está en uso. Usá otro.', 'email');
    const id = insertar(ctx.db, 'INSERT INTO usuarios (taller_id, nombre, email, rol, creado_at) VALUES (?, ?, ?, ?, ?)', ctx.taller.id, nombre, email, rol, isoAhora());
    const t = crearTokenAcceso(ctx.db, id, 'invitacion', ctx.usuario.id, 72);
    ctx.auditar('Usuario invitado', 'usuario', id, `${nombre} · ${ROLES[rol]}`);
    return { id, enlace: `/acceso.html#${t.token}`, expira: t.expira };
  });

  r.put('/api/usuarios/:id', (ctx) => {
    exigir(ctx.usuario, 'usuarios.gestionar');
    const u = delTaller(ctx.db, 'usuarios', ctx.taller.id, idEntero(ctx.params.id), 'No encontramos ese usuario.');
    if (Number(ctx.cuerpo.version) !== u.version) conflicto();
    const nombre = requerido(ctx.cuerpo.nombre ?? u.nombre, 'El nombre no puede quedar vacío.', 'nombre', 120);
    const rol = enLista(ctx.cuerpo.rol ?? u.rol, Object.keys(ROLES), 'Perfil no válido.', 'rol');
    const activo = ctx.cuerpo.activo === undefined ? u.activo : (ctx.cuerpo.activo ? 1 : 0);
    if (u.id === ctx.usuario.id && (rol !== 'dueno' || !activo)) falla('No podés quitarte tu propio acceso de dueño desde tu sesión. Pedile a otro dueño que lo haga.');
    if (u.rol === 'dueno' && u.activo && (rol !== 'dueno' || !activo)) {
      const otros = uno(ctx.db, "SELECT COUNT(*) AS n FROM usuarios WHERE taller_id = ? AND rol = 'dueno' AND activo = 1 AND id <> ?", ctx.taller.id, u.id).n;
      if (!otros) falla('Tiene que quedar al menos un dueño activo.');
    }
    ejecutar(ctx.db, 'UPDATE usuarios SET nombre = ?, rol = ?, activo = ?, version = version + 1 WHERE id = ?', nombre, rol, activo, u.id);
    if (!activo || rol !== u.rol) cerrarSesionesDe(ctx.db, u.id);
    const det = [];
    if (rol !== u.rol) det.push(`perfil: ${ROLES[u.rol]} → ${ROLES[rol]}`);
    if (activo !== u.activo) det.push(activo ? 'reactivado' : 'desactivado (se cerraron sus sesiones)');
    ctx.auditar('Usuario actualizado', 'usuario', u.id, det.join('; ') || nombre);
    return { ok: true };
  });

  r.post('/api/usuarios/:id/cerrar-sesiones', (ctx) => {
    exigir(ctx.usuario, 'usuarios.gestionar');
    const u = delTaller(ctx.db, 'usuarios', ctx.taller.id, idEntero(ctx.params.id), 'No encontramos ese usuario.');
    cerrarSesionesDe(ctx.db, u.id);
    ctx.auditar('Sesiones cerradas en todos los dispositivos', 'usuario', u.id, u.nombre);
    return { ok: true };
  });

  r.post('/api/usuarios/:id/recuperacion', (ctx) => {
    exigir(ctx.usuario, 'usuarios.gestionar');
    const u = delTaller(ctx.db, 'usuarios', ctx.taller.id, idEntero(ctx.params.id), 'No encontramos ese usuario.');
    if (!u.activo) falla('El usuario está desactivado. Reactivalo primero.');
    const t = crearTokenAcceso(ctx.db, u.id, u.pass_hash ? 'recuperacion' : 'invitacion', ctx.usuario.id, 24);
    ctx.auditar(u.pass_hash ? 'Enlace para cambiar contraseña generado' : 'Invitación generada de nuevo', 'usuario', u.id);
    return { enlace: `/acceso.html#${t.token}`, expira: t.expira };
  });

  // ----- Puestos, servicios y plantillas -----
  r.get('/api/catalogos', (ctx) => {
    exigir(ctx.usuario, 'ver.taller');
    const verDinero = puede(ctx.usuario, 'ver.dinero');
    return {
      puestos: todos(ctx.db, 'SELECT * FROM puestos WHERE taller_id = ? ORDER BY activo DESC, id', ctx.taller.id),
      servicios: todos(ctx.db, 'SELECT * FROM servicios WHERE taller_id = ? ORDER BY activo DESC, nombre', ctx.taller.id).map((s) => ({ ...s, precio: verDinero ? s.precio : null })),
      plantillas: todos(ctx.db, 'SELECT * FROM plantillas_service WHERE taller_id = ? ORDER BY activo DESC, nombre', ctx.taller.id).map((p) => ({ ...p, tareas: json(p.tareas, []) })),
      trabajos: todos(ctx.db, 'SELECT * FROM plantillas_trabajo WHERE taller_id = ? ORDER BY activo DESC, nombre', ctx.taller.id)
    };
  });

  r.post('/api/catalogos/:tipo', (ctx) => {
    exigir(ctx.usuario, 'config.taller');
    const b = ctx.cuerpo, tid = ctx.taller.id;
    const id = idEntero(b.id);
    const activo = b.activo === false ? 0 : 1;
    switch (ctx.params.tipo) {
      case 'puestos': {
        const nombre = requerido(b.nombre, 'Escribí el nombre del puesto (por ejemplo «Elevador 1»).', 'nombre', 60);
        if (id) { delTaller(ctx.db, 'puestos', tid, id); ejecutar(ctx.db, 'UPDATE puestos SET nombre = ?, activo = ? WHERE id = ?', nombre, activo, id); }
        else insertar(ctx.db, 'INSERT INTO puestos (taller_id, nombre) VALUES (?, ?)', tid, nombre);
        break;
      }
      case 'servicios': {
        const nombre = requerido(b.nombre, 'Escribí el nombre del servicio.', 'nombre', 120);
        const dur = Number(b.duracion || 60);
        if (!Number.isInteger(dur) || dur < 15 || dur > 480 || dur % 15) falla('La duración va de 15 a 480 minutos, en pasos de 15.', 'duracion');
        const precio = b.precio == null || String(b.precio).trim() === '' ? null : dinero(b.precio, 'El precio debe escribirse con números.', 'precio', { cero: true });
        const publico = b.publico === false ? 0 : 1;
        if (id) { delTaller(ctx.db, 'servicios', tid, id); ejecutar(ctx.db, 'UPDATE servicios SET nombre = ?, duracion_min = ?, precio = ?, publico = ?, activo = ? WHERE id = ?', nombre, dur, precio, publico, activo, id); }
        else insertar(ctx.db, 'INSERT INTO servicios (taller_id, nombre, duracion_min, precio, publico) VALUES (?, ?, ?, ?, ?)', tid, nombre, dur, precio, publico);
        break;
      }
      case 'plantillas': {
        const nombre = requerido(b.nombre, 'Escribí el nombre de la plantilla.', 'nombre', 120);
        const tareas = (Array.isArray(b.tareas) ? b.tareas : String(b.tareas || '').split('\n')).map((t) => texto(t, 300)).filter(Boolean);
        if (!tareas.length) falla('Escribí al menos una tarea (una por renglón).', 'tareas');
        if (id) { delTaller(ctx.db, 'plantillas_service', tid, id); ejecutar(ctx.db, 'UPDATE plantillas_service SET nombre = ?, tareas = ?, activo = ? WHERE id = ?', nombre, JSON.stringify(tareas), activo, id); }
        else insertar(ctx.db, 'INSERT INTO plantillas_service (taller_id, nombre, tareas) VALUES (?, ?, ?)', tid, nombre, JSON.stringify(tareas));
        break;
      }
      case 'trabajos': {
        exigir(ctx.usuario, 'calculadora.configurar');
        const nombre = requerido(b.nombre, 'Escribí el nombre del trabajo.', 'nombre', 120);
        const horas = parseCantidad(b.horas);
        if (!horas || horas > 200000) falla('Escribí las horas estimadas con números (por ejemplo 1,5).', 'horas');
        if (id) { delTaller(ctx.db, 'plantillas_trabajo', tid, id); ejecutar(ctx.db, 'UPDATE plantillas_trabajo SET nombre = ?, horas_m = ?, notas = ?, activo = ? WHERE id = ?', nombre, horas, opcional(b.notas, 500), activo, id); }
        else insertar(ctx.db, 'INSERT INTO plantillas_trabajo (taller_id, nombre, horas_m, notas) VALUES (?, ?, ?, ?)', tid, nombre, horas, opcional(b.notas, 500));
        break;
      }
      default: falla('Catálogo no válido.');
    }
    ctx.auditar(`Catálogo actualizado: ${ctx.params.tipo}`, 'taller', tid, texto(b.nombre, 120));
    return { ok: true };
  });

  // ----- Calculadora de mano de obra (sin IA): horas × valor hora del taller, con antecedentes propios. -----
  r.get('/api/calculadora', (ctx) => {
    exigir(ctx.usuario, 'calculadora.usar');
    const plantilla = idEntero(ctx.query.plantillaId) ? delTaller(ctx.db, 'plantillas_trabajo', ctx.taller.id, idEntero(ctx.query.plantillaId)) : null;
    const horas = ctx.query.horas ? parseCantidad(ctx.query.horas) : plantilla?.horas_m ?? null;
    const valorHora = ctx.query.valorHora ? dinero(ctx.query.valorHora, 'El valor hora debe escribirse con números.', 'valorHora') : (ctx.taller.config.valor_hora ?? null);
    const nombre = plantilla?.nombre || texto(ctx.query.descripcion, 120);
    let antecedentes = [];
    if (nombre && nombre.length >= 3) {
      const q = normTexto(nombre);
      antecedentes = todos(ctx.db, `SELECT l.descripcion, l.importe, l.cantidad_m, l.unidad, v.numero, v.ingreso_at FROM presupuesto_lineas l JOIN visitas v ON v.id = l.visita_id
        WHERE l.taller_id = ? AND l.tipo = 'mano_obra' AND l.estado = 'vigente' AND l.realizado_at IS NOT NULL ORDER BY l.id DESC LIMIT 500`, ctx.taller.id)
        .filter((l) => normTexto(l.descripcion).includes(q) || q.includes(normTexto(l.descripcion))).slice(0, 10);
    }
    const resultado = horas && valorHora ? Math.round((horas * valorHora) / 1000) : null;
    return {
      horas_m: horas, valorHora, resultado, antecedentes,
      promedioAntecedentes: antecedentes.length ? Math.round(antecedentes.reduce((n, a) => n + a.importe, 0) / antecedentes.length) : null,
      faltante: !valorHora ? 'Falta cargar el valor de la hora de trabajo en Ajustes del taller.' : !horas ? 'Escribí las horas estimadas o elegí un trabajo con tiempo cargado.' : null,
      aviso: 'Cálculo con tarifas y tiempos del taller. No es un precio de mercado ni un tiempo normativo; el responsable decide el importe final.'
    };
  });

  // ----- Integraciones condicionadas -----
  r.get('/api/integraciones', (ctx) => {
    exigir(ctx.usuario, 'ver.taller');
    return { integraciones: INTEGRACIONES.map((i) => ({ ...i, estado: 'inactiva', motivo: 'Sin cuenta ni proveedor configurados. No se simula ningún envío ni respuesta.' })) };
  });

  // ----- Registro de acciones -----
  r.get('/api/auditoria', (ctx) => {
    exigir(ctx.usuario, 'auditoria.ver');
    const filas = todos(ctx.db, `SELECT a.*, u.nombre AS por FROM auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id WHERE a.taller_id = ? ORDER BY a.id DESC LIMIT 300`, ctx.taller.id);
    return { acciones: filas };
  });

  // ----- Exportación de los datos del taller (solo los de este taller; sin contraseñas ni sesiones) -----
  r.get('/api/exportar', (ctx) => {
    exigir(ctx.usuario, 'exportar');
    const datos = { taller: { nombre: ctx.taller.nombre, slug: ctx.taller.slug, perfil: tallerPublico(ctx.taller) }, exportado: isoAhora(), usuarios: todos(ctx.db, 'SELECT id, nombre, email, rol, activo, creado_at FROM usuarios WHERE taller_id = ?', ctx.taller.id) };
    for (const t of TABLAS_EXPORT) datos[t] = todos(ctx.db, `SELECT * FROM ${t} WHERE taller_id = ?`, ctx.taller.id);
    for (const a of datos.adjuntos) delete a.ruta;
    ctx.auditar('Exportación de datos descargada', 'taller', ctx.taller.id);
    if (ctx.query.formato === 'csv') {
      const ent = TABLAS_EXPORT.includes(ctx.query.entidad) ? ctx.query.entidad : 'vehiculos';
      const filas = datos[ent];
      const cols = filas.length ? Object.keys(filas[0]) : ['sin_datos'];
      const celda = (v) => { const s = v == null ? '' : String(v); if (/^-?\d+(\.\d+)?$/.test(s)) return s; return /[";\n\r]/.test(s) || /^[=+\-@]/.test(s) ? '"' + s.replace(/"/g, '""').replace(/^([=+\-@])/, "'$1") + '"' : s; };
      const csv = '﻿' + [cols.join(';'), ...filas.map((f) => cols.map((c) => celda(f[c])).join(';'))].join('\r\n');
      ctx.res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${ctx.taller.slug}-${ent}.csv"`, 'Cache-Control': 'no-store' });
      ctx.res.end(csv);
      return undefined;
    }
    ctx.res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="${ctx.taller.slug}-exportacion.json"`, 'Cache-Control': 'no-store' });
    ctx.res.end(JSON.stringify(datos, null, 1));
    return undefined;
  });
}
