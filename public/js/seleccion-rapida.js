// Clasificaciones de presentación, sin diagnosticar ni cambiar estados de negocio.
export const normalizar = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const MOTIVOS_RAPIDOS = [
  {id:'service',nombre:'Service',icono:'service',texto:'Service / mantenimiento'},
  {id:'arranque',nombre:'No arranca',icono:'arranque',texto:'No arranca'},
  {id:'ruido',nombre:'Ruido / vibración',icono:'ruido',texto:'Ruido o vibración (a precisar)'},
  {id:'perdida',nombre:'Pérdida de fluidos',icono:'fluido',texto:'Pérdida de fluidos (a precisar)'},
  {id:'frenos',nombre:'Frenos',icono:'frenos',texto:'Frena mal o hace ruido al frenar'},
  {id:'otro',nombre:'Otro motivo',icono:'lapiz',texto:''}
];
export const CATEGORIAS = [
  {id:'service',nombre:'Service',icono:'service',patron:/service|mantenimiento|filtro|aceite|lubric/},
  {id:'frenos',nombre:'Frenos',icono:'frenos',patron:/freno|pastilla|disco|caliper|balata/},
  {id:'diagnostico',nombre:'Diagnóstico',icono:'buscar',patron:/revision|diagnos|escan|prueba|ruido/},
  {id:'suspension',nombre:'Suspensión',icono:'suspension',patron:/amortiguador|suspension|buje|rotula|direccion|estabiliz/},
  {id:'electricidad',nombre:'Electricidad',icono:'arranque',patron:/electric|bateria|alternador|arranque|luz|lampara/},
  {id:'otros',nombre:'Otros',icono:'llave'}
];
export function categoriaDe(nombre) { return CATEGORIAS.find(c=>c.patron?.test(normalizar(nombre))) || CATEGORIAS.at(-1); }
export function categoriasPresentes(items) { const ids=new Set(items.map(x=>categoriaDe(x.nombre).id));return CATEGORIAS.filter(c=>ids.has(c.id)); }
export function anexarMotivo(actual,propuesto) {
  if(!propuesto||normalizar(actual).includes(normalizar(propuesto)))return actual;
  return actual.trim()?actual.trimEnd()+(actual.trimEnd().endsWith('.')?' ':'. ')+propuesto:propuesto;
}
// Solo los servicios, artículos y tiempos que realmente configuró este taller.
export function opcionesPresupuesto(cat) {
  const servicio=(cat.servicios||[]).filter(x=>x.activo).map(x=>({clave:'servicio-'+x.id,nombre:x.nombre,fuente:'Servicio del taller',tipo:'mano_obra',cantidad:'1',unidad:'u.',precio:x.precio??null}));
  const trabajo=(cat.trabajos||[]).filter(x=>x.activo).map(x=>({clave:'trabajo-'+x.id,nombre:x.nombre,fuente:'Tiempo del taller',tipo:'mano_obra',cantidad:String(x.horas_m/1000).replace('.',','),unidad:'h',precio:cat.valorHora??null}));
  const articulo=(cat.articulos||[]).filter(x=>x.activo).map(x=>({clave:'articulo-'+x.id,nombre:x.nombre,fuente:'Repuesto · verificar aplicación',tipo:'repuesto',cantidad:'1',unidad:x.unidad,precio:x.precio_venta??null}));
  return [...servicio,...trabajo,...articulo];
}
