// Datos de PRUEBA ficticios. Se cargan a través de la API real (mismas reglas y permisos).
// Demostración con pocos casos, cada uno en un momento distinto del trabajo: Cronos en revisión, Gol esperando autorización,
// Etios en trabajo esperando un repuesto (con historial de dos visitas), 208 con el service en curso y Onix listo con pago parcial.
// No son datos de ningún taller real ni de sus clientes. Uso: npm run seed  (o: npm run seed -- --reiniciar)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { ClienteApi } from './cliente-api.js';
import { crearTaller, agregarUsuario } from '../server/plataforma.js';
import { config, archivoBase, carpetaArchivos } from '../server/config.js';

export const CLAVE_PRUEBA = process.env.TALLERES_CLAVE_PRUEBA || 'prueba-taller-2026';
export const USUARIOS_PRUEBA = {
  dueno: 'dueno@taller-modelo.test', recepcion: 'recepcion@taller-modelo.test', marcos: 'marcos@taller-modelo.test', julian: 'julian@taller-modelo.test', norte: 'dueno@norte.test'
};

const ZONA = 'America/Argentina/Mendoza';
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const local = (d) => { const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`; };
const deLocal = (s) => new Date(s + ':00-03:00'); // Mendoza: UTC-3 todo el año
const reloj = (d) => { process.env.TALLERES_RELOJ = (d instanceof Date ? d : deLocal(d)).toISOString(); };
const redondear = (d, min = 30) => new Date(Math.ceil(d.getTime() / (min * 60e3)) * min * 60e3);
function proximoHabil(fecha, diasLibres = [0]) {
  let d = new Date(fecha + 'T12:00:00Z');
  do d.setUTCDate(d.getUTCDate() + 1); while (diasLibres.includes(d.getUTCDay()));
  return d.toISOString().slice(0, 10);
}

export async function sembrar({ db, base }) {
  const real = new Date();
  const hace = (h) => new Date(real.getTime() - h * 3600e3);
  const hoy = local(real).slice(0, 10);

  // ---------- Talleres y usuarios (plataforma) ----------
  reloj('2025-01-01T09:00');
  const A = crearTaller(db, {
    slug: 'taller-modelo', nombre: 'Taller Modelo', publico: true, enDirectorio: true,
    config: {
      demo: true, lema: 'Taller de demostración', localidad: 'Mendoza (ficticio)',
      // Dirección, teléfono y horarios quedan vacíos hasta que el dueño los confirme: no se inventan datos públicos.
      descripcion: 'Página de prueba con datos ficticios. Antes de publicarla, el dueño debe confirmar nombre, dirección, teléfono, horarios y servicios.',
      serviciosPublicos: ['Mecánica general', 'Service y mantenimiento', 'Frenos y suspensión', 'Revisión antes de viajar'],
      turnosOnline: true, valor_hora: 2500000, validez_presupuesto_dias: 15
    },
    dueno: { nombre: 'Dueño (prueba)', email: USUARIOS_PRUEBA.dueno, clave: CLAVE_PRUEBA }
  });
  agregarUsuario(db, A.tallerId, { nombre: 'Carla (recepción, prueba)', email: USUARIOS_PRUEBA.recepcion, rol: 'recepcion', clave: CLAVE_PRUEBA });
  const marcosId = agregarUsuario(db, A.tallerId, { nombre: 'Marcos (prueba)', email: USUARIOS_PRUEBA.marcos, rol: 'mecanico', clave: CLAVE_PRUEBA });
  const julianId = agregarUsuario(db, A.tallerId, { nombre: 'Julián (prueba)', email: USUARIOS_PRUEBA.julian, rol: 'mecanico', clave: CLAVE_PRUEBA });
  const B = crearTaller(db, { slug: 'taller-norte', nombre: 'Taller Norte (ficticio)', config: { demo: true }, dueno: { nombre: 'Dueña Norte (prueba)', email: USUARIOS_PRUEBA.norte, clave: CLAVE_PRUEBA } });

  const dueno = new ClienteApi(base), carla = new ClienteApi(base), marcos = new ClienteApi(base), julian = new ClienteApi(base), norte = new ClienteApi(base);
  await dueno.ingresar(USUARIOS_PRUEBA.dueno, CLAVE_PRUEBA);
  await carla.ingresar(USUARIOS_PRUEBA.recepcion, CLAVE_PRUEBA);
  await marcos.ingresar(USUARIOS_PRUEBA.marcos, CLAVE_PRUEBA);
  await julian.ingresar(USUARIOS_PRUEBA.julian, CLAVE_PRUEBA);
  await norte.ingresar(USUARIOS_PRUEBA.norte, CLAVE_PRUEBA);

  // ---------- Catálogos del taller ----------
  for (const n of ['Elevador 1', 'Elevador 2', 'Fosa']) await dueno.post('/api/catalogos/puestos', { nombre: n });
  for (const s of [['Service de aceite y filtros', 60, '60000'], ['Revisión de ruido o vibración', 60, '25000'], ['Revisión de frenos', 45, '30000'], ['Revisión antes de viajar', 60, '28000']]) await dueno.post('/api/catalogos/servicios', { nombre: s[0], duracion: s[1], precio: s[2] });
  await dueno.post('/api/catalogos/plantillas', {
    nombre: 'Service de aceite y filtros (confirmar cada tarea)',
    tareas: ['Confirmar lo autorizado al recibir', 'Cambiar aceite según la especificación indicada para el motor', 'Cambiar filtro de aceite', 'Revisar filtro de aire y de habitáculo', 'Revisar niveles y pérdidas', 'Registrar productos y cantidades usadas', 'Prueba de funcionamiento']
  });
  for (const t of [['Cambio de amortiguadores traseros (par)', '2,5'], ['Cambio de pastillas de freno delanteras', '1'], ['Cambio de bujes de barra estabilizadora', '1,5'], ['Cambio de kit de embrague', '4']]) await dueno.post('/api/catalogos/trabajos', { nombre: t[0], horas: t[1], notas: 'Tiempo de prueba: el taller debe confirmarlo.' });
  const prov1 = (await dueno.post('/api/proveedores', { nombre: 'Distribuidora Andina (ficticio)', telefono: '2622 15-55-0901' })).id;
  await dueno.post('/api/proveedores', { nombre: 'Repuestos Valle (ficticio)', telefono: '2622 15-55-0902' });
  const art = {};
  art.buje = (await dueno.post('/api/articulos', { nombre: 'Buje de barra estabilizadora trasera · ejemplo', unidad: 'u.', minimo: '2', precioVenta: '12000' })).id;
  art.filtro = (await dueno.post('/api/articulos', { nombre: 'Filtro de aceite · verificar aplicación', unidad: 'u.', minimo: '2', precioVenta: '12000', codigo: 'FA-PRUEBA' })).id;
  art.aceite = (await dueno.post('/api/articulos', { nombre: 'Aceite de motor · especificación a confirmar', unidad: 'L', minimo: '10', precioVenta: '9000' })).id;
  art.pastillas = (await dueno.post('/api/articulos', { nombre: 'Pastillas de freno delanteras · ejemplo', unidad: 'juego', minimo: '2', precioVenta: '98000' })).id;
  reloj('2025-01-02T10:00');
  const compra = await dueno.post('/api/compras', {
    proveedorId: prov1, recibir: true, documento: { tipo: 'remito', numero: 'R-0001-00001234', fecha: '2025-01-02' },
    lineas: [{ articuloId: art.buje, cantidad: '6', costo: '7000' }, { articuloId: art.filtro, cantidad: '5', costo: '8000' }, { articuloId: art.aceite, cantidad: '40', costo: '6000' }]
  });
  reloj('2025-01-06T10:00');
  await dueno.post(`/api/compras/${compra.id}/documentos`, { tipo: 'factura', numero: 'A-0002-00004567', fecha: '2025-01-06', importe: '322000' });
  await dueno.post(`/api/compras/${compra.id}/pagos`, { importe: '200000', medio: 'transferencia', nota: 'Pago parcial de prueba' }, { idempotencia: true });

  const cat = await dueno.get('/api/catalogos');
  const plantillaService = cat.plantillas[0].id;

  // ---------- Etios: historial ----------
  reloj('2025-11-18T09:00');
  const etios = await carla.post('/api/vehiculos', { patente: 'AE 482 KJ', marca: 'Toyota', modelo: 'Etios', version_txt: 'XLS 1.5', anio: 2019, combustible: 'Nafta', color: 'Gris', contacto: { nombre: 'Ana Ferreyra (ficticio)', telefono: '2622 15-55-0142', acepta_avisos: true } });
  const e1 = (await carla.recibir({ vehiculoId: etios.id, tipo: 'revision', motivo: 'Ruido en la parte trasera al pasar lomos de burro.', responsableId: marcosId, km: '71900' })).id;
  reloj('2025-11-18T11:00');
  await marcos.post(`/api/visitas/${e1}/revision`, { versionActual: 0, estado: 'sin_falla', relato: 'Escucha un golpe atrás en calles de tierra.', hallazgos: 'Sin juego visible en suspensión trasera. Amortiguadores sin pérdidas.', pruebas: 'Prueba de ruta 15 km por calle de tierra y revisión en elevador.' });
  await marcos.post(`/api/visitas/${e1}/control`, { resultado: 'no_reproducido', como: 'Prueba de ruta y revisión en elevador', nota: 'Volver si el ruido aparece de nuevo.' });
  await carla.post(`/api/visitas/${e1}/lista`, {});
  reloj('2025-11-18T17:30');
  await carla.post(`/api/visitas/${e1}/entrega`, { pendientesInformados: true, nota: 'Se le explicó que no se reprodujo el ruido.' });

  reloj('2026-05-12T08:30');
  const e2 = (await carla.recibir({ vehiculoId: etios.id, tipo: 'service', motivo: 'Service de aceite y filtros.', responsableId: marcosId, km: '78420', plantillaId: plantillaService, autorizacion: { persona: 'Ana Ferreyra', canal: 'presencial', importe: '60000' } })).id;
  reloj('2026-05-12T10:00');
  let ve2 = (await marcos.get(`/api/visitas/${e2}`)).visita;
  for (const t of ve2.tareas) await marcos.post(`/api/tareas/${t.id}`, t.descripcion.startsWith('Revisar filtro de aire') ? { estado: 'no_aplica', explicacion: 'Filtro de aire cambiado hace 2.000 km según factura del cliente.' } : { estado: 'hecho' });
  await marcos.post(`/api/visitas/${e2}/productos`, { descripcion: 'Aceite de motor (especificación según manual, a confirmar)', cantidad: '4,2', unidad: 'L', articuloId: art.aceite });
  await marcos.post(`/api/visitas/${e2}/productos`, { descripcion: 'Filtro de aceite', cantidad: '1', unidad: 'u.', articuloId: art.filtro });
  ve2 = (await marcos.get(`/api/visitas/${e2}`)).visita;
  await marcos.post(`/api/visitas/${e2}/lineas/${ve2.presupuesto.lineas[0].id}/realizado`, {});
  await marcos.post(`/api/visitas/${e2}/control`, { resultado: 'resuelto', como: 'Control de nivel y pérdidas con motor en marcha' });
  await marcos.post(`/api/visitas/${e2}/proximo`, { km: '88420', fecha: '2027-05-12', criterio: 'Lo que ocurra primero.', confirma: true });
  await carla.post(`/api/visitas/${e2}/lista`, {});
  await carla.post(`/api/visitas/${e2}/liquidar`, {});
  reloj('2026-05-12T12:10');
  await carla.post(`/api/visitas/${e2}/pagos`, { importe: '60000', medio: 'efectivo' }, { idempotencia: true });
  await carla.post(`/api/visitas/${e2}/entrega`, {});

  // ---------- Etios: visita actual ----------
  const retiroHoy = `${hoy}T18:00`;
  reloj(hace(26));
  const e3 = (await carla.recibir({
    vehiculoId: etios.id, tipo: 'revision', motivo: 'Golpe en la parte trasera al pasar lomos de burro. Pide revisar también los frenos.', responsableId: marcosId,
    retiro: retiroHoy, km: '84150', autorizacion: { revisionConCosto: true, persona: 'Ana Ferreyra', canal: 'presencial', importe: '25000' }
  })).id;
  reloj(hace(25));
  await marcos.post(`/api/visitas/${e3}/revision`, {
    versionActual: 0, estado: 'confirmado', confirma: true,
    relato: 'Golpe atrás en lomos de burro, más fuerte con el auto cargado. Pide revisar frenos.',
    hallazgos: 'Amortiguador trasero izquierdo con pérdida de aceite. Bujes de barra estabilizadora trasera agrietados. Pastillas delanteras al 25 %.',
    hipotesis: null, pruebas: 'Prueba de ruta con lomos de burro y revisión en elevador. Comparación con el lado derecho.',
    diagnostico: 'Amortiguadores traseros vencidos (izquierdo con pérdida) y bujes de barra estabilizadora gastados.',
    recomendacion: 'Cambiar amortiguadores traseros de a par y bujes. Las pastillas pueden esperar unos 2.000 km.'
  });
  let ve3 = (await marcos.get(`/api/visitas/${e3}`)).visita;
  await marcos.post(`/api/visitas/${e3}/lineas/${ve3.presupuesto.lineas[0].id}/realizado`, {});
  reloj(hace(24));
  ve3 = (await carla.post(`/api/visitas/${e3}/presupuesto`, {
    nota: 'Presupuesto de reparación',
    lineas: [
      { tipo: 'repuesto', descripcion: 'Amortiguadores traseros (par)', cantidad: '1', unidad: 'par', precio: '118000' },
      { tipo: 'mano_obra', descripcion: 'Cambio de amortiguadores traseros', cantidad: '1', unidad: 'u.', precio: '22000' },
      { tipo: 'mano_obra', descripcion: 'Cambio de bujes de barra estabilizadora trasera (incluye bujes)', cantidad: '1', unidad: 'u.', precio: '49000' },
      { tipo: 'repuesto', descripcion: 'Pastillas de freno delanteras', cantidad: '1', unidad: 'juego', precio: '98000' }
    ]
  })).visita;
  const L = ve3.presupuesto.lineas.filter((l) => !l.autorizada_ingreso);
  reloj(hace(23));
  await carla.post(`/api/visitas/${e3}/respuestas`, {
    persona: 'Ana Ferreyra', canal: 'telefono',
    respuestas: [{ lineaId: L[0].id, respuesta: 'autoriza' }, { lineaId: L[1].id, respuesta: 'autoriza' }, { lineaId: L[2].id, respuesta: 'autoriza' }, { lineaId: L[3].id, respuesta: 'posterga', nota: 'Las cambia el mes próximo.' }]
  });
  reloj(hace(22.5));
  await carla.post(`/api/visitas/${e3}/repuestos`, { lineaId: L[0].id, descripcion: 'Amortiguadores traseros (par)', cantidad: '1', unidad: 'par', origen: 'taller', proveedorId: prov1, etapa: 'pedido', fechaPrevista: hoy });
  const rBuje = (await carla.post(`/api/visitas/${e3}/repuestos`, { lineaId: L[2].id, descripcion: 'Buje de barra estabilizadora trasera', cantidad: '2', unidad: 'u.', origen: 'taller', etapa: 'falta_pedir' })).id;
  await carla.post(`/api/repuestos/${rBuje}/reservar`, { articuloId: art.buje });
  await carla.post(`/api/repuestos/${rBuje}/etapa`, { etapa: 'llego' });
  reloj(hace(22));
  await carla.post(`/api/visitas/${e3}/pagos`, { importe: '50000', medio: 'transferencia', referencia: 'Operación de prueba 0001', nota: 'Seña' }, { idempotencia: true });

  // ---------- Otros autos presentes ----------
  async function auto(patente, marca, modelo, version, contacto, tel) {
    return (await carla.post('/api/vehiculos', { patente, marca, modelo, version_txt: version, contacto: { nombre: contacto, telefono: tel } })).id;
  }
  // Cronos: en revisión
  reloj(hace(2));
  const cronos = await auto('AD 913 LP', 'Fiat', 'Cronos', 'Drive 1.3', 'Laura Méndez (ficticio)', '2622 15-55-0111');
  const vc = (await carla.recibir({ vehiculoId: cronos, tipo: 'revision', motivo: 'Ruido en la caja al pasar cambios.', responsableId: julianId, km: '45210' })).id;
  reloj(hace(1.5));
  await julian.post(`/api/visitas/${vc}/revision`, { versionActual: 0, estado: 'en_revision', relato: 'Ruido al pasar de segunda a tercera, más en frío.', hallazgos: 'Nivel de aceite de caja correcto. Falta prueba de ruta en frío.' });

  // Gol: presupuesto sin respuesta
  reloj(hace(5));
  const gol = await auto('NKO 245', 'Volkswagen', 'Gol', 'Trend 1.6', 'Diego Sosa (ficticio)', '2622 15-55-0122');
  const vg = (await carla.recibir({ vehiculoId: gol, tipo: 'revision', motivo: 'Pierde refrigerante y levanta temperatura.', responsableId: marcosId, km: '132400', retiro: null, autorizacion: { revisionConCosto: true, persona: 'Diego Sosa', importe: '25000' } })).id;
  reloj(hace(4));
  await marcos.post(`/api/visitas/${vg}/revision`, { versionActual: 0, estado: 'confirmado', confirma: true, relato: 'Pierde líquido y la aguja sube en ruta.', hallazgos: 'Pérdida por el sello de la bomba de agua.', pruebas: 'Prueba de presión del circuito de refrigeración.', diagnostico: 'Bomba de agua con pérdida por el sello.', recomendacion: 'Cambiar bomba de agua y refrigerante.' });
  let vgv = (await marcos.get(`/api/visitas/${vg}`)).visita;
  await marcos.post(`/api/visitas/${vg}/lineas/${vgv.presupuesto.lineas[0].id}/realizado`, {});
  reloj(hace(3));
  await carla.post(`/api/visitas/${vg}/presupuesto`, { lineas: [{ tipo: 'repuesto', descripcion: 'Bomba de agua', cantidad: '1', unidad: 'u.', precio: '85000' }, { tipo: 'mano_obra', descripcion: 'Cambio de bomba de agua y refrigerante', precio: '35000' }] });

  // 208: service en curso
  reloj(hace(3));
  const p208 = await auto('AE 771 BD', 'Peugeot', '208', 'Allure 1.6', 'Mariana López (ficticio)', '2622 15-55-0144');
  const v208 = (await carla.recibir({ vehiculoId: p208, tipo: 'service', motivo: 'Service de los 40.000 km.', responsableId: julianId, km: '40120', plantillaId: plantillaService, retiro: `${hoy}T17:00`, autorizacion: { persona: 'Mariana López', canal: 'presencial', importe: '60000' } })).id;
  reloj(hace(1));
  const t208 = (await julian.get(`/api/visitas/${v208}`)).visita.tareas;
  await julian.post(`/api/tareas/${t208[0].id}`, { estado: 'hecho' });
  await julian.post(`/api/tareas/${t208[1].id}`, { estado: 'hecho' });

  // Onix: listo para retirar, liquidado y con pago parcial
  reloj(hace(27));
  const onix = await auto('AC 552 MZ', 'Chevrolet', 'Onix', 'LT 1.4', 'Silvia Torres (ficticio)', '2622 15-55-0166');
  const vo = (await carla.recibir({ vehiculoId: onix, tipo: 'service', motivo: 'Service anual.', responsableId: marcosId, km: '61050', plantillaId: plantillaService, retiro: local(redondear(new Date(real.getTime() + 3600e3))), autorizacion: { persona: 'Silvia Torres', importe: '60000' } })).id;
  reloj(hace(20));
  for (const t of (await marcos.get(`/api/visitas/${vo}`)).visita.tareas) await marcos.post(`/api/tareas/${t.id}`, { estado: 'hecho' });
  await marcos.post(`/api/visitas/${vo}/productos`, { descripcion: 'Aceite de motor (especificación según manual)', cantidad: '3,5', unidad: 'L', articuloId: art.aceite });
  const vov = (await marcos.get(`/api/visitas/${vo}`)).visita;
  await marcos.post(`/api/visitas/${vo}/lineas/${vov.presupuesto.lineas[0].id}/realizado`, {});
  reloj(hace(19));
  await marcos.post(`/api/visitas/${vo}/control`, { resultado: 'resuelto', como: 'Prueba de funcionamiento y control de pérdidas' });
  await marcos.post(`/api/visitas/${vo}/proximo`, { km: '71050', fecha: `${Number(hoy.slice(0, 4)) + 1}${hoy.slice(4)}`, confirma: true });
  await carla.post(`/api/visitas/${vo}/lista`, {});
  await carla.post(`/api/visitas/${vo}/liquidar`, {});
  reloj(hace(18));
  await carla.post(`/api/visitas/${vo}/pagos`, { importe: '25000', medio: 'transferencia', referencia: 'Operación de prueba 0002', nota: 'Pago a cuenta; el resto al retirar' }, { idempotencia: true });

  // ---------- Agenda ----------
  const manana = proximoHabil(hoy);
  reloj(hace(48));
  await carla.post('/api/turnos', { nombre: 'Luis Gómez (ficticio)', telefono: '2622 15-55-0177', patente: 'AB 123 CD', vehiculo: 'Toyota Corolla', motivo: 'Service', servicioId: cat.servicios.find((s) => s.nombre.startsWith('Service')).id, puestoId: cat.puestos[0].id, inicio: `${manana}T10:00` });
  await carla.post('/api/turnos', { nombre: 'Carolina Paz (ficticio)', telefono: '2622 15-55-0188', patente: 'AA 987 ZZ', vehiculo: 'Ford Ka', motivo: 'Revisar frenos', servicioId: cat.servicios.find((s) => s.nombre.startsWith('Revisión de frenos')).id, puestoId: cat.puestos[1].id, inicio: `${manana}T14:00` });
  const anon = new ClienteApi(base);
  await anon.post('/api/publico/taller-modelo/turnos', { nombre: 'Paula Díaz (ficticio)', telefono: '2622 15-55-0199', patente: 'AC 001 AA', vehiculo: 'Renault Sandero', motivo: 'Ruido al frenar', fecha: manana, hora: '11:00', acepta: true });

  // ---------- Mostrador ----------
  reloj(hace(30));
  await carla.post('/api/ventas', { clienteNombre: 'Consumidor sin datos', lineas: [{ articuloId: art.filtro, cantidad: '1', precio: '12000' }], cobro: { importe: '12000', medio: 'efectivo' } }, { idempotencia: true });

  // ---------- Taller Norte: misma patente, otro auto y otro dueño (debe quedar aislado) ----------
  reloj(hace(10));
  const vn = await norte.post('/api/vehiculos', { patente: 'AE482KJ', marca: 'Toyota', modelo: 'Etios', contacto: { nombre: 'Pedro Gómez (ficticio)', telefono: '2622 15-55-0700' } });
  await norte.recibir({ vehiculoId: vn.id, tipo: 'revision', motivo: 'Revisión general (taller Norte).', km: '20000' });

  delete process.env.TALLERES_RELOJ;
  return { tallerA: A.tallerId, tallerB: B.tallerId, etios: { vehiculo: etios.id, visitaActual: e3 }, articulos: art };
}

// ----- Uso por consola -----
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const reiniciar = process.argv.includes('--reiniciar');
  const archivo = archivoBase();
  if (reiniciar && fs.existsSync(archivo)) {
    // Nunca se borra una base con talleres reales: solo las que tienen exclusivamente talleres de demostración.
    const { DatabaseSync } = await import('node:sqlite');
    const previa = new DatabaseSync(archivo, { readOnly: true });
    let reales = [];
    try { reales = previa.prepare('SELECT nombre, config FROM talleres').all().filter((t) => !JSON.parse(t.config || '{}').demo).map((t) => t.nombre); } catch { /* base sin tablas */ }
    previa.close();
    if (reales.length) {
      console.error(`No se borra: la base tiene talleres que no son de demostración (${reales.join(', ')}).`);
      console.error('Para una demostración usá otra carpeta: TALLERES_DATOS=./data-demo npm run seed');
      process.exit(1);
    }
  }
  if (reiniciar) {
    for (const f of [archivo, archivo + '-wal', archivo + '-shm']) fs.rmSync(f, { force: true });
    fs.rmSync(carpetaArchivos(), { recursive: true, force: true });
  }
  const { crearServidor } = await import('../server/index.js');
  const servidor = crearServidor({ archivo });
  const n = servidor.db.prepare('SELECT COUNT(*) AS n FROM talleres').get().n;
  if (n) {
    console.error('La base ya tiene talleres. Para borrar y volver a cargar los datos de prueba: npm run seed -- --reiniciar');
    process.exit(1);
  }
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  try {
    await sembrar({ db: servidor.db, base });
    console.log('Datos de prueba cargados en', path.relative(process.cwd(), archivo) || archivo);
    console.log('Usuarios de prueba (contraseña en scripts/seed.js o en TALLERES_CLAVE_PRUEBA):');
    for (const [k, v] of Object.entries(USUARIOS_PRUEBA)) console.log(`  ${k.padEnd(10)} ${v}`);
  } finally {
    servidor.close();
    servidor.db.close();
  }
  void config;
}
