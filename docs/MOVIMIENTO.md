# Movimiento e interacción

11/11/2026 · candidata local **0.6.0-rc.2**. Producción y GitHub conservan 0.5.0; esta intervención no los publica ni cambia datos reales.

## Resultado y alcance

Una capa común de respuesta para controles de todos los módulos, más transiciones explícitas donde cambia el contexto. Identidad, logo, navegación A, iconos sol/luna, reglas de negocio y permisos conservados. No hay nuevas dependencias de ejecución ni migración a React. No se animan importes, patentes o filas por cada búsqueda. El guardado nunca espera una animación ni acredita éxito antes del servidor.

- `public/css/movimiento.css`: última capa de estilos, resuelve conflictos de cascada y define la escala común de movimiento.
- `public/js/movimiento.js`: entradas WAAPI, cancelación, retirada no interactiva y fallback. Un registro por elemento, sin MutationObserver ni animación por cada inserción.
- `app.js`: entrada de cabecera, o del contenido de la solapa en la orden; omite reentrada al recargar tras guardar. Cancela efectos del contenido anterior y devuelve foco al encabezado al volver a una ruta recordada.
- `recibir-pasos.js`: nueva etapa con dirección acorde al avance/retroceso, sin clonar formularios ni esperar efectos; resúmenes mientras se escribe permanecen quietos.
- `ui.js`: toast interrumpible, retirada inmediata de interacción, acciones ejecutadas sin esperar; foco estable al cerrar después de renovar un formulario. Conserva protección de acciones pendientes, pausas por foco/puntero y límites de avisos.
- `ayuda.js`: entrada/salida por abajo en móvil o costado en escritorio; foco restaurado sin esperar el efecto.
- `mostrador.js`: respuesta breve del título de una línea nueva, sin animar total o cantidad.
- HTML de ingreso/activación y páginas públicas: carga de la capa de controles compartida. No se presume recorrido público completo por incluir la hoja.

## Escala y reglas

| Situación | Tiempo normal | Tratamiento |
|---|---:|---|
| Presión, hover y foco de campos | 120 ms | Color/borde; botones elegibles 1px. Teclado con foco inmediato. |
| Cabecera, solapa y paso | 180 ms | Opacidad; etapa nueva hasta 6px. No mueve el shell/sticky. |
| Ayuda | 240 ms | Desplazamiento breve de 18px desde su borde. |
| Retirada de aviso/ayuda | 120 ms | Interacción y acceso retirados de inmediato; eliminación con fallback máximo 160ms. |
| Diálogo nativo | 180 ms entrada | Cierre/resolución inmediata, sin depender de animationend. |

Fuente de tiempos y curvas: variables CSS `--respuesta-rapida`, `--respuesta`, `--respuesta-panel`, `--respuesta-curva`, `--respuesta-curva-panel`. JS lee estos tokens, acepta ms/s y usa fallback si no hay hoja o WAAPI.

Hover de movimiento solo con puntero fino. Foco blanco sobre avisos oscuros y navegación oscura; rojo sobre superficies claras. Selección de marcas/motivos y detalles mantiene geometría. Sin `transition:all`, scroll secuestrado, parallax, loops decorativos, temporizadores por fila o `will-change` generalizado. Solo el indicador de carga real gira.

`prefers-reduced-motion` se respeta desde la apertura y al cambiar en vivo: cancela WAAPI y elimina desplazamientos CSS. Teclado cancela efectos y evita nuevas entradas de movimiento; los diálogos también abren sin movimiento. La información sigue disponible en texto/estado/color. Impresión sin animaciones.

## Cobertura y evidencia

La matriz distingue aplicar una capa compartida de probar exhaustivamente cada acción de negocio. No se afirma que cada formulario o dispositivo físico haya sido probado a mano.

| Área | Aplicado | Verificado en esta intervención |
|---|---|---|
| Ingreso y shell | Campos, botón ocupado, tema, foco, navegación | Ingreso con dueño ficticio; marca conservada; controles móvil/escritorio. |
| Hoy/Taller/Clientes/Pendientes | Navegación, filtros, botones, entrada de cabecera; listas quietas | Apertura y geometría; Hoy en 360/390/430/768/1440. |
| Recepción | Selecciones, progreso, avance/retroceso y campos | Auto nuevo Ford, motivos, sin lectura, revisión sin costo, omitir opcionales, Cambiar, recuperar borrador y confirmar una orden. 360/390/430/768/1440. |
| Ficha de orden | Tabs, cuerpo de sección, controles | Cinco solapas en escritorio; resumen en tamaños móviles/tablet; no oferta prematura de cobro en nueva orden. |
| Revisión/presupuesto/trabajos/repuestos/control/cobros/archivos | Controles, formulario, detalles, diálogos y feedback comunes | Cinco áreas principales abiertas. Reglas de autorización/cobro/entrega y reintentos cubiertas por suite; no se hizo cobro real. |
| Historial/notas | Guardado, aviso y foco | Notas ficticias guardadas; cierre por teclado devuelve foco a `#contenido`, incluso tras reemplazar el botón. |
| Mostrador | Catálogo, selección y línea nueva | Agregar el mismo artículo dos veces deja una línea, cantidad2 y total correcto; quitar y descartar sin registrar venta. |
| Agenda/Cuentas/Stock/Compras/Proveedores/Caja/Reportes | Campos, navegación, categorías, botones, tablas estables | Apertura/geometría en escritorio; principales módulos también390. Sin transacciones reales. |
| Más | Grupos, controles, chevron y foco | Móvil claro/oscuro; 360/430/768; accesos existentes conservados. |
| Ajustes/Usuarios/Catálogos/Conexiones/Datos/Registro | Tabs, formularios, selección, confirmación | Seis secciones abiertas en1440; no cambios en usuarios ni configuración real. |
| Biblioteca/Archivo/Calculadora/QR/Ayuda | Respuesta común, ayudas/disclosures | Apertura390/1440; panel de ayuda abre/cierra; cámara física no probada. |
| Activación y página pública/directorio | Hoja común de controles | Recursos coherentes comprobados por suite; no activaciones reales ni revisión pública completa. |

`evidence/movimiento-2026-11-11/matriz-pantallas.json`: 52 comprobaciones de geometría registradas, sin desbordes en esos casos. No equivale a 52 recorridos funcionales completos. El navegador habitual reportó movimiento reducido; se verificó ese comportamiento sin modificar la preferencia del sistema.

Motor normal: laboratorio local aislado con preferencia controlada, API WAAPI real y estilos calculados. Nueve casos: inicio/duración, opacidad intermedia/final, cierre durante entrada, retirada del nodo, cambio de preferencia, reducido, teclado, edición disponible y limpieza. Evidencia `motor-normal-navegador.json`. No es una medición de FPS en un teléfono físico ni una revisión de toda la app con movimiento normal.

Suite final: **71 pruebas aprobadas, 0 fallos** en `pruebas.log`; código de salida en `resultado-pruebas.json`. Se agregó un caso para tokens CSS después del primer pase de70. Pruebas nuevas sobre reentrada, teclado, preferencia, cierre, falta de WAAPI, limpieza y fallback. La suite conserva las pruebas de dinero, aislamiento, persistencia, permisos e idempotencia.

## Autocrítica y correcciones

1. Reglas antiguas de remaster quitaban transform de las transiciones de botones: resuelto con hoja final única.
2. Motivos, marcas y Más escalaban bruscamente: reemplazado por respuesta que mantiene sus cajas.
3. Foco rojo sobre toast oscuro no contrastaba: contorno blanco en esa superficie.
4. Un botón deshabilitado durante guardado puede dejar foco en body; restaurarlo no sirve. Al cerrar aviso se vuelve a contenido estable cuando corresponde.
5. Navegar a una vista recordada restauraba scroll pero podía perder foco: encabezado enfocado sin desplazar scroll.
6. Animar cada render hubiera producido ruido al escribir o guardar: enganches explícitos y recargas sin reentrada.

## Fuentes, skills y dependencias

- 21st: https://21st.dev/ y https://21st.dev/mcp. Analizado como referencia de interacción/componentes; no se copió código React ni se conectó una cuenta.
- Motion Primitives: https://github.com/ibelick/motion-primitives. Referencia de continuidad y paneles; no se instaló React/Motion/Tailwind ni se copiaron componentes.
- Spline: https://spline.design/mcp. Evaluado y descartado para operación diaria por no requerir escenas3D. No hay MCP ni escena añadidos.
- GSAP: https://gsap.com/docs/v3/Plugins/ScrollTrigger/. No se necesita animación vinculada al scroll en este panel; no se agregó el runtime ni ScrollTrigger.
- Skill oficial `gsap-performance` instalada mediante helper de skills en `.agents/skills/gsap-performance`, procedente de https://github.com/greensock/gsap-skills/tree/main/skills/gsap-performance (MIT). Disponible para cargar en siguientes interacciones/sesiones. No es una dependencia de ejecución. Hash/procedencia en `peso-y-procedencia.json`.
- Se aplicaron las guías locales de animación y rendimiento. La implementación nueva es propia con CSS/WAAPI; no hay imágenes nuevas ni recursos remotos obligatorios.

El archivo de peso registra bytes originales y estimación gzip de los dos archivos nuevos. No es tráfico medido ni una garantía de rendimiento. Sin nueva cuenta, suscripción, CDN o permisos de cámara.

