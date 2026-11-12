// Identidad visual del taller: color principal y acento. El mismo módulo lo usan el servidor (para validar)
// y la interfaz (para aplicar y previsualizar). Solo acepta colores #rrggbb y calcula todo lo demás:
// no hay CSS ni código provisto por el usuario. Los colores de error, aviso y éxito no dependen de la marca.

export const MARCA_PRODUCTO = { principal: '#2e3bff', acento: '#2e3bff' }; // Growth Labs Talleres

// Paletas sugeridas: todas cumplen el contraste exigido en claro y en oscuro (lo comprueba test/identidad.test.js).
export const PALETAS = [
  { clave: 'growth', nombre: 'Azul Growth Labs', principal: '#2e3bff', acento: '#2e3bff' },
  { clave: 'grafito', nombre: 'Grafito', principal: '#2f3640', acento: '#e0662a' },
  { clave: 'verde', nombre: 'Verde taller', principal: '#14714a', acento: '#1f9d63' },
  { clave: 'rojo', nombre: 'Rojo', principal: '#b0141f', acento: '#b0141f' },
  { clave: 'naranja', nombre: 'Naranja', principal: '#b5400c', acento: '#e0662a' },
  { clave: 'petroleo', nombre: 'Petróleo', principal: '#0e6470', acento: '#13a3b5' }
];

// Superficies de referencia de cada tema (app.css y tema.css).
const CLARO = { fondo: '#f3f3f2', superficie: '#ffffff' };
const OSCURO = { fondo: '#161b21', superficie: '#1d242c' };
export const CONTRASTE_TEXTO = 4.5; // texto normal (WCAG AA)
export const CONTRASTE_ACENTO = 3; // elementos gráficos que no son texto

const HEX = /^#[0-9a-f]{6}$/;
export const normalizarHex = (v) => {
  const s = String(v ?? '').trim().toLowerCase();
  return HEX.test(s) ? s : null;
};
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c) => '#' + c.map((x) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, '0')).join('');
function luminancia(h) {
  const [r, g, b] = rgb(h).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contraste(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
const mezclar = (a, b, t) => { const [p, q] = [rgb(a), rgb(b)]; return hex(p.map((v, i) => v + (q[i] - v) * t)); };
// Acerca el color hacia `hacia` hasta lograr el contraste pedido contra `fondo`.
function ajustar(color, fondo, minimo, hacia) {
  for (let t = 0; t <= 1.0001; t += 0.04) {
    const c = mezclar(color, hacia, t);
    if (contraste(c, fondo) >= minimo) return c;
  }
  return hacia;
}

// Devuelve el error de validación (texto para la persona) o null si el par se puede usar.
export function problemaApariencia({ principal, acento }) {
  const p = normalizarHex(principal);
  if (!p) return { campo: 'principal', error: 'Elegí el color principal de la lista o escribilo como #rrggbb.' };
  if (contraste('#ffffff', p) < CONTRASTE_TEXTO) return { campo: 'principal', error: 'Ese color principal es muy claro: el texto blanco de los botones no se leería. Elegí un tono más oscuro.' };
  if (acento != null && acento !== '') {
    const a = normalizarHex(acento);
    if (!a) return { campo: 'acento', error: 'Elegí el acento de la lista o escribilo como #rrggbb.' };
    if (contraste(a, CLARO.superficie) < CONTRASTE_ACENTO) return { campo: 'acento', error: 'Ese acento casi no se distingue sobre fondo blanco. Elegí un tono más intenso.' };
  }
  return null;
}

// Valores efectivos del taller: lo guardado, o la marca del producto si no configuró nada.
export function aparienciaEfectiva(guardada) {
  const p = normalizarHex(guardada?.principal);
  if (!p || problemaApariencia({ principal: p })) return { ...MARCA_PRODUCTO, propia: false };
  const a = normalizarHex(guardada?.acento);
  return { principal: p, acento: a && !problemaApariencia({ principal: p, acento: a }) ? a : p, propia: true };
}

// Tokens derivados para cada tema. `marca` es relleno con texto blanco; `marcaTexto` es la marca usada como
// texto, contorno o indicador sobre la superficie, con el contraste de texto garantizado.
export function tokensApariencia(apariencia) {
  const { principal: p, acento: a } = aparienciaEfectiva(apariencia);
  const claro = {
    marca: p, marcaHover: mezclar(p, '#000000', 0.18), sobreMarca: '#ffffff',
    marcaTexto: ajustar(p, CLARO.fondo, CONTRASTE_TEXTO, '#000000'),
    marcaTinte: mezclar(p, '#ffffff', 0.9), marcaLinea: mezclar(p, '#ffffff', 0.62),
    acento: ajustar(a, CLARO.superficie, CONTRASTE_ACENTO, '#000000')
  };
  const textoOscuro = ajustar(p, OSCURO.superficie, CONTRASTE_TEXTO, '#ffffff');
  // Un relleno casi igual al fondo oscuro (por ejemplo grafito) pierde el borde del botón: se invierte.
  const invertir = contraste(p, OSCURO.superficie) < 1.8 && contraste(textoOscuro, OSCURO.fondo) >= CONTRASTE_TEXTO;
  const oscuro = {
    marca: invertir ? textoOscuro : p, marcaHover: invertir ? mezclar(textoOscuro, '#ffffff', 0.18) : mezclar(p, '#000000', 0.18), sobreMarca: invertir ? OSCURO.fondo : '#ffffff',
    marcaTexto: textoOscuro,
    marcaTinte: mezclar(p, OSCURO.superficie, 0.72), marcaLinea: mezclar(ajustar(p, OSCURO.superficie, CONTRASTE_ACENTO, '#ffffff'), OSCURO.superficie, 0.35),
    acento: ajustar(a, OSCURO.superficie, CONTRASTE_ACENTO, '#ffffff')
  };
  return { claro, oscuro };
}

const VARIABLES = { marca: '--marca', marcaHover: '--marca-hover', sobreMarca: '--sobre-marca', marcaTexto: '--marca-texto', marcaTinte: '--marca-tinte', marcaLinea: '--marca-linea', acento: '--acento' };
const declarar = (t) => Object.entries(VARIABLES).map(([k, v]) => `${v}:${t[k]}`).join(';');

// Hoja con los tokens del taller. Solo contiene colores calculados aquí; `ambito` limita la vista previa a un contenedor.
export function cssApariencia(apariencia, ambito = '') {
  const { claro, oscuro } = tokensApariencia(apariencia);
  const sel = ambito ? ` ${ambito}` : '';
  return `:root${sel}{${declarar(claro)}}html[data-tema-efectivo="oscuro"]${sel}{${declarar(oscuro)}}`;
}
