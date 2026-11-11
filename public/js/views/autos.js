// Autos y clientes: búsqueda por patente, nombre o teléfono; alta de auto con datos mínimos.
import { get, post } from '../api.js?v=0.1.0';
import { esc, icono, patente, nombreAuto, fecha, campo, alEnviar, toast, confirmar } from '../ui.js?v=0.1.0';

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

export default async function autos({ app, query }) {
  const { vehiculos } = await get(`/api/vehiculos${query.archivados ? '?archivados=1' : ''}`);
  const puedeEditar = app.puede('vehiculos.editar');
  return {
    titulo: 'Autos y clientes',
    html: `<div class="pagina">
      <div class="cab"><div class="cab__titulo"><h1 tabindex="-1">Autos y clientes</h1></div>
        <div class="acciones"><button type="button" class="btn btn-chico btn-texto" data-ayuda="buscar">${icono('ayuda')}¿Cómo hago…?</button>
        ${app.puede('visita.recibir') ? `<a class="btn btn-primario" href="#/recibir">${icono('mas')}Recibir un auto</a>` : ''}</div></div>
      <section class="bloque" aria-labelledby="t-buscar">
        <h2 id="t-buscar" class="sr">Buscar</h2>
        <div class="buscador">${icono('buscar')}<label class="sr" for="autos-q">Buscar por patente, nombre o teléfono</label>
          <input id="autos-q" type="search" placeholder="Patente, nombre del cliente o teléfono" value="${esc(query.q || '')}" autocomplete="off"></div>
        <div class="resultados" data-resultados aria-live="polite"></div>
      </section>
      ${puedeEditar ? `<details class="mas" data-alta><summary>Agregar un auto sin recibirlo</summary><div class="mas__cuerpo">
        <form class="form" id="f-auto" novalidate>
          ${camposVehiculo()}
          <div class="fila-campos">${campo({ nombre: 'cnombre', etiqueta: 'Persona de contacto', placeholder: 'Nombre y apellido' })}${campo({ nombre: 'ctelefono', etiqueta: 'Teléfono', tipo: 'tel' })}</div>
          <div class="form-pie"><button class="btn btn-primario" type="submit">${icono('check')}Guardar auto</button></div>
        </form></div></details>` : ''}
      <section class="panel" aria-labelledby="t-recientes">
        <div class="panel__cab"><h2 id="t-recientes">${query.archivados ? 'Fichas archivadas' : 'Últimos autos atendidos'}</h2>
          ${app.puede('vehiculos.archivar') ? `<a class="small" href="#/autos${query.archivados ? '' : '?archivados=1'}">${query.archivados ? 'Ver fichas activas' : 'Ver fichas archivadas'}</a>` : ''}</div>
        ${vehiculos.length ? `<ul class="lista" style="margin-top:8px">${vehiculos.map((v) => `<li><a class="fila" href="#/autos/${v.id}" style="text-decoration:none;color:inherit"><span class="fila__izq">${patente(v.patente)}<span><strong>${nombreAuto(v)}</strong><br><span class="muted small">${esc(v.contacto || 'Sin contacto')}</span></span></span>
          <span class="muted small">${v.ultima_visita ? 'Última visita ' + esc(fecha(v.ultima_visita)) : 'Sin visitas'}</span></a></li>`).join('')}</ul>` : '<div class="panel__cuerpo"><p class="muted">Todavía no hay autos cargados.</p></div>'}
      </section>
    </div>`,
    despues(raiz) {
      const q = raiz.querySelector('#autos-q'), cont = raiz.querySelector('[data-resultados]');
      let t;
      const buscar = async () => {
        const v = q.value.trim();
        if (v.length < 2) { cont.innerHTML = ''; return; }
        try {
          const r = await get('/api/buscar?q=' + encodeURIComponent(v));
          cont.innerHTML = r.vehiculos.length ? r.vehiculos.map((x) => `<a class="resultado" href="#/autos/${x.id}">${patente(x.patente)}<span><strong>${nombreAuto(x)}</strong><br><span class="muted small">${esc(x.contacto || 'Sin contacto')}${x.telefono ? ' · ' + esc(x.telefono) : ''}</span></span>${x.visitaAbierta ? '<span class="estado estado--teal" style="margin-left:auto">En el taller</span>' : ''}${x.archivado ? '<span class="estado">Archivada</span>' : ''}</a>`).join('')
            : `<p class="muted">No encontramos «${esc(v)}». ${app.puede('visita.recibir') ? `<a href="#/recibir?patente=${encodeURIComponent(v)}">Recibir un auto nuevo con esa patente</a>` : ''}</p>`;
        } catch (e) { cont.innerHTML = `<p class="aviso aviso--rojo">${esc(e.message)}</p>`; }
      };
      q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(buscar, 220); });
      if (q.value) buscar();
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
