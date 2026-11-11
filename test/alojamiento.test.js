// Publicación: la base y los archivos nunca quedan en una carpeta que el alojamiento reemplaza al desplegar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { problemaCarpetaDatos } from '../server/config.js';

test('Carpeta de datos fuera del código en el alojamiento', () => {
  const hostinger = '/home/u1/domains/panel.ejemplo.com/hbuilds/current/nodejs';
  // Local, sin variables: ./data dentro del proyecto está permitido.
  assert.equal(problemaCarpetaDatos({ raiz: '/proyecto', datos: '/proyecto/data', env: {} }), null);
  // En Hostinger sin TALLERES_DATOS: no arranca.
  assert.match(problemaCarpetaDatos({ raiz: hostinger, datos: hostinger + '/data', env: {} }), /Falta TALLERES_DATOS/);
  // Apuntando dentro de lo que se reemplaza: no arranca.
  for (const datos of [hostinger + '/data', '/home/u1/domains/panel.ejemplo.com/public_html/datos'])
    assert.match(problemaCarpetaDatos({ raiz: hostinger, datos, env: { TALLERES_DATOS: datos } }), /reemplaza/);
  // Producción declarada con la base dentro del código: no arranca.
  assert.match(problemaCarpetaDatos({ raiz: '/srv/app', datos: '/srv/app/data', env: { TALLERES_SEGURO: '1', TALLERES_DATOS: '/srv/app/data' } }), /dentro de la carpeta del código/);
  assert.match(problemaCarpetaDatos({ raiz: '/srv/app', datos: '/srv/app/data', env: { NODE_ENV: 'production' } }), /Falta TALLERES_DATOS/);
  // Carpeta propia fuera del código: correcto.
  assert.equal(problemaCarpetaDatos({ raiz: hostinger, datos: '/home/u1/talleres-datos', env: { TALLERES_DATOS: '/home/u1/talleres-datos', TALLERES_SEGURO: '1' } }), null);
});
