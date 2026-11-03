# TaskTracker: identidad visual

Azul atlántico y hielo. Color principal `#0369a1`; acompañamiento `#38bdf8`.

Los tokens y estilos de marca se mantienen en `src/styles.scss`. Navegación, botones, foco, formularios y marca deben conservar esta familia, incluyendo móvil y el tema oscuro cuando exista. Los colores de éxito, advertencia, error y las series de gráficos conservan significado semántico; no se sustituyen indiscriminadamente por el color de marca.

El acceso habitual continúa usando la sesión común de Authelia. Esta identidad no introduce una cuenta, contraseña ni formulario adicional. El piloto TaskTracker comparte la familia de TaskTracker. Las tarjetas de productos de KOVA deben representar la identidad del producto enlazado.

Las descargas conservan esta identidad sobre papel blanco: encabezado azul profundo `#0c2e42`, tablas azul atlántico `#0369a1`, acento hielo `#38bdf8` y filas alternadas `#f0f9ff`. `src/app/shared/report-pdf.ts` centraliza el formato PDF de tareas, horas extras y seguimiento. Los informes tienen texto seleccionable, encabezados repetidos, filas sin cortes cuando caben en una página y numeración final de páginas. El tema de la aplicación no cambia los colores del documento impreso.

La vista de tareas descarga `.xlsx` mediante `POST /api/tasks/export/view`; requiere publicar también el backend correspondiente. La selección envía identificadores en el orden de la vista y su nivel de jerarquía. Se mantiene separado el CSV de respaldo compatible con la importación existente.

La ficha `/projects/:id` conserva la paleta del producto en las métricas, pestañas, acciones y edición en lote, con los mismos tokens en ambos temas y móvil. El color elegido para cada proyecto se conserva como marca propia del documento/proyecto. La selección en lote se limita a las tareas ejecutables visibles; los grupos derivan sus valores desde sus subtareas. El diálogo muestra los campos elegidos y las tareas antes de guardar.
