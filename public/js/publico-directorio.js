// Directorio voluntario de talleres del producto.
import { api } from './api.js?v=0.1.0';
import { esc } from './ui.js?v=0.1.0';

const main = document.getElementById('contenido');
try {
  const { talleres } = await api('GET', '/api/publico/directorio');
  main.innerHTML = talleres.length ? `<div class="grupos" style="grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr))">${talleres.map((t) => `<a class="tarjeta-taller" href="/t/${esc(t.slug)}">${t.tieneLogo ? `<img src="/publico/logo/${esc(t.slug)}" alt="" style="max-height:48px;max-width:160px">` : ''}<strong style="font-size:1.15rem">${esc(t.nombre)}</strong>${t.localidad ? `<span class="muted">${esc(t.localidad)}</span>` : ''}${t.servicios.length ? `<span class="small">${t.servicios.map(esc).join(' · ')}</span>` : ''}</a>`).join('')}</div>` : '<p>Todavía no hay talleres en el listado.</p>';
} catch (e) {
  main.innerHTML = `<p>No se pudo cargar el listado: ${esc(e.message)}</p>`;
}
