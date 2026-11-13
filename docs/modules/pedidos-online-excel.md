# Pedidos_online → Excel de pedidos

## Alcance

La integración toma la hoja pública `Pedidos_online` del Google Sheet configurado en `lib/services/pedidos-online-excel.service.ts`. Sólo procesa pedidos con `Modalidad = Delivery` cuyo ID no estaba en el Sheet cuando ADMIN activó la integración. La activación guarda una fotografía de los IDs existentes en PostgreSQL. El worker del ERP vuelve a leer la hoja cada dos minutos; `PEDIDOS_ONLINE_EXCEL_AUTO=false` desactiva sólo ese worker.

Pausar detiene la lectura y entrega de operaciones sin cambiar la fecha de primera activación. Reanudar conserva la fotografía inicial y procesa también los IDs nuevos que aparecieron durante la pausa.

La escritura se realiza desde un complemento Office.js instalado en el Excel de escritorio que permanece abierto y tiene Autoguardado. Usa un token aleatorio que ADMIN genera en `/pedidos-online-excel` y que se guarda como hash en `ConfiguracionGlobal`. El complemento consulta operaciones cada 30 segundos, comprueba el nombre del libro y escribe en la tabla `Pedidos2026` de la hoja `2026`. En OneDrive personal, Graph Excel REST no es una alternativa para esta escritura. El ERP no necesita controlar la ventana de Excel ni bloquear a la persona que toma pedidos.

## Mapeo

| Excel | Origen / regla |
| --- | --- |
| A Fecha | Fecha/Hora del registro en Google; se escribe en la fila asignada aunque tuviera otra fecha precargada. |
| B Nombre y Apellido | Nombre + Apellido. |
| C Pedido | Código de producto normalizado. Ejemplo: `48jyq 48clasicos 8zyh`. |
| D Cantidad | Total de sándwiches dividido por ocho planchas. |
| E Calle | Dirección. |
| F Teléfono | Teléfono como texto. |
| G Horario | `Turno:` de observaciones. |
| H Entrega | Fecha Entrega. |
| T ID Google Online | `GOOGLE:<ID>` para reconocer y actualizar la misma fila. |

Los paquetes cerrados conocidos y los sabores personalizados se convierten en `lib/pedidos-online-excel.ts`. El Sheet tiene dos columnas «Observaciones»: los datos están en la primera y la segunda está vacía. El parser lee todas las columnas de observaciones aunque repitan el nombre. Las cantidades y los sabores de `Surtidos Elegidos` deben coincidir con el detalle de comentarios; si no, el pedido queda en ERROR. «Jamón Crudo» se convierte al código `crudo`. El worker vuelve a evaluar los errores de conversión aunque el Sheet no cambie, y sólo los actualiza si la conversión mejora; los errores de escritura en Excel conservan el reintento manual. Las columnas I:S y sus fórmulas no se editan. El complemento consulta sólo la columna T para localizar un ID existente y las últimas 512 filas de A:H para encontrar una fila libre. Reutiliza una fila con B:H y T vacías, actualiza su fecha A y, si no hay ninguna en ese tramo, agrega una fila al final de la tabla. Así evita leer las siete columnas de pedidos de las casi 30.000 filas históricas en cada operación.

Cuando el estado de Google cambia a cancelado/anulado, o la modalidad deja de ser Delivery, se encola una cancelación. El complemento limpia B:H y T de la fila vinculada. Conserva A, la estructura de la tabla y las fórmulas. Los IDs previos a la activación nunca se alteran.

## Puesta en marcha

1. Desplegar la migración y el ERP. La integración queda apagada.
2. En la PC que mantiene la copia abierta en Excel de escritorio, descargar `https://app.santacatalina.online/office-pedidos/manifest.xml` y agregarlo desde un catálogo de complementos de carpeta compartida de confianza. En Excel: Archivo → Opciones → Centro de confianza → Catálogos de complementos de confianza; agregar la ruta UNC de la carpeta, marcarla para mostrar en el menú y luego elegir Inicio → Complementos → Avanzado → Carpeta compartida. Abrir el panel «Pedidos online» desde Inicio. Microsoft documenta este método como instalación de prueba en Windows, no como distribución productiva permanente; al migrar a Microsoft 365 empresarial debe reemplazarse por distribución administrada.
3. En `/pedidos-online-excel`, mantener seleccionado `Pedidos Santa Catalina ultimo - Copia.xlsx`, generar una clave y pegarla en el panel. La clave sólo se muestra una vez; renovarla revoca la anterior. Tras guardarla, el complemento configura el inicio automático para ese libro y el panel se puede cerrar.
4. Activar la integración. Crear un pedido de prueba desde la página, verificar una sola fila en la copia y cancelarlo; verificar que B:H y T queden vacías. Revisar el estado del pedido en la misma página.
5. Para pasar al libro operativo, pausar la integración, cambiar el destino a `Pedidos Santa Catalina ultimo.xlsx`, instalar y configurar el complemento en ese libro y volver a activar. La fotografía de IDs ya existentes se conserva. Verificar el nombre mostrado en el panel antes de activar.

El complemento debe poder alcanzar `https://app.santacatalina.online`. Si Excel se cierra, el ERP conserva la cola; al abrir el libro se recuperan las operaciones pendientes. Si el libro se renombra o la tabla cambia, se bloquea la escritura y el error aparece en el panel o en la administración. La pestaña `2026` y la tabla `Pedidos2026` deberán adaptarse al cambiar de año.

## Reporte comercial de Pedidos_online

`/reportes/pedidos-online` y `GET /api/reportes/pedidos-online` requieren `permisoReportes` o ADMIN. El reporte lee directamente la hoja configurada para esta integración aunque el worker esté pausado. Comparte la lectura entre filtros durante dos minutos y no cambia el Sheet, el Excel ni Caja. La tabla permite filtrar por `Fecha Entrega` (día local), modalidad, ubicación, estado y texto; ofrece 10 IDs por página y CSV de hasta 10.000 IDs con neutralización de fórmulas. `Fecha/Hora` de registro permanece visible en el detalle, pero no determina el período. Los pedidos sin `Fecha Entrega` válida se excluyen de los períodos y se informan en calidad. Incluye datos personales, por lo que no se habilita con permisos de Caja o Pedidos.

El **ingreso esperado** suma `Precio` de pedidos `Entregado` con fecha y precio válidos, excluyendo IDs duplicados o con valores financieros contradictorios. Los pendientes se muestran como potencial y los cancelados se excluyen. La comparación usa el período inmediatamente anterior con la misma cantidad de días y los mismos filtros. El importe del pedido no demuestra que el dinero haya ingresado: para conciliarlo con movimientos reales de Caja haría falta una relación auditable por ID y medio de pago. Los pedidos anteriores a la activación de la sincronización con Excel también aparecen en este reporte porque se lee toda la hoja disponible.

La **evolución de paquetes** cuenta paquetes de pedidos entregados según `Producto`: `48 Jamón y Queso` equivale a un paquete de 48 sándwiches y `2x 24 Jamón y Queso` a dos paquetes de 24. El total implícito de sándwiches debe coincidir exactamente con `Cantidad`; las presentaciones admitidas son 8, 16, 24, 32, 40 y 48. Un producto ilegible, una cantidad ausente o una diferencia quedan fuera del volumen y se muestran como pedidos sin paquetes calculables. El reporte permite elegir una fecha de entrega para comparar sus paquetes con el mismo día de la semana anterior y los siete días terminados en esa fecha con los siete anteriores. El día actual puede estar incompleto. Esta regla se aplica a la vista online y a la conjunta.

`/reportes/pedidos-conjunto` aplica el mismo análisis a `Pedidos_comunes` configurada en Caja y `Pedidos_online` configurada para la integración con Excel. La clave del pedido es hoja + ID, por lo que un mismo número en ambas hojas representa dos pedidos distintos. El filtro de origen permite ver sólo local, sólo online o la suma; el gráfico por origen separa sus importes esperados. Ambas hojas deben estar configuradas y accesibles para que el total conjunto sea completo.
