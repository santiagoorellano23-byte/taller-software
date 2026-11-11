// Reglas del taller sin acceso a la base: se aplican sobre una visita ya cargada.
// Conservan las reglas de la demo amplia: autorizado ≠ realizado ≠ cobrado; llegó ≠ colocado;
// listo ≠ entregado; un cambio sobre algo autorizado necesita su propia respuesta.

// Respuesta efectiva de una línea: la última registrada o la autorización al ingreso.
export function respuestaDe(linea) {
  if (linea.respuesta) return linea.respuesta.respuesta;
  if (linea.autorizada_ingreso) return 'autoriza';
  return null;
}

// Una línea vigente que modifica otra queda "cambio pendiente" hasta que el cliente responda.
export const esCambioPendiente = (l) => l.estado === 'vigente' && l.origen_linea_id && !respuestaDe(l);

// Líneas autorizadas que se pueden ejecutar ahora.
export function lineasEjecutables(lineas) {
  return lineas.filter((l) => l.estado === 'vigente' && respuestaDe(l) === 'autoriza');
}

export function totales(v) {
  const lineas = v.presupuesto?.lineas || [];
  const t = { presupuestado: 0, autorizado: 0, postergado: 0, rechazado: 0, sinRespuesta: 0, cambiosPendientes: 0, realizado: 0, liquidado: 0, cobrado: 0, saldo: 0, aFavor: 0 };
  const vigentes = lineas.filter((l) => l.estado === 'vigente');
  for (const l of vigentes) {
    t.presupuestado += l.importe;
    const r = respuestaDe(l);
    if (r === 'autoriza') t.autorizado += l.importe;
    else if (r === 'posterga') t.postergado += l.importe;
    else if (r === 'rechaza') t.rechazado += l.importe;
    else t.sinRespuesta += l.importe;
    if (l.realizado_at) t.realizado += l.importe;
  }
  // Mientras un cambio espera respuesta, lo autorizado antes sigue contando como autorizado.
  for (const l of vigentes.filter(esCambioPendiente)) {
    t.cambiosPendientes += 1;
    const origen = lineas.find((x) => x.id === l.origen_linea_id);
    if (origen && respuestaDe(origen) === 'autoriza') t.autorizado += origen.importe;
  }
  const mov = v.cuenta || [];
  t.liquidado = mov.filter((m) => m.tipo === 'cargo').reduce((n, m) => n + m.importe, 0)
    - mov.filter((m) => m.tipo === 'anulacion' && m.anula_tipo === 'cargo').reduce((n, m) => n + m.importe, 0);
  t.cobrado = mov.filter((m) => m.tipo === 'pago').reduce((n, m) => n + m.importe, 0)
    - mov.filter((m) => m.tipo === 'anulacion' && m.anula_tipo === 'pago').reduce((n, m) => n + m.importe, 0)
    - mov.filter((m) => m.tipo === 'devolucion_dinero').reduce((n, m) => n + m.importe, 0);
  const neto = mov.reduce((n, m) => n + m.efecto, 0);
  t.saldo = Math.max(0, neto);
  t.aFavor = Math.max(0, -neto);
  return t;
}

export const controlVigente = (v) => (v.controles || []).find((c) => c.vigente) || null;

// Situación operativa y próximo paso, con palabras del taller.
export function situacion(v) {
  if (v.anulada_at) return { clave: 'anulada', texto: 'Anulada', paso: 'Visita anulada: solo consulta.' };
  if (v.entregada_at) return { clave: 'entregada', texto: 'Entregado', paso: 'Visita cerrada. Queda en el historial.' };
  const lineas = (v.presupuesto?.lineas || []).filter((l) => l.estado === 'vigente');
  const ejecutables = lineasEjecutables(lineas);
  const control = controlVigente(v);
  if (v.lista_at) {
    const sinLiquidar = ejecutables.some((l) => l.realizado_at && l.importe > 0 && !l.cargo_id);
    const saldo = (v.cuenta || []).reduce((n, m) => n + m.efecto, 0);
    const paso = sinLiquidar ? 'Liquidar lo realizado en Cobros y después registrar la entrega.'
      : saldo > 0 ? 'Cobrar el saldo y registrar la entrega cuando el cliente lo retire.'
        : 'Registrar la entrega cuando el cliente lo retire.';
    return { clave: 'lista', texto: 'Listo para retirar', paso };
  }
  if (control) return { clave: 'controlada', texto: 'Resultado comprobado', paso: 'Marcar el auto como listo para retirar.' };

  const sinResp = lineas.filter((l) => !respuestaDe(l));
  const revision = v.revision;
  // La revisión con costo autorizada al recibir no es todavía un trabajo de reparación.
  const reparaciones = lineas.filter((l) => l.tipo !== 'revision');
  if (v.tipo === 'revision' && !reparaciones.length && (!revision || revision.estado === 'en_revision')) {
    return { clave: 'revision', texto: 'En revisión', paso: revision ? 'Completar las pruebas y registrar la conclusión de la revisión.' : 'Registrar lo que cuenta el cliente y lo observado.' };
  }
  if (sinResp.length) {
    const cambios = sinResp.filter((l) => l.origen_linea_id).length;
    return { clave: 'autorizacion', texto: 'Esperando autorización', paso: cambios ? 'Registrar la respuesta del cliente sobre el cambio de presupuesto.' : 'Registrar la respuesta del cliente sobre el presupuesto.' };
  }
  if (v.tipo === 'revision' && !reparaciones.length) {
    return { clave: 'presupuesto', texto: 'Falta presupuesto', paso: 'Preparar el presupuesto con lo que surgió de la revisión.' };
  }
  const deEjecutables = new Set(ejecutables.map((l) => l.id));
  const esperando = (v.repuestos || []).filter((r) => (r.linea_id == null || deEjecutables.has(r.linea_id)) && (r.etapa === 'falta_pedir' || r.etapa === 'pedido'));
  const pendientes = ejecutables.filter((l) => !l.realizado_at);
  const tareasPend = (v.tareas || []).filter((t) => t.estado === 'pendiente');
  if (esperando.length && pendientes.length) {
    const r = esperando[0];
    return { clave: 'repuesto', texto: 'Esperando repuesto', paso: r.etapa === 'falta_pedir' ? `Pedir: ${r.descripcion}.` : `Registrar que llegó: ${r.descripcion}.` };
  }
  if (pendientes.length || tareasPend.length) {
    const llegados = (v.repuestos || []).filter((r) => r.etapa === 'llego');
    if (llegados.length) return { clave: 'trabajo', texto: 'En trabajo', paso: `Colocar y registrar: ${llegados[0].descripcion}.` };
    if (tareasPend.length) return { clave: 'trabajo', texto: 'En trabajo', paso: `Tareas del service: ${tareasPend.length} pendiente${tareasPend.length > 1 ? 's' : ''}.` };
    return { clave: 'trabajo', texto: 'En trabajo', paso: `Terminar y registrar: ${pendientes[0].descripcion}.` };
  }
  if (!ejecutables.length && !lineas.length && v.tipo === 'service' && !(v.tareas || []).length) {
    return { clave: 'trabajo', texto: 'En trabajo', paso: 'Registrar las tareas y productos del service.' };
  }
  if (!ejecutables.length && lineas.length) {
    return { clave: 'control', texto: 'Sin trabajos autorizados', paso: 'El cliente no autorizó trabajos. Comprobar el estado del auto y preparar la entrega.' };
  }
  return { clave: 'control', texto: 'Falta comprobar', paso: 'Comprobar el resultado antes de marcarlo listo.' };
}

// Motivos que impiden marcar realizado un trabajo autorizado.
export function bloqueosRealizar(v, linea) {
  const motivos = [];
  if (linea.estado !== 'vigente') motivos.push('Esta línea fue reemplazada por un cambio.');
  if (respuestaDe(linea) !== 'autoriza') motivos.push('El cliente todavía no autorizó este trabajo.');
  if (linea.realizado_at) motivos.push('Ya figura realizado.');
  const cambio = (v.presupuesto?.lineas || []).find((l) => l.origen_linea_id === linea.id && esCambioPendiente(l));
  if (cambio) motivos.push('Hay un cambio de este trabajo esperando la respuesta del cliente.');
  const sinColocar = (v.repuestos || []).filter((r) => r.linea_id === linea.id && r.etapa !== 'colocado');
  if (sinColocar.length) motivos.push(`Falta colocar: ${sinColocar.map((r) => r.descripcion).join(', ')}.`);
  if (v.tipo === 'service' && linea.autorizada_ingreso) {
    const pend = (v.tareas || []).filter((t) => t.estado === 'pendiente');
    if (pend.length) motivos.push(`El service tiene ${pend.length} tarea${pend.length > 1 ? 's' : ''} sin confirmar.`);
  }
  return motivos;
}

// Motivos que impiden comprobar el resultado (control).
export function bloqueosControl(v) {
  const motivos = [];
  const lineas = (v.presupuesto?.lineas || []).filter((l) => l.estado === 'vigente');
  if (lineas.some((l) => !respuestaDe(l))) motivos.push('Hay trabajos sin respuesta del cliente.');
  const pend = lineasEjecutables(lineas).filter((l) => !l.realizado_at);
  if (pend.length) motivos.push(`Faltan trabajos autorizados: ${pend.map((l) => l.descripcion).join(', ')}.`);
  if ((v.tareas || []).some((t) => t.estado === 'pendiente')) motivos.push('Hay tareas del service sin confirmar.');
  if (v.entregada_at) motivos.push('La visita ya se entregó.');
  return motivos;
}

// Pendientes simultáneos, independientes del estado principal y sin alterar la orden.
export function resumenOperativo(v) {
  if (v.entregada_at || v.anulada_at) return { autorizacion: false, repuestos: false, bloqueos: [] };
  const lineas = (v.presupuesto?.lineas || []).filter(l=>l.estado==='vigente');
  const pendientes = lineas.filter(l=>!respuestaDe(l));
  const ejecutables = lineasEjecutables(lineas).filter(l=>!l.realizado_at);
  const piezas = (v.repuestos || []).filter(r=>r.etapa!=='colocado' && ejecutables.some(l=>r.linea_id===l.id || r.linea_id==null));
  const bloqueos = [];
  if (pendientes.length) bloqueos.push({tipo:'autorizacion',texto:`${pendientes.length} trabajo${pendientes.length===1?'':'s'} sin respuesta del cliente.`,seccion:'presupuesto'});
  for (const r of piezas) bloqueos.push({tipo:'repuesto',texto:`${ETAPA_TXT[r.etapa]}: ${r.descripcion}.`,seccion:'trabajo'});
  const tareas = (v.tareas || []).filter(t=>t.estado==='pendiente');
  if (tareas.length) bloqueos.push({tipo:'tarea',texto:`${tareas.length} tarea${tareas.length===1?'':'s'} del service sin confirmar.`,seccion:'trabajo'});
  return {autorizacion:pendientes.length>0,repuestos:piezas.length>0,bloqueos};
}

// Lectura de cinco dimensiones independientes; no agrega estados ni efectos de negocio.
export function dimensionesVisita(v,{conDinero=true}={}){
  const ls=(v.presupuesto?.lineas||[]).filter(l=>l.estado==='vigente'),ej=ls.filter(l=>respuestaDe(l)==='autoriza');
  const tecnico=v.lista_at||v.entregada_at?'Terminado':controlVigente(v)?'Control final':ej.some(l=>!l.realizado_at)||v.tipo==='service'?'En trabajo':v.revision?(v.revision.estado==='en_revision'?'En revisión':'Revisado'):'Recibido';
  const autorizacion=ls.some(l=>!respuestaDe(l))?'Esperando respuesta':ej.length?(ls.some(l=>respuestaDe(l)!=='autoriza')?'Aprobado parcial':'Aprobado'):v.tipo==='service'?'Service autorizado':v.revision?'Falta presupuesto':v.autorizacion_ingreso||v.recepcion?.autoriza==='revision'?'Revisión aceptada':'Sin pedir';
  const piezas=v.repuestos||[],repuestos=piezas.some(r=>['falta_pedir','pedido'].includes(r.etapa))?'Esperando repuesto':piezas.some(r=>r.etapa==='llego')?'Recibido sin colocar':piezas.length?'Completo':'Sin pedidos';
  const rows=[['Trabajo',tecnico],['Autorización',autorizacion],['Repuestos',repuestos]];
  if(conDinero){const t=v.totales||totales(v);rows.push(['Dinero',!t.liquidado&&t.cobrado>0?'Anticipo':t.saldo>0?'Saldo pendiente':t.aFavor>0?'Saldo a favor':t.liquidado?'Pagado':'Sin movimientos']);}
  rows.push(['Vehículo',v.anulada_at?'Orden anulada':v.entregada_at?'Entregado':v.lista_at?'Listo para retirar':'En taller']);return rows;
}

export const RESULTADOS = {
  resuelto: 'Resuelto y comprobado',
  mejoro: 'Mejoró, pero falta resolver',
  no_reproducido: 'No se pudo reproducir el problema',
  pendiente: 'Sigue pendiente'
};
export const ETAPAS = ['falta_pedir', 'pedido', 'llego', 'colocado'];
export const ETAPA_TXT = { falta_pedir: 'Falta pedir', pedido: 'Pedido', llego: 'Llegó · falta colocar', colocado: 'Colocado' };
export const TIPOS_LINEA = { repuesto: 'Repuesto', insumo: 'Insumo', mano_obra: 'Mano de obra', servicio_externo: 'Servicio externo', revision: 'Revisión', otro: 'Otro' };

// Regla de cada taller para entregar un auto con saldo. «recepcion» es el comportamiento inicial
// (dueño y recepción, con confirmación y motivo) hasta que el dueño confirme otra.
export const ENTREGA_SALDO = {
  recepcion: 'Dueño y recepción pueden entregar con saldo, con confirmación y motivo',
  dueno: 'Solo el dueño puede entregar con saldo, con confirmación y motivo',
  ninguno: 'No se entrega con saldo: primero se cobra'
};
export const reglaEntregaSaldo = (taller) => (ENTREGA_SALDO[taller?.config?.entrega_saldo] ? taller.config.entrega_saldo : 'recepcion');
export function puedeEntregarConSaldo(usuario, taller) {
  const regla = reglaEntregaSaldo(taller);
  if (regla === 'ninguno') return false;
  if (regla === 'dueno') return usuario?.rol === 'dueno';
  return ['dueno', 'recepcion'].includes(usuario?.rol);
}
