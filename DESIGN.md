---
name: Growth Labs Talleres · base operativa
description: Paso a paso, con una próxima acción clara y estados fieles al taller.
colors:
  action: "#2e3bff"
  action-hover: "#2630d1"
  on-action: "#fff"
  action-tint: "#eaebff"
  background: "#f4f5f6"
  surface: "#fff"
  surface-soft: "#f8f9fa"
  surface-inset: "#eceef0"
  ink: "#22282e"
  ink-secondary: "#404a53"
  muted: "#5d6871"
  line: "#e3e6e9"
  line-subtle: "#eef0f2"
  line-strong: "#c5cbd0"
  warning: "#8A4B00"
  warning-background: "#FCEFDD"
  success: "#1E6B3C"
  success-background: "#E5F3EA"
  dark-background: "#111214"
  dark-surface: "#191b1f"
  dark-ink: "#f5f6f7"
  dark-action: "#ae2034"
typography:
  headline:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-.02em"
  receiving-title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-.02em"
  body:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    lineHeight: 1.45
  plate:
    fontFamily: "Barlow Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: ".06em"
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "14px"
rounded:
  small: "4px"
  control: "6px"
  panel: "8px"
  receiving-control: "12px"
  receiving-card: "16px"
  island: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  base: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.on-action}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
    textColor: "{colors.on-action}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  receiving-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.receiving-control}"
  receiving-option:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.receiving-card}"
    padding: "14px"
  receiving-option-selected:
    backgroundColor: "{colors.action-tint}"
    textColor: "{colors.ink}"
  more-navigation:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.receiving-card}"
  status-warning:
    backgroundColor: "{colors.warning-background}"
    textColor: "{colors.warning}"
    rounded: "{rounded.small}"
    padding: "3px 9px"
---

# Design System: Growth Labs Talleres · base operativa

## Overview

**Creative North Star: "Paso a paso"**

Una decisión de recepción por pantalla y una próxima acción clara por orden. Dirección A «Paso a paso», heredada de la base operativa original; la pantalla Más conserva exclusivamente los grupos, el orden y los iconos de B. Se fusiona con el sistema anterior: siguen la hoja clara sobre marco gris, la tinta oscura, Barlow local y el color de marca de cada taller; recepción y navegación incorporan formas más amplias y redondeadas.

La identidad la llevan el nombre y el logo de cada taller, las patentes, la orden numerada y el lenguaje real del taller. El selector sol/luna se conserva. Las superficies y los estados comunican decisiones operativas, sin indicadores inventados ni fotografías genéricas. Sistema heredado de la base operativa (versión 0.6.1) al iniciar Growth Labs Talleres 0.1.0, con la marca separada de la semántica.

**Key Characteristics:**

- Una decisión visible y un siguiente paso concreto.
- Patente y número de orden como anclas de identidad.
- Superficies sobrias, controles amplios y estados con palabras.
- Datos, permisos y confirmaciones fieles al servidor.

Los valores se extraen de la cascada de `public/index.html`: app, interacciones, remaster, pos, tema, operación, isla y finalmente propuesta-a. Esta fusión sustituye la documentación anterior de cuatro áreas de orden y del círculo activo elevado en la isla.

## Colors

Color de marca del taller sobre una base gris fría y superficies blancas; los colores semánticos conservan texto, icono y borde y no dependen de la marca.

### Marca (configurable por taller)

Tokens en `app.css` (claro) y `tema.css` (oscuro) con el azul Growth Labs `#2e3bff` por defecto; cada taller los reemplaza desde Ajustes → Logo y colores. `public/js/marca.js` calcula todos los valores a partir de dos colores #rrggbb y garantiza el contraste; nunca se acepta CSS del usuario.

- `--marca` / `--marca-hover` / `--sobre-marca`: relleno del botón principal, selección de texto, casillas. Texto sobre la marca ≥ 4,5:1. En oscuro, si el relleno se confunde con el fondo (grafito), se invierte a tono claro con texto oscuro.
- `--marca-texto`: la marca usada como texto, contorno, foco o indicador; ≥ 4,5:1 contra el fondo de cada tema.
- `--marca-tinte` / `--marca-linea`: fondo y borde de una elección activa.
- `--acento`: detalle junto al nombre del taller; ≥ 3:1 contra la superficie.
- `--accion*` quedan como alias de la marca por compatibilidad.

### Semánticos (fijos)

- **Rojo** (`--red*`): solo errores, deudas, acciones destructivas y estado rojo. No se usa como marca.
- Ámbar, verde, azul, violeta y turquesa: estados, con palabra e icono.

### Neutral

- **Marco gris:** fondo general; **Hoja blanca:** formularios, tarjetas y navegación.
- **Tinta de taller:** texto principal; **Tinta secundaria** y **Gris de apoyo:** explicación y metadatos.
- **Divisores suaves:** separan grupos; el borde fuerte identifica campos y opciones interactivas.

### Semantic

- **Ámbar de atención:** bloqueos, borradores y advertencias con explicación.
- **Verde de confirmación:** resultado confirmado o listo según el estado real.
- Los estados azul, teal y violeta ya existentes mantienen sus variables y significados; no constituyen nuevos acentos de marca.

### Theme

El selector sol/luna existente gobierna el tema. La variante oscura usa sus variables de `tema.css`, incluidos bordes, estados y texto secundario; los tokens oscuros del frontmatter son las anclas de esa variante, no una segunda paleta a mezclar con la clara. Las tarjetas de logos mantienen el blanco para la identificación de marca.

**Oscuro grafito (17/11/2026).** Toda la aplicación usa el grafito de la propuesta A de Ajustes, definido una sola vez en `tema.css`: fondo `--bg #111214`; superficies `--surface #191b1f`, `--surface-2 #22252a`, `--surface-3 #2b2f35`; divisor `--line-2 #2e3238`, borde de tarjetas y tablas `--line #383c43` (intermedio, para que una tarjeta se distinga del fondo), borde de controles `--line-strong #6b727d` (≥ 3:1); texto `--ink #f5f6f7`, `--ink-2 #bcc1c8`, `--muted #959ca6` (≥ 4,8:1 hasta sobre `--surface-3`). Los campos van hundidos sobre `--bg`. El azul es acento (acciones y enlaces, desde `marca.js` con la marca de cada taller), nunca superficie. Verde, rojo, ámbar, azul, teal y violeta de estado no cambiaron. `marca.js` calcula los contrastes de la marca contra estas mismas superficies.

**The Estado con palabras Rule.** Ningún color sustituye el nombre del estado, el icono o la explicación de un bloqueo.

## Typography

**Body Font:** Geist Sans local (un archivo variable, subconjunto latino, 28 KB) con fallback de sistema; pesos 400 a 700. Elegida el 16/11/2026 frente a Inter: cubre todos los pesos con un solo archivo, tiene cifras tabulares y lee bien patentes, fechas e importes a 16 px en el teléfono. Barlow queda declarada solo para documentos ya emitidos.
**Label/Mono Font:** Barlow Condensed local para patentes y el nombre del taller; cifras tabulares (`.num`, `td.n`) para dinero, kilometraje y fechas.

Pesos: título 700, etiqueta 600, dato 600 con cifras tabulares, lectura 400. Campos a 16 px como mínimo (sin zoom al enfocar en iOS).

La voz es directa y propia del taller. No se introduce una tipografía de exhibición ni una descarga externa de fuentes.

### Hierarchy

- **Headline:** título general; Hoy móvil usa un título mayor (30px).
- **Receiving title:** pregunta del paso; baja a (26px) hasta el corte móvil.
- **Body:** explicaciones y lectura habitual.
- **Label:** campos y ayudas breves; los grupos de Más usan etiqueta en mayúsculas (13px, peso 700, espaciado .06em).
- **Plate:** patente grande de la orden; la variante compacta conserva la misma familia.

Los campos tienen tamaño efectivo (16px): la regla compartida de remaster usa `!important`, aunque recepción declare una intención local de (17px). No copiar esa intención como valor efectivo. Las pestañas de orden en móvil usan (13px).

## Layout

Escritorio desde (1024px): lateral de (232px), centro flexible y contexto de (316px) cuando aporta; debajo de (1280px), el contexto general pasa al resumen desplegable. El ritmo común es el del frontmatter, con controles compartidos de al menos (44px). Las excepciones compactas existentes deben conservar un uso accesible.

Recepción usa un contenedor máximo de (1080px), contenido flexible, contexto de (270px) y separación de (32px). Hasta (1023px) pasa a una columna con máximo de (640px), sin contexto lateral; cabecera del paso y acciones permanecen accesibles. Campos y acción principal tienen altura mínima de (52px); opciones amplias, marcas en cuatro columnas y motivos en dos. Con poco alto disponible (540px), la barra de recepción vuelve al flujo.

Más usa dos columnas de grupos y máximo de (850px); en móvil, una columna y máximo de (560px). Hoy conserva sus tres grupos en todos los tamaños: tarjetas en móvil y tabla con desplazamiento horizontal local cuando sea necesario. El documento no impone convertir todos los módulos en tarjetas.

La isla móvil es la «Cápsula de vidrio» (26/11/2026; `public/js/isla.js` y `isla.css`), sobre la estructura de la variante C. Cuerpo de 64 px con extremos redondeados (radio completo), a 12 px de los bordes, hasta 440 px de ancho y centrada. Superficie de vidrio sutil: blanco al 74 % en claro y #1e2025 al 70 % en oscuro, con desenfoque de 18 px, borde fino, brillo interior de 1 px en el canto superior y sombra suave. Sin soporte de desenfoque, con transparencia reducida o con más contraste pedido usa la superficie opaca (`--surface` en claro, #1e2025 en oscuro); con más contraste, además, borde `--line-strong` y contorno en la cápsula. Una cápsula interior con el tinte de la marca del taller (12 % sobre blanco en claro, 32 % sobre #1e2025 en oscuro, borde fino y sombra interior leve) se desliza en 240 ms con `cubic-bezier(.32,.72,0,1)` hasta el destino actual; ese destino pasa a `--marca-texto` (claro, 5,4:1 con la marca de la demo) o `--ink` (oscuro, 12:1), con trazo más grueso, relleno tenue del ícono y texto en negrita. Los demás destinos usan `--ink-2`. Hoy, Taller, Clientes y Más son enlaces a sus pantallas reales; las pantallas secundarias (agenda, caja, ajustes…) marcan Más. Recibir es un botón que abre la recepción guiada: nunca queda seleccionado; es una pastilla de 46 × 28 px en el color de acción del taller dentro de la isla, con su nombre debajo. Se oculta en modo enfoque (recepción), en escritorio desde 768 px y al escribir con poco alto. Si falta permiso de recepción, quedan cuatro destinos. El contenido reserva 64 px, la separación del borde (12 px o el área segura más 6) y 16 px de lectura. La primera ubicación de la cápsula no se anima; con movimiento reducido salta sin desplazarse y solo cambia el color (120 ms). En colores forzados el destino actual lleva un contorno.

## Elevation & Depth

La hoja y las tarjetas son planas, con bordes y cambios tonales. Las sombras se reservan para navegación flotante y superposiciones existentes. La isla es vidrio con una sombra ambiente suave; Recibir es una pastilla dentro de ella, con una sombra corta de su color, no un resplandor. Los valores exactos y las transiciones se registran en `.impeccable/design.json`.

Feedback breve, entre (120–180ms), sin retrasar acciones. La presión de motivo, marca y enlace de Más reduce la escala a (.985); con movimiento reducido se elimina. Los avisos entran en (180ms), salvo movimiento reducido. No hay motor de animación nuevo.

**The Hoja plana Rule.** No agregar sombras decorativas a formularios o tarjetas para crear jerarquía; usar espacio, borde, texto y estado.

## Shapes

El sistema compartido conserva esquinas discretas para controles y paneles. Recepción y Más amplían el radio para agrupar decisiones: campos y marcas suaves; motivos, revisión y contenedores con esquinas más amplias. La isla es una cápsula y su acción Recibir, una pastilla de 46 × 28 px. La patente mantiene su silueta propia con borde superior marcado.

## Components

### Movimiento e interacción (11/11/2026)

Recepción ampliada en la versión 0.6.0 a siete pasos. Paso2 Estado al ingresar: fotos privadas con previsualización, descripción, recuperación del borrador y estados de carga/error explícitos; tablero/exterior obligatorios y detalle obligatorio si hay daño previo. Foco en el encabezado de cada paso, errores con enlace al dato y confirmación renovada al cambiar evidencia. El mismo registro se consulta en resumen, historial y entrega; no sustituye diagnóstico ni autorización. Ver docs/FOTOS-INGRESO.md.

Última capa: public/css/movimiento.css, con escala120/180/240ms y curvas compartidas con public/js/movimiento.js. Entradas explícitas y cancelables; hover solo con puntero fino. Datos, filas, patentes e importes permanecen estables. No reanimar guardados ni resultados al escribir. Foco inmediato de teclado, cancelación al activar movimiento reducido y fallback sin WAAPI. Avisos salen sin demorar acciones ni dejar foco en controles eliminados. Mantener cierre nativo de confirmaciones. Cobertura y límites en docs/MOVIMIENTO.md.

### Buttons

Acción directa con verbo concreto, guardado explícito y doble envío bloqueado. El botón primario usa acción/sobre-acción; el secundario conserva superficie y borde. Foco visible; hover solo cuando corresponde a puntero. En recepción, el botón principal tiene altura mínima de (52px) y comparte barra con volver u omitir según el paso.

### Inputs and feedback

Etiqueta permanente, ayuda y error junto al campo, texto conservado y resumen de errores cuando corresponde. `aria-describedby` enlaza ayuda y error, conservando la ayuda al limpiar. Confirmaciones con nombre y descripción únicos. El cursor, selección de texto y controles nativos reutilizan los colores del tema.

Avisos: pausar el tiempo con puntero o foco. Si contienen una acción, permanecen hasta resolver o cerrar; no retirar un aviso con foco o acción pendiente para mostrar otro. Botones de aviso de al menos (44px); texto largo ajustable y acción en fila propia en teléfono. Referencia: `docs/MEJORAS-DISENO-GROWTH.md`.

### Receiving

Seis pasos: Auto, Motivo, Kilometraje, Autorización, Datos opcionales y Revisión. Buscar o cargar auto; una orden abierta ofrece continuar y bloquea el ingreso duplicado. La revisión permite editar antes de confirmar. Solo la respuesta del servidor acredita el ingreso.

Selector de marca exacto: Fiat, Volkswagen, Toyota, Chevrolet, Ford, Renault, Peugeot y Otra. Usar los recursos identificativos locales y su procedencia en `public/RECURSOS-REDISENO.json`; no redibujar logos. Otra solicita el nombre. La selección muestra borde, marca de comprobación y foco visible. Las siluetas existentes son ilustrativas, nunca fotografías del vehículo.

Motivos y relato se guardan separados. Los motivos no diagnostican ni autorizan. El borrador es de la pestaña, usuario y taller, con vigencia de hasta 24 horas; no presentarlo como ingreso guardado ni sincronización.

### Navigation and order

Más agrupa sus 16 accesos en Agenda y clientes; Repuestos y compras; Dinero; Consulta; Administración. Mantener orden, nombres e iconos Material Symbols Outlined locales de B. Ocultar accesos sin permiso y grupos vacíos; el servidor vuelve a comprobar permisos. Sesión y salida quedan al pie.

La orden expone cinco pestañas: Resumen, Revisión, Trabajos, Repuestos e Historial. Presupuesto, Control y entrega, Cobros y Archivos siguen accesibles; preservar enlaces profundos y no guardar negocio por navegar. La próxima acción depende del estado y permisos reales. Las notas internas van al historial auditado, sin crear presupuesto ni cobro.

### Cards and status chips

Hoy agrupa Para hacer, Bloqueados y Listos para retirar. Tarjetas con patente, estado legible y acción; tabla en escritorio cuando aporta. No fusionar autorizado, realizado, liquidado y cobrado, ni recibido y colocado, ni listo y entregado.

### POS selection

Presupuesto conserva catálogo real, categorías y selección múltiple con revisión visible incluso al filtrar. Agregar genera líneas editables; guardar versión y autorizar son acciones distintas. Las tareas de plantilla no se convierten en cobros. Precio ausente requiere completarse; cero significa sin cargo.

Mostrador conserva categorías con iconos, grilla/lista y disponibilidad/precios de API. Frecuentes deriva de ventas recientes, excluyendo anulaciones y devoluciones completas. Las tareas mantienen pendiente, hecho y no aplica.

## Do's and Don'ts

### Do:

- **Do** conservar el logo original, el selector sol/luna y las fuentes locales con licencia.
- **Do** mostrar la próxima acción y los estados reales con texto, icono y foco visible.
- **Do** preservar errores, ayudas, datos introducidos y confirmación explícita del servidor.
- **Do** respetar movimiento reducido, áreas seguras y espacio para acciones fijas.
- **Do** conservar las versiones, documentos fechados y reglas de permisos del producto.

### Don't:

- **Don't** mezclar el runtime de los prototipos con el producto o inventar actividad, importes, tarifas, fotografías o indicadores.
- **Don't** equiparar autorizado, realizado, liquidado y cobrado; recibido y colocado; listo y entregado.
- **Don't** transformar navegar, elegir motivos o escribir una nota en autorización o cobro.
- **Don't** reemplazar la identidad existente ni convertir Más de B en una nueva dirección para las demás pantallas.
- **Don't** presentar esta candidata local o sus emulaciones como publicación o validación en teléfonos físicos.

### Controles e iconos (16/11/2026)

- **Variantes de botón:** principal (`.btn-primario`), secundario (`.btn`), discreto (`.btn-texto`), destructivo (`.btn-peligro`), de icono (`.btn-icono`, 44 × 44, nombre en `aria-label`) y siguiente acción de una tarjeta (`.btn-siguiente`: tinte de marca, distinta de una acción secundaria).
- **Estados:** hover solo con puntero fino y sin elevar el control; foco con contorno de marca; presionado con `scale(.97)` breve (sin cambiar el tamaño de diseño); carga con `.cargando` y `aria-busy`; deshabilitado gris. Con movimiento reducido no hay escala. Guardar usa `alEnviar`: bloquea el doble envío, conserva lo escrito ante un error y solo avisa éxito tras la respuesta del servidor.
- **Selector segmentado** (Hoy: Todo el taller / Asignado a mí): pista gris, segmento activo con superficie elevada, peso 600 y cantidad en tinte de marca; `aria-current` además del aspecto.
- **Iconos Material:** máscara pintada con `currentColor`; toman el color del texto (marca en el activo, claro/oscuro) sin filtros.
- **Dinero de una orden:** presupuestado, autorizado, realizado, cobrado y saldo en una tira propia, nunca animada; el saldo se fija al liquidar.

### Ajustes · Consola Grafito (17/11/2026)

- **Alcance:** la estructura vive en el área de contenido de Ajustes (`.ajg`) y sus diálogos (`.ajg-dlg`). La isla, el lateral, el encabezado y las demás pantallas no cambian de forma.
- **Tokens:** en oscuro, los mismos del grafito global (`tema.css`); Ajustes no define valores propios. Acción `#4652FF`, enlaces `#A3AAFF`. En claro, variante grafito clara con los mismos roles y contraste AA. Radios 8 px en paneles y 6 px en controles. Tipografía Geist del producto; campos y botones conservan 44 px.
- **Escala:** título de página 24 px (22 en área angosta), título de sección 16, texto 15, etiquetas, botones y tablas 14, entradas 16, ayudas y metadatos 12–13. Pesos 400, 600 y 700. La ayuda de cada campo va debajo del control, para que los campos de una misma fila empiecen a la misma altura.
- **Navegación interna:** índice agrupado (El taller, Presencia e imagen, Equipo, Cuenta y datos) al costado cuando el contenedor mide 960 px o más. Por debajo (tablet y escritorio angosto con el lateral global, donde el índice dejaba el formulario en ~550 px), lista de áreas —en dos columnas desde 560 px— y una sola área abierta con «← Ajustes». Lo decide el ancho del contenedor, no el del dispositivo.
- **Secciones:** título y explicación a la izquierda de la tarjeta de campos desde 760 px de área; apiladas debajo. Las tablas (usuarios, registro, pagos, «Qué incluye cada opción») pasan a filas apiladas con su etiqueta bajo 640 px de área. «Editar» y «Agregar…» cerrados ocupan lo que su texto; los textos largos agrandan su caja hasta 320 px.
- **Barra de cambios pendientes:** aparece al modificar; Guardar/Descartar; estados de guardado y de error; éxito solo tras la respuesta del servidor. Se apoya sobre la isla en celular. Lo escrito en un área queda como borrador al moverse dentro de Ajustes; salir de Ajustes o recargar pide confirmación.
- **Movimiento:** botones 120 ms, selecciones y barra 160 ms, diálogos 220 ms, paneles 280 ms; curvas `cubic-bezier(.23,1,.32,1)` y `(.32,.72,0,1)` para paneles. Sin movimiento con `prefers-reduced-motion`.

### Diseño final (18/11/2026)

Fuente: GrowthLabs-Talleres-App-Final (ZIP). Combinación: Hoy, Taller, Clientes y ficha A; Más B; Recepción B; Orden con cabecera A e interior B; resto de módulos A; isla C. Una sola presentación, sin selector A/B. Estilos en la sección «Diseño final» de `propuesta-a.css`; piezas de HTML en `public/js/diseno.js`.

- **Colores:** claro del diseño (fondo `#f2f3f1`, superficies `#fff` / `#f6f7f5` / `#e9ece8`, tinta `#15171a` / `#3b434b` / `#56606a`, líneas `#e0e3df` y controles `#c9cec9`) en `remaster.css`; oscuro grafito en `tema.css` con los estados del diseño (`info`, `ok`, `warn`, `err`). Bloques grafito (`--grafito`) para el resumen de Hoy, la cabecera de la orden y el saldo. La marca de cada taller sigue llegando de `marca.js`.
- **Armado:** sin barra superior. Debajo de 768 px, la isla «Cápsula de vidrio» (vidrio claro u oscuro según el tema); de 768 a 1099 px, columna de íconos de 88 px; desde 1100 px, columna de 240 px con la marca del taller, «Recibir un auto», Hoy, Taller, Clientes, Más y la sesión. El avatar abre el panel de sesión (perfil, tema claro/oscuro/automático, ayuda y salir). La recepción usa modo enfoque: sin isla ni columna.
- **Medidas:** texto 16 px, márgenes 16, tarjetas con radio 16, controles con radio 12, botones de 48 (compactos 44), campos de 52, íconos Material Symbols locales.
- **Encabezados:** Hoy con la marca del taller, la fecha, DEMO cuando corresponde, ayuda y avatar; Taller, Clientes y Más con título grande y ayuda; módulos y orden con volver, título y ayuda (`cab-mod` / `cab-modulo`). El recordatorio del plan es una línea en Hoy; el servicio vencido o suspendido sigue avisándose en todas las pantallas.
- **Hoy:** buscador, resumen grafito (en el taller, retiros de hoy y saldo por cobrar de `/api/cuentas`, o listos sin permiso de dinero), grupos de atención, todo el taller / asignado a mí y tarjetas con marca, patente, etapa de cinco segmentos, estados, responsable, retiro y próximo paso. Atención, retiros, turnos, configuración pendiente y órdenes por responsable quedan como desplegables.
- **Orden:** tarjeta grafito con logo, patente, vehículo, cliente, cinco etapas (anulada tachada, entregada completa), estado, bloqueos, urgencia, responsable y retiro. «Ahora» muestra la sección del próximo paso o la pedida por el enlace (`#/visitas/:id/:sección`); dinero en cinco cifras que no se mezclan; «Toda la orden» arma cada sección al abrirla, una por vez, y recuerda la abierta al guardar.
- **Recepción B:** banda de la marca, hoja progresiva (hechos resumidos y editables, actual desarrollado, siguientes identificados) y barra del borrador. Fotos de ingreso por tipo con miniatura y estado; el reemplazo conserva la foto anterior hasta que llega el nuevo archivo.
- **Patentes:** Mercosur (blanca con franja azul), formato anterior (negra) y sin patente (punteada), en Barlow Condensed.

### Recepción · paso 2 «Panel rápido» (19/11/2026)

Protocolo de `referencia-estados.dc.html` llevado a Growth Labs Talleres (sin la marca ni el rojo de la otra empresa): tres controles de foto en fila (Tablero, Exterior, Daños), cada uno con cámara y «Galería»; miniaturas por categoría con lugar reservado y «+» (Tablero 0 de 1, Exterior N de 4 vistas, Daños si hay); tablero y carrocería como opciones grandes; testigos con estado del motor; una tarjeta por daño con su ubicación y descripción y su foto; «Aclarar zona no revisada (opcional)»; confirmación grande y la línea de lo que falta («Faltan: …», «Todo listo para continuar» o la foto que no se subió con «Ir a la foto»). Estados de cada foto: obligatoria, subiendo, guardada, fallida con «Reintentar». Tocar una miniatura la amplía para corregir qué muestra, reemplazarla o quitarla. Selección con la marca del taller; el rojo solo para una carga fallida. La banda muestra «Paso N de 7 · nombre», la patente y siete tramos.

Los campos que el servidor ya exigía no cambiaron: los testigos y el estado del motor forman el texto de testigos; la opción de carrocería, las descripciones de cada daño y la aclaración forman las observaciones. No se inventa texto: todo sale de lo que la persona eligió o escribió.

### Dirección de estilo aplicación (referencias del 19/11/2026)

Cuatro referencias marcan hacia dónde seguir puliendo la app (aplicado por ahora en el paso 2): tarjetas grandes y redondeadas (16–20 px) con un ícono en círculo, cifras grandes y etiqueta corta; una tarjeta destacada en el color de marca entre tarjetas oscuras; buscador en píldora; resúmenes en franja con estados de color (en stock / bajo / sin stock); listas de movimientos con importe y estado a la derecha; selectores en píldora (Todo / Esta semana / Este mes); calendario horizontal de días; botón de acción redondo y elevado sobre la barra inferior; modo oscuro grafito profundo y modo claro lavanda suave. Se toma la composición, no los datos ni marcas de esos ejemplos.

### Refinamiento de toda la app (26/11/2026)

Referencia interna: Hoy. Estilos al final de `propuesta-a.css` («Refinamiento de toda la app»).

- **Encabezados:** nombre del taller arriba (contexto), título de 32 px y ayuda redonda a la derecha en Hoy, Taller, Más y el índice de Ajustes. Dentro de un área de Ajustes: «volver» con botón redondo, nombre del taller, título de 28–30 px y ayuda redonda (reemplaza el enlace «¿Cómo hago…?»).
- **Filas de opciones (Más e índice de Ajustes):** grupos con rótulo en versalitas sobre una sola superficie de radio 18 con separadores finos; mosaico de ícono de 36 px, nombre, valor actual a la derecha o debajo (solo datos que ya trae la sesión: nombre del taller, validez, página pública, paleta, estado del plan, tema) y flecha. La flecha de avance abre otra pantalla; la flecha hacia arriba abre una hoja (Tu sesión). Los íconos de cada apartado son los mismos en Más y en Ajustes.
- **Ajustes usa los colores del taller** (ya no el azul fijo `#4652FF`): `marca.js` garantiza el contraste y rechaza un principal muy claro antes de guardar.
- **Guardado en Ajustes:** pendiente, bloqueado, guardando, error (lo escrito queda) y «Guardado» con el mensaje del servidor, mostrado en la misma barra recién repintada con el dato nuevo y anunciado por una región de estado; el área queda marcada «Guardado» en el índice mientras dure la visita. Con la barra visible, el campo enfocado se desplaza por encima de ella y de la isla.
- **Superficies y campos:** tarjetas sin marco con sombra mínima en claro y borde fino en oscuro; campos de 48 px, letra de 16 px y radio 12; la elevación queda para la barra de guardado, la isla y las hojas.
- **Selección:** segmentos con peso 700 y contorno; en oscuro, el filtro activo se invierte (tinta sobre grafito) y el segmento activo se aclara, para que no dependa de un matiz.
- **Taller:** cifra del listado elegido («3 autos en el taller», «2 asignadas a mí») junto al auto de la colección. En escritorio (≥ 1100 px) Taller y Clientes son filas anchas de una columna: marca, patente, modelo, motivo y estado alineados para comparar.
- **Auto 3D:** hatchback genérico propio, tres cuartos delantero con la trompa hacia el interior, grafito satinado, cristales ahumados y sombra de contacto corta. Render estático (three.js, solo para producirlo) en `public/ilustraciones/taller/auto-hatchback-160.webp` (4 KB) y `-320.webp` (9 KB), con transparencia, medidas reservadas y `alt=""`. No reemplaza las fotos reales de cada vehículo.
- **Volver desde una orden:** regresa al listado desde el que se abrió (Hoy con su filtro, Taller, Clientes, ficha o Pendientes), con la misma posición.
