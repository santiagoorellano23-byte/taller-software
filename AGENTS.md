# Reglas para agentes · Growth Labs Talleres

Leé este archivo completo antes de tocar código. Vale para Claude Code, Antigravity y cualquier otro agente. Si una instrucción del usuario lo contradice, gana el usuario. Si una tarea no se puede hacer sin romper una de estas reglas, parás y preguntás.

## 1. Qué es esto

Software de gestión para talleres mecánicos que Growth Labs ofrece como servicio: un solo producto, muchos talleres, cada uno con sus datos, usuarios e identidad. Lo usa gente que recibe autos todos los días desde el teléfono. Se prioriza que sea rápido, claro y que no pierda datos, antes que lo vistoso.

- Producto y compromisos: `PRODUCT.md`. Diseño: `DESIGN.md`. Decisiones: `docs/DECISIONES.md`.
- Hoja de ruta y próximo paso: `docs/HOJA-DE-RUTA.md`.
- Fotos de ingreso: `docs/FOTOS-INGRESO.md`. Movimiento: `docs/MOVIMIENTO.md` (leelo antes de tocar animaciones).
- `privado/` (ignorado por git) guarda estado de despliegue y datos operativos. **No se sube nunca** ni se copia a archivos versionados.
- Este repositorio no contiene datos, logos ni contactos de ningún taller cliente. No los agregues: ni en la demo, ni en pruebas, ni en capturas.

## 2. Reglas del taller que no se negocian

- Autorizado ≠ realizado ≠ liquidado ≠ cobrado. Recibido ≠ colocado. Listo ≠ entregado. Desconocido ≠ cero.
- Cambiar algo autorizado crea una versión nueva que necesita su propia respuesta. Las versiones y los documentos emitidos se conservan.
- Lo postergado no se cobra.
- Las correcciones de dinero, stock y documentos son movimientos o versiones nuevas con motivo. **Nunca se borran registros** para "arreglar" un saldo.
- Antes de registrar dinero se muestra importe, destinatario, medio y efecto.
- Entregar con saldo sigue la regla del taller (`config.entrega_saldo`), con confirmación, motivo y registro.
- Preparar un aviso no es enviarlo. WhatsApp, correo e IA no están activos: no simular envíos.
- No inventar servicios, tarifas, teléfonos, horarios, actividad, testimonios ni fotos.
- ARCA y Libro IVA están excluidos. Los documentos no son facturas.

## 3. Seguridad y datos

- **Toda consulta y escritura filtra por `taller_id` en el servidor.** Cada permiso se comprueba en el servidor (`server/permisos.js`). Ocultar un botón no protege nada.
- Cada módulo nuevo agrega su caso a la matriz de aislamiento (`test/talleres.test.js`): un taller no puede leer, relacionar, editar ni exportar datos de otro cambiando identificadores.
- Plan contratado ≠ permiso del usuario. Cuando existan planes, se comprueban en el servidor y nunca reemplazan el rol.
- Las escrituras que mueven dinero o crean registros usan clave de idempotencia (`Idempotency-Key`). Un reintento no puede duplicar.
- Nunca subir a git: bases (`*.db`), `data/`, `respaldos/`, `.env`, `privado/`, fotos reales, claves, enlaces de acceso, correos personales ni datos del alojamiento.
- La clave de la demo (`scripts/seed.js`) es solo para datos ficticios. Nunca probarla contra una instalación real.
- No ejecutar `npm run seed -- --reiniciar` sobre una carpeta que no sea una demo descartable.

## 4. Arquitectura

Node.js 24, `node:sqlite`, servidor HTTP propio, frontend en HTML/CSS/JS con módulos ES, **sin dependencias ni compilación**. No agregar paquetes npm, frameworks (React, Tailwind, etc.) ni CDNs sin decisión explícita del usuario.

| Dónde | Qué |
|---|---|
| `servidor.cjs` | Entrada del alojamiento. `npm start` lo usa. |
| `server/index.js`, `server/http.js` | Servidor, enrutador, sesiones, idempotencia. |
| `server/config.js` | Variables `TALLERES_*`. No arranca si los datos quedan dentro del código. |
| `server/db.js`, `server/migrations/NNN_*.sql` | Base y migraciones automáticas. |
| `server/permisos.js`, `auth.js`, `plataforma.js` | Permisos, sesiones, talleres. |
| `server/reglas.js`, `recepcion.js`, `estado-ingreso.js`, `hallazgos.js`, `routes/` | Reglas de negocio y API. |
| `server/respaldo.js`, `scripts/backup.js`, `restore.js` | Respaldo y restauración. |
| `public/js/app.js`, `public/js/views/` | Navegación y pantallas. |
| `public/js/recepcion-modelo.js`, `views/recibir-pasos.js`, `estado-ingreso.js` | Recepción guiada de 7 pasos y fotos. |
| `public/js/api.js`, `ui.js`, `movimiento.js` | Llamadas, avisos/formularios, animación. |
| `test/` | Pruebas `node --test` contra la API real con base temporal. |

### Contratos de compatibilidad

`TALLERES_*`, `talleres.db`, la cabecera `X-Talleres`, la cookie de sesión y las claves `talleres-*` de `localStorage` ya son contratos. Renombrarlos exige migración y aviso: si no, una instalación pierde su base o cierra sesiones.

### Hojas de estilo: orden de la cascada

`public/index.html` carga, en este orden: `fuentes` → `app` → `interacciones` → `remaster` → `pos` → `tema` → `operacion` → `isla` → `propuesta-a` → `movimiento`. **La última gana.** Antes de cambiar un estilo, buscá el selector en todas las hojas y editá la que realmente decide el resultado. No agregues una hoja nueva ni `!important` para tapar otra regla. Los colores salen de variables en `app.css` y `tema.css` (modo oscuro).

### Versión de recursos

Cada `<script>`, `<link>` e `import` lleva `?v=<versión de package.json>`. `test/recursos.test.js` falla si alguno no coincide. Si cambiás la versión, actualizá todas las referencias.

### Migraciones

Solo aditivas: archivo nuevo `server/migrations/NNN_nombre.sql` con el número siguiente. Nunca editar una migración ya publicada, ni borrar o renombrar columnas. Los datos viejos tienen que seguir abriendo.

## 5. Cómo trabajar

1. **Rama:** `main` es estable. Cada tarea en una rama `tarea/<nombre>` y se integra cuando está verificada.
2. **Una tarea por vez**, en el orden de `docs/HOJA-DE-RUTA.md`. No mezclar cambios de otra tarea ni "mejorar" código ajeno.
3. **Leer antes de editar:** el archivo completo que vas a tocar y quién lo usa.
4. **Cambio mínimo** que cumpla los criterios de aceptación. Respetá el estilo del archivo: nombres en español, mismo formato y densidad de comentarios.
5. **Prueba primero** cuando la tarea toca el servidor o una regla: agregá o ajustá un caso en `test/` que falle antes del cambio y pase después.
6. **Verificar:**
   - `npm test` completo, todas en verde. Si una falla, no la borres ni la debilites: arreglá la causa o pará y avisá.
   - Si tocaste la interfaz: demo ficticia y revisión a **390 px y 1440 px**, en claro y en oscuro, sin desborde horizontal ni errores de consola.
7. **Commit** con mensaje en español que diga qué y por qué. No `git push --force`, no `reset --hard`, no reescribir historia publicada.
8. **No desplegar.** Subir a un alojamiento, tocar paneles, cron, usuarios o bases reales solo con orden explícita del usuario para ese despliegue.

### Demo ficticia aislada

```powershell
$env:TALLERES_DATOS = Join-Path $PWD 'demo-data'
$env:TALLERES_PUERTO = '3160'
npm run seed
npm start
```

Abrir http://127.0.0.1:3160. Usuarios en `scripts/seed.js`. `demo-data/` ya está en `.gitignore`.

## 6. Cuándo una tarea está terminada

- Cumple todos sus criterios de aceptación.
- `npm test` en verde, con la cantidad de pruebas informada.
- Revisión visual hecha, si correspondía, con las capturas o lo observado.
- Commit en la rama.
- Informe breve: qué cambió (archivos), cómo se verificó, qué **no** se pudo verificar (por ejemplo teléfono físico o cámara) y cualquier duda. No digas "terminado" ni "probado" si no lo verificaste.

## 7. Diseño

Dirección A «Paso a paso»; la pantalla Más usa la variante B. Conservar Barlow local, selector sol/luna, foco visible, áreas táctiles de al menos 44 px y movimiento reducido. Los estados se nombran con palabras, no solo con color. Sin sesión se muestra la marca Growth Labs Talleres; dentro del espacio de un taller, su nombre y su logo. Un color de marca nunca reemplaza un color semántico (error, deuda, acción destructiva). No rediseñar pantallas fuera de la tarea.
