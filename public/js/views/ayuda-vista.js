// Ayuda: buscador y artículos por tarea.
import { esc, icono } from '../ui.js?v=0.1.0';
import { ARTICULOS, articuloHTML, buscarAyuda } from '../ayuda.js?v=0.1.0';

export default async function ayudaVista({ params }) {
  const a = params.id ? ARTICULOS.find((x) => x.id === params.id) : null;
  return {
    titulo: a ? a.titulo : 'Ayuda',
    html: `<div class="pagina" style="max-width:860px">
      <a class="volver" href="${a ? '#/ayuda' : '#/mas'}">${icono('izq')}${a ? 'Toda la ayuda' : 'Más funciones'}</a>
      <div class="cab"><h1 tabindex="-1">${a ? esc(a.titulo) : '¿Cómo hago…?'}</h1></div>
      ${a ? `<div class="panel panel__cuerpo">${articuloHTML(a)}</div>` : `
        <div class="buscador">${icono('buscar')}<label class="sr" for="ay-q">Buscar en la ayuda</label><input id="ay-q" type="search" placeholder="Escribí una palabra: cobro, turno, repuesto, contraseña…"></div>
        <div class="panel"><ul class="lista" data-lista>${ARTICULOS.map((x) => `<li><a href="#/ayuda/${x.id}"><strong>${esc(x.titulo)}</strong></a><span class="muted small">${esc(x.pasos[0])}</span></li>`).join('')}</ul></div>
        <p class="muted small">Los ejemplos usan datos ficticios. Esta ayuda está escrita para el panel y funciona sin conexión a servicios de IA.</p>`}
    </div>`,
    despues(raiz) {
      const q = raiz.querySelector('#ay-q');
      if (!q) return;
      q.addEventListener('input', () => {
        const r = q.value.trim().length >= 2 ? buscarAyuda(q.value) : ARTICULOS;
        raiz.querySelector('[data-lista]').innerHTML = r.length ? r.map((x) => `<li><a href="#/ayuda/${x.id}"><strong>${esc(x.titulo)}</strong></a><span class="muted small">${esc(x.pasos[0])}</span></li>`).join('') : '<li class="muted">No encontramos ayuda con esa palabra.</li>';
      });
    }
  };
}
