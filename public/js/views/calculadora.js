// Calculadora de mano de obra: horas × valor hora del taller, con antecedentes propios. Funciona sin IA.
import { get } from '../api.js?v=0.1.0';
import { esc, icono, pesos, cant, fecha, campo, aviso, copiar, aEntradaDinero } from '../ui.js?v=0.1.0';

export default async function calculadora({ query, app }) {
  const cat = await get('/api/catalogos');
  const q = new URLSearchParams();
  for (const k of ['plantillaId', 'horas', 'valorHora', 'descripcion']) if (query[k]) q.set(k, query[k]);
  const r = await get('/api/calculadora?' + q);
  const trabajos = cat.trabajos.filter((t) => t.activo);
  return {
    titulo: 'Calculadora de mano de obra',
    html: `<div class="pagina" style="max-width:860px">
      <a class="volver" href="#/mas">${icono('izq')}Más funciones</a>
      <div class="cab"><h1 tabindex="-1">Calculadora de mano de obra</h1><button type="button" class="btn btn-chico btn-texto" data-ayuda="calculadora">${icono('ayuda')}¿Cómo hago…?</button></div>
      <form class="form panel panel__cuerpo" id="f-calc" data-sin-aviso>
        ${campo({ nombre: 'plantillaId', etiqueta: 'Trabajo con tiempo cargado', tipo: 'select', valor: query.plantillaId || '', opciones: [['', 'Elegí un trabajo o escribí las horas'], ...trabajos.map((t) => [t.id, `${t.nombre} · ${cant(t.horas_m, 'h')}`])] })}
        <div class="fila-campos">${campo({ nombre: 'horas', etiqueta: 'Horas', valor: query.horas || '', attrs: 'inputmode="decimal"', placeholder: 'Ej.: 2,5' })}${campo({ nombre: 'valorHora', etiqueta: 'Valor de la hora', valor: query.valorHora || aEntradaDinero(r.valorHora), attrs: 'inputmode="decimal"', ayuda: 'Por defecto, el del taller (Ajustes).' })}${campo({ nombre: 'descripcion', etiqueta: 'Buscar antecedentes por nombre', valor: query.descripcion || '' })}</div>
        <button class="btn btn-oscuro" type="submit">${icono('calculadora')}Calcular</button></form>
      ${r.faltante ? aviso(esc(r.faltante), 'ambar', 'info') : `<section class="panel panel__cuerpo bloque"><h2>Resultado</h2>
        <p><span class="num">${esc(cant(r.horas_m, 'h'))}</span> × <span class="num">${pesos(r.valorHora)}</span> = <b class="num" style="font-family:var(--fc);font-size:34px">${pesos(r.resultado)}</b></p>
        <div class="acciones"><button type="button" class="btn btn-chico" data-copiar>${icono('copiar')}Copiar importe</button></div>
        <p class="small muted">${esc(r.aviso)}</p></section>`}
      <section class="panel panel__cuerpo bloque"><h2>Antecedentes del taller</h2>
        ${r.antecedentes.length ? `<p>Promedio de ${r.antecedentes.length} trabajo(s) realizado(s): <strong class="num">${pesos(r.promedioAntecedentes)}</strong></p><ul class="lista">${r.antecedentes.map((a) => `<li class="fila"><span>${esc(a.descripcion)} · visita N.º ${esc(a.numero)} · ${esc(fecha(a.ingreso_at))}</span><strong class="num">${pesos(a.importe)}</strong></li>`).join('')}</ul>` : '<p class="muted">No hay trabajos parecidos realizados en este taller. El cálculo usa solo horas y valor hora.</p>'}</section>
      ${aviso('La estimación asistida por IA está inactiva: necesita un proveedor y datos suficientes. Esta calculadora no usa IA.', 'gris', 'info')}
    </div>`,
    despues(raiz) {
      const f = raiz.querySelector('#f-calc');
      f.plantillaId.addEventListener('change', () => { const t = trabajos.find((x) => x.id === Number(f.plantillaId.value)); if (t) { f.horas.value = String(t.horas_m / 1000).replace('.', ','); f.descripcion.value = t.nombre; } });
      f.addEventListener('submit', (e) => { e.preventDefault(); const p = new URLSearchParams(); for (const k of ['plantillaId', 'horas', 'valorHora', 'descripcion']) if (f[k].value) p.set(k, f[k].value); app.ir('#/calculadora?' + p); });
      raiz.querySelector('[data-copiar]')?.addEventListener('click', () => copiar(String((r.resultado / 100).toFixed(0))));
    }
  };
}
