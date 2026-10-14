# Edición de incidentes como en Tareas

La tabla usa el mismo estilo de celdas, encabezados, controles compactos y botones de acción que Tareas. Ambos componentes comparten el archivo de estilos `src/app/shared/styles/_editable-table.scss`.

- Lápiz: editar en la tabla. Se habilitan título, reportante, proyecto, ambiente de detección, prioridad, desarrollo, QA y fecha objetivo. Check guarda; X cancela sin guardar.
- Editar nota: editar en modal, con los campos completos. Al guardar desde la tabla se regresa a la tabla; desde una ficha se regresa al detalle.
- Doble clic en el título: editar solo el título. Enter o salir del campo guarda; Escape cancela.
- Ojo: consultar detalle, comentarios, evidencias e historial.
- Encabezados: ordenar ascendente/descendente. Shift agrega criterios, como Tareas.
- Borde del encabezado: redimensionar columnas. Los anchos se conservan al volver a abrir el apartado.
- Estado: menú con las acciones válidas. Las observaciones y aprobaciones se registran con el formulario de transición, conservando la certificación QA y la aprobación del cliente obligatorias.

La edición de datos se permite solo en Registrado y Desarrollo, conforme a las reglas del módulo. Al cambiar proyecto se desvincula la tarea anterior para no dejar una asociación con otro proyecto. Los datos de referencia QA, descripción y demás campos no visibles en la fila se conservan al guardar.

## Verificación

Se probó sobre un backend con base H2 temporal: guardar título, prioridad, responsables y fecha en fila; cancelar sin guardar; editar título con doble clic; guardar descripción en modal y regresar a tabla; ordenar y redimensionar; conservar referencias del Excel; pasar a CERT y comprobar el bloqueo de edición de datos. No se modificaron datos reales.

Se compararon ambas tablas en el navegador: tamaño de texto de celda de 13 px y padding de 6 px, con 10 px en el borde izquierdo, coincidentes con Tareas. Se comprobó compilación de producción y ausencia de errores de interfaz.

El lápiz permite cambiar el estado desde la misma fila. Solo ofrece los cambios permitidos por el flujo DESA → CERT → QA → UAT → cliente → PROD. Cuando hace falta registrar responsable, observación o enlace, esos campos aparecen debajo del selector de estado, sin abrir un modal. Desde CERT en adelante se puede editar el estado, mientras los datos de la corrección permanecen protegidos.

El botón Guardar registra datos y cambio de estado en una sola operación: si falla una validación, no guarda parcialmente la edición. El formulario abierto desde la columna Estado se cierra automáticamente después de un cambio exitoso; conserva los datos si hay un error para poder corregirlo.
