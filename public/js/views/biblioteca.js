// Biblioteca técnica propia: manuales, diagramas y apuntes que el taller tiene derecho a usar.
import { get, api, post } from '../api.js?v=0.1.0';
import { esc, icono, fecha, campo, casilla, alEnviar, toast, confirmar, aviso } from '../ui.js?v=0.1.0';

export default async function biblioteca({ query, app }) {
  const q = new URLSearchParams();
  for (const k of ['q', 'marca', 'anio']) if (query[k]) q.set(k, query[k]);
  const { documentos } = await get('/api/biblioteca?' + q);
  const marcas = window.TALLERES_CATALOGOS?.marcas || [];
  return {
    titulo: 'Biblioteca técnica',
    html: `<div class="pagina">
      <a class="volver" href="#/mas">${icono('izq')}Más funciones</a>
      <div class="cab"><h1 tabindex="-1">Biblioteca técnica</h1><button type="button" class="btn btn-chico btn-texto" data-ayuda="biblioteca">${icono('ayuda')}¿Cómo hago…?</button></div>
      ${aviso('Guarda el material propio del taller. No incluye manuales de fábrica: solo lo que el taller tiene derecho a usar.', 'gris', 'libro')}
      <form class="form" id="f-bus" data-sin-aviso><div class="fila-campos">
        <div class="buscador">${icono('buscar')}<label class="sr" for="bib-q">Buscar</label><input id="bib-q" name="q" type="search" value="${esc(query.q || '')}" placeholder="Palabra, sistema, modelo…"></div>
        ${campo({ nombre: 'marca', etiqueta: 'Marca', valor: query.marca || '', attrs: 'list="dl-bmarcas"' })}${campo({ nombre: 'anio', etiqueta: 'Año del auto', valor: query.anio || '', attrs: 'inputmode="numeric"' })}</div>
        <datalist id="dl-bmarcas">${marcas.map((m) => `<option value="${esc(m)}">`).join('')}</datalist><button class="btn btn-chico btn-oscuro" type="submit">Buscar</button></form>
      ${documentos.length ? `<div class="panel"><ul class="lista">${documentos.map((d) => `<li><div class="fila"><a href="/api/adjuntos/${d.adjunto_id}" target="_blank" rel="noopener"><strong>${esc(d.titulo)}</strong></a><span class="muted small">${esc(d.mime === 'application/pdf' ? 'PDF' : 'Imagen')} · ${Math.round(d.bytes / 1024)} KB</span></div>
        <p class="small">${esc([d.marca, d.modelo, d.sistema].filter(Boolean).join(' · ') || 'Sin clasificar')}${d.anio_desde || d.anio_hasta ? ` · años ${d.anio_desde || '…'}–${d.anio_hasta || '…'}` : ''}${d.version_doc ? ' · versión ' + esc(d.version_doc) : ''}</p>
        <p class="xs muted">Procedencia: ${esc(d.procedencia)} · ${esc(d.derechos)} · ${esc(fecha(d.creado_at))}</p>
        ${app.puede('config.taller') ? `<button type="button" class="btn btn-chico btn-texto" data-archivar="${d.id}">Archivar</button>` : ''}</li>`).join('')}</ul></div>` : '<div class="vacio"><p>No hay documentos que coincidan.</p></div>'}
      ${app.puede('biblioteca.cargar') ? `<details class="mas"><summary>Agregar documento</summary><div class="mas__cuerpo"><form class="form" id="f-bib" novalidate>
        <div class="campo" data-campo="archivo"><label for="bib-arch">Archivo (PDF o imagen, hasta 15 MB)</label><input id="bib-arch" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required></div>
        ${campo({ nombre: 'titulo', etiqueta: 'Título', requerido: true, placeholder: 'Ej.: Diagrama de inyección Etios 1.5' })}
        <div class="fila-campos">${campo({ nombre: 'marca', etiqueta: 'Marca', attrs: 'list="dl-bmarcas"' })}${campo({ nombre: 'modelo', etiqueta: 'Modelo' })}${campo({ nombre: 'sistema', etiqueta: 'Sistema', placeholder: 'Frenos, inyección…' })}</div>
        <div class="fila-campos">${campo({ nombre: 'anioDesde', etiqueta: 'Año desde', attrs: 'inputmode="numeric"' })}${campo({ nombre: 'anioHasta', etiqueta: 'Año hasta', attrs: 'inputmode="numeric"' })}${campo({ nombre: 'version', etiqueta: 'Versión del documento' })}</div>
        ${campo({ nombre: 'procedencia', etiqueta: 'De dónde viene', requerido: true, placeholder: 'Manual entregado por el fabricante, apunte propio, curso…' })}
        ${campo({ nombre: 'etiquetas', etiqueta: 'Palabras para encontrarlo' })}
        ${casilla('derechos', 'Confirmo que el taller tiene derecho a guardar y usar este material')}
        <button class="btn btn-primario" type="submit">${icono('subir')}Guardar en la biblioteca</button></form></div></details>` : ''}
    </div>`,
    despues(raiz) {
      raiz.querySelector('#f-bus').addEventListener('submit', (e) => { e.preventDefault(); const f = e.target; app.ir(`#/biblioteca?q=${encodeURIComponent(f.q.value)}&marca=${encodeURIComponent(f.marca.value)}&anio=${encodeURIComponent(f.anio.value)}`); });
      const f = raiz.querySelector('#f-bib');
      if (f) alEnviar(f, async (d) => {
        const archivo = f.querySelector('#bib-arch').files[0];
        if (!archivo) throw Object.assign(new Error('Elegí el archivo.'), { campo: 'archivo' });
        const p = new URLSearchParams({ titulo: d.titulo, marca: d.marca, modelo: d.modelo, sistema: d.sistema, anioDesde: d.anioDesde, anioHasta: d.anioHasta, version: d.version, procedencia: d.procedencia, etiquetas: d.etiquetas, derechos: d.derechos ? '1' : '0' });
        await api('POST', '/api/biblioteca?' + p, undefined, { archivo, cabeceras: { 'X-Nombre-Archivo': encodeURIComponent(archivo.name) } });
        toast('Documento guardado en la biblioteca.');
        app.recargar();
      });
      raiz.querySelectorAll('[data-archivar]').forEach((b) => b.addEventListener('click', async () => {
        const r = await confirmar({ titulo: 'Archivar documento', texto: 'Deja de aparecer en la biblioteca. No se borra.', aceptar: 'Archivar', pedir: { etiqueta: 'Motivo' } });
        if (r.ok) try { await post(`/api/biblioteca/${b.dataset.archivar}/archivar`, { motivo: r.valor }); toast('Documento archivado.'); app.recargar(); } catch (e) { toast(e.message, { error: true }); }
      }));
    }
  };
}
