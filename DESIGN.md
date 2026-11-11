---
name: Growth Labs Talleres · base operativa
description: Paso a paso, con una próxima acción clara y estados fieles al taller.
colors:
  action: "#af1927"
  action-hover: "#8d1320"
  on-action: "#fff"
  action-tint: "#fff0f1"
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
  dark-background: "#161b21"
  dark-surface: "#1d242c"
  dark-ink: "#edf1f5"
  dark-action: "#ae2034"
typography:
  headline:
    fontFamily: "Barlow, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-.02em"
  receiving-title:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-.02em"
  body:
    fontFamily: "Barlow, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    lineHeight: 1.45
  plate:
    fontFamily: "Barlow Condensed, Barlow, Arial Narrow, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: ".06em"
  label:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "14px"
rounded:
  small: "4px"
  control: "6px"
  panel: "8px"
  receiving-control: "12px"
  receiving-card: "16px"
  island: "30px"
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

Una decisión de recepción por pantalla y una próxima acción clara por orden. Dirección A «Paso a paso», heredada de la base operativa original; la pantalla Más conserva exclusivamente los grupos, el orden y los iconos de B. Se fusiona con el sistema anterior: siguen la hoja clara sobre marco gris, la tinta oscura, Barlow local y el rojo de acción por defecto; recepción y navegación incorporan formas más amplias y redondeadas.

La identidad la llevan el nombre y el logo de cada taller, las patentes, la orden numerada y el lenguaje real del taller. El selector sol/luna se conserva. Las superficies y los estados comunican decisiones operativas, sin indicadores inventados ni fotografías genéricas. Sistema heredado de la base operativa (versión 0.6.1) al iniciar Growth Labs Talleres 0.1.0. El rojo es el color de acción por defecto: la identidad configurable por taller lo separará de los colores semánticos (error, deuda, acción destructiva) mediante tokens propios; ver docs/HOJA-DE-RUTA.md.

**Key Characteristics:**

- Una decisión visible y un siguiente paso concreto.
- Patente y número de orden como anclas de identidad.
- Superficies sobrias, controles amplios y estados con palabras.
- Datos, permisos y confirmaciones fieles al servidor.

Los valores se extraen de la cascada de `public/index.html`: app, interacciones, remaster, pos, tema, operación, isla y finalmente propuesta-a. Esta fusión sustituye la documentación anterior de cuatro áreas de orden y del círculo activo elevado en la isla.

## Colors

Rojo de acción sobre una base gris fría y superficies blancas; los colores semánticos conservan texto, icono y borde.

### Primary

- **Rojo de acción (por defecto):** acción principal y selección. El token de acción y el rojo semántico coinciden en claro; en oscuro se separan para preservar el contraste entre botón y texto.
- **Rojo profundo:** respuesta de hover de la acción principal.
- **Rojo suave:** fondo de una elección activa o de un aviso de error; nunca reemplaza el mensaje.

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

**The Estado con palabras Rule.** Ningún color sustituye el nombre del estado, el icono o la explicación de un bloqueo.

## Typography

**Body Font:** Barlow local, con fallback de sistema. Pesos disponibles: 400, 500, 600 y 700.
**Label/Mono Font:** Barlow Condensed local para patentes; cifras tabulares para dinero, kilometraje y fechas cuando corresponde.

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

La isla móvil sólida alcanza (430px), reserva espacio inferior y respeta áreas seguras. Recibir ocupa el centro cuando el permiso lo habilita; sus otros destinos son Hoy, Taller, Clientes y Más. Al recibir y dentro de la orden, se oculta por modo enfoque. Si falta permiso de recepción, quedan cuatro destinos. El estado activo usa color, sin el círculo elevado de la versión anterior.

## Elevation & Depth

La hoja y las tarjetas son planas, con bordes y cambios tonales. Las sombras se reservan para navegación flotante y superposiciones existentes. La isla conserva una sombra ambiente; Recibir tiene un anillo de superficie, no un resplandor. Los valores exactos y las transiciones se registran en `.impeccable/design.json`.

Feedback breve, entre (120–180ms), sin retrasar acciones. La presión de motivo, marca y enlace de Más reduce la escala a (.985); con movimiento reducido se elimina. Los avisos entran en (180ms), salvo movimiento reducido. No hay motor de animación nuevo.

**The Hoja plana Rule.** No agregar sombras decorativas a formularios o tarjetas para crear jerarquía; usar espacio, borde, texto y estado.

## Shapes

El sistema compartido conserva esquinas discretas para controles y paneles. Recepción y Más amplían el radio para agrupar decisiones: campos y marcas suaves; motivos, revisión y contenedores con esquinas más amplias. La isla es una cápsula y su acción Recibir es circular (52px). La patente mantiene su silueta propia con borde superior marcado.

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
