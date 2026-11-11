// Invitación o recuperación: el token viaja en el fragmento (#), que el navegador no envía en enlaces ni registros.
import { api } from './api.js?v=0.1.0';
import { esc, campo, alEnviar, icono } from './ui.js?v=0.1.0';

const caja = document.getElementById('caja');
const token = location.hash.slice(1);
history.replaceState(null, '', location.pathname); // saca el token de la barra de direcciones

async function iniciar() {
  if (!token) { caja.innerHTML = '<h1>Enlace incompleto</h1><p>Abrí el enlace completo que te mandó el dueño del taller.</p>'; return; }
  let info;
  try { info = await api('GET', `/api/acceso/${encodeURIComponent(token)}`); } catch (e) {
    caja.innerHTML = `<h1>Este enlace ya no sirve</h1><p>${esc(e.message)}</p><p><a class="btn" href="/">Ir al ingreso</a></p>`;
    return;
  }
  caja.innerHTML = `<div><h1>${info.tipo === 'invitacion' ? 'Bienvenido' : 'Nueva contraseña'}, ${esc(info.nombre)}</h1>
      <p class="muted small" style="margin-top:6px">${esc(info.taller)} · vas a ingresar con <strong>${esc(info.email)}</strong></p></div>
    <form class="form" id="f-clave" novalidate>
      ${campo({ nombre: 'clave', etiqueta: 'Elegí una contraseña', tipo: 'password', requerido: true, ayuda: 'Al menos 10 caracteres. Puede ser una frase fácil de recordar, por ejemplo tres palabras.', attrs: 'autocomplete="new-password"' })}
      ${campo({ nombre: 'repetir', etiqueta: 'Repetila', tipo: 'password', requerido: true, attrs: 'autocomplete="new-password"' })}
      <button class="btn btn-primario btn-ancho" type="submit">${icono('check')}Guardar contraseña</button>
    </form>`;
  const f = document.getElementById('f-clave');
  alEnviar(f, async (d) => {
    if (d.clave !== d.repetir) throw Object.assign(new Error('Las dos contraseñas no coinciden.'), { campo: 'repetir' });
    await api('POST', `/api/acceso/${encodeURIComponent(token)}`, { clave: d.clave });
    caja.innerHTML = `<h1>Listo</h1><p>Tu contraseña quedó guardada. Ya podés ingresar con ${esc(info.email)}.</p><p><a class="btn btn-primario btn-ancho" href="/">Ir al ingreso</a></p>`;
  });
  f.querySelector('input').focus();
}
iniciar();
