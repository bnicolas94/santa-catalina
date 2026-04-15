# 👥 Módulo: Clientes

## 1. 📌 Descripción general

El módulo **Clientes** es el componente fundamental para la gestión de la cartera de compradores (puntos de venta, distribuidores, comercios) dentro del sistema Santa Catalina.

**¿Qué hace el módulo?**
Permite crear, leer, actualizar y eliminar (CRUD) registros de clientes. Administra información de contacto, datos de ubicación (incluyendo geolocalización automática), clasificación comercial (segmento y zona), y parámetros logísticos (frecuencia semanal y pedido promedio).

**¿Para qué existe dentro del sistema?**
Funciona como la entidad base para transacciones fundamentales: no puede existir un *Pedido*, una *Entrega* o un *Cobro* (en Caja) sin estar asociado a un Cliente.

**Problema que resuelve:**
Centraliza el directorio comercial de la empresa. Automatiza la geocodificación de direcciones al momento de la carga para que los módulos de *Logística* y *Rutas* dispongan de coordenadas exactas, facilitando la planificación espacial. Además, permite clasificar a los clientes por zonas y segmentos, lo cual es útil para reportes de Business Intelligence y filtrado.

---

## 2. 🧩 Componentes principales

### Frontend (`app/(dashboard)/clientes`)
*   **`page.tsx`**: Es la única vista del módulo. Actúa como un contenedor que incluye:
    *   **Dashboard de Listado**: Tabla con la nómina de clientes y contador de pedidos históricos (`_count.pedidos`).
    *   **Filtros**: Botonera superior para filtrar el listado rápidamente por "Zona" (A, B, C, D).
    *   **Modal de Edición/Creación**: Formulario incrustado en el mismo componente que maneja la lógica de estado local (React `useState`) para registrar o modificar datos de clientes.
    *   **Acciones Destructivas**: Botones para eliminar un cliente individual y un botón de "Limpieza Masiva" (Clear) condicionado por la zona seleccionada o global.

### Backend (`app/api/clientes`)
*   **`route.ts`**:
    *   `GET`: Obtiene todos los clientes ordenados por `nombreComercial` e incluye el conteo de pedidos.
    *   `POST`: Crea un cliente nuevo. Implementa lógica de formateo automático de calles (agrega "Calle " si el input es solo un número) y dispara la geolocalización usando `geocodeAddress()`.
    *   `DELETE`: Maneja el **borrado masivo** de clientes. Ejecuta una transacción (`prisma.$transaction`) muy agresiva que borra en cascada manual todos los datos transaccionales (`MovimientoCaja`, `Entrega`, `DetallePedido`, `Pedido`) antes de borrar el `Cliente`.
*   **`[id]/route.ts`**:
    *   `PUT`: Actualiza un cliente. Detecta si hubo cambios en los campos de dirección (`calle`, `numero`, `localidad`) y, de ser así, ejecuta un llamado directo a la API de Google Maps para re-calcular y guardar la `latitud` y `longitud`.
    *   `DELETE`: Borrado individual básico de un cliente. (Depende del comportamiento restrictivo de la DB).

---

## 3. 🔄 Flujo de funcionamiento

### A. Flujo de Creación / Actualización (con Geolocalización)
1.  **Input**: El usuario completa el formulario en la UI. Campos clave: Nombre Comercial, Calle, Número, Localidad.
2.  **Preparación (Frontend)**: Se envía un payload JSON (`POST` o `PUT`).
3.  **Higiene de Datos (Backend)**: El servidor formatea el nombre de la calle (ej: normaliza "154" a "Calle 154").
4.  **Geocodificación**: Si hay calle y número, el servidor hace un request a la API de Google Maps.
5.  **Persistencia**: Se guardan los datos del cliente junto con la `latitud` y `longitud` obtenidas.
6.  **Output**: El Frontend recibe el cliente creado/actualizado, cierra el modal, muestra un Toast de éxito y hace re-fetch de la tabla.

### B. Flujo de Borrado Masivo
1.  **Input**: El usuario presiona "🧹 Limpiar". Si tiene un filtro de Zona activo, purgará solo esa zona; si no, purgará la base completa.
2.  **Confirmación**: Advertencia destructiva en el cliente.
3.  **Ejecución (Backend)**: El endpoint `DELETE /api/clientes` recibe un array de `ids`.
4.  **Cascada Inversa**: Abre una transacción en Prisma y borra de "abajo hacia arriba": Movimientos de caja vinculados $\rightarrow$ Entregas $\rightarrow$ Detalles de pedidos $\rightarrow$ Pedidos $\rightarrow$ Clientes.

---

## 4. 🔌 Interfaces y dependencias

### 📥 Módulos que usan a "Clientes"
*   **Pedidos**: Relación directa (1 a N). Cada pedido requiere un `clienteId`.
*   **Logística / Rutas (Entregas)**: Requiere explícitamente a los clientes para armar hojas de ruta. Consume la `latitud` y `longitud` para mapas.
*   **Caja**: Los movimientos de caja asociados a pedidos arrastran indirectamente la identidad del cliente.

### 🌐 Dependencias Externas / Librerías
*   **Google Maps Geocoding API**: Dependencia crítica (`process.env.GOOGLE_MAPS_API_KEY`). Si la API key falla, expira o excede cuota, los clientes se guardan sin coordenadas (lo que puede afectar el módulo de logística).
*   **`@/lib/services/geocoding`**: Helper local usado en la creación (POST). Curiosamente, la actualización (PUT) tiene el fetch a Google explícitamente dentro de `[id]/route.ts`.

---

## 5. 🗄️ Interacción con la base de datos

El módulo interactúa principalmente con la tabla `clientes` y, en operaciones de borrado profundo, con las tablas adyacentes.

### Tabla Principal: `clientes` (modelo `Cliente`)
*   **Claves primarias**: `id` (UUID).
*   **Campos relevantes**: `nombreComercial`, `contactoNombre`, `contactoTelefono`, `direccion` (calculado/compuesto), `calle`, `numero`, `localidad`, `latitud`, `longitud`, `zona`, `segmento`.
*   **Operaciones típicas**:
    *   `SELECT`: Obtiene registros adjuntando la relación `_count: { pedidos: true }`.
    *   `INSERT`: Se ejecuta post-geocodificación de dirección.
    *   `UPDATE`: Actualización parcial. Muta coordenadas si cambia la dirección.

### Tablas Secundarias afectadas (por `DELETE` masivo)
*   Toda transacción destructiva elimina registros asociados en: `movimientos_caja`, `entregas`, `detalle_pedidos` y `pedidos` (usando `where: { pedido: { clienteId: { in: ids } } }`).

---

## 6. ⚠️ Consideraciones importantes

*   **Diferencia de protección en Borrado**:
    *   El borrado individual (`DELETE /api/clientes/[id]`) ejecuta un `prisma.cliente.delete`. Como en `schema.prisma` la relación entre `Pedido` y `Cliente` no tiene `onDelete: Cascade`, **esto va a fallar (Error 500)** si intentan borrar individualmente un cliente que ya tiene pedidos registrados. Sirve como protección implícita.
    *   El borrado masivo (`DELETE /api/clientes`) **elude esta protección** implementando un borrado en cascada manual (`prisma.$transaction`). Este botón destruye historial económico por lo que es de alto riesgo.
*   **Falla Silenciosa de Geocodificación**: Si Google Maps rechaza la petición en el backend, la creación/edición no falla. Se captura el error en un `catch`, las coordenadas quedan en `null` o `undefined` y el cliente se crea igual. Esto asegura alta disponibilidad del CRUD pero podría degradar datos logísticos.
*   **Duplicidad de Código Geocoding**: El file `route.ts` usa un servicio (`geocodeAddress`), mientras que `[id]/route.ts` tiene la lógica de `fetch` hacia Google Maps directamente escrita dentro del endpoint.

---

## 7. 🧪 Casos de prueba sugeridos

### Casos normales
*   Crear un cliente informando todos los campos incluyendo "Localidad" para verificar que se asigne correctamente la latitud y longitud.
*   Modificar la "calle" y el "número" de un cliente existente y corroborar que el sistema actúe en segundo plano para cambiar sus coordenadas.
*   Filtrar clientes por zona (A, B, C, D) y corroborar conteos.

### Casos borde
*   Ingresar una calle formada solo por números (ej: "15") y comprobar que el sistema la formatee como "Calle 15" antes de guardarla.
*   Eliminar de manera individual un cliente que tenga un pedido creado (debería lanzar un error bloqueante pero protegido).

### Casos de error
*   Intentar crear un cliente vacío o sin el `nombreComercial` obligatorio.
*   Fallo en Google Maps Geocoding (simular API Key inválida) $\rightarrow$ Verificar que el cliente se guarde igual y no crashee la App.

---

## 8. 🚀 Posibles mejoras

1.  **Unificar lógica de Geocodificación**: Mover el `fetch` directo de `[id]/route.ts` a la librería `@/lib/services/geocoding.ts` para no tener código de infraestructura duplicado en los controllers.
2.  **Paginación y Virtualización**: Actualmente `GET /api/clientes` trae toda la tabla de memoria de una vez. Si la cartera escala a miles de clientes, esto puede ralentizar el Frontend. Refactorizar a un modelo paginado (`limit`, `offset`) o usar Infinite Scroll.
3.  **Soft-Delete (Lógico)**: En vez de un borrado masivo y destructivo por cascada (`prisma.$transaction` con `deleteMany`), implementar un soft-delete (ej: `activo: false`) para mantener la integridad referencial y las estadísticas de negocio históricas.
4.  **Mejor manejo del borrado individual**: Cambiar la falla no controlada (Prisma FK constraint de la DB) por una verificación previa: si el cliente tiene pedidos, negarle el borrado con un mensaje custom ("No puedes eliminar un cliente con historial").

---

## 9. 🧠 Notas para futuras IAs o desarrolladores (Extra)

*   **NO ALTERAR EL BORRADO MASIVO sin entender las implicancias**: Si necesitas añadir nuevos módulos transaccionales que relacionen a `Cliente` (o actúen sobre `Pedidos`), recuerda agregar el `deleteMany()` correspondiente en la transacción del endpoint `DELETE` masivo. Si lo omites, Prisma bloqueará toda la transacción debido a restricciones lógicas restrictivas de Foreign Keys y el botón dejará de funcionar.
*   **Cuidado con `schema.prisma`**: La relación en Prisma `cliente Cliente @relation(fields: [clienteId], references: [id])` es restrictiva por defecto. Es fundamental mantener esta rigidez y no activar `onDelete: Cascade` en la DB para prevenir la eliminación accidental de transacciones contables desde herramientas de BD.
*   **Dependencia Crítica UI -> Google Maps**: El comentario en el UI de `<p>Obligatorio para que Google Maps encuentre el lugar</p>` indica que la precisión georreferencial es sensible al dato `localidad`. Si modificas o cambias el nombre de los campos del formulario, asegúrate de pasarlos correctamente al `geocodeAddress` o romperás el cálculo de rutas y fletes.
