import { icono } from './ui.js?v=0.1.0';
const sistema = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
let abortar;
export function selectorTema() {
  return `<button type="button" class="selector-tema" data-tema-selector aria-label="Activar modo oscuro" title="Activar modo oscuro">${icono('luna')}</button>`;
}
export function aplicarTema(modo) {
  if (!['claro','oscuro','automatico'].includes(modo)) modo='automatico';
  const oscuro=modo==='oscuro'||(modo==='automatico'&&sistema?.matches);
  document.documentElement.dataset.tema=modo;
  document.documentElement.dataset.temaEfectivo=oscuro?'oscuro':'claro';
  document.documentElement.style.colorScheme=oscuro?'dark':'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',oscuro?'#161b21':'#f4f5f6');
  document.querySelectorAll('[data-tema-selector]').forEach(s=>{
    const accion=oscuro?'Activar modo claro':'Activar modo oscuro';
    s.setAttribute('aria-label',accion);
    s.setAttribute('title',accion);
    s.innerHTML=icono(oscuro?'sol':'luna');
  });
}
export function enlazarTema() {
  abortar?.abort(); abortar=new AbortController();
  aplicarTema(document.documentElement.dataset.tema || 'automatico');
  document.querySelectorAll('[data-tema-selector]').forEach(s=>s.addEventListener('click',()=>{
    const modo=document.documentElement.dataset.temaEfectivo==='oscuro'?'claro':'oscuro';
    aplicarTema(modo);
    try {localStorage.setItem('talleres-tema',modo);} catch { /* se conserva durante esta página */ }
  },{signal:abortar.signal}));
}
sistema?.addEventListener('change',()=>{if(document.documentElement.dataset.tema==='automatico')aplicarTema('automatico');});
if(typeof window!=='undefined') window.addEventListener('storage',e=>{if(e.key==='talleres-tema')aplicarTema(e.newValue||'automatico');});
