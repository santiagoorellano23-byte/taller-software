// Autos y clientes: búsqueda por patente, nombre o teléfono; alta de auto con datos mínimos.
import { get, post } from '../api.js?v=0.1.0';
import { esc, fecha, campo, alEnviar, toast, confirmar } from '../ui.js?v=0.1.0';
import { ic, placa, logoMarca, ibtn, vacioD } from '../diseno.js?v=0.1.0';

export function opcionesMarcas() {
  const c = window.TALLERES_CATALOGOS || { marcas: [], modelos: {} };
  return `<datalist id="dl-marcas">${c.marcas.map((m) => `<option value="${esc(m)}">`).join('')}</datalist>`;
}
export function enlazarModelos(form) {
  const c = window.TALLERES_CATALOGOS || { modelos: {} };
  const marca = form.querySelector('[name="marca"]'), dl = form.querySelector('#dl-modelos');
  if (!marca || !dl) return;
  const act = () => { dl.innerHTML = (c.modelos[marca.value] || []).map((m) => `<option value="${esc(m)}">`).join(''); };
  marca.addEventListener('input', act);
  act();
}
export function camposVehiculo(v = {}) {
  return `${opcionesMarcas()}<datalist id="dl-modelos"></datalist>
    <div class="fila-campos">
      ${campo({ nombre: 'patente', etiqueta: 'Patente', requerido: true, valor: v.patente || '', ayuda: 'Con o sin espacios. Si no tiene, escribí una referencia.', attrs: 'autocapitalize="characters" spellcheck="false"' })}
      ${campo({ nombre: 'marca', etiqueta: 'Marca', valor: v.marca || '', attrs: 'list="dl-marcas"' })}
      ${campo({ nombre: 'modelo', etiqueta: 'Modelo', valor: v.modelo || '', attrs: 'list="dl-modelos"' })}
    </div>
    <details class="mas"><summary>Más datos del auto (opcional)</summary><div class="mas__cuerpo"><div class="fila-campos">
      ${campo({ nombre: 'version_txt', etiqueta: 'Versión o motor', valor: v.version_txt || '', placeholder: 'Ej.: XLS 1.5' })}
      ${campo({ nombre: 'anio', etiqueta: 'Año', valor: v.anio || '', attrs: 'inputmode="numeric" maxlength="4"' })}
      ${campo({ nombre: 'combustible', etiqueta: 'Combustible', tipo: 'select', valor: v.combustible || '', opciones: [['', 'Sin indicar'], ...(window.TALLERES_CATALOGOS?.combustibles || []).map((x) => [x, x])] })}
      ${campo({ nombre: 'color', etiqueta: 'Color', valor: v.color || '' })}
      ${campo({ nombre: 'vin', etiqueta: 'N.º de chasis (VIN)', valor: v.vin || '', ayuda: 'No hace falta para recibir el auto.', attrs: 'spellcheck="false"' })}
    </div>${campo({ nombre: 'notas', etiqueta: 'Notas del auto', tipo: 'textarea', valor: v.notas || '' })}</div></details>`;
}

const filaAuto = (v) => `<a class="orden-f" href="#/autos/${v.id}">${logoMarca(v.marca)}<span class="t-id">${placa(v.patente)}<span class="t-mod"><b>${esc(v.contacto || 'Sin contacto')}</b><small>${esc([v.marca, v.modelo].filter(Boolean).join(' ') || 'Vehículo sin datos')}${v.telefono ? ' · ' + esc(v.telefono) : ''}</small></span></span>
  <span class="of-r">${v.visitaAbierta ? `<span class="chip info">En el taller${v.visitaAbierta.numero ? ' · N.º ' + esc(v.visitaAbierta.numero) : ''}</span>` : v.ultima_visita ? `<small>Última visita ${esc(fecha(v.ultima_visita))}</small>` : '<small class="sindato">Sin visitas</small>'}${v.archivado ? '<span class="chip">Archivada</span>' : ''}</span>${ic('chevron_right', 'chev')}</a>`;

export default async function autos({ app, query }) {
  const { vehiculos } = await get(`/api/vehiculos${query.archivados ? '?archivados=1' : ''}`);
  const puedeEditar = app.puede('vehiculos.editar');
  const lista = query.archivados ? vehiculos : vehiculos.slice().sort((a, b) => Number(!!b.visitaAbierta) - Number(!!a.visitaAbierta));
  return {
    titulo: 'Autos y clientes',
    html: `<header class="a-cab"><div class="a-tit"><h1 tabindex="-1">Autos y clientes</h1></div><div class="a-cab-acc">${ibtn('help', 'Ayuda', { attrs: 'data-ayuda="buscar"' })}</div></header>
      <div class="buscador-d">${ic('search')}<label class="sr" for="autos-q">Buscar por patente, nombre o teléfono</label><input id="autos-q" type="search" placeholder="Patente, nombre o teléfono" value="${esc(query.q || '')}" autocomplete="off" enterkeyhint="search"></div>
      <div class="accesos">${app.puede('visita.recibir') ? `<a class="acceso prim" href="#/recibir">${ic('add')}<span>Recibir un auto</span></a>` : ''}${puedeEditar ? `<button type="button" class="acceso" data-abrir-alta aria-controls="alta-auto">${ic('directions_car')}<span>Agregar un auto sin recibirlo</span></button>` : ''}</div>
      ${puedeEditar ? `<details class="desp" id="alta-auto" data-alta><summary>${ic('directions_car')}Agregar un auto sin recibirlo</summary><div class="desp-c">
        <form class="form" id="f-auto" novalidate>
          ${camposVehiculo()}
          <div class="fila-campos">${campo({ nombre: 'cnombre', etiqueta: 'Persona de contacto', placeholder: 'Nombre y apellido' })}${campo({ nombre: 'ctelefono', etiqueta: 'Teléfono', tipo: 'tel' })}</div>
          <div class="form-pie"><button class="btn btn-primario" type="submit">${ic('check')}Guardar auto</button></div>
        </form></div></details>` : ''}
      <section class="grupo-o" data-resultados-grupo hidden aria-live="polite"><h2>Resultados<span data-resultados-n></span></h2><div class="grupo-o" data-resultados></div></section>
      <section class="grupo-o" data-recientes><h2>${query.archivados ? 'Fichas archivadas' : 'Autos'}<span>${lista.length}</span></h2>
        ${lista.length ? lista.map(filaAuto).join('') : vacioD('directions_car', 'Todavía no hay autos cargados', 'Cuando recibas un auto, queda su ficha acá.')}</section>
      ${app.puede('vehiculos.archivar') ? `<p><a class="btn btn-texto" href="#/autos${query.archivados ? '' : '?archivados=1'}">${query.archivados ? 'Ver fichas activas' : 'Ver fichas archivadas'}</a></p>` : ''}`,
    despues(raiz) {
      const q = raiz.querySelector('#autos-q'), cont = raiz.querySelector('[data-resultados]'), grupo = raiz.querySelector('[data-resultados-grupo]'), recientes = raiz.querySelector('[data-recientes]');
      let t, turno = 0;
      const buscar = async () => {
        const v = q.value.trim(), mio = ++turno;
        if (v.length < 2) { grupo.hidden = true; recientes.hidden = false; cont.innerHTML = ''; return; }
        try {
          const r = await get('/api/buscar?q=' + encodeURIComponent(v));
          if (mio !== turno) return; // una respuesta vieja no pisa la búsqueda actual
          grupo.hidden = false; recientes.hidden = true;
          raiz.querySelector('[data-resultados-n]').textContent = r.vehiculos.length;
          cont.innerHTML = r.vehiculos.length ? r.vehiculos.map(filaAuto).join('')
            : vacioD('person_search', `Sin resultados para «${v}»`, 'Probá con la patente, el nombre o el teléfono.', app.puede('visita.recibir') ? `<a class="btn btn-primario" href="#/recibir?patente=${encodeURIComponent(v)}">${ic('add')}Recibir un auto nuevo con esa patente</a>` : '');
        } catch (e) { cont.innerHTML = `<p class="aviso-in err">${ic('error')}<span>${esc(e.message)}</span></p>`; grupo.hidden = false; }
      };
      q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(buscar, 220); });
      if (q.value) buscar();
      raiz.querySelector('[data-abrir-alta]')?.addEventListener('click', () => { const d = raiz.querySelector('[data-alta]'); d.open = true; d.querySelector('input')?.focus(); });
      const f = raiz.querySelector('#f-auto');
      if (f) {
        enlazarModelos(f);
        alEnviar(f, async (d) => {
          const cuerpo = { patente: d.patente, marca: d.marca, modelo: d.modelo, version_txt: d.version_txt, anio: d.anio, combustible: d.combustible, color: d.color, vin: d.vin, notas: d.notas, contacto: d.cnombre ? { nombre: d.cnombre, telefono: d.ctelefono } : null };
          try {
            const r = await post('/api/vehiculos', cuerpo);
            toast('Auto guardado.');
            app.ir('#/autos/' + r.id);
          } catch (e) {
            if (e.estado === 409 && e.datos.duplicados) {
              const r = await confirmar({ titulo: 'Ya hay un auto con esa patente', texto: `En este taller existe: ${e.datos.duplicados.map((x) => esc(x.patente + ' ' + (x.marca || '') + ' ' + (x.modelo || ''))).join(', ')}.`, efecto: 'Si es el mismo auto, abrí esa ficha. Crear otra ficha no une los historiales.', aceptar: 'Es otro auto: crear ficha' });
              if (!r.ok) { app.ir('#/autos/' + e.datos.duplicados[0].id); return; }
              const r2 = await post('/api/vehiculos', { ...cuerpo, confirmarDuplicado: true });
              app.ir('#/autos/' + r2.id);
              return;
            }
            throw e;
          }
        });
      }
    }
  };
}
