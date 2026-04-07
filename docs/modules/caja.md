# 💰 Módulo de Caja

## 1. 📌 Descripción general

El módulo de **Caja** es el núcleo financiero del sistema. Su objetivo principal es controlar, registrar y auditar todos los flujos de dinero físico y digital interno de la empresa. 

Resuelve el problema de la trazabilidad del dinero mediante la separación del capital en múltiples "cajas" (Caja Madre, Caja Chica, Local, Mercado Pago, Mercado Pago Juani) y centraliza las entradas por ventas, salidas por gastos, transferencias internas y la conciliación (rendición) del dinero que ingresan los choferes de logística tras finalizar sus rutas.

---

## 2. 🧩 Componentes principales

### Frontend (`app/(dashboard)/caja`)
*   **`page.tsx`**: Es la interfaz concentradora (dashboard) de caja. Permite:
    *   Visualizar los saldos actuales de cada caja (dependiendo de la ubicación/rol del usuario).
    *   Listar y filtrar movimientos diarios (`MovimientoCaja`).
    *   Registrar, editar y eliminar ingresos/egresos manuales.
    *   Cargar transferencias entre distintas cajas.
    *   Controlar las "Rendiciones Pendientes", una función clave para cobrarle a los choferes lo recaudado en el día.
    *   Configurar conceptos de caja (`ConceptoCaja`).

### Backend (`app/api/caja`)
*   **`route.ts`**: Gestiona el CRUD principal de `MovimientoCaja`. Maneja validaciones estrictas de permisos por ubicación y Rol (ADMIN, FABRICA, LOCAL), asegurando que un cajero del local no pueda tocar la Caja Madre. 
    *   *Nota técnica:* Contiene lógica robusta para revertir saldos en las operaciones PUT y DELETE.
*   **`transferir/route.ts`**: Crea dos movimientos simultáneos (un egreso y un ingreso) en una transacción para mover fondos internamente.
*   **`rendiciones/route.ts`**: 
    *   `GET`: Cruza datos del módulo de _Rutas_ y _Pedidos_. Calcula automáticamente cuánto dinero en efectivo debe tener cada chofer en base a los pedidos cobrados.
    *   `POST`: Confirma la recepción del dinero, actualiza la caja chica y liquida la cuenta del chofer en `RendicionChofer`.
*   **`saldos/route.ts`** & **`conceptos/route.ts`**: APIs de soporte para gestionar categorías monetarias y permitir a administradores forzar/ajustar saldos globales.

---

## 3. 🔄 Flujo de funcionamiento

1. **Ingreso/Egreso Manual:** 
   El usuario abre el modal -> Selecciona tipo, origen (Ej. Local), concepto, monto y medio de pago -> El backend valida la ubicación del usuario -> Se inserta el `MovimientoCaja` -> Se actualiza el agregado en `SaldoCaja` a través de un `increment` o `decrement`.
2. **Conciliación Logística (Rendición):**
   *   El sistema (`GET /api/caja/rendiciones`) busca las `Rutas` de hoy y filtra los `Pedidos` de esa ruta cuyo estado sea "entregado" y el pago "efectivo". 
   *   Suma estos valores y los presenta en pantalla como expectativa ("Monto Esperado").
   *   El supervisor de caja cuenta los billetes del chofer y presiona "Controlado".
   *   El backend (`POST`) registra una `RendicionChofer` documentando el dinero esperado vs real (Diferencia) y crea automáticamente el `MovimientoCaja` enviando el dinero a "Caja Chica".
3. **Transferencia de Fondos (Ej. Local a Caja Madre):**
   El usuario llena el formulario de transferencia -> El backend ejecuta una Tx de base de datos -> Resta al origen -> Suma al destino -> Crea referencias para el historial.

---

## 4. 🔌 Interfaces y dependencias

Este módulo es un "hub" al que confluyen otros procesos de negocio:

*   **Pedidos (`Pedido`, `DetallePedido`):** Los movimientos de caja pueden estar atados a un `pedidoId` cuando un pedido de retiro en local se abona.
*   **Logística (`Ruta`, `Entrega`):** Dependencia estricta para calcular las rendiciones de manera automática sin ingreso manual (evita fraude).
*   **Empleados / Auth:** Dependencia fuerte para el control de accesos (Session del usuario, roles, y su atributo `ubicacionTipo`: FABRICA vs LOCAL).
*   **Mercado Pago (`MovimientoMercadoPago`):** Integración indirecta, los webhooks y operaciones digitales replican data en el sistema para que la caja muestre los ingresos virtuales en tiempo real junto al efectivo.

---

## 5. 🗄️ Interacción con la base de datos

Todas las operaciones mutables están fuertemente protegidas bajo colecciones de `prisma.$transaction`.

**Tablas Principales:**
*   `MovimientoCaja`: (INSERT, UPDATE, DELETE). Historial nominal.
*   `SaldoCaja`: (UPDATE continuo). Caché o totalizador del estado financiero. Funciona con `increment` / `decrement`.
*   `RendicionChofer`: (INSERT, SELECT). Relaciona al empleado (chofer) con la desviación de fondos (dinero faltante o sobrante en su turno).
*   `ConceptoCaja`: (SELECT, INSERT). Tipificación (Gastos varios, Pago de sueldos, Venta mostrador, etc).

---

## 6. ⚠️ Consideraciones importantes

*   **Manejo de Fechas (Timezones):** Es un punto hiper-crítico de este módulo. Existe lógica en `route.ts` que determina:
    *   Si la transacción es *en el día de hoy*, usa `new Date()` (para registrar la hora exacta).
    *   Si la transacción indica *fecha pasada* (ej. cargar un gasto de ayer), fuerza la hora a mediodía UTC (`T12:00:00Z`). Esto previene el clásico bug donde, por desfases de zona horaria del servidor vs cliente, un movimiento insertado para el 5 de Mayo termina registrándose a las 23:00 del 4 de Mayo.
*   **Persistencia Doble (Movimiento vs Saldo):** Por diseño, la base de datos guarda un historial fila por fila y a la vez suma/resta en una tabla maestra `SaldoCaja`. Si se hace un CRUD sobre el movimiento sin tocar el saldo (o si la tx falla en el medio), la caja perderá coherencia.
*   **Restricciones de Ubicación:** Un usuario de `FABRICA` nunca verá la caja del `LOCAL` a menos que sea `ADMIN`. 

---

## 7. 🧪 Casos de prueba sugeridos

Al realizar modificaciones, verificar obligatoriamente:

1.  **Edición de Origen (Borde crítico):** Editar un movimiento y cambiar su origen de "Caja Madre" a "Local". Comprobar que en base de datos la caja madre *recupere* su dinero y el local *pierda o gane* en consonancia.
2.  **Eliminación (Reversión):** Eliminar el registro de una transferencia y validar que se deshizo la resta en la caja origen y la suma en el destino.
3.  **Seguridad Base:** Intentar disparar una petición POST simulando ser gerente del Local, pero mandando un payload de transferencia con `origen: caja_madre` (debería retornar 403 Forbidden).
4.  **Fecha histórica:** Crear un ingreso seleccionando fecha de hace 3 días. Comprobar en base que `fecha` coincida cronológicamente con aquel día (ignorando la hora actual).

---

## 8. 🚀 Posibles mejoras

*   ✅ **~~Refactorización de Lógica de Saldos:~~** IMPLEMENTADO. Se creó `lib/services/caja.service.ts` que centraliza toda la lógica de creación/edición/eliminación de movimientos y su impacto en `SaldoCaja`. Todos los módulos que interactúan con la caja (stock, liquidaciones, webhooks, flota, pedidos) ahora usan `CajaService.createMovimientoEnTx()` en lugar de duplicar la lógica manualmente.
*   **Modelo de Partida Doble (Asientos contables):** Para un sistema a gran escala empresarial, reemplazar la técnica de un solo movimiento + sumador de saldo por Asientos Contables estrictos (Debe/Haber por cada cuenta y cada transacción). Requiere migración de esquema y datos históricos.

---

### 🧠 Notas para futuras IAs o desarrolladores

*   **¡PELIGRO AL BORRAR / EDITAR!**: El proceso de `PUT` y `DELETE` ejecuta una reversión matemática del movimiento original antes de aplicar el nuevo. **Nunca toques esta sección del código (`app/api/caja/route.ts`) sin escribir pruebas o entender al 100% que revertir un ingreso implica un `decrement` y revertir un egreso implica un `increment`.**
*   **Agregar una nueva Caja**: Si la empresa decide tener una "Caja Banco X", debes: 
    1. Agregarlo a `allowedBoxes` en el page.tsx (frontend).
    2. Agregarlo a los arrays de control de permisos (fabricBoxes, localBoxes, etc) dentro de `route.ts` y `transferir/route.ts` (backend).
    3. Asegurarte de poblar un `SaldoCaja` inicial en base de datos.
*   **Mercado Pago**: Las cajas rotuladas como "MP" y "MP Juani" son virtuales. Cualquier ajuste o sincronización con estas debe tratar a las APIs como principal fuente de verdad, la sección de caja actúa aquí en modo espejo/visor.
*   **Fechas UTC vs Local**: **NO MODIFIQUES** la función anónima `(() => { if (!fecha) return new Date()... })()` en la creación de movimientos. Fue ajustada específicamente para solucionar un bug molesto de desfase horario. 
