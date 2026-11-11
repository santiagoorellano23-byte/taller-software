// Leer QR (cámara o imagen, si el navegador lo permite) con alternativa manual. Generar el QR de la página pública.
import { get } from '../api.js?v=0.1.0';
import { esc, icono, aviso, toast } from '../ui.js?v=0.1.0';
import { qrSVG, lectorDisponible, interpretarCodigo } from '../qr-util.js?v=0.1.0';

export default async function qr({ app }) {
  const t = app.sesion.taller;
  const seguro = window.isSecureContext;
  const hayLector = lectorDisponible();
  return {
    titulo: 'Leer o generar QR',
    html: `<div class="pagina" style="max-width:860px">
      <a class="volver" href="#/mas">${icono('izq')}Más funciones</a>
      <div class="cab"><h1 tabindex="-1">Leer o generar QR</h1><button type="button" class="btn btn-chico btn-texto" data-ayuda="qr">${icono('ayuda')}¿Cómo hago…?</button></div>
      <section class="panel panel__cuerpo bloque" aria-labelledby="t-leer"><h2 id="t-leer">Leer la etiqueta de una llave</h2>
        ${!hayLector ? aviso('Este navegador no puede leer códigos QR por sí solo. Escribí el número de visita o la patente abajo.', 'gris', 'info') : !seguro ? aviso('La cámara solo funciona si el panel se abre con https. Mientras tanto, escribí el número de visita o la patente.', 'ambar', 'alerta') : ''}
        ${hayLector ? `<div class="acciones">${seguro ? `<button type="button" class="btn btn-oscuro" data-camara>${icono('camara')}Usar la cámara</button>` : ''}
          <label class="btn">${icono('foto')}Leer desde una foto<input type="file" accept="image/*" data-imagen class="sr"></label></div>
          <video class="video-qr" data-video playsinline muted hidden></video>` : ''}
        <form class="form" id="f-manual" data-sin-aviso><div class="campo"><label for="qr-manual">Número de visita o patente</label><input id="qr-manual" type="text" autocomplete="off" placeholder="Ej.: 3 o AE482KJ"></div><button class="btn btn-primario" type="submit">Buscar</button></form>
        <div data-resultado aria-live="polite"></div>
        <p class="muted small">Solo se abren códigos del propio panel y para usuarios de este taller. Un código ajeno se muestra como texto y no se abre.</p></section>
      ${t.publico ? `<section class="panel panel__cuerpo bloque"><h2>QR de la página pública del taller</h2><div class="qr-caja">${qrSVG(location.origin + '/t/' + t.slug)}<p class="small">${esc(location.origin + '/t/' + t.slug)}</p></div>
        <p class="muted small">Muestra datos públicos del taller y, si está habilitado, el pedido de turnos. No expone clientes ni historiales.</p><div class="acciones"><button type="button" class="btn btn-chico" data-imprimir>${icono('imprimir')}Imprimir</button></div></section>` : aviso('La página pública del taller está desactivada. Se activa en Ajustes del taller.', 'gris')}
    </div>`,
    despues(raiz) {
      const res = raiz.querySelector('[data-resultado]');
      async function resolver(texto) {
        const r = interpretarCodigo(texto);
        if (r.ruta) return app.ir(r.ruta);
        if (r.externo) { res.innerHTML = aviso(`Es la página pública de un taller: <a href="${esc(r.externo)}">${esc(r.externo)}</a>`, 'gris'); return; }
        if (r.numeroVisita) {
          try { const v = await get(`/api/visitas/numero/${r.numeroVisita}`); return app.ir('#/visitas/' + v.id); } catch (e) { res.innerHTML = aviso(esc(e.message), 'ambar'); return; }
        }
        if (r.patente) {
          const b = await get('/api/buscar?q=' + encodeURIComponent(r.patente)).catch(() => ({ vehiculos: [] }));
          if (b.vehiculos.length === 1) return app.ir(b.vehiculos[0].visitaAbierta ? '#/visitas/' + b.vehiculos[0].visitaAbierta.id : '#/autos/' + b.vehiculos[0].id);
          res.innerHTML = b.vehiculos.length ? `<ul class="lista panel">${b.vehiculos.map((x) => `<li><a href="#/autos/${x.id}">${esc(x.patente)} · ${esc([x.marca, x.modelo].filter(Boolean).join(' '))}</a></li>`).join('')}</ul>` : aviso('No encontramos ese auto en este taller.', 'ambar');
          return;
        }
        res.innerHTML = aviso(`Este código no pertenece al panel y no se abre. Contenido: <code>${esc(String(r.ajeno || r.error).slice(0, 200))}</code>`, 'ambar', 'alerta');
      }
      raiz.querySelector('#f-manual').addEventListener('submit', (e) => { e.preventDefault(); resolver(raiz.querySelector('#qr-manual').value); });
      raiz.querySelector('[data-imprimir]')?.addEventListener('click', () => window.print());
      if (!lectorDisponible()) return;
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      raiz.querySelector('[data-imagen]')?.addEventListener('change', async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try {
          const bmp = await createImageBitmap(f);
          const c = await detector.detect(bmp);
          if (c[0]) resolver(c[0].rawValue); else res.innerHTML = aviso('No encontramos un código QR en la foto. Probá con otra más nítida o escribí el número.', 'ambar');
        } catch { res.innerHTML = aviso('No se pudo leer la imagen. Escribí el número de visita o la patente.', 'ambar'); }
      });
      raiz.querySelector('[data-camara]')?.addEventListener('click', async () => {
        const video = raiz.querySelector('[data-video]');
        let stream;
        try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); } catch {
          res.innerHTML = aviso('No se pudo usar la cámara (permiso denegado o sin cámara). Escribí el número de visita o la patente.', 'ambar', 'alerta');
          return;
        }
        video.hidden = false; video.srcObject = stream; await video.play();
        const parar = () => { stream.getTracks().forEach((x) => x.stop()); video.hidden = true; window.removeEventListener('hashchange', parar); };
        window.addEventListener('hashchange', parar);
        const ciclo = async () => {
          if (video.hidden) return;
          try { const c = await detector.detect(video); if (c[0]) { parar(); toast('Código leído.'); return resolver(c[0].rawValue); } } catch { /* sigue intentando */ }
          requestAnimationFrame(ciclo);
        };
        ciclo();
      });
    }
  };
}
