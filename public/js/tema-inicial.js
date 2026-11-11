// Antes de las hojas de estilo: evita pintar primero el tema contrario.
(() => {
  let modo = 'automatico';
  try { modo = localStorage.getItem('talleres-tema') || modo; } catch { /* almacenamiento no disponible */ }
  if (!['claro','oscuro','automatico'].includes(modo)) modo = 'automatico';
  const oscuro = modo === 'oscuro' || (modo === 'automatico' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.tema = modo;
  document.documentElement.dataset.temaEfectivo = oscuro ? 'oscuro' : 'claro';
  document.documentElement.style.colorScheme = oscuro ? 'dark' : 'light';
})();
