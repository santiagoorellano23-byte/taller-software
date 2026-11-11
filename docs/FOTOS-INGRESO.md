# Estado y fotos al ingresar · versión 0.6.0

Pedido del 11/11/2026: registrar el estado previo para poder consultarlo al entregar el auto. Implementación local sobre la candidata de movimiento; no publicada en Hostinger ni GitHub en esta intervención.

## Uso

Recepción pasa a siete pasos: Auto → Estado al ingresar → Motivo → Kilometraje → Autorización → Datos opcionales → Revisión.

El segundo paso requiere foto del tablero y foto del exterior, descripción de cada foto, decisión sobre testigos y daños, observación general y confirmación de que las fotos corresponden a este ingreso. Si hay daños previos exige también foto de detalle. Si hay testigos o el tablero no enciende exige aclaración; aun sin encender se fotografía el tablero. Agregar tantas vistas como hagan falta para cubrir los daños observados (máximo 12 fotos). No se infiere un diagnóstico de las imágenes.

Originales JPG/PNG/WEBP hasta 15 MB por archivo, sin compresión ni edición automática. El selector nativo permite elegir fotos; las opciones de cámara dependen del dispositivo. Falta comprobar cámara y teclado en teléfono físico; no se declara validada esa parte por emulación.

## Persistencia y seguridad

- La carga va a archivos privados existentes, fuera de public. El borrador en sessionStorage guarda referencias y descripciones, nunca los binarios.
- Cada carga tiene su propia idempotencia y pertenece al usuario/taller y clave del borrador. Reintentar la misma carga no crea otro adjunto. Al recargar se comprueban las referencias contra el servidor.
- Confirmar una recepción nueva exige el registro también en la API, incluso sin `recepcion` de la interfaz guiada. Clientes antiguos deben actualizarse; no existe un bypass por omitir el objeto moderno.
- La transacción vincula las fotos, crea la orden y conserva el registro en `visitas.recepcion_json.estadoIngreso`. Un error no deja vehículo/contacto/orden parciales ni consume las fotos preparadas.
- Se comprueban propietario, taller, borrador, categoría real del adjunto, existencia del archivo, huella y referencias distintas. No reutiliza fotos de otra orden ni acepta el mismo archivo como tablero y exterior.
- Fecha de carga, autor y SHA-256 proceden del servidor. No se presenta esa fecha como certificación de cuándo se tomó la imagen ni se promete autenticación pericial del contenido.
- Consulta en Resumen, Historial, Archivos y Control y entrega. Acceso privado con sesión del taller. El estado original no se pisa con cambios de cabecera ni se archivan esas fotos desde la API; correcciones posteriores se añaden como notas del historial.
- Las órdenes anteriores conservan sus datos: muestran que no tienen registro fotográfico de ingreso. No se fabrican fotos retroactivas.
- Cambiar la identidad del auto en el borrador exige fotos nuevas, incluidas las cargas aún en curso. Cambiar fotos o descripciones vuelve a pedir la confirmación.
- Fotos descartadas de un borrador no se adjuntan a la orden y permanecen como cargas privadas preparadas; no hay una purga automática en este cambio. Límite de 36 cargas por clave de borrador y 12 seleccionadas por orden. Contemplar su almacenamiento en la administración de respaldos.

Migración aditiva: `006_fotos_ingreso.sql`, columnas de preparación sobre adjuntos e índice por taller/usuario/clave. Sin dependencias nuevas. Los respaldos existentes incluyen las fotos registradas; la prueba restaura una base nueva y verifica que fotos y registro coinciden.

## QA y demo

`evidence/fotos-ingreso-2026-11-11/pruebas.log` y `resultado-pruebas.json` son la evidencia automatizada final. Pruebas específicas cubren permisos, cruce de talleres/usuarios/borradores, datos faltantes, daño sin detalle, testigos sin aclaración, duplicados, archivos alterados, confirmación idempotente, conservación del original y respaldo/restauración. Pruebas de UI controladas cubren hidratación, falta de conexión y respuesta tardía después de cambiar de auto.

Prueba manual en la demo aislada: patente ficticia FOTO061QA, orden número 9, id 10, tres capturas ficticias (no fotos reales), bloqueo sin fotos, bloqueo de daño sin detalle, recuperación tras recarga, confirmación única y consulta en historial. Capturas y matriz de tamaños en la misma carpeta de evidencia. No se escribieron datos en producción.

Demo: `http://127.0.0.1:3137/?v=0.6.0#/recibir`. Lanzador local: ABRIR-DEMO-MOVIMIENTO.cmd; reutiliza los datos ficticios. Producción/GitHub mantienen el último estado confirmado 0.5.0, no comprobado de nuevo en esta tarea. La candidata incluye también el movimiento local previo.

Antes de publicar: respaldo real nuevo y restauración aislada, paquete verificado, conservación de variables de entorno y carpeta externa de datos, prueba tras despliegue. Mantener los cinco administradores y el cron temporal por minuto por decisión explícita del usuario. No copiar seed, fixtures, evidencia ni bases de la demo al alojamiento.
