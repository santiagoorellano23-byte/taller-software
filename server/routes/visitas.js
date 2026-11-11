// Recorrido principal: recibir → revisión → presupuesto y respuesta → repuestos y trabajo → control → lista → entrega.
import { uno, todos, insertar, ejecutar, siguiente } from '../db.js';
import { exigir, puede } from '../permisos.js';
import { delTaller, cargarVisita, resumenVisita, nombreUsuario } from '../datos.js';
import {
  ErrorUsuario, falla, conflicto, prohibido, requerido, opcional, texto, enLista, dinero, cantidad, parseCantidad,
  importeLinea, isoAhora, localAhora, hoyLocal, fechaHoraValida, fechaValida, sumarDias, idEntero, json, parseKm
} from '../util.js';
import { crearContacto, crearVehiculo, registrarLectura } from './vehiculos.js';
import { respuestaDe, esCambioPendiente, bloqueosRealizar, bloqueosControl, controlVigente, RESULTADOS, ETAPAS, TIPOS_LINEA, totales, reglaEntregaSaldo, puedeEntregarConSaldo, ENTREGA_SALDO } from '../reglas.js';
import { consumirRepuesto, reintegrarRepuesto, consumirProducto, reintegrarProducto } from './stock.js';
import { registrarHallazgo, leerHallazgos } from '../hallazgos.js';
import { datosRecepcion, motivoRecepcion } from '../recepcion.js';
import {validarEstadoIngreso,vincularEstadoIngreso} from '../estado-ingreso.js';

const zona = (ctx) => ctx.taller.config.zona_horaria || 'America/Argentina/Mendoza';
const UNIDADES = ['u.', 'L', 'kg', 'm', 'h', 'juego', 'kit', 'par'];
const CANALES = ['presencial', 'telefono', 'whatsapp', 'correo', 'otro'];

export function visitaDelTaller(ctx, id) {
  return delTaller(ctx.db, 'visitas', ctx.taller.id, idEntero(id), 'No encontramos esa visita en este taller.');
}
function abierta(v) {
  if (v.anulada_at) falla('La visita está anulada. Solo se puede consultar.');
  if (v.entregada_at) falla('La visita ya se entregó. Para un trabajo nuevo, recibí el auto otra vez (podés vincular la visita anterior).');
}
// El mecánico actúa sobre las visitas que tiene asignadas (o sin responsable). El dueño, sobre todas.
function exigirAsignado(ctx, v) {
  if (ctx.usuario.rol === 'mecanico' && v.responsable_id && v.responsable_id !== ctx.usuario.id) {
    prohibido('Esta visita está asignada a otra persona. Pedí que te la asignen para registrar cambios.');
  }
}
function tocarVisita(ctx, v, accion, detalle) {
  ejecutar(ctx.db, 'UPDATE visitas SET version = version + 1 WHERE taller_id = ? AND id = ?', ctx.taller.id, v.id);
  ctx.auditar(accion, 'visita', v.id, detalle);
}
function responder(ctx, id) {
  return { visita: cargarVisita(ctx.db, ctx.taller.id, id, { conDinero: puede(ctx.usuario, 'ver.dinero') }) };
}
// Agregar trabajo después del control reabre el circuito, conservando el control anterior.
function reabrirControl(ctx, v, motivo) {
  const c = uno(ctx.db, 'SELECT id FROM controles WHERE taller_id = ? AND visita_id = ? AND vigente = 1', ctx.taller.id, v.id);
  if (c) {
    ejecutar(ctx.db, 'UPDATE controles SET vigente = 0, reemplazado_motivo = ? WHERE id = ?', motivo, c.id);
    ctx.auditar('Control anterior conservado; hay que comprobar de nuevo', 'visita', v.id, motivo);
  }
  if (v.lista_at) {
    ejecutar(ctx.db, 'UPDATE visitas SET lista_at = NULL, lista_por = NULL WHERE id = ?', v.id);
    ctx.auditar('Ya no figura lista para retirar', 'visita', v.id, motivo);
  }
}

function lineaDesde(b, i) {
  const campo = (k) => `lineas.${i}.${k}`;
  const tipo = enLista(b.tipo || 'mano_obra', Object.keys(TIPOS_LINEA), 'Elegí si es repuesto, insumo, mano de obra o servicio externo.', campo('tipo'));
  const descripcion = requerido(b.descripcion, 'Escribí qué trabajo o repuesto es.', campo('descripcion'), 300);
  const cant = b.cantidad == null || String(b.cantidad).trim() === '' ? 1000 : cantidad(b.cantidad, 'La cantidad debe ser un número mayor que cero (por ejemplo 1 o 4,5).', campo('cantidad'));
  const unidad = enLista(texto(b.unidad) || 'u.', UNIDADES, 'Elegí una unidad de la lista.', campo('unidad'));
  const precio = dinero(b.precio, 'Escribí el precio con números, por ejemplo 36000 o 36.000.', campo('precio'), { cero: true });
  return { tipo, descripcion, cantidad_m: cant, unidad, precio_unit: precio, importe: importeLinea(cant, precio) };
}

function nuevaVersion(ctx, v, nota, cambios) {
  const n = (uno(ctx.db, 'SELECT MAX(numero) AS n FROM presupuesto_versiones WHERE taller_id = ? AND visita_id = ?', ctx.taller.id, v.id)?.n || 0) + 1;
  const validez = sumarDias(hoyLocal(zona(ctx)), Number(ctx.taller.config.validez_presupuesto_dias || 15));
  const id = insertar(ctx.db, 'INSERT INTO presupuesto_versiones (taller_id, visita_id, numero, nota, cambios, validez_hasta, creado_por, creado_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ctx.taller.id, v.id, n, nota, cambios ? JSON.stringify(cambios) : null, validez, ctx.usuario.id, isoAhora());
  return { id, numero: n };
}
function insertarLinea(ctx, v, versionId, l, extra = {}) {
  return insertar(ctx.db, `INSERT INTO presupuesto_lineas (taller_id, visita_id, version_id, origen_linea_id, tipo, descripcion, cantidad_m, unidad, precio_unit, importe, autorizada_ingreso, creado_por, creado_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ctx.taller.id, v.id, versionId, extra.origen ?? null, l.tipo, l.descripcion, l.cantidad_m, l.unidad, l.precio_unit, l.importe, extra.autorizadaIngreso ? 1 : 0, ctx.usuario.id, isoAhora());
}
const pesos = (c) => '$' + (c / 100).toLocaleString('es-AR', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
const cant = (m, u) => `${(m / 1000).toLocaleString('es-AR', { maximumFractionDigits: 3 })} ${u}`;

export function recibirAuto(ctx, b) {
  exigir(ctx.usuario, 'visita.recibir');
  const db = ctx.db, tid = ctx.taller.id;
  const tipo = enLista(b.tipo, ['revision', 'service'], 'Elegí si es Revisión o reparación, o Service.', 'tipo');
  const recepcion = datosRecepcion(b.recepcion);
  const motivo = requerido(recepcion ? motivoRecepcion(recepcion) : b.motivo, 'Escribí el motivo con las palabras del cliente.', 'motivo', recepcion ? 3000 : 1000);
  if(recepcion && (recepcion.autoriza!==tipo || (tipo==='revision' && (recepcion.revisionCosto==='si')!==!!b.autorizacion?.revisionConCosto)))falla('La autorización no coincide con la revisión final.','tipo');
  let responsableId = idEntero(b.responsableId);
  if (responsableId) {
    const u = delTaller(db, 'usuarios', tid, responsableId, 'Elegí un responsable del taller.');
    if (!u.activo) falla('Esa persona está desactivada. Elegí otro responsable.', 'responsableId');
  }
  let retiro = null;
  if (b.retiro) {
    if (!fechaHoraValida(b.retiro)) falla('El retiro acordado debe tener fecha y hora, o dejarse «A confirmar».', 'retiro');
    retiro = b.retiro;
  }
  // Vehículo y contacto
  let vehiculoId = idEntero(b.vehiculoId);
  let contactoId = idEntero(b.contactoId);
  if (contactoId) delTaller(db, 'contactos', tid, contactoId, 'Ese contacto no es de este taller.');
  if (vehiculoId) {
    const ve = delTaller(db, 'vehiculos', tid, vehiculoId, 'Ese auto no es de este taller.');
    if (ve.archivado) falla('La ficha de este auto está archivada. Recuperala desde la ficha antes de recibirlo.');
    if (!contactoId && b.contacto && texto(b.contacto.nombre)) contactoId = crearContacto(ctx, b.contacto);
    if (!contactoId) contactoId = ve.contacto_id;
    if (!ve.contacto_id && contactoId) {
      ejecutar(db, 'UPDATE vehiculos SET contacto_id = ? WHERE id = ?', contactoId, ve.id);
      insertar(db, 'INSERT INTO vehiculo_contactos (taller_id, vehiculo_id, contacto_id, desde) VALUES (?, ?, ?, ?)', tid, ve.id, contactoId, isoAhora());
    }
  } else {
    if (!contactoId) contactoId = crearContacto(ctx, b.contacto || {});
    vehiculoId = crearVehiculo(ctx, b.vehiculo || {}, contactoId);
  }
  const ya = uno(db, 'SELECT id, numero FROM visitas WHERE taller_id = ? AND vehiculo_id = ? AND entregada_at IS NULL AND anulada_at IS NULL', tid, vehiculoId);
  if (ya) throw new ErrorUsuario(409, `Este auto ya tiene una visita abierta (N.º ${ya.numero}). Abrila para continuar; no se crea otra.`, null, { visitaAbierta: ya });
  if (!contactoId) falla('Falta la persona de contacto de esta visita.', 'cnombre');
  const contacto = uno(db, 'SELECT nombre, telefono FROM contactos WHERE id = ?', contactoId);

  // Autorización al ingreso: un service autorizado no exige un diagnóstico; una revisión con costo no autoriza reparaciones.
  let autorizacion = null;
  const aut = b.autorizacion || {};
  if (tipo === 'service') {
    const persona = requerido(aut.persona, 'Indicá quién autorizó el service al dejar el auto. Si todavía no lo autorizó, recibilo como Revisión.', 'autPersona', 120);
    autorizacion = `Service autorizado al ingresar por ${persona}${aut.canal ? ' (' + aut.canal + ')' : ''}.`;
  } else if (aut.revisionConCosto) {
    const persona = requerido(aut.persona, 'Indicá quién autorizó la revisión con costo.', 'autPersona', 120);
    autorizacion = `Revisión con costo autorizada por ${persona}. No autoriza reparaciones.`;
  }
  let relacionadaId = idEntero(b.relacionadaId);
  if (relacionadaId) {
    const rel = delTaller(db, 'visitas', tid, relacionadaId, 'La visita anterior no es de este taller.');
    if (rel.vehiculo_id !== vehiculoId) falla('La visita relacionada debe ser del mismo auto.');
  }
  let turnoId = idEntero(b.turnoId);
  if (turnoId) {
    const t = delTaller(db, 'turnos', tid, turnoId, 'Ese turno no es de este taller.');
    if (t.estado !== 'confirmado') falla('Primero confirmá el turno para recibir el auto desde la agenda.');
    const auto=uno(db,'SELECT patente FROM vehiculos WHERE id = ?',vehiculoId);
    if(t.patente && t.patente.replace(/\W/g,'').toUpperCase()!==auto.patente.replace(/\W/g,'').toUpperCase())falla('La patente del turno no coincide con el auto elegido. Revisá el turno antes de recibirlo.','vehiculoId');
  }
  const plantillaId = tipo === 'service' ? idEntero(b.plantillaId) : null;
  const plantilla = plantillaId ? delTaller(db, 'plantillas_service', tid, plantillaId, 'Elegí una plantilla de service de este taller.') : null;

  const estadoIngreso = validarEstadoIngreso(ctx, b.estadoIngreso);

  const numero = siguiente(db, tid, 'visita');
  const id = insertar(db, `INSERT INTO visitas (taller_id, numero, vehiculo_id, contacto_id, contacto_nombre, contacto_telefono, tipo, motivo, responsable_id, prioridad,
      retiro_acordado, retiro_nota, ingreso_at, turno_id, relacionada_id, relacion_nota, autorizacion_ingreso, plantilla_id, creado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  tid, numero, vehiculoId, contactoId, contacto.nombre, contacto.telefono, tipo, motivo, responsableId, b.prioridad === 'alta' ? 'alta' : 'normal',
  retiro, opcional(b.retiroNota, 300), isoAhora(), turnoId, relacionadaId, relacionadaId ? (opcional(b.relacionNota, 500) || 'Vuelve por el mismo problema. La garantía la decide el taller.') : null,
  autorizacion, plantilla?.id ?? null, ctx.usuario.id);
  const v = { id };
  if(recepcion)ejecutar(db,'UPDATE visitas SET recepcion_json = ? WHERE taller_id = ? AND id = ?',JSON.stringify(recepcion),tid,id);
  vincularEstadoIngreso(ctx,estadoIngreso,id,vehiculoId);
  registrarLectura(ctx, vehiculoId, id, { km: b.km, sinKm: !!b.sinKm, explicacion: b.kmExplicacion, origen: 'Tablero, al recibir' });
  if (turnoId) ejecutar(db, "UPDATE turnos SET estado = 'ingresado', visita_id = ?, version = version + 1 WHERE id = ?", id, turnoId);

  // Líneas autorizadas al ingreso (importe opcional y explícito).
  const importe = aut.importe != null && String(aut.importe).trim() !== '' ? dinero(aut.importe, 'El importe acordado debe escribirse con números.', 'autImporte', { cero: true }) : null;
  if (autorizacion && importe !== null) {
    const ver = nuevaVersion(ctx, v, 'Autorizado al recibir el auto.', null);
    insertarLinea(ctx, v, ver.id, {
      tipo: tipo === 'service' ? 'mano_obra' : 'revision',
      descripcion: tipo === 'service' ? `Service${plantilla ? ': ' + plantilla.nombre : ''}` : 'Revisión con costo',
      cantidad_m: 1000, unidad: 'u.', precio_unit: importe, importe
    }, { autorizadaIngreso: true });
  }
  if (plantilla) {
    json(plantilla.tareas, []).forEach((t, i) => insertar(db, 'INSERT INTO tareas_service (taller_id, visita_id, orden, descripcion) VALUES (?, ?, ?, ?)', tid, id, i + 1, String(t).slice(0, 300)));
  }
  ctx.auditar(`Auto recibido (${tipo === 'service' ? 'Service' : 'Revisión o reparación'})`, 'visita', id, motivo);
  if (relacionadaId) ctx.auditar('Visita vinculada a una anterior, sin garantía automática', 'visita', id, String(relacionadaId));
  return id;
}

export default function rutas(r) {
  r.get('/api/hoy', (ctx) => {
    exigir(ctx.usuario, 'ver.taller');
    const tid = ctx.taller.id, db = ctx.db, z = zona(ctx);
    const abiertas = todos(db, 'SELECT * FROM visitas WHERE taller_id = ? AND entregada_at IS NULL AND anulada_at IS NULL ORDER BY ingreso_at', tid);
    const lista = abiertas.map((v) => resumenVisita(db, tid, v, { conDinero: puede(ctx.usuario, 'ver.dinero') }));
    const hoy = hoyLocal(z), ahoraL = localAhora(z);
    const conteo = {};
    for (const v of lista) conteo[v.situacion.clave] = (conteo[v.situacion.clave] || 0) + 1;
    const retiros = lista.filter((v) => v.retiro_acordado && v.retiro_acordado.slice(0, 10) === hoy).sort((a, b) => a.retiro_acordado.localeCompare(b.retiro_acordado));
    const atencion = [];
    for (const v of lista) {
      if (v.retiro_acordado && v.retiro_acordado < ahoraL && !v.lista_at) atencion.push({ visitaId: v.id, vehiculo: v.vehiculo, tipo: 'retiro', titulo: 'Retiro acordado vencido', detalle: 'El retiro acordado ya pasó y el auto no figura listo. Avisá al cliente o acordá otro horario.', accion: 'Abrir visita' });
      if (v.sinRespuestaDesde) {
        const horas = (Date.now() - new Date(v.sinRespuestaDesde).getTime()) / 3600e3;
        if (horas >= 2) atencion.push({ visitaId: v.id, vehiculo: v.vehiculo, tipo: 'autorizacion', titulo: `Presupuesto sin respuesta hace ${horas >= 24 ? Math.floor(horas / 24) + ' día(s)' : Math.floor(horas) + ' h'}`, detalle: 'Falta registrar la respuesta del cliente sobre los trabajos pendientes.', accion: 'Registrar respuesta' });
      }
      for (const rp of v.repuestosEsperando) {
        if (rp.etapa === 'pedido' && !rp.fecha_prevista) atencion.push({ visitaId: v.id, vehiculo: v.vehiculo, tipo: 'repuesto', titulo: `${rp.descripcion}: sin fecha de llegada`, detalle: 'Confirmá con el proveedor cuándo llega.', accion: 'Abrir repuestos' });
      }
    }
    const turnos = todos(db, "SELECT id, codigo, inicio, duracion_min, nombre, patente, vehiculo_texto, motivo, estado FROM turnos WHERE taller_id = ? AND substr(inicio, 1, 10) = ? AND estado IN ('solicitado','confirmado') ORDER BY inicio", tid, hoy);
    const solicitudes = uno(db, "SELECT COUNT(*) AS n FROM turnos WHERE taller_id = ? AND estado = 'solicitado'", tid).n;
    // Puesta en marcha (solo el dueño): lo que falta configurar en un taller nuevo.
    let configurar = null;
    if (puede(ctx.usuario, 'config.taller')) {
      const n = (sql) => uno(db, sql, tid).n;
      const c = ctx.taller.config || {};
      configurar = [
        ['ajustes', 'Completar los datos de contacto del taller (logo opcional)', !!(c.telefono || c.whatsapp || c.direccion)],
        ['ajustes/usuarios', 'Invitar a recepción y a los mecánicos', n('SELECT COUNT(*) AS n FROM usuarios WHERE taller_id = ?') > 1],
        ['ajustes/catalogos', 'Cargar puestos de trabajo y servicios con precio', n('SELECT COUNT(*) AS n FROM puestos WHERE taller_id = ?') > 0 && n('SELECT COUNT(*) AS n FROM servicios WHERE taller_id = ?') > 0],
        ['recibir', 'Recibir el primer auto', n('SELECT COUNT(*) AS n FROM visitas WHERE taller_id = ?') > 0]
      ].map(([ruta, texto, hecho]) => ({ ruta, texto, hecho }));
      if (configurar.every((x) => x.hecho)) configurar = null;
    }
    const pendientes = {
      autorizacion: lista.filter(v=>v.operacion.autorizacion).map(v=>v.id),
      repuestos: lista.filter(v=>v.operacion.repuestos).map(v=>v.id),
      retiros: retiros.map(v=>v.id),
      listas: lista.filter(v=>v.lista_at).map(v=>v.id)
    };
    return { ahora: ahoraL, hoy, zona: z, pendientes, presentes: lista, conteo, retiros, atencion, turnos, solicitudes, configurar, mias: lista.filter((v) => v.responsable_id === ctx.usuario.id).map((v) => v.id) };
  });

  r.get('/api/visitas', (ctx) => {
    exigir(ctx.usuario, 'ver.taller');
    const tid = ctx.taller.id;
    const estado = ctx.query.estado || 'abiertas';
    let filas;
    if (estado === 'abiertas') filas = todos(ctx.db, 'SELECT * FROM visitas WHERE taller_id = ? AND entregada_at IS NULL AND anulada_at IS NULL ORDER BY ingreso_at DESC', tid);
    else if (estado === 'mias') filas = todos(ctx.db, 'SELECT * FROM visitas WHERE taller_id = ? AND responsable_id = ? AND entregada_at IS NULL AND anulada_at IS NULL ORDER BY ingreso_at DESC', tid, ctx.usuario.id);
    else filas = todos(ctx.db, 'SELECT * FROM visitas WHERE taller_id = ? AND (entregada_at IS NOT NULL OR anulada_at IS NOT NULL) ORDER BY ingreso_at DESC LIMIT 200', tid);
    return { visitas: filas.map((v) => resumenVisita(ctx.db, tid, v, { conDinero: puede(ctx.usuario, 'ver.dinero') })) };
  });

  // Buscar una visita por su número dentro del taller (para el lector QR o el ingreso manual).
  r.get('/api/visitas/numero/:n', (ctx) => {
    exigir(ctx.usuario, 'ver.taller');
    const v = uno(ctx.db, 'SELECT id FROM visitas WHERE taller_id = ? AND numero = ?', ctx.taller.id, idEntero(ctx.params.n) || 0);
    if (!v) throw new ErrorUsuario(404, 'No hay una visita con ese número en este taller.');
    return { id: v.id };
  });

  r.get('/api/visitas/:id', (ctx) => {
    exigir(ctx.usuario, 'ver.taller');
    const v = visitaDelTaller(ctx, ctx.params.id);
    return responder(ctx, v.id);
  });

  r.post('/api/visitas', (ctx) => {
    const id = recibirAuto(ctx, ctx.cuerpo);
    return { id, ...responder(ctx, id) };
  });

  r.post('/api/visitas/:id/notas',ctx=>{
    exigir(ctx.usuario,'adjuntos.subir');
    const v=visitaDelTaller(ctx,ctx.params.id);abierta(v);exigirAsignado(ctx,v);
    const nota=requerido(ctx.cuerpo.texto,'Escribí la nota para el equipo.','texto',1000);
    tocarVisita(ctx,v,'Nota interna del equipo',nota);
    return responder(ctx,v.id);
  });

  // Cambios de cabecera: responsable, retiro acordado, prioridad, motivo (con versión para no pisar cambios).
  r.put('/api/visitas/:id', (ctx) => {
    exigir(ctx.usuario, 'visita.editar');
    const v = visitaDelTaller(ctx, ctx.params.id);
    abierta(v);
    if (Number(ctx.cuerpo.version) !== v.version) conflicto();
    const b = ctx.cuerpo;
    const cambios = [];
    let responsableId = v.responsable_id;
    if (b.responsableId !== undefined) {
      responsableId = idEntero(b.responsableId);
      if (responsableId) delTaller(ctx.db, 'usuarios', ctx.taller.id, responsableId, 'Elegí un responsable del taller.');
      if (responsableId !== v.responsable_id) cambios.push(`responsable: ${nombreUsuario(ctx.db, ctx.taller.id, v.responsable_id) || 'sin asignar'} → ${nombreUsuario(ctx.db, ctx.taller.id, responsableId) || 'sin asignar'}`);
    }
    let retiro = v.retiro_acordado;
    if (b.retiro !== undefined) {
      retiro = b.retiro || null;
      if (retiro && !fechaHoraValida(retiro)) falla('El retiro acordado debe tener fecha y hora, o dejarse «A confirmar».', 'retiro');
      if (retiro !== v.retiro_acordado) cambios.push(`retiro: ${v.retiro_acordado || 'a confirmar'} → ${retiro || 'a confirmar'}`);
    }
    const prioridad = b.prioridad === undefined ? v.prioridad : (b.prioridad === 'alta' ? 'alta' : 'normal');
    const motivo = b.motivo === undefined ? v.motivo : requerido(b.motivo, 'El motivo no puede quedar vacío.', 'motivo', 1000);
    if (motivo !== v.motivo) cambios.push('motivo corregido');
    ejecutar(ctx.db, 'UPDATE visitas SET responsable_id = ?, retiro_acordado = ?, retiro_nota = ?, prioridad = ?, motivo = ?, version = version + 1 WHERE id = ?',
      responsableId, retiro, b.retiroNota === undefined ? v.retiro_nota : opcional(b.retiroNota, 300), prioridad, motivo, v.id);
    ctx.auditar('Datos de la visita actualizados', 'visita', v.id, cambios.join('; ') || 'Sin cambios');
    return responder(ctx, v.id);
  });

  // Revisión técnica versionada: guardar crea una versión nueva y conserva las anteriores.
  r.post('/api/visitas/:id/hallazgos', (ctx) => registrarHallazgo(ctx));
  r.put('/api/visitas/:id/hallazgos/:hallazgoId', (ctx) => registrarHallazgo(ctx, ctx.params.hallazgoId));

  r.post('/api/visitas/:id/revision', (ctx) => {
    exigir(ctx.usuario, 'revision.registrar', 'La revisión técnica la registra el mecánico o el dueño.');
    const v = visitaDelTaller(ctx, ctx.params.id);
    abierta(v);
    exigirAsignado(ctx, v);
    if (uno(ctx.db, 'SELECT id FROM controles WHERE taller_id = ? AND visita_id = ? AND vigente = 1', ctx.taller.id, v.id)) falla('El resultado ya está comprobado. Conservá ese control; si hace falta revisar de nuevo, agregá un trabajo o abrí una visita relacionada.');
    const b = ctx.cuerpo;
    const actual = uno(ctx.db, 'SELECT MAX(version_num) AS n FROM revisiones WHERE taller_id = ? AND visita_id = ?', ctx.taller.id, v.id)?.n || 0;
    if (Number(b.versionActual || 0) !== actual) conflicto('Otra persona guardó la revisión mientras la editabas. Recargá para ver su versión; lo tuyo sigue en pantalla.');
    const estado = enLista(b.estado, ['en_revision', 'sin_falla', 'confirmado'], 'Elegí cómo está la revisión.', 'estado');
    const relato = requerido(b.relato, 'Registrá lo que cuenta el cliente.', 'relato', 4000);
    const estructurados = leerHallazgos(ctx.db,ctx.taller.id,v.id);
    const hallazgos = requerido(b.hallazgos || (estructurados.length ? `La inspección tiene ${estructurados.length} hallazgo${estructurados.length===1?'':'s'} registrado${estructurados.length===1?'':'s'} por separado. Consultar sus observaciones, versiones y fotos.` : ''), 'Registrá lo que se observó o agregá un hallazgo.', 'hallazgos', 4000);
    const pruebas = opcional(b.pruebas, 4000), hipotesis = opcional(b.hipotesis, 4000), diagnostico = opcional(b.diagnostico, 4000), recomendacion = opcional(b.recomendacion, 4000);
    if (estado !== 'en_revision' && !pruebas) falla('Antes de concluir, registrá qué pruebas se hicieron.', 'pruebas');
    if (estado === 'confirmado' && (!diagnostico || !b.confirma)) falla('Escribí el diagnóstico y confirmá que lo comprobaste con pruebas.', 'diagnostico');
    if (estado !== 'confirmado' && diagnostico) falla('Si el diagnóstico todavía no está confirmado, anotalo como posibilidad en «Lo que podría ser».', 'diagnostico');
    insertar(ctx.db, 'INSERT INTO revisiones (taller_id, visita_id, version_num, relato, hallazgos, hipotesis, pruebas, diagnostico, recomendacion, estado, creado_por, creado_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ctx.taller.id, v.id, actual + 1, relato, hallazgos, hipotesis, pruebas, diagnostico, recomendacion, estado, ctx.usuario.id, isoAhora());
    tocarVisita(ctx, v, `Revisión registrada (versión ${actual + 1}). No autoriza trabajos.`, { sin_falla: 'Sin falla encontrada', en_revision: 'En revisión', confirmado: 'Diagnóstico confirmado' }[estado]);
    return responder(ctx, v.id);
  });

  // Presupuesto: cada envío crea una versión. Un adicional no toca lo ya respondido.
  r.post('/api/visitas/:id/presupuesto', (ctx) => {
    exigir(ctx.usuario, 'presupuesto.preparar');
    const v = visitaDelTaller(ctx, ctx.params.id);
    abierta(v);
    const lineas = Array.isArray(ctx.cuerpo.lineas) ? ctx.cuerpo.lineas : [];
    if (!lineas.length) falla('Agregá al menos un trabajo o repuesto al presupuesto.');
    if (lineas.length > 60) falla('Demasiadas líneas en un solo envío. Dividilo en dos versiones.');
    const datos = lineas.map(lineaDesde);
    const previas = uno(ctx.db, 'SELECT COUNT(*) AS n FROM presupuesto_versiones WHERE taller_id = ? AND visita_id = ?', ctx.taller.id, v.id).n;
    const nota = opcional(ctx.cuerpo.nota, 500) || (previas ? 'Trabajo adicional.' : 'Presupuesto inicial.');
    const ver = nuevaVersion(ctx, v, nota, previas ? datos.map((l) => `se agrega ${l.descripcion} (${pesos(l.importe)})`) : null);
    for (const l of datos) insertarLinea(ctx, v, ver.id, l);
    if (previas) reabrirControl(ctx, v, 'Se agregó trabajo después del control.');
    tocarVisita(ctx, v, `Presupuesto versión ${ver.numero} preparado`, datos.map((l) => l.descripcion).join('; '));
    return responder(ctx, v.id);
  });

  // Modificar cantidad, precio o descripción de una línea: crea una versión nueva y una línea que reemplaza a la anterior.
  // Si la anterior estaba autorizada, su autorización se conserva y el cambio necesita su propia respuesta.
  r.post('/api/visitas/:id/lineas/:lid/modificar', (ctx) => {
    exigir(ctx.usuario, 'presupuesto.preparar');
    const v = visitaDelTaller(ctx, ctx.params.id);
    abierta(v);
    const l = delTaller(ctx.db, 'presupuesto_lineas', ctx.taller.id, idEntero(ctx.params.lid), 'No encontramos esa línea.');
    if (l.visita_id !== v.id) falla('Esa línea es de otra visita.');
    if (l.estado !== 'vigente') falla('Esta línea ya fue reemplazada. Modificá la versión actual.');
    if (l.realizado_at) falla('Este trabajo ya figura realizado: no se cambia su importe. Si hubo algo más, agregalo como adicional.');
    if (l.cargo_id) falla('Esta línea ya está liquidada. Corregí con un movimiento en la cuenta del cliente.');
    if (uno(ctx.db, "SELECT id FROM presupuesto_lineas WHERE taller_id = ? AND origen_linea_id = ? AND estado = 'vigente'", ctx.taller.id, l.id)) falla('Ya hay un cambio pendiente sobre esta línea.');
    const motivo = requerido(ctx.cuerpo.motivo, 'Explicá por qué cambia (por ejemplo: el proveedor subió el precio).', 'motivo', 500);
    const nueva = lineaDesde({
      tipo: l.tipo,
      descripcion: ctx.cuerpo.descripcion ?? l.descripcion,
      cantidad: ctx.cuerpo.cantidad ?? String(l.cantidad_m / 1000),
      unidad: ctx.cuerpo.unidad ?? l.unidad,
      precio: ctx.cuerpo.precio ?? String(l.precio_unit / 100).replace('.', ',')
    }, 0);
    if (nueva.descripcion === l.descripcion && nueva.cantidad_m === l.cantidad_m && nueva.precio_unit === l.precio_unit && nueva.unidad === l.unidad) falla('No cambiaste ningún dato.');
    const resp = uno(ctx.db, 'SELECT respuesta FROM respuestas WHERE taller_id = ? AND linea_id = ? ORDER BY id DESC LIMIT 1', ctx.taller.id, l.id)?.respuesta || (l.autorizada_ingreso ? 'autoriza' : null);
    const det = [];
    if (nueva.descripcion !== l.descripcion) det.push(`descripción: «${l.descripcion}» → «${nueva.descripcion}»`);
    if (nueva.cantidad_m !== l.cantidad_m || nueva.unidad !== l.unidad) det.push(`cantidad: ${cant(l.cantidad_m, l.unidad)} → ${cant(nueva.cantidad_m, nueva.unidad)}`);
    if (nueva.precio_unit !== l.precio_unit) det.push(`precio: ${pesos(l.precio_unit)} → ${pesos(nueva.precio_unit)}`);
    det.push(`importe: ${pesos(l.importe)} → ${pesos(nueva.importe)}`);
    const ver = nuevaVersion(ctx, v, `Cambio: ${motivo}`, [`${l.descripcion}: ${det.join(', ')}`]);
    const nid = insertarLinea(ctx, v, ver.id, nueva, { origen: l.id });
    ejecutar(ctx.db, "UPDATE presupuesto_lineas SET estado = 'reemplazada' WHERE id = ?", l.id);
    // Repuestos vinculados siguen el trabajo modificado.
    ejecutar(ctx.db, 'UPDATE repuestos SET linea_id = ? WHERE taller_id = ? AND linea_id = ?', nid, ctx.taller.id, l.id);
    reabrirControl(ctx, v, 'Cambió un trabajo después del control.');
    tocarVisita(ctx, v, resp === 'autoriza' ? 'Cambio sobre un trabajo autorizado: se conserva la autorización anterior y el cambio espera respuesta' : 'Línea del presupuesto modificada en una versión nueva', det.join('; '));
    return responder(ctx, v.id);
  });

  // Respuesta del cliente por línea: autorización parcial, rechazo o postergación. Persona, canal y fecha quedan registrados.
  r.post('/api/visitas/:id/respuestas', (ctx) => {
    exigir(ctx.usuario, 'presupuesto.respuesta');
    const v = visitaDelTaller(ctx, ctx.params.id);
    abierta(v);
    const b = ctx.cuerpo;
    const persona = requerido(b.persona, 'Indicá quién respondió (nombre de la persona).', 'persona', 120);
    const canal = enLista(b.canal, CANALES, 'Elegí por qué medio respondió.', 'canal');
    const fecha = b.fecha && fechaHoraValida(b.fecha) ? b.fecha : localAhora(zona(ctx));
    const lista = Array.isArray(b.respuestas) ? b.respuestas.filter((x) => x && x.respuesta) : [];
    if (!lista.length) falla('Elegí la respuesta de al menos un trabajo.');
    const hechos = [];
    for (const x of lista) {
      const l = delTaller(ctx.db, 'presupuesto_lineas', ctx.taller.id, idEntero(x.lineaId), 'No encontramos una de las líneas.');
      if (l.visita_id !== v.id || l.estado !== 'vigente') falla('Una de las líneas ya no está vigente. Recargá la visita.');
      const respuesta = enLista(x.respuesta, ['autoriza', 'rechaza', 'posterga'], 'Respuesta no válida.');
      const previa = uno(ctx.db, 'SELECT respuesta FROM respuestas WHERE taller_id = ? AND linea_id = ? ORDER BY id DESC LIMIT 1', ctx.taller.id, l.id);
      if (l.realizado_at) falla(`«${l.descripcion}» ya está realizado. No se cambia su respuesta.`);
      if (previa && !x.corrige) falla(`«${l.descripcion}» ya tiene respuesta. Para corregirla, usá «Corregir respuesta».`);
      if (l.origen_linea_id && respuesta === 'posterga') falla('Un cambio sobre un trabajo se autoriza o se rechaza. Si el cliente quiere dejar el trabajo para después, rechazá el cambio y registrá aparte la postergación.');
      insertar(ctx.db, 'INSERT INTO respuestas (taller_id, linea_id, respuesta, persona, canal, fecha_respuesta, nota, cargado_por, creado_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ctx.taller.id, l.id, respuesta, persona, canal, fecha, opcional(x.nota, 500), ctx.usuario.id, isoAhora());
      if (l.origen_linea_id && respuesta === 'rechaza') {
        // Cambio rechazado: vuelve a regir la línea anterior con su respuesta original.
        ejecutar(ctx.db, "UPDATE presupuesto_lineas SET estado = 'descartada' WHERE id = ?", l.id);
        ejecutar(ctx.db, "UPDATE presupuesto_lineas SET estado = 'vigente' WHERE id = ?", l.origen_linea_id);
        ejecutar(ctx.db, 'UPDATE repuestos SET linea_id = ? WHERE taller_id = ? AND linea_id = ?', l.origen_linea_id, ctx.taller.id, l.id);
      }
      if (respuesta === 'posterga' && !uno(ctx.db, 'SELECT id FROM seguimientos WHERE taller_id = ? AND linea_id = ?', ctx.taller.id, l.id)) {
        insertar(ctx.db, `INSERT INTO seguimientos (taller_id, vehiculo_id, contacto_id, visita_origen_id, linea_id, tipo, titulo, criterio, importe, creado_por, creado_at)
          VALUES (?, ?, ?, ?, ?, 'postergado', ?, ?, ?, ?, ?)`, ctx.taller.id, v.vehiculo_id, v.contacto_id, v.id, l.id, l.descripcion,
        opcional(x.nota, 300) || 'El cliente lo dejó para más adelante.', l.importe, ctx.usuario.id, isoAhora());
      }
      if (previa && previa.respuesta === 'posterga' && respuesta !== 'posterga') {
        ejecutar(ctx.db, "UPDATE seguimientos SET estado = 'descartado', cierre_nota = 'Respuesta corregida' WHERE taller_id = ? AND linea_id = ? AND estado = 'pendiente'", ctx.taller.id, l.id);
      }
      hechos.push(`${l.descripcion}: ${{ autoriza: 'autoriza', rechaza: 'no autoriza', posterga: 'deja para después' }[respuesta]}`);
    }
    const canalTxt = { telefono: 'por teléfono', whatsapp: 'por WhatsApp', presencial: 'en persona', correo: 'por correo', otro: 'por otro medio' }[canal];
    tocarVisita(ctx, v, `Respuesta del cliente registrada (${persona}, ${canalTxt})`, hechos.join('; '));
    return responder(ctx, v.id);
  });

  r.post('/api/visitas/:id/lineas/:lid/realizado', (ctx) => {
    exigir(ctx.usuario, 'trabajo.ejecutar');
    const v = visitaDelTaller(ctx, ctx.params.id);
    abierta(v);
    exigirAsignado(ctx, v);
    const vc = cargarVisita(ctx.db, ctx.taller.id, v.id);
    const l = vc.presupuesto?.lineas.find((x) => x.id === idEntero(ctx.params.lid));
    if (!l) falla('No encontramos ese trabajo en esta visita.');
    if (ctx.cuerpo.realizado === false) {
      if (ctx.usuario.rol !== 'dueno') prohibido('Solo el dueño corrige un trabajo marcado como realizado.');
      if (!l.realizado_at) falla('Ese trabajo no figura realizado.');
      if (l.cargo_id) falla('Ese trabajo ya está liquidado. Corregí primero la cuenta.');
      if (controlVigente(vc)) falla('Hay un control vigente. Agregá un trabajo o corregí con el control nuevo.');
      ejecutar(ctx.db, 'UPDATE presupuesto_lineas SET realizado_at = NULL, realizado_por = NULL WHERE id = ?', l.id);
      tocarVisita(ctx, v, 'Corrección: trabajo vuelve a pendiente', requerido(ctx.cuerpo.motivo, 'Explicá la corrección.', 'motivo', 300) + ' · ' + l.descripcion);
      return responder(ctx, v.id);
    }
    const motivos = bloqueosRealizar(vc, l);
    if (motivos.length) falla(motivos.join(' '));
    ejecutar(ctx.db, 'UPDATE presupuesto_lineas SET realizado_at = ?, realizado_por = ? WHERE id = ?', isoAhora(), ctx.usuario.id, l.id);
    tocarVisita(ctx, v, 'Trabajo realizado', l.descripcion);
    return responder(ctx, v.id);
  });

  // Repuestos por trabajo
  r.post('/api/visitas/:id/repuestos', (ctx) => {
    exigir(ctx.usuario, 'repuestos.gestionar');
    const v = visitaDelTaller(ctx, ctx.params.id);
    abierta(v);
    const b = ctx.cuerpo;
    let lineaId = idEntero(b.lineaId);
    if (lineaId) {
      const l = delTaller(ctx.db, 'presupuesto_lineas', ctx.taller.id, lineaId, 'No encontramos ese trabajo.');
      const resp = uno(ctx.db, 'SELECT respuesta FROM respuestas WHERE taller_id = ? AND linea_id = ? ORDER BY id DESC LIMIT 1', ctx.taller.id, l.id)?.respuesta || (l.autorizada_ingreso ? 'autoriza' : null);
      if (l.visita_id !== v.id || l.estado !== 'vigente') falla('Ese trabajo no está vigente en esta visita.');
      if (l.realizado_at) falla('Ese trabajo ya está realizado. Si hace falta otra pieza, agregá un adicional.');
      if (resp === 'rechaza' || resp === 'posterga') falla('El cliente no autorizó ese trabajo: no se piden repuestos para él.');
    }
    const descripcion = requerido(b.descripcion, 'Escribí qué repuesto es.', 'descripcion', 200);
    const c = cantidad(b.cantidad ?? '1', 'La cantidad debe ser mayor que cero.', 'cantidad');
    const unidad = enLista(texto(b.unidad) || 'u.', UNIDADES, 'Elegí una unidad de la lista.', 'unidad');
    const origen = enLista(b.origen || 'taller', ['taller', 'cliente'], 'Elegí si lo pone el taller o lo trae el cliente.', 'origen');
    const proveedorId = idEntero(b.proveedorId);
    if (proveedorId) delTaller(ctx.db, 'proveedores', ctx.taller.id, proveedorId, 'Ese proveedor no es de este taller.');
    const articuloId = origen === 'taller' ? idEntero(b.articuloId) : null;
    if (articuloId) {
      const a = delTaller(ctx.db, 'articulos', ctx.taller.id, articuloId, 'Ese artículo no es de este taller.');
      if (a.unidad !== unidad) falla(`El artículo de stock se cuenta en «${a.unidad}». Usá la misma unidad.`, 'unidad');
    }
    const etapa = enLista(b.etapa || (origen === 'cliente' ? 'llego' : 'falta_pedir'), ['falta_pedir', 'pedido', 'llego'], 'Etapa inicial no válida.', 'etapa');
    if (b.fechaPrevista && !fechaValida(b.fechaPrevista)) falla('La fecha prevista no es válida.', 'fechaPrevista');
    const t = isoAhora();
    const id = insertar(ctx.db, `INSERT INTO repuestos (taller_id, visita_id, linea_id, descripcion, cantidad_m, unidad, origen, proveedor_id, articulo_id, etapa, fecha_prevista, pedido_at, llego_at, nota, creado_por, creado_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ctx.taller.id, v.id, lineaId, descripcion, c, unidad, origen, proveedorId, articuloId, etapa,
    b.fechaPrevista || null, etapa !== 'falta_pedir' ? t : null, etapa === 'llego' ? t : null, opcional(b.nota, 300), ctx.usuario.id, t);
    tocarVisita(ctx, v, 'Repuesto agregado al trabajo (no cambia el presupuesto)', `${descripcion} × ${cant(c, unidad)} · ${origen === 'cliente' ? 'lo trae el cliente' : 'lo pone el taller'}`);
    return { id, ...responder(ctx, v.id) };
  });

  r.post('/api/repuestos/:rid/etapa', (ctx) => {
    exigir(ctx.usuario, 'repuestos.gestionar');
    const rp = delTaller(ctx.db, 'repuestos', ctx.taller.id, idEntero(ctx.params.rid), 'No encontramos ese repuesto.');
    const v = visitaDelTaller(ctx, rp.visita_id);
    abierta(v);
    if (ctx.cuerpo.version != null && Number(ctx.cuerpo.version) !== rp.version) conflicto();
    const etapa = enLista(ctx.cuerpo.etapa, ETAPAS, 'Etapa no válida.', 'etapa');
    const actual = ETAPAS.indexOf(rp.etapa), nueva = ETAPAS.indexOf(etapa);
    if (nueva === actual) falla('El repuesto ya está en esa etapa.');
    const t = isoAhora();
    if (nueva < actual) {
      // Volver atrás es una corrección: solo el dueño, con motivo. Si ya se descontó stock, se reintegra.
      if (ctx.usuario.rol !== 'dueno') prohibido('Solo el dueño corrige la etapa de un repuesto hacia atrás.');
      const motivo = requerido(ctx.cuerpo.motivo, 'Explicá la corrección.', 'motivo', 300);
      if (rp.etapa === 'colocado') {
        const l = rp.linea_id ? uno(ctx.db, 'SELECT realizado_at FROM presupuesto_lineas WHERE id = ?', rp.linea_id) : null;
        if (l?.realizado_at) falla('El trabajo de este repuesto figura realizado. Corregí primero el trabajo.');
        reintegrarRepuesto(ctx, rp, motivo);
      }
      ejecutar(ctx.db, `UPDATE repuestos SET etapa = ?, colocado_at = CASE WHEN ? < 3 THEN NULL ELSE colocado_at END, llego_at = CASE WHEN ? < 2 THEN NULL ELSE llego_at END,
        pedido_at = CASE WHEN ? < 1 THEN NULL ELSE pedido_at END, version = version + 1 WHERE id = ?`, etapa, nueva, nueva, nueva, rp.id);
      tocarVisita(ctx, v, 'Corrección de etapa de repuesto', `${rp.descripcion}: vuelve a ${etapa} · ${motivo}`);
      return responder(ctx, v.id);
    }
    if (etapa === 'colocado') {
      exigir(ctx.usuario, 'repuestos.colocar', 'Registrar que una pieza se colocó le corresponde al mecánico o al dueño.');
      exigirAsignado(ctx, v);
      if (rp.etapa !== 'llego') falla('Primero registrá que el repuesto llegó. Llegó y colocado son pasos distintos.');
      if (rp.linea_id) {
        const l = uno(ctx.db, 'SELECT * FROM presupuesto_lineas WHERE id = ?', rp.linea_id);
        const resp = uno(ctx.db, 'SELECT respuesta FROM respuestas WHERE taller_id = ? AND linea_id = ? ORDER BY id DESC LIMIT 1', ctx.taller.id, l.id)?.respuesta || (l.autorizada_ingreso ? 'autoriza' : null);
        if (resp !== 'autoriza') falla('El trabajo de este repuesto no está autorizado (o tiene un cambio sin respuesta). No se coloca todavía.');
      }
      consumirRepuesto(ctx, rp);
      ejecutar(ctx.db, 'UPDATE repuestos SET etapa = ?, colocado_at = ?, colocado_por = ?, version = version + 1 WHERE id = ?', etapa, t, ctx.usuario.id, rp.id);
      tocarVisita(ctx, v, 'Repuesto colocado (el trabajo se marca aparte)', rp.descripcion);
      return responder(ctx, v.id);
    }
    ejecutar(ctx.db, `UPDATE repuestos SET etapa = ?, pedido_at = COALESCE(pedido_at, ?), llego_at = CASE WHEN ? = 'llego' THEN ? ELSE llego_at END,
      fecha_prevista = COALESCE(?, fecha_prevista), proveedor_id = COALESCE(?, proveedor_id), version = version + 1 WHERE id = ?`,
    etapa, t, etapa, t, ctx.cuerpo.fechaPrevista && fechaValida(ctx.cuerpo.fechaPrevista) ? ctx.cuerpo.fechaPrevista : null,
    idEntero(ctx.cuerpo.proveedorId) && delTaller(ctx.db, 'proveedores', ctx.taller.id, idEntero(ctx.cuerpo.proveedorId)).id || null, rp.id);
    tocarVisita(ctx, v, etapa === 'pedido' ? 'Repuesto pedido' : 'Repuesto llegó (todavía no está colocado)', rp.descripcion);
    return responder(ctx, v.id);
  });

  r.put('/api/repuestos/:rid', (ctx) => {
    exigir(ctx.usuario, 'repuestos.gestionar');
    const rp = delTaller(ctx.db, 'repuestos', ctx.taller.id, idEntero(ctx.params.rid), 'No encontramos ese repuesto.');
    const v = visitaDelTaller(ctx, rp.visita_id);
    abierta(v);
    if (Number(ctx.cuerpo.version) !== rp.version) conflicto();
    const b = ctx.cuerpo;
    if (b.fechaPrevista && !fechaValida(b.fechaPrevista)) falla('La fecha prevista no es válida.', 'fechaPrevista');
    const proveedorId = b.proveedorId === undefined ? rp.proveedor_id : idEntero(b.proveedorId);
    if (proveedorId) delTaller(ctx.db, 'proveedores', ctx.taller.id, proveedorId, 'Ese proveedor no es de este taller.');
    ejecutar(ctx.db, 'UPDATE repuestos SET fecha_prevista = ?, proveedor_id = ?, nota = ?, version = version + 1 WHERE id = ?',
      b.fechaPrevista === undefined ? rp.fecha_prevista : (b.fechaPrevista || null), proveedorId, b.nota === undefined ? rp.nota : opcional(b.nota, 300), rp.id);
    tocarVisita(ctx, v, 'Datos del repuesto actualizados', rp.descripcion);
    return responder(ctx, v.id);
  });

  // Tareas del service: Pendiente / Hecho / No aplica (con explicación). La plantilla nunca las marca sola.
  r.post('/api/visitas/:id/tareas', (ctx) => {
    exigir(ctx.usuario, 'trabajo.ejecutar');
    const v = visitaDelTaller(ctx, ctx.params.id);
    abierta(v);
    exigirAsignado(ctx, v);
    const d = requerido(ctx.cuerpo.descripcion, 'Escribí la tarea.', 'descripcion', 300);
    const orden = (uno(ctx.db, 'SELECT MAX(orden) AS n FROM tareas_service WHERE taller_id = ? AND visita_id = ?', ctx.taller.id, v.id)?.n || 0) + 1;
    insertar(ctx.db, 'INSERT INTO tareas_service (taller_id, visita_id, orden, descripcion) VALUES (?, ?, ?, ?)', ctx.taller.id, v.id, orden, d);
    tocarVisita(ctx, v, 'Tarea agregada al service', d);
    return responder(ctx, v.id);
  });

  r.post('/api/tareas/:tid', (ctx) => {
    exigir(ctx.usuario, 'trabajo.ejecutar');
    const t = delTaller(ctx.db, 'tareas_service', ctx.taller.id, idEntero(ctx.params.tid), 'No encontramos esa tarea.');
    const v = visitaDelTaller(ctx, t.visita_id);
    abierta(v);
    exigirAsignado(ctx, v);
    if (uno(ctx.db, 'SELECT id FROM controles WHERE taller_id = ? AND visita_id = ? AND vigente = 1', ctx.taller.id, v.id)) falla('El resultado ya está comprobado. No se cambian tareas después del control.');
    const estado = enLista(ctx.cuerpo.estado, ['pendiente', 'hecho', 'no_aplica'], 'Elegí Hecho, No aplica o Pendiente.', 'estado');
    const explicacion = estado === 'no_aplica' ? requerido(ctx.cuerpo.explicacion, 'Explicá por qué esta tarea no aplica.', 'explicacion', 300) : opcional(ctx.cuerpo.explicacion, 300);
    ejecutar(ctx.db, 'UPDATE tareas_service SET estado = ?, explicacion = ?, actualizado_por = ?, actualizado_at = ? WHERE id = ?', estado, explicacion, ctx.usuario.id, isoAhora(), t.id);
    tocarVisita(ctx, v, 'Tarea del service', `${t.descripcion}: ${{ pendiente: 'pendiente', hecho: 'hecho', no_aplica: 'no aplica' }[estado]}${explicacion ? ' · ' + explicacion : ''}`);
    return responder(ctx, v.id);
  });

  // Productos realmente usados (aceite, filtros, insumos) con cantidad y unidad.
  r.post('/api/visitas/:id/productos', (ctx) => {
    exigir(ctx.usuario, 'trabajo.ejecutar');
    const v = visitaDelTaller(ctx, ctx.params.id);
    abierta(v);
    exigirAsignado(ctx, v);
    const b = ctx.cuerpo;
    const descripcion = requerido(b.descripcion, 'Escribí el producto usado (marca, tipo o especificación que figura en el envase).', 'descripcion', 200);
    const c = cantidad(b.cantidad, 'Escribí la cantidad usada, por ejemplo 4,2.', 'cantidad');
    const unidad = enLista(texto(b.unidad) || 'u.', UNIDADES, 'Elegí una unidad.', 'unidad');
    const origen = b.origen === 'cliente' ? 'cliente' : 'taller';
    const articuloId = origen === 'taller' ? idEntero(b.articuloId) : null;
    if (articuloId) {
      const a = delTaller(ctx.db, 'articulos', ctx.taller.id, articuloId, 'Ese artículo no es de este taller.');
      if (a.unidad !== unidad) falla(`El artículo se cuenta en «${a.unidad}». Usá la misma unidad.`, 'unidad');
    }
    const id = insertar(ctx.db, 'INSERT INTO productos_usados (taller_id, visita_id, descripcion, cantidad_m, unidad, origen, articulo_id, creado_por, creado_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ctx.taller.id, v.id, descripcion, c, unidad, origen, articuloId, ctx.usuario.id, isoAhora());
    if (articuloId) consumirProducto(ctx, { id, articulo_id: articuloId, cantidad_m: c, visita_id: v.id, descripcion });
    tocarVisita(ctx, v, 'Producto usado registrado', `${descripcion} × ${cant(c, unidad)}`);
    return responder(ctx, v.id);
  });

  r.post('/api/productos/:pid/anular', (ctx) => {
    exigir(ctx.usuario, 'trabajo.ejecutar');
    const p = delTaller(ctx.db, 'productos_usados', ctx.taller.id, idEntero(ctx.params.pid), 'No encontramos ese producto.');
    const v = visitaDelTaller(ctx, p.visita_id);
    abierta(v);
    exigirAsignado(ctx, v);
    if (p.anulado_at) falla('Ese registro ya está anulado.');
    const motivo = requerido(ctx.cuerpo.motivo, 'Explicá por qué se anula (por ejemplo: cantidad mal cargada).', 'motivo', 300);
    ejecutar(ctx.db, 'UPDATE productos_usados SET anulado_at = ?, anulado_motivo = ? WHERE id = ?', isoAhora(), motivo, p.id);
    if (p.articulo_id) reintegrarProducto(ctx, p, motivo);
    tocarVisita(ctx, v, 'Producto usado anulado (se conserva el registro)', `${p.descripcion} · ${motivo}`);
    return responder(ctx, v.id);
  });

  // Control del resultado: opción explícita y cómo se comprobó.
  r.post('/api/visitas/:id/control', (ctx) => {
    exigir(ctx.usuario, 'control.registrar', 'Comprobar el resultado le corresponde al mecánico o al dueño.');
    const v = visitaDelTaller(ctx, ctx.params.id);
    abierta(v);
    exigirAsignado(ctx, v);
    const vc = cargarVisita(ctx.db, ctx.taller.id, v.id);
    if (controlVigente(vc)) falla('Ya hay un resultado comprobado. Si agregás trabajo, el sistema pedirá comprobar de nuevo.');
    const motivos = bloqueosControl(vc);
    if (motivos.length) falla(motivos.join(' '));
    const resultado = enLista(ctx.cuerpo.resultado, Object.keys(RESULTADOS), 'Elegí el resultado.', 'resultado');
    const como = requerido(ctx.cuerpo.como, 'Contá cómo se comprobó (por ejemplo: prueba de ruta y elevador).', 'como', 500);
    insertar(ctx.db, 'INSERT INTO controles (taller_id, visita_id, resultado, como, nota, creado_por, creado_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ctx.taller.id, v.id, resultado, como, opcional(ctx.cuerpo.nota, 1000), ctx.usuario.id, isoAhora());
    tocarVisita(ctx, v, 'Resultado comprobado', `${RESULTADOS[resultado]} · ${como}`);
    return responder(ctx, v.id);
  });

  // Próximo service / control: lo registra y confirma el técnico. No se calcula con intervalos universales.
  r.post('/api/visitas/:id/proximo', (ctx) => {
    exigir(ctx.usuario, 'trabajo.ejecutar');
    const v = visitaDelTaller(ctx, ctx.params.id);
    if (v.anulada_at) falla('La visita está anulada.');
    const b = ctx.cuerpo;
    const km = b.km != null && String(b.km).trim() !== '' ? parseKm(b.km) : null;
    if (b.km && km === null) falla('Escribí los kilómetros del próximo control con números.', 'km');
    const fecha = b.fecha || null;
    if (fecha && !fechaValida(fecha)) falla('La fecha del próximo control no es válida.', 'fecha');
    if (km === null && !fecha) falla('Indicá kilómetros, fecha o ambos para el próximo control.', 'km');
    if (!b.confirma) falla('Confirmá que el próximo control lo definió el técnico para este auto.', 'confirma');
    const criterio = opcional(b.criterio, 300) || 'Lo que ocurra primero.';
    ejecutar(ctx.db, "UPDATE seguimientos SET estado = 'resuelto', cierre_nota = ? WHERE taller_id = ? AND vehiculo_id = ? AND tipo = 'service' AND estado = 'pendiente'", `Reemplazado por el control definido en la visita ${v.numero}`, ctx.taller.id, v.vehiculo_id);
    insertar(ctx.db, `INSERT INTO seguimientos (taller_id, vehiculo_id, contacto_id, visita_origen_id, tipo, titulo, km_objetivo, fecha_objetivo, criterio, creado_por, creado_at)
      VALUES (?, ?, ?, ?, 'service', 'Próximo service', ?, ?, ?, ?, ?)`, ctx.taller.id, v.vehiculo_id, v.contacto_id, v.id, km, fecha, criterio, ctx.usuario.id, isoAhora());
    tocarVisita(ctx, v, 'Próximo service definido por el técnico', `${km != null ? km.toLocaleString('es-AR') + ' km' : ''}${km != null && fecha ? ' o ' : ''}${fecha || ''}`);
    return responder(ctx, v.id);
  });

  r.post('/api/visitas/:id/lista', (ctx) => {
    exigir(ctx.usuario, 'visita.lista');
    const v = visitaDelTaller(ctx, ctx.params.id);
    abierta(v);
    if (v.lista_at) falla('Ya figura lista para retirar.');
    if (!uno(ctx.db, 'SELECT id FROM controles WHERE taller_id = ? AND visita_id = ? AND vigente = 1', ctx.taller.id, v.id)) falla('Primero comprobá el resultado. Marcar lista no es lo mismo que entregar.');
    ejecutar(ctx.db, 'UPDATE visitas SET lista_at = ?, lista_por = ? WHERE id = ?', isoAhora(), ctx.usuario.id, v.id);
    tocarVisita(ctx, v, 'Listo para retirar (sigue en Hoy hasta la entrega)');
    return responder(ctx, v.id);
  });

  // Entrega: puede conservar pendientes explícitos. No marca pagado. Con saldo exige confirmación y queda registrado.
  r.post('/api/visitas/:id/entrega', (ctx) => {
    exigir(ctx.usuario, 'visita.entregar');
    const v = visitaDelTaller(ctx, ctx.params.id);
    abierta(v);
    if (!v.lista_at) falla('Primero marcá el auto como listo para retirar.');
    const vc = cargarVisita(ctx.db, ctx.taller.id, v.id);
    const sinLiquidar = (vc.presupuesto?.lineas || []).filter((l) => l.estado === 'vigente' && respuestaDe(l) === 'autoriza' && l.realizado_at && l.importe > 0 && !l.cargo_id);
    if (sinLiquidar.length) falla('Hay trabajos realizados sin liquidar. Abrí Cobros y liquidá el importe antes de registrar la entrega.');
    const control = controlVigente(vc);
    const hayPendientes = vc.presupuesto?.lineas.some((l) => l.estado === 'vigente' && respuestaDe(l) === 'posterga') || control?.resultado !== 'resuelto';
    if (hayPendientes && !ctx.cuerpo.pendientesInformados) falla('Confirmá que le informaste al cliente lo que queda pendiente.', 'pendientesInformados');
    const nota = opcional(ctx.cuerpo.nota, 500);
    const saldo = vc.totales.saldo;
    const regla = reglaEntregaSaldo(ctx.taller);
    if (saldo > 0) {
      // La regla del taller se aplica acá, no solo ocultando el botón.
      if (regla === 'ninguno') throw new ErrorUsuario(403, `Queda un saldo de ${pesos(saldo)}. La regla de este taller es no entregar con saldo: registrá el pago antes de la entrega.`, null, { saldo, regla });
      if (!puedeEntregarConSaldo(ctx.usuario, ctx.taller)) throw new ErrorUsuario(403, `Queda un saldo de ${pesos(saldo)}. En este taller solo el dueño autoriza entregar con saldo: pedile que registre la entrega o cobrá el saldo.`, null, { saldo, regla });
      if (!ctx.cuerpo.conSaldo) throw new ErrorUsuario(400, `Queda un saldo de ${pesos(saldo)}. Si el cliente retira igual, confirmá «El cliente retira con saldo pendiente» y anotá el motivo.`, 'conSaldo', { saldo });
      if (!nota || nota.length < 5) falla('Anotá el motivo y lo acordado sobre el saldo (por ejemplo, cuándo paga).', 'nota');
    }
    ejecutar(ctx.db, 'UPDATE visitas SET entregada_at = ?, entregada_por = ?, entrega_nota = ?, pendientes_informados = ?, entrega_saldo = ?, entrega_regla = ? WHERE id = ?',
      isoAhora(), ctx.usuario.id, nota, hayPendientes ? 1 : null, saldo > 0 ? saldo : null, saldo > 0 ? regla : null, v.id);
    tocarVisita(ctx, v, saldo > 0 ? `Entregado con saldo pendiente de ${pesos(saldo)} (no figura pagado). Autorizó ${ctx.usuario.nombre}. Regla: ${ENTREGA_SALDO[regla]}` : 'Entregado al cliente', nota);
    return responder(ctx, v.id);
  });

  r.post('/api/visitas/:id/anular', (ctx) => {
    exigir(ctx.usuario, 'visita.anular');
    const v = visitaDelTaller(ctx, ctx.params.id);
    abierta(v);
    const motivo = requerido(ctx.cuerpo.motivo, 'Escribí el motivo de la anulación.', 'motivo', 500);
    if (uno(ctx.db, `SELECT m.id FROM cuenta_movimientos m WHERE m.taller_id = ? AND m.visita_id = ? AND m.tipo <> 'anulacion'
      AND NOT EXISTS (SELECT 1 FROM cuenta_movimientos a WHERE a.taller_id = m.taller_id AND a.anula_id = m.id)`, ctx.taller.id, v.id)) falla('La visita tiene movimientos de dinero vigentes. Anulá esos movimientos antes.');
    if (uno(ctx.db, "SELECT id FROM repuestos WHERE taller_id = ? AND visita_id = ? AND etapa = 'colocado'", ctx.taller.id, v.id)) falla('Hay piezas colocadas en esta visita. No se anula: registrá la entrega con lo realizado.');
    ejecutar(ctx.db, 'UPDATE visitas SET anulada_at = ?, anulada_motivo = ? WHERE id = ?', isoAhora(), motivo, v.id);
    ejecutar(ctx.db, "UPDATE reservas SET estado = 'liberada', motivo = 'Visita anulada' WHERE taller_id = ? AND estado = 'activa' AND repuesto_id IN (SELECT id FROM repuestos WHERE visita_id = ?)", ctx.taller.id, v.id);
    tocarVisita(ctx, v, 'Visita anulada (se conserva el registro)', motivo);
    return responder(ctx, v.id);
  });
}
