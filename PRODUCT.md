# Producto · Growth Labs Talleres

Software de gestión para talleres mecánicos, operado por Growth Labs como un único producto compartido. Cada taller tiene su espacio privado, sus usuarios, su configuración y su identidad (nombre, logo y, próximamente, colores). Las mejoras se publican para todos; no hay una copia del software por cliente.

Público inicial: talleres independientes de una sede, con dueño involucrado y equipos pequeños, empezando por Mendoza (Valle de Uco). La pregunta operativa de cada pantalla es qué requiere atención ahora y cuál es la siguiente acción segura.

## Superficies

1. **Aplicación del taller** (este repositorio): Hoy, Taller, Agenda y Más; acciones según rol; recepción guiada; ficha de orden; ajustes.
2. **Página pública y directorio** de cada taller (opcionales, con datos que el dueño confirma).
3. **Administración de Growth Labs** (por construir): altas, planes, pagos, límites, respaldos y auditoría, con privilegios separados de los del dueño de un taller.
4. **Sitio comercial** (fuera de este repositorio): solo muestra funciones verificadas.

## Recorrido

Recibir → revisión → presupuesto versionado y respuesta → trabajo y repuestos → control → listo → liquidación → cobro → entrega → historial por patente. También Mostrador, Agenda, Repuestos/compras, Clientes, Caja/cuentas, Reportes, documentos, Biblioteca y configuración.

## Compromisos durables

- Autorizado, realizado, liquidado y cobrado son dimensiones distintas. Recibido no significa colocado; listo no significa entregado; desconocido no significa cero.
- Una modificación de algo autorizado crea una nueva versión y requiere su propia respuesta. Se conservan antecedentes y documentos emitidos; lo postergado no se cobra.
- Guardar es explícito. Las correcciones crean movimientos o versiones con motivo; no se borran registros de dinero, stock ni documentos. Antes de una operación de dinero se muestran destinatario, importe, medio y efecto.
- Todo ingreso nuevo registra fotos de tablero y exterior; daños previos requieren detalle fotográfico. Contrato en `docs/FOTOS-INGRESO.md`.
- El servidor filtra por taller y comprueba permisos, asignación y estados. Ocultar un botón no sustituye esa comprobación. El plan contratado tampoco reemplaza el permiso del usuario.
- Marca del producto separada de la del taller: los documentos emitidos conservan la identidad con que se emitieron, aunque el taller cambie su logo después.
- No inventar tarifas, servicios, actividad, testimonios ni datos. Los datos ficticios viven solo en demos y pruebas aisladas.
- Preparar un aviso no es enviarlo. WhatsApp/correo automáticos e IA no están activos; se comunica su estado real y la alternativa manual.
- ARCA y Libro IVA están excluidos. Los documentos del sistema no son facturas.
- Seguridad, respaldos, historial y exportación de datos propios no son restricciones de un plan comercial.

## Fuera del alcance actual

Portal del cliente final con autorización por enlace, multisucursal, dominio propio, mensajería automática, facturación fiscal y funcionamiento sin conexión completo. No se anuncian como disponibles.
