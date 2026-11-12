// Ajustes del taller (solo dueño): datos y página pública, usuarios, catálogos, conexiones externas, datos y registro.
import { get, post, put, api } from '../api.js?v=0.1.0';
import { esc, icono, pesos, cant, fechaHora, chip, campo, casilla, alEnviar, toast, confirmar, aviso, copiar, aEntradaDinero, aEntradaCant } from '../ui.js?v=0.1.0';
import { PALETAS, tokensApariencia, problemaApariencia, aparienciaEfectiva, normalizarHex } from '../marca.js?v=0.1.0';

const SECC = [['taller', 'Datos y página pública', 'config.taller'], ['identidad', 'Logo y colores', 'config.taller'], ['usuarios', 'Usuarios', 'usuarios.gestionar'], ['catalogos', 'Servicios y plantillas', 'config.taller'], ['integraciones', 'Conexiones externas', 'config.taller'], ['datos', 'Exportación y respaldo', 'exportar'], ['registro', 'Registro de acciones', 'auditoria.ver']];
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default async function ajustes({ params, app }) {
  const sec = SECC.some((s) => s[0] === params.seccion) ? params.seccion : 'taller';
  const def = SECC.find((s) => s[0] === sec) || SECC[0];
  if (!app.puede(def[2])) return { titulo: 'Ajustes', html: `<div class="pagina"><h1 tabindex="-1">Sin acceso</h1><p>Esta parte la administra el dueño del taller.</p></div>` };
  const pestanas = `<nav class="pestanas" aria-label="Secciones de ajustes">${SECC.filter((s) => app.puede(s[2])).map(([k, t]) => `<a href="#/ajustes/${k}" ${k === sec ? 'aria-current="page"' : ''}><strong>${t}</strong></a>`).join('')}</nav>`;
  const marco = (cuerpo) => `<div class="pagina" style="max-width:1120px"><a class="volver" href="#/mas">${icono('izq')}Más funciones</a><div class="cab"><h1 tabindex="-1">${esc(def[1])}</h1><button type="button" class="btn btn-chico btn-texto" data-ayuda="${sec === 'usuarios' ? 'usuarios' : sec === 'datos' ? 'respaldo' : 'guia'}">${icono('ayuda')}¿Cómo hago…?</button></div>${pestanas}${cuerpo}</div>`;
  const vistas = { taller: vTaller, identidad: vIdentidad, usuarios: vUsuarios, catalogos: vCatalogos, integraciones: vIntegraciones, datos: vDatos, registro: vRegistro };
  const v = await vistas[sec](app);
  return { titulo: `Ajustes · ${def[1]}`, html: marco(v.html), despues: v.despues };
}

async function vTaller(app) {
  const { taller: t, agenda: a, entregaSaldo: es } = await get('/api/taller');
  const c = t.config;
  return {
    html: `<form class="form" id="f-taller" novalidate>
      <section class="panel panel__cuerpo bloque"><h2>Datos del taller</h2>
        <div class="fila-campos">${campo({ nombre: 'nombre', etiqueta: 'Nombre', requerido: true, valor: t.nombre })}${campo({ nombre: 'lema', etiqueta: 'Frase debajo del nombre', valor: c.lema || '' })}</div>
        <div class="fila-campos">${campo({ nombre: 'telefono', etiqueta: 'Teléfono', valor: c.telefono || '' })}${campo({ nombre: 'whatsapp', etiqueta: 'WhatsApp', valor: c.whatsapp || '' })}${campo({ nombre: 'email', etiqueta: 'Correo', valor: c.email || '' })}</div>
        <div class="fila-campos">${campo({ nombre: 'direccion', etiqueta: 'Dirección', valor: c.direccion || '' })}${campo({ nombre: 'localidad', etiqueta: 'Localidad', valor: c.localidad || '' })}${campo({ nombre: 'horarios', etiqueta: 'Horarios para mostrar', valor: c.horarios || '' })}</div>
        <p class="muted small">Estos datos salen en los documentos nuevos. Los documentos ya emitidos conservan los datos de su fecha.</p></section>
      <section class="panel panel__cuerpo bloque"><h2>Presupuestos y mano de obra</h2>
        <div class="fila-campos">${campo({ nombre: 'validezDias', etiqueta: 'Validez de los presupuestos (días)', valor: c.validez_presupuesto_dias || 15, attrs: 'inputmode="numeric"' })}${campo({ nombre: 'valorHora', etiqueta: 'Valor de la hora de trabajo', valor: aEntradaDinero(c.valor_hora), attrs: 'inputmode="decimal"', ayuda: 'Lo usa la calculadora. Lo define el taller.' })}</div></section>
      <section class="panel panel__cuerpo bloque"><h2>Entrega con saldo pendiente</h2>
        <fieldset class="grupo" data-campo="entregaSaldo"><legend>¿Quién puede entregar un auto que todavía debe plata?</legend><div class="opciones opciones--columna">${Object.entries(es.opciones).map(([k, txt]) => `<label class="opcion"><input type="radio" name="entregaSaldo" value="${k}" ${es.regla === k ? 'checked' : ''}><span>${esc(txt)}</span></label>`).join('')}</div></fieldset>
        <p class="muted small">Siempre queda registrado quién la autorizó, el saldo y el motivo. Valor inicial: dueño y recepción, hasta que el dueño confirme su regla.</p></section>
      <section class="panel panel__cuerpo bloque"><h2>Horario de turnos</h2>
        <fieldset class="grupo" data-campo="agendaDias"><legend>Días de atención</legend><div class="opciones">${DIAS.map((d, i) => `<label class="opcion"><input type="checkbox" name="dias[]" value="${i}" ${a.dias.includes(i) ? 'checked' : ''}><span>${d}</span></label>`).join('')}</div></fieldset>
        <div class="fila-campos">${campo({ nombre: 'desde', etiqueta: 'Desde', tipo: 'time', valor: a.desde, id: 'agendaDesde' })}${campo({ nombre: 'hasta', etiqueta: 'Hasta', tipo: 'time', valor: a.hasta })}${campo({ nombre: 'paso', etiqueta: 'Turnos cada', tipo: 'select', valor: String(a.paso), opciones: [['15', '15 minutos'], ['30', '30 minutos'], ['60', '1 hora']] })}</div></section>
      <section class="panel panel__cuerpo bloque"><h2>Cierre del mediodía</h2><p class="muted small">Si atienden de corrido, dejá ambos campos vacíos. Los turnos no pueden cruzar este cierre.</p>
        <div class="fila-campos">${campo({ nombre: 'pausaDesde', etiqueta: 'Cierra al mediodía', tipo: 'time', valor: a.pausaDesde || '' })}${campo({ nombre: 'pausaHasta', etiqueta: 'Vuelve a abrir', tipo: 'time', valor: a.pausaHasta || '' })}</div></section>
      <section class="panel panel__cuerpo bloque"><h2>Página pública y directorio (voluntario)</h2>
        ${casilla('publico', 'Mostrar una página pública del taller (datos de contacto, servicios y horarios)', t.publico)}
        ${casilla('turnosOnline', 'Permitir pedir turnos desde la página pública (quedan sin confirmar hasta que los confirmes)', !!c.turnosOnline)}
        ${casilla('en_directorio', 'Aparecer en el listado de talleres del producto', t.en_directorio)}
        ${campo({ nombre: 'descripcion', etiqueta: 'Descripción para la página pública', tipo: 'textarea', valor: c.descripcion || '' })}
        ${campo({ nombre: 'serviciosPublicos', etiqueta: 'Servicios que se muestran (uno por renglón)', tipo: 'textarea', valor: (c.serviciosPublicos || []).join('\n') })}
        ${campo({ nombre: 'mapa', etiqueta: 'Enlace al mapa', valor: c.mapa || '', placeholder: 'https://…' })}
        ${t.publico ? `<p><a href="/t/${esc(t.slug)}" target="_blank" rel="noopener">${icono('enlace')} Ver la página pública</a></p>` : ''}
        ${aviso('La página pública nunca muestra clientes, autos ni trabajos. Confirmá cada dato con el dueño antes de activarla.', 'gris')}</section>
      <div class="form-pie"><button class="btn btn-primario" type="submit">${icono('check')}Guardar ajustes</button></div>
    </form>
    <p class="muted small">El logo y los colores del taller están en <a href="#/ajustes/identidad">Logo y colores</a>.</p>`,
    despues(raiz) {
      alEnviar(raiz.querySelector('#f-taller'), async (d) => {
        await put('/api/taller', {
          version: t.version, nombre: d.nombre, lema: d.lema, telefono: d.telefono, whatsapp: d.whatsapp, email: d.email, direccion: d.direccion, localidad: d.localidad, horarios: d.horarios,
          validezDias: d.validezDias, valorHora: d.valorHora, entregaSaldo: d.entregaSaldo, agenda: { dias: d.dias || [], desde: d.desde, hasta: d.hasta, paso: Number(d.paso), pausaDesde: d.pausaDesde, pausaHasta: d.pausaHasta },
          publico: d.publico, turnosOnline: d.turnosOnline, en_directorio: d.en_directorio, descripcion: d.descripcion, serviciosPublicos: d.serviciosPublicos, mapa: d.mapa
        });
        toast('Ajustes guardados.');
        location.reload();
      });
    }
  };
}

// Vista previa con los tokens calculados para cada tema. No depende del tema de la pantalla actual.
const SUPERFICIE = { claro: { fondo: '#f3f3f2', hoja: '#ffffff', tinta: '#292929', suave: '#555555', linea: '#e0e0de', rojo: '#ae040f', rojoFondo: '#fcebec' }, oscuro: { fondo: '#161b21', hoja: '#1d242c', tinta: '#edf1f5', suave: '#b2bfcc', linea: '#41505e', rojo: '#ff9aa4', rojoFondo: '#442630' } };
function muestra(tema, k, nombre, logo) {
  const s = SUPERFICIE[tema];
  return `<figure class="vp" style="background:${s.fondo};color:${s.tinta};border-color:${s.linea}"><figcaption class="vp__tema">${tema === 'claro' ? 'Modo claro' : 'Modo oscuro'}</figcaption>
    <div class="vp__hoja" style="background:${s.hoja};border-color:${s.linea}">
      <div class="vp__marca">${logo ? `<img src="${logo}" alt="" class="vp__logo">` : `<span class="vp__punto" style="background:${k.acento}"></span>`}<strong translate="no">${esc(nombre)}</strong></div>
      <div class="vp__nav"><span class="vp__activo" style="color:${k.marcaTexto};background:${k.marcaTinte};border-color:${k.marcaLinea}">Hoy</span><span style="color:${s.suave}">Taller</span><span style="color:${s.suave}">Agenda</span></div>
      <div class="vp__fila"><span class="vp__btn" style="background:${k.marca};color:${k.sobreMarca}">Recibir un auto</span><span class="vp__enlace" style="color:${k.marcaTexto}">Ver orden</span></div>
      <p class="vp__error" style="color:${s.rojo};background:${s.rojoFondo}">Saldo pendiente: los errores y las deudas no cambian de color.</p>
    </div></figure>`;
}

async function vIdentidad(app) {
  const { taller: t } = await get('/api/taller');
  const c = t.config;
  const guardada = aparienciaEfectiva(c.apariencia);
  const logo = c.logoAdjuntoId ? `/api/adjuntos/${Number(c.logoAdjuntoId)}` : '';
  let version = t.version;
  return {
    html: `<form class="form" id="f-colores" novalidate>
      <section class="panel panel__cuerpo bloque"><h2>Colores del taller</h2>
        <p class="muted small">Se usan en botones, selección y navegación de todo el equipo. Los colores de errores, deudas y avisos son fijos para que siempre se entiendan.</p>
        <fieldset class="grupo" data-campo="paleta"><legend>Elegí una paleta</legend><div class="paletas">${PALETAS.map((p) => `<label class="paleta"><input type="radio" name="paleta" value="${p.clave}"><span><i style="background:${p.principal}"></i><i style="background:${p.acento}"></i>${esc(p.nombre)}</span></label>`).join('')}
          <label class="paleta"><input type="radio" name="paleta" value="propia"><span><i data-propia-p></i><i data-propia-a></i>Colores propios</span></label></div></fieldset>
        <div class="fila-campos" data-propios>
          <div class="campo" data-campo="principal"><label for="col-principal">Color principal</label><div class="color-campo"><input type="color" id="col-principal-sel" aria-label="Elegir color principal"><input type="text" id="col-principal" name="principal" inputmode="text" autocomplete="off" spellcheck="false" maxlength="7" aria-describedby="ayuda-principal"></div><p class="campo__ayuda" id="ayuda-principal">Botones y selección. Tiene que ser oscuro para que el texto blanco se lea.</p></div>
          <div class="campo" data-campo="acento"><label for="col-acento">Acento</label><div class="color-campo"><input type="color" id="col-acento-sel" aria-label="Elegir acento"><input type="text" id="col-acento" name="acento" inputmode="text" autocomplete="off" spellcheck="false" maxlength="7" aria-describedby="ayuda-acento"></div><p class="campo__ayuda" id="ayuda-acento">Detalle junto al nombre del taller.</p></div>
        </div>
        <div class="vp-cab"><h3>Vista previa</h3><span class="vp-estado" data-estado aria-live="polite"></span></div>
        <div class="vp-par" data-vista></div>
        <div class="form-pie acciones"><button class="btn btn-primario" type="submit" data-guardar>${icono('check')}Guardar colores</button><button type="button" class="btn" data-descartar>Descartar cambios</button>${guardada.propia ? `<button type="button" class="btn btn-texto" data-restaurar>Volver a los colores de Growth Labs</button>` : ''}</div>
        <p class="muted small">Los documentos ya emitidos conservan los colores y el logo de su fecha.</p>
      </section></form>
    <section class="panel panel__cuerpo bloque"><h2>Logo</h2>
      ${logo ? `<img src="${logo}" alt="Logo actual" style="max-height:72px;background:#fff;padding:6px;border:1px solid var(--line);border-radius:6px">` : '<p class="muted">Sin logo cargado: se muestra el nombre del taller.</p>'}
      ${logo ? '<p><button type="button" class="btn btn-texto" data-quitar-logo>Quitar logo</button></p>' : ''}
      <form class="form" id="f-logo" novalidate><div class="campo" data-campo="logo"><label for="logo-in">Imagen PNG, JPG o WEBP (menos de 400 KB)</label><input id="logo-in" type="file" accept="image/png,image/jpeg,image/webp"></div><button class="btn" type="submit">${icono('subir')}Subir logo</button></form>
      <p class="muted small">Los documentos ya emitidos conservan el logo que tenían.</p></section>`,
    despues(raiz) {
      const f = raiz.querySelector('#f-colores');
      const inP = f.querySelector('#col-principal'), inA = f.querySelector('#col-acento');
      const selP = f.querySelector('#col-principal-sel'), selA = f.querySelector('#col-acento-sel');
      const estado = f.querySelector('[data-estado]'), vista = f.querySelector('[data-vista]');
      let base = { principal: guardada.principal, acento: guardada.acento };
      const borrador = () => ({ principal: normalizarHex(inP.value), acento: normalizarHex(inA.value) });
      const marcarPaleta = (d) => {
        const p = PALETAS.find((x) => x.principal === d.principal && x.acento === d.acento);
        f.querySelector(`input[name="paleta"][value="${p ? p.clave : 'propia'}"]`).checked = true;
        f.querySelector('[data-propia-p]').style.background = d.principal || 'transparent';
        f.querySelector('[data-propia-a]').style.background = d.acento || d.principal || 'transparent';
      };
      const cargar = (d) => { inP.value = d.principal; inA.value = d.acento; selP.value = d.principal; selA.value = d.acento; };
      const pintar = () => {
        const d = borrador();
        const p = problemaApariencia({ principal: inP.value, acento: inA.value });
        for (const [campoEl, nombre] of [[inP, 'principal'], [inA, 'acento']]) {
          const cont = campoEl.closest('.campo');
          cont.classList.toggle('campo--error', p?.campo === nombre);
          cont.querySelector('.campo__error')?.remove();
          if (p?.campo === nombre) cont.insertAdjacentHTML('beforeend', `<p class="campo__error" role="alert">${esc(p.error)}</p>`);
        }
        const cambiado = d.principal !== base.principal || (d.acento || d.principal) !== base.acento;
        estado.textContent = p ? 'Corregí el color para ver la vista previa' : cambiado ? 'Sin guardar: solo vos ves esta vista previa' : 'Guardado: así lo ve todo el equipo';
        estado.dataset.tipo = p ? 'error' : cambiado ? 'borrador' : 'guardado';
        f.querySelector('[data-guardar]').disabled = !!p || !cambiado;
        f.querySelector('[data-descartar]').disabled = !cambiado;
        if (!p) { const k = tokensApariencia(d); vista.innerHTML = muestra('claro', k.claro, t.nombre, logo) + muestra('oscuro', k.oscuro, t.nombre, logo); marcarPaleta({ principal: d.principal, acento: d.acento || d.principal }); }
        f.dataset.cambios = cambiado ? '1' : '';
      };
      f.querySelectorAll('input[name="paleta"]').forEach((r) => r.addEventListener('change', () => {
        const p = PALETAS.find((x) => x.clave === r.value);
        if (p) cargar(p); else inP.focus();
        pintar();
      }));
      selP.addEventListener('input', () => { inP.value = selP.value; pintar(); });
      selA.addEventListener('input', () => { inA.value = selA.value; pintar(); });
      inP.addEventListener('input', () => { if (normalizarHex(inP.value)) selP.value = normalizarHex(inP.value); pintar(); });
      inA.addEventListener('input', () => { if (normalizarHex(inA.value)) selA.value = normalizarHex(inA.value); pintar(); });
      f.querySelector('[data-descartar]').addEventListener('click', () => { cargar(base); pintar(); });
      alEnviar(f, async () => {
        const d = borrador();
        const r = await put('/api/taller/apariencia', { version, principal: d.principal, acento: d.acento });
        version = r.version; base = { principal: r.apariencia.principal, acento: r.apariencia.acento };
        app.sesion.taller.apariencia = r.apariencia; app.aplicarApariencia(r.apariencia);
        cargar(base); pintar();
        toast('Colores guardados. Ya los ve todo el equipo.');
      });
      raiz.querySelector('[data-restaurar]')?.addEventListener('click', async () => {
        const ok = await confirmar({ titulo: 'Volver a los colores de Growth Labs', texto: 'El taller deja de usar sus colores propios. Podés volver a elegirlos cuando quieras; los documentos emitidos no cambian.', aceptar: 'Volver a los colores de Growth Labs' });
        if (!ok.ok) return;
        try {
          const r = await put('/api/taller/apariencia', { version, restaurar: true });
          app.sesion.taller.apariencia = r.apariencia; app.aplicarApariencia(r.apariencia);
          toast('Se restauraron los colores de Growth Labs.'); app.recargar();
        } catch (e) { toast(e.message, { error: true }); }
      });
      cargar(base); pintar();
      alEnviar(raiz.querySelector('#f-logo'), async () => {
        const f = raiz.querySelector('#logo-in').files[0];
        if (!f) throw Object.assign(new Error('Elegí una imagen.'), { campo: 'logo' });
        await api('POST', '/api/taller/logo', undefined, { archivo: f, cabeceras: { 'X-Nombre-Archivo': encodeURIComponent(f.name) } });
        toast('Logo guardado.');
        app.recargar();
      });
      raiz.querySelector('[data-quitar-logo]')?.addEventListener('click', async () => {
        const r = await confirmar({ titulo: 'Quitar logo', texto: 'Se mostrará el nombre del taller. Los documentos anteriores conservan su copia y podés volver a subir el logo.', aceptar: 'Quitar logo' });
        if (!r.ok) return;
        try { await api('DELETE', '/api/taller/logo'); toast('Logo quitado.'); location.reload(); } catch (e) { toast(e.message, { error: true }); }
      });
    }
  };
}

async function vUsuarios(app) {
  const { usuarios, roles } = await get('/api/usuarios');
  return {
    html: `<section class="panel"><ul class="lista">${usuarios.map((u) => `<li><div class="fila"><span><strong>${esc(u.nombre)}</strong> · ${esc(u.rolTexto)}<br><span class="muted small">${esc(u.email)} · ${u.pendiente ? 'todavía no creó su contraseña' : u.ultimo_acceso ? 'último ingreso ' + esc(fechaHora(u.ultimo_acceso)) : 'sin ingresos'}</span></span>${u.activo ? chip('Activo', 'verde', 'check') : chip('Sin acceso', '', 'ban')}</div>
      <details class="mas"><summary>Cambiar perfil o acceso</summary><div class="mas__cuerpo"><form class="form" data-u="${u.id}" data-version="${u.version}" novalidate>
        <div class="fila-campos">${campo({ nombre: 'nombre', etiqueta: 'Nombre', requerido: true, valor: u.nombre })}${campo({ nombre: 'rol', etiqueta: 'Perfil', tipo: 'select', valor: u.rol, opciones: Object.entries(roles) })}${campo({ nombre: 'activo', etiqueta: 'Acceso', tipo: 'select', valor: u.activo ? '1' : '0', opciones: [['1', 'Puede ingresar'], ['0', 'Sin acceso (desactivado)']] })}</div>
        <div class="acciones"><button class="btn" type="submit">Guardar</button>${u.activo ? `<button type="button" class="btn btn-texto" data-enlace="${u.id}">${icono('enlace')}${u.pendiente ? 'Generar invitación de nuevo' : 'Enlace para cambiar contraseña'}</button>` : ''}${u.activo && !u.pendiente && u.id !== app.sesion.usuario.id ? `<button type="button" class="btn btn-texto" data-cerrar="${u.id}">${icono('salir')}Cerrar sus sesiones</button>` : ''}</div>
        <div data-enlace-u="${u.id}"></div></form></div></details></li>`).join('')}</ul></section>
      <section class="panel panel__cuerpo bloque"><h2>Invitar a una persona</h2>
        <form class="form" id="f-inv" novalidate><div class="fila-campos">${campo({ nombre: 'nombre', etiqueta: 'Nombre', requerido: true })}${campo({ nombre: 'email', etiqueta: 'Correo para ingresar', tipo: 'email', requerido: true })}${campo({ nombre: 'rol', etiqueta: 'Perfil', tipo: 'select', opciones: Object.entries(roles), valor: 'mecanico' })}</div>
        <button class="btn btn-primario" type="submit">${icono('mas')}Crear invitación</button></form><div data-inv></div>
        ${aviso('<strong>Qué puede hacer cada perfil:</strong> Recepción recibe autos, prepara presupuestos, registra respuestas, cobros, agenda y ventas. Mecánico registra revisión, tareas, repuestos colocados, trabajos y control, sin ver importes. Dueño puede todo, incluidos usuarios, ajustes, anulaciones y reportes.', 'gris')}</section>`,
    despues(raiz) {
      const mostrar = (cont, r) => { cont.innerHTML = `<div class="bloque">${aviso('Mandale este enlace por un medio seguro. Sirve una sola vez y vence el ' + esc(fechaHora(r.expira)) + '. No envíes contraseñas.', 'verde', 'check')}<div class="campo"><label>Enlace</label><input type="text" readonly value="${esc(location.origin + r.enlace)}"></div><button type="button" class="btn btn-chico" data-c>${icono('copiar')}Copiar enlace</button></div>`; cont.querySelector('[data-c]').onclick = () => copiar(location.origin + r.enlace); };
      alEnviar(raiz.querySelector('#f-inv'), async (d) => { const r = await post('/api/usuarios', d); mostrar(raiz.querySelector('[data-inv]'), r); raiz.querySelector('#f-inv').reset(); });
      raiz.querySelectorAll('[data-u]').forEach((f) => alEnviar(f, async (d) => {
        if (d.activo === '0') { const c = await confirmar({ titulo: 'Quitar el acceso', texto: `${esc(d.nombre)} no podrá ingresar y su sesión se cierra ahora. Lo que registró se conserva.`, aceptar: 'Quitar acceso', peligro: true }); if (!c.ok) return; }
        await put(`/api/usuarios/${f.dataset.u}`, { nombre: d.nombre, rol: d.rol, activo: d.activo === '1', version: Number(f.dataset.version) });
        toast('Usuario actualizado.'); app.recargar();
      }));
      raiz.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', async () => {
        const r = await confirmar({ titulo: 'Cerrar sus sesiones', texto: 'La persona tendrá que volver a ingresar con su correo y contraseña en todos sus dispositivos. No se borra nada.', aceptar: 'Cerrar sesiones' });
        if (!r.ok) return;
        try { await post(`/api/usuarios/${b.dataset.cerrar}/cerrar-sesiones`, {}); toast('Sesiones cerradas.'); } catch (e) { toast(e.message, { error: true }); }
      }));
      raiz.querySelectorAll('[data-enlace]').forEach((b) => b.addEventListener('click', async () => { try { const r = await post(`/api/usuarios/${b.dataset.enlace}/recuperacion`, {}); mostrar(raiz.querySelector(`[data-enlace-u="${b.dataset.enlace}"]`), r); } catch (e) { toast(e.message, { error: true }); } }));
    }
  };
}

async function vCatalogos(app) {
  const c = await get('/api/catalogos');
  const fila = (tipo, x, campos, resumen) => `<li><div class="fila"><span>${resumen}</span>${x.activo ? '' : chip('Inactivo', '', 'menos')}</div><details class="mas"><summary>Editar</summary><div class="mas__cuerpo"><form class="form" data-cat="${tipo}" data-id="${x.id}" novalidate>${campos}${casilla('activo', 'Activo', !!x.activo)}<button class="btn" type="submit">Guardar</button></form></div></details></li>`;
  const sec = (tipo, titulo, lista, campos, resumen, ayuda) => `<section class="panel"><div class="panel__cab"><h2>${titulo}</h2></div>${ayuda ? `<div class="panel__cuerpo" style="padding-bottom:0"><p class="muted small">${ayuda}</p></div>` : ''}
    <ul class="lista">${lista.map((x) => fila(tipo, x, campos(x), resumen(x))).join('') || '<li class="muted">Todavía no hay.</li>'}</ul>
    <div class="panel__cuerpo"><details class="mas"><summary>Agregar</summary><div class="mas__cuerpo"><form class="form" data-cat="${tipo}" novalidate>${campos({})}<button class="btn btn-primario" type="submit">Agregar</button></form></div></details></div></section>`;
  return {
    html: `<div class="bloque">
      ${sec('puestos', 'Puestos de trabajo', c.puestos, (x) => campo({ nombre: 'nombre', etiqueta: 'Nombre', requerido: true, valor: x.nombre || '', placeholder: 'Ej.: Elevador 1' }), (x) => `<strong>${esc(x.nombre)}</strong>`, 'La agenda controla que dos turnos no se superpongan en el mismo puesto.')}
      ${sec('servicios', 'Servicios (agenda y página pública)', c.servicios, (x) => `<div class="fila-campos">${campo({ nombre: 'nombre', etiqueta: 'Nombre', requerido: true, valor: x.nombre || '' })}${campo({ nombre: 'duracion', etiqueta: 'Duración (min)', valor: x.duracion_min || 60, attrs: 'inputmode="numeric"' })}${campo({ nombre: 'precio', etiqueta: 'Precio orientativo', valor: aEntradaDinero(x.precio), attrs: 'inputmode="decimal"' })}</div>${casilla('publico', 'Se puede pedir desde la página pública', x.publico !== 0)}`, (x) => `<strong>${esc(x.nombre)}</strong> · ${x.duracion_min} min${x.precio != null ? ' · ' + pesos(x.precio) : ''}`)}
      ${sec('plantillas', 'Plantillas de service', c.plantillas, (x) => `${campo({ nombre: 'nombre', etiqueta: 'Nombre', requerido: true, valor: x.nombre || '' })}${campo({ nombre: 'tareas', etiqueta: 'Tareas (una por renglón)', tipo: 'textarea', requerido: true, valor: (x.tareas || []).join('\n') })}`, (x) => `<strong>${esc(x.nombre)}</strong> · ${(x.tareas || []).length} tareas`, 'Proponen tareas; el mecánico las confirma una por una. No definen intervalos ni productos compatibles.')}
      ${sec('trabajos', 'Tiempos de trabajo (calculadora)', c.trabajos, (x) => `<div class="fila-campos">${campo({ nombre: 'nombre', etiqueta: 'Trabajo', requerido: true, valor: x.nombre || '' })}${campo({ nombre: 'horas', etiqueta: 'Horas', valor: x.horas_m ? aEntradaCant(x.horas_m) : '', requerido: true, attrs: 'inputmode="decimal"' })}</div>${campo({ nombre: 'notas', etiqueta: 'Notas', valor: x.notas || '' })}`, (x) => `<strong>${esc(x.nombre)}</strong> · ${cant(x.horas_m, 'h')}`, 'Tiempos propios del taller. No son tiempos oficiales.')}
    </div>`,
    despues(raiz) {
      raiz.querySelectorAll('[data-cat]').forEach((f) => alEnviar(f, async (d) => { await post(`/api/catalogos/${f.dataset.cat}`, { ...d, id: f.dataset.id ? Number(f.dataset.id) : undefined, activo: f.dataset.id ? d.activo : true, publico: d.publico !== false }); toast('Guardado.'); app.recargar(); }));
    }
  };
}

async function vIntegraciones() {
  const { integraciones } = await get('/api/integraciones');
  return {
    html: `<div class="bloque">${aviso('Estas funciones necesitan cuentas, proveedores o contenidos que el taller todavía no contrató. Están preparadas pero <strong>inactivas</strong>: no se simula ningún envío ni respuesta.', 'gris', 'info')}
      <div class="panel"><ul class="lista">${integraciones.map((i) => `<li><div class="fila"><strong>${esc(i.nombre)}</strong>${chip('Inactiva', '', 'pausa')}</div><p class="small"><strong>Necesita:</strong> ${esc(i.necesita)}</p><p class="small"><strong>Mientras tanto:</strong> ${esc(i.alternativa)}</p></li>`).join('')}</ul></div></div>`
  };
}

async function vDatos() {
  const estado = await get('/api/respaldos/estado');
  const TABLAS = [['vehiculos', 'Autos'], ['contactos', 'Clientes'], ['visitas', 'Visitas'], ['presupuesto_lineas', 'Líneas de presupuesto'], ['cuenta_movimientos', 'Movimientos de dinero'], ['movimientos_stock', 'Movimientos de stock'], ['articulos', 'Artículos'], ['turnos', 'Turnos']];
  return {
    html: `<div class="bloque">
      <section class="panel panel__cuerpo bloque"><h2>Descargar los datos del taller</h2><p>Incluye solo los datos de este taller, sin contraseñas ni sesiones. Los archivos (fotos, PDF) se descargan desde cada visita o con el respaldo del servidor.</p>
        <div class="acciones"><a class="btn btn-primario" href="/api/exportar">${icono('descargar')}Todo (JSON)</a></div>
        <p class="small">Planillas (CSV) por tema:</p><div class="acciones">${TABLAS.map(([t, n]) => `<a class="btn btn-chico" href="/api/exportar?formato=csv&entidad=${t}">${esc(n)}</a>`).join('')}</div></section>
      <section class="panel panel__cuerpo bloque"><h2>Respaldo completo</h2>
        <p>El respaldo incluye la base de datos y los archivos privados. Lo administra el responsable técnico y se recupera en un entorno separado, comprobando los registros y los archivos antes de usarlo.</p>
        ${aviso(estado.ultimaCopia ? `Última copia completa detectada: <strong>${esc(fechaHora(estado.ultimaCopia))}</strong>. ${estado.reciente ? 'Hay una copia de las últimas 36 horas.' : 'Pasaron más de 36 horas: avisá al administrador para revisar la tarea.'}` : 'Todavía no se detectó un respaldo completo. Avisá al administrador.', estado.reciente ? 'verde' : 'ambar', estado.reciente ? 'check' : 'alerta')}
        <p class="muted small">Este estado corresponde al respaldo de la instalación en el servidor. No comprueba una copia fuera del servidor ni que la tarea automática esté programada. El administrador debe verificar la frecuencia, el destino externo y la recuperación.</p></section></div>`
  };
}

async function vRegistro() {
  const { acciones } = await get('/api/auditoria');
  return {
    html: `<section class="panel"><div class="panel__cab"><h2>Últimas acciones</h2><span class="muted small">Quién hizo cada cambio importante</span></div>
      <ul class="lista">${acciones.map((a) => `<li><div class="fila"><strong>${esc(a.accion)}</strong><span class="muted small">${esc(fechaHora(a.fecha))}</span></div><p class="small muted">${esc(a.por || 'Sistema o página pública')}${a.entidad === 'visita' ? ` · <a href="#/visitas/${a.entidad_id}">visita</a>` : ''}${a.detalle ? ' · ' + esc(a.detalle.length > 200 ? a.detalle.slice(0, 200) + '…' : a.detalle) : ''}</p></li>`).join('')}</ul></section>`
  };
}
