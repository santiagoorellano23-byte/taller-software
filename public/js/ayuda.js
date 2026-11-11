// Ayuda por tarea: pasos cortos con ejemplos ficticios. Documentación propia, funciona sin proveedor de IA.
import { esc, icono } from './ui.js?v=0.1.0';
import { entrada, retirar } from './movimiento.js?v=0.1.0';

export const ARTICULOS = [
  { id: 'guia', titulo: 'Primeros pasos en el panel', pantallas: ['hoy', 'mas'], pasos: ['Hoy muestra los autos que están en el taller y qué falta en cada uno.', 'Tocá «Abrir visita» para ver el trabajo de un auto y su próximo paso.', 'Con «Recibir un auto» registrás un ingreso nuevo.', 'Autos y clientes sirve para buscar por patente, nombre o teléfono.', 'Pendientes reúne próximos services y trabajos que el cliente dejó para más adelante.', 'Lo demás (agenda, cobros, stock, compras, reportes) está en «Más funciones».'], ejemplo: 'Ejemplo ficticio: buscá «AE482KJ» y abrí la visita del Toyota Etios.' },
  { id: 'buscar', titulo: 'Buscar un auto o un cliente', pantallas: ['hoy', 'autos', 'recibir'], pasos: ['Escribí la patente como quieras: con o sin espacios ni guiones.', 'También podés escribir el nombre del cliente o parte del teléfono.', 'Tocá el resultado para abrir la ficha con su historial.'], ejemplo: 'Ejemplo ficticio: «ae 482» o «0142» encuentran el Etios de Ana Ferreyra.' },
  { id: 'recibir', titulo: 'Recibir un auto', pantallas: ['hoy', 'recibir', 'ficha', 'agenda'], pasos: ['Tocá «Recibir un auto».', 'Buscá la patente. Si el auto ya vino, elegilo; si no, cargá patente y contacto.', 'Elegí Revisión o reparación, o Service.', 'Escribí el motivo con las palabras del cliente.', 'Anotá los kilómetros. Si no se pueden leer, marcá «Sin lectura».', 'El resto (responsable, retiro, autorización) es opcional y se puede completar después.'], ejemplo: 'Un service solo se recibe como tal si el cliente lo autorizó al dejar el auto. Si todavía no, recibilo como Revisión.' },
  { id: 'revision', titulo: 'Registrar la revisión', pantallas: ['visita'], pasos: ['Abrí la visita y entrá a «Revisión».', 'Anotá lo que cuenta el cliente y lo que observaste.', 'Si todavía no estás seguro, escribí la posibilidad en «Lo que podría ser».', 'El diagnóstico se marca como confirmado solo después de las pruebas.', 'Cada vez que guardás queda una versión nueva; las anteriores se conservan.'], ejemplo: 'Registrar la revisión no autoriza ningún trabajo: eso lo decide el cliente con el presupuesto.' },
  { id: 'presupuesto', titulo: 'Preparar un presupuesto', pantallas: ['visita'], pasos: ['En la visita, entrá a «Presupuesto».', 'Agregá cada repuesto, insumo, mano de obra o servicio externo con cantidad y precio.', 'El total se calcula solo y queda la versión guardada.', 'Imprimilo o compartilo desde «Documentos de la visita».', 'Si después aparece algo más, se agrega como trabajo adicional (otra versión).'], ejemplo: 'Ejemplo ficticio: amortiguadores traseros (par) $118.000 + mano de obra $22.000.' },
  { id: 'respuesta', titulo: 'Registrar la respuesta del cliente', pantallas: ['visita'], pasos: ['En «Presupuesto», tocá «Registrar respuesta del cliente».', 'Para cada trabajo elegí: Autoriza, No autoriza o Para más adelante.', 'Indicá quién respondió y por dónde (teléfono, WhatsApp, en persona).', 'Lo que queda para más adelante pasa a Pendientes para avisarle después.'], ejemplo: 'Una respuesta parcial habilita solo lo autorizado.' },
  { id: 'cambio', titulo: 'Cambiar el precio o la cantidad de algo ya autorizado', pantallas: ['visita'], pasos: ['En «Presupuesto», tocá «Cambiar» en la línea.', 'Escribí la nueva cantidad o precio y el motivo.', 'Se crea una versión nueva. La línea anterior queda tachada pero se conserva con su autorización.', 'El cambio espera la respuesta del cliente: registrala como cualquier otra.', 'Si el cliente no acepta el cambio, vuelve a regir lo autorizado antes.'], ejemplo: 'Mientras el cambio no tenga respuesta, ese trabajo no se puede marcar como realizado.' },
  { id: 'repuestos', titulo: 'Pedir un repuesto y registrar que llegó o se colocó', pantallas: ['visita'], pasos: ['En «Trabajo y repuestos», agregá el repuesto al trabajo correspondiente.', 'Avanzalo por etapas: Falta pedir → Pedido → Llegó → Colocado.', 'Llegó no es lo mismo que colocado: el trabajo se marca aparte.', 'Si la pieza sale del stock del taller, se descuenta una sola vez, al colocarla.'], ejemplo: 'Si el cliente trae la pieza, elegí «La trae el cliente»: no toca el stock.' },
  { id: 'service', titulo: 'Registrar un service (tareas y productos)', pantallas: ['visita'], pasos: ['La plantilla propone tareas pero no las marca solas.', 'Marcá cada tarea como Hecho o No aplica (con una explicación).', 'Registrá los productos realmente usados con cantidad y unidad (por ejemplo 4,2 L).', 'Al terminar, el técnico indica el próximo service por kilómetros y/o fecha.'], ejemplo: 'El sistema no inventa intervalos: el próximo control lo confirma el técnico.' },
  { id: 'control', titulo: 'Comprobar el resultado y marcar listo', pantallas: ['visita'], pasos: ['Cuando todos los trabajos autorizados están hechos, entrá a «Control y entrega».', 'Elegí el resultado: Resuelto, Mejoró pero falta, No se pudo reproducir o Sigue pendiente.', 'Contá cómo lo comprobaste (prueba de ruta, elevador…).', 'Después tocá «Marcar listo para retirar». El auto sigue en Hoy hasta la entrega.'], ejemplo: 'Si se agrega un trabajo después del control, el sistema pide comprobar de nuevo y guarda el control anterior.' },
  { id: 'entrega', titulo: 'Registrar la entrega', pantallas: ['visita'], pasos: ['Con el auto listo, tocá «Registrar entrega».', 'Si quedó algo pendiente, confirmá que se lo explicaste al cliente.', 'Si queda saldo, el sistema lo avisa: confirmá «Entrega con saldo» y anotá lo acordado.', 'Entregar no marca pagado: el saldo sigue en la cuenta del cliente.'], ejemplo: 'Podés imprimir el resumen de entrega desde «Documentos de la visita».' },
  { id: 'cobro', titulo: 'Registrar un pago o una seña', pantallas: ['visita', 'cuentas', 'caja'], pasos: ['En la visita, entrá a «Cobros».', 'Antes de terminar podés registrar una seña (hasta lo autorizado).', 'Al terminar, tocá «Liquidar»: suma solo lo realizado, nunca lo postergado.', 'Registrá el pago con importe y medio. Si el botón no responde, no lo toques dos veces: el sistema evita duplicarlo.', 'Un pago mal cargado lo anula el dueño con un motivo; no se borra.'], ejemplo: 'Ejemplo ficticio: seña de $50.000 por transferencia.' },
  { id: 'vuelve', titulo: 'El auto vuelve por el mismo problema', pantallas: ['ficha', 'visita', 'recibir'], pasos: ['Abrí la ficha del auto o la visita anterior.', 'Tocá «Vuelve por el mismo problema».', 'Se crea una visita nueva vinculada a la anterior. La anterior no se modifica.', 'La garantía la decide el taller: el sistema no la aplica sola.'], ejemplo: '' },
  { id: 'pendientes', titulo: 'Avisar un próximo service o un trabajo pendiente', pantallas: ['pendientes', 'ficha'], pasos: ['En Pendientes, elegí el auto y tocá «Preparar aviso».', 'Revisá y editá el texto sugerido.', 'Tocá «Abrir WhatsApp» o copiá el texto para enviarlo vos.', 'Abrir WhatsApp no significa que se envió: cuando lo mandes, tocá «Ya lo envié».', 'Si el cliente responde, registralo.'], ejemplo: 'Los avisos automáticos necesitan una cuenta de WhatsApp o correo que todavía no está configurada.' },
  { id: 'turnos', titulo: 'Dar, confirmar o mover un turno', pantallas: ['agenda'], pasos: ['En Agenda, tocá «Nuevo turno», elegí día, hora y puesto.', 'Las solicitudes de la página pública aparecen arriba: confirmalas o cancelalas.', 'Para mover un turno, abrilo, cambiá la hora y confirmá.', 'Cuando llega el auto, tocá «Recibir este auto»: se crea la visita.'], ejemplo: 'Un turno no autoriza reparaciones.' },
  { id: 'compra', titulo: 'Registrar una compra de repuestos', pantallas: ['compras', 'stock', 'proveedores'], pasos: ['En Compras, tocá «Nueva compra» y elegí el proveedor.', 'Agregá los artículos con cantidad y costo.', 'Cargá el número de remito o factura: el sistema no deja cargar dos veces el mismo.', 'Tocá «Registrar recepción» cuando la mercadería está en el taller: entra al stock una sola vez.', 'Si después llega la factura de ese remito, agregala a la misma compra.'], ejemplo: 'El pago al proveedor se registra aparte.' },
  { id: 'venta', titulo: 'Vender en el mostrador', pantallas: ['mostrador'], pasos: ['En Mostrador, tocá «Nueva venta».', 'Agregá artículos del stock o escribí uno.', 'Registrá el cobro. Si queda saldo, elegí el cliente.', 'Imprimí el comprobante (no es factura fiscal).', 'Una devolución vuelve al stock y deja registrado el dinero devuelto.'], ejemplo: '' },
  { id: 'stock', titulo: 'Ver y corregir el stock', pantallas: ['stock'], pasos: ['La existencia cambia solo con movimientos: compras, colocaciones, ventas, devoluciones y ajustes.', 'Reservado es lo apartado para un trabajo que todavía no se colocó.', 'Para corregir después de contar, el dueño hace un ajuste con motivo.', 'Los artículos en rojo están en el mínimo o por debajo.'], ejemplo: '' },
  { id: 'documentos', titulo: 'Imprimir o compartir un presupuesto o informe', pantallas: ['visita', 'documento', 'archivo'], pasos: ['En la visita, entrá a «Documentos» y elegí qué preparar.', 'Se guarda una copia con fecha: aunque cambien precios o el logo, esa copia no cambia.', 'Imprimí o guardá como PDF desde el navegador.', 'Para compartir, creá un enlace con vencimiento: solo muestra ese documento.'], ejemplo: 'Los documentos no son facturas ni tienen validez fiscal.' },
  { id: 'usuarios', titulo: 'Invitar a una persona o quitarle el acceso', pantallas: ['ajustes'], pasos: ['En Ajustes → Usuarios, tocá «Invitar».', 'Escribí nombre, correo y perfil (recepción, mecánico o dueño).', 'Copiá el enlace y mandáselo por un medio seguro. Sirve una sola vez y vence.', 'Para quitar el acceso, tocá «Desactivar»: su sesión se cierra en el momento.'], ejemplo: 'Nunca mandes contraseñas por WhatsApp: el enlace permite que la persona cree la suya.' },
  { id: 'qr', titulo: 'Usar códigos QR', pantallas: ['qr', 'visita', 'ajustes'], pasos: ['Cada visita puede imprimir una etiqueta con QR para la llave.', 'Al leerla con el lector del panel se abre esa visita (solo para usuarios del taller).', 'Si la cámara no funciona, escribí el número de visita o la patente.', 'La página pública de turnos también tiene su QR para el mostrador.'], ejemplo: 'Un código que no es del panel no se abre.' },
  { id: 'biblioteca', titulo: 'Guardar manuales y diagramas', pantallas: ['biblioteca'], pasos: ['En Biblioteca técnica, tocá «Agregar documento».', 'Elegí el PDF o la imagen, poné un título y la marca/modelo si corresponde.', 'Indicá de dónde viene y confirmá que el taller tiene derecho a usarlo.', 'Después buscalo por palabra, marca o año.'], ejemplo: 'El sistema no incluye manuales de fábrica: guarda los que el taller ya tiene.' },
  { id: 'calculadora', titulo: 'Calcular la mano de obra', pantallas: ['calculadora', 'visita'], pasos: ['Elegí un trabajo con tiempo cargado o escribí las horas.', 'El cálculo usa el valor hora del taller (Ajustes).', 'Mirá los antecedentes del propio taller si existen.', 'Vos decidís el importe final antes de pasarlo al presupuesto.'], ejemplo: 'No es un precio de mercado ni un tiempo oficial.' },
  { id: 'respaldo', titulo: 'Respaldo y exportación de datos', pantallas: ['ajustes'], pasos: ['El dueño puede descargar todos los datos del taller en Ajustes → Datos.', 'El respaldo completo (base y archivos) lo hace quien administra el servidor con «npm run backup».', 'Guardá los respaldos fuera del servidor.', 'La restauración se prueba primero en una carpeta aparte.'], ejemplo: '' },
  { id: 'sin-conexion', titulo: 'Si se corta internet', pantallas: [], pasos: ['Si no hay conexión, el panel avisa que no se guardó.', 'Lo que escribiste queda en pantalla: no recargues.', 'Cuando vuelva internet, tocá de nuevo «Guardar».', 'El panel todavía no funciona sin conexión: es un pendiente a definir con el taller.'], ejemplo: '' }
];

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function buscarAyuda(q) {
  const t = norm(q);
  return ARTICULOS.filter((a) => norm([a.titulo, ...a.pasos, a.ejemplo].join(' ')).includes(t));
}
export function articuloHTML(a) {
  return `<article class="bloque"><h3>${esc(a.titulo)}</h3><ol class="ayuda-pasos">${a.pasos.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>${a.ejemplo ? `<p class="ayuda-ejemplo">${esc(a.ejemplo)}</p>` : ''}</article>`;
}

let abierto = null;
export function abrirAyuda(tema, app) {
  cerrarAyuda();
  const propios = ARTICULOS.filter((a) => a.pantallas.includes(app.pantalla));
  const primero = ARTICULOS.find((a) => a.id === tema);
  const lista = primero ? [primero, ...propios.filter((a) => a !== primero)] : (propios.length ? propios : ARTICULOS.slice(0, 4));
  const p = document.createElement('aside');
  p.className = 'panel-ayuda';
  p.setAttribute('role', 'dialog');
  p.setAttribute('aria-label', 'Ayuda');
  p.innerHTML = `<div class="fila"><h2>${icono('ayuda')} ¿Cómo hago…?</h2><button type="button" class="btn btn-chico" data-cerrar>${icono('x')}Cerrar</button></div>
    <div class="buscador">${icono('buscar')}<label class="sr" for="ayuda-q">Buscar en la ayuda</label><input id="ayuda-q" type="search" placeholder="Buscar: cobro, turno, repuesto…"></div>
    <div data-lista>${lista.map(articuloHTML).join('<hr style="border:0;border-top:1px solid var(--line)">')}</div>
    <p><a href="#/ayuda" data-cerrar-enlace>Ver toda la ayuda</a></p>`;
  document.body.appendChild(p);
  abierto = { p, previo: document.activeElement };
  const cerrar = () => cerrarAyuda();
  p.querySelector('[data-cerrar]').onclick = cerrar;
  p.querySelector('[data-cerrar-enlace]').onclick = cerrar;
  p.querySelector('#ayuda-q').addEventListener('input', (e) => {
    const r = e.target.value.trim().length >= 2 ? buscarAyuda(e.target.value) : lista;
    p.querySelector('[data-lista]').innerHTML = r.length ? r.map(articuloHTML).join('<hr style="border:0;border-top:1px solid var(--line)">') : '<p class="muted">No encontramos ayuda con esa palabra. Probá con otra (por ejemplo «cobro» o «turno»).</p>';
  });
  p.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
  p.querySelector('[data-cerrar]').focus();
  entrada(p, {tipo:'ayuda'});
}
export function cerrarAyuda() {
  if (!abierto) return;
  const anterior = abierto;
  abierto = null;
  if (anterior.previo?.isConnected) anterior.previo.focus({preventScroll:true});
  retirar(anterior.p, {tipo:'ayuda'});
}
