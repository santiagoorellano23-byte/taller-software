// Documento emitido: vista imprimible, enlace para compartir con vencimiento (y su QR), anulación con motivo.
import { get, post } from '../api.js?v=0.1.0';
import { esc, icono, fechaHora, campo, alEnviar, toast, confirmar, aviso, copiar } from '../ui.js?v=0.1.0';
import { renderDocumento, ESTILO_DOCUMENTO } from '../documento.js?v=0.1.0';
import { qrSVG } from '../qr-util.js?v=0.1.0';

export default async function documento({ params, app }) {
  const { documento: d } = await get(`/api/documentos/${params.id}`);
  const volver = d.refTipo === 'visita' ? `#/visitas/${d.refId}/archivos` : d.refTipo === 'venta' ? `#/mostrador/${d.refId}` : '#/archivo';
  const vigentes = d.enlaces.filter((e) => !e.revocado_at && e.expira > new Date().toISOString());
  return {
    titulo: `${d.contenido.titulo} N.º ${d.numero}`,
    html: `<div class="pagina" style="max-width:900px">
      <style>${ESTILO_DOCUMENTO}</style>
      <a class="volver no-imprimir" href="${volver}">${icono('izq')}Volver</a>
      <div class="cab no-imprimir"><h1 tabindex="-1">${esc(d.contenido.titulo)} N.º ${esc(d.numero)}</h1>
        <div class="acciones"><button type="button" class="btn btn-primario" data-imprimir>${icono('imprimir')}Imprimir o guardar PDF</button></div></div>
      ${d.anulado_at ? aviso(`<strong>Documento anulado</strong> ${esc(fechaHora(d.anulado_at))}: ${esc(d.anulado_motivo)}.`, 'rojo', 'ban') : ''}
      <div class="doc-marco">${renderDocumento(d.contenido)}</div>
      ${app.puede('documentos.compartir') && !d.anulado_at ? `<section class="panel panel__cuerpo bloque no-imprimir"><h2>Compartir con el cliente</h2>
        <p class="small muted">El enlace muestra solo este documento, vence y se puede desactivar. No da acceso al historial ni a otros datos.</p>
        <form class="form" id="f-enlace" novalidate data-sin-aviso><div class="fila-campos">${campo({ nombre: 'dias', etiqueta: 'Vigencia', tipo: 'select', opciones: [['3', '3 días'], ['7', '7 días'], ['15', '15 días'], ['30', '30 días']], valor: '7' })}</div><button class="btn" type="submit">${icono('enlace')}Crear enlace</button></form>
        <div data-enlace-nuevo></div>
        ${vigentes.length ? `<ul class="lista">${vigentes.map((e) => `<li class="fila"><span class="small">Enlace creado ${esc(fechaHora(e.creado_at))} · vence ${esc(fechaHora(e.expira))} · abierto ${e.accesos} vez/veces</span><button type="button" class="btn btn-chico btn-texto" data-revocar="${e.id}">Desactivar</button></li>`).join('')}</ul>` : ''}</section>` : ''}
      ${app.puede('documentos.anular') && !d.anulado_at ? `<p class="no-imprimir"><button type="button" class="btn btn-chico btn-peligro" data-anular>${icono('ban')}Anular documento</button></p>` : ''}
    </div>`,
    despues(raiz) {
      raiz.querySelector('[data-imprimir]').onclick = () => window.print();
      const f = raiz.querySelector('#f-enlace');
      if (f) alEnviar(f, async (x) => {
        if(d.contenido.hallazgos?.some(h=>h.foto)) {
          const r=await confirmar({titulo:'Compartir informe con fotos',texto:'El enlace incluirá las copias de fotos guardadas en este informe. Quien reciba el enlace podrá verlas hasta su vencimiento o desactivación.',efecto:'No da acceso a los archivos originales ni al historial del taller.',aceptar:'Crear enlace con fotos'});
          if(!r.ok)return false;
        }
        const r = await post(`/api/documentos/${d.id}/enlace`, { dias: Number(x.dias) });
        const url = r.url || location.origin + r.ruta;
        raiz.querySelector('[data-enlace-nuevo]').innerHTML = `<div class="bloque">${aviso('Enlace creado. Copialo y mandalo por el medio que prefieras.', 'verde', 'check')}<div class="campo"><label for="enl">Enlace</label><input id="enl" type="text" readonly value="${esc(url)}"></div>
          <div class="acciones"><button type="button" class="btn btn-chico" data-copiar>${icono('copiar')}Copiar enlace</button></div><div class="qr-caja">${qrSVG(url)}<p class="xs muted">Para mostrar desde el teléfono</p></div></div>`;
        raiz.querySelector('[data-copiar]').onclick = () => copiar(url);
      });
      raiz.querySelectorAll('[data-revocar]').forEach((b) => b.addEventListener('click', async () => {
        try { await post(`/api/enlaces/${b.dataset.revocar}/revocar`, {}); toast('Enlace desactivado.'); app.recargar(); } catch (e) { toast(e.message, { error: true }); }
      }));
      raiz.querySelector('[data-anular]')?.addEventListener('click', async () => {
        const r = await confirmar({ titulo: 'Anular el documento', texto: 'El documento queda guardado como anulado y sus enlaces dejan de funcionar.', aceptar: 'Anular', peligro: true, pedir: { etiqueta: 'Motivo' } });
        if (!r.ok) return;
        try { await post(`/api/documentos/${d.id}/anular`, { motivo: r.valor }); toast('Documento anulado.'); app.recargar(); } catch (e) { toast(e.message, { error: true }); }
      });
    }
  };
}
