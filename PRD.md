__SANTA CATALINA__

*Sandwichería & Distribuidora*

__PRODUCT REQUIREMENTS DOCUMENT__

Sistema Operativo de Gestión Industrial

__Versión__

1\.0 — Febrero 2026

__Plataforma__

Antigravity \+ n8n

__Rubro__

Fábrica y distribuidora de sándwiches de miga

__Etapa__

Crecimiento acelerado — MVP operativo

__Estado__

Para revisión — Pre\-desarrollo

# __1\. RESUMEN EJECUTIVO__

Santa Catalina es una sandwichería artesanal en etapa de crecimiento acelerado que actualmente opera con hojas de cálculo \(Google Sheets\) para el registro de producción, tareas y objetivos diarios\. El negocio tiene procesos definidos empíricamente pero carece de un sistema integrado que permita tomar decisiones en tiempo real, controlar costos con precisión y escalar la operación sin perder calidad ni control\.

Este documento especifica el sistema digital que reemplazará y potenciará la operación actual: una plataforma web construida en Antigravity con automatizaciones en n8n, diseñada para ser el centro nervioso operativo del negocio\.

## __1\.1 Problema a resolver__

- Los datos de producción, empleados, clientes y costos están fragmentados en hojas separadas sin relación entre sí\.
- No existe cálculo automatizado de costo unitario real por variedad de producto\.
- No hay trazabilidad de lotes desde insumos hasta entrega al cliente\.
- El control de stock es manual y reactivo: se descubre la falta de insumos cuando ya es problema\.
- No existen métricas de rentabilidad por cliente ni de eficiencia logística\.
- Las alertas y reportes dependen de que alguien los genere manualmente\.

## __1\.2 Solución propuesta__

Un sistema web operativo con las siguientes capacidades core:

- Gestión de producción por lotes con trazabilidad completa
- Control de stock en tiempo real con alertas automáticas
- Módulo logístico con gestión de rutas, clientes y cadena de frío
- Dashboard operativo con KPIs en tiempo real
- Motor de automatizaciones vía n8n para alertas, reportes y flujos
- Costeo unitario real calculado automáticamente

## __1\.3 Métricas de éxito del sistema__

__Métrica__

__Baseline actual__

__Objetivo a 90 días__

Tiempo de carga de datos operativos diarios

>30 min manuales

<5 min asistidos

Precisión del costo unitario

Estimada \(±20%\)

Real \(±3%\)

Stock\-outs por insumo crítico

No medido

0 por mes

On\-Time Delivery \(OTD\)

No medido

≥ 95%

Merma documentada

No medida

< 5% por variedad

Tiempo de generación de reporte diario

Manual / No existe

Automático a las 21:00

# __2\. USUARIOS Y ROLES__

## __2\.1 Definición de roles del sistema__

__Rol__

__Nombre en sistema__

__Descripción__

__Acceso__

Dueño / Gerente

ADMIN

Acceso total\. Ve todos los módulos, KPIs financieros, rentabilidad por cliente\.

Total

Coordinador de producción

COORD\_PROD

Gestiona lotes, registra tiempos, ve stock de insumos, no ve costos ni márgenes\.

Producción \+ Stock

Operario de línea

OPERARIO

Solo registra inicio/fin de ronda y unidades\. Vista simplificada móvil\.

Solo producción

Repartidor / Logística

LOGISTICA

Gestiona rutas, registra entregas y temperatura\. No ve producción\.

Logística

Administrativo

ADMIN\_OPS

Carga pedidos, gestiona clientes, emite remitos\. No ve costos internos\.

Pedidos \+ Clientes

## __2\.2 Contexto de uso por rol__

### __ADMIN — Dueño/Gerente__

- Usa el sistema principalmente desde desktop o tablet\.
- Revisa el dashboard ejecutivo cada mañana \(5–10 minutos\)\.
- Interviene en el sistema para definir objetivos, aprobar fichas técnicas y analizar rentabilidad\.
- Recibe reportes automáticos por WhatsApp/Telegram al cierre de cada día\.

### __COORD\_PROD — Coordinador de producción__

- Usa el sistema desde tablet en la planta durante el turno\.
- Abre y cierra lotes, registra merma y novedades\.
- Ejecuta los checklists de apertura, mitad y cierre de turno\.
- Ve en tiempo real el avance vs\. el objetivo del día\.

### __OPERARIO — Operario de línea__

- Acceso mínimo desde celular o tablet compartida\.
- Solo registra: inicio de ronda, fin de ronda, unidades producidas, unidades rechazadas\.
- UI extremadamente simple: máximo 3 acciones posibles en pantalla\.

### __LOGISTICA — Repartidor__

- Usa el sistema desde celular durante la ruta\.
- Ve la lista de entregas del día ordenada por ruta\.
- Registra: hora de entrega, temperatura al momento de entrega, unidades rechazadas\.
- Puede dejar observaciones por entrega\.

# __3\. ARQUITECTURA DEL SISTEMA__

## __3\.1 Stack tecnológico__

__Capa__

__Tecnología__

__Rol__

Frontend / Plataforma

Antigravity

Construcción del sistema web, UI, lógica de negocio

Automatizaciones

n8n \(self\-hosted\)

Flujos automáticos: alertas, reportes, webhooks

Base de datos

Definida por Antigravity

Persistencia de todos los datos operativos

Mensajería

WhatsApp Business API / Telegram Bot

Alertas y reportes automáticos

Mapas y geolocalización

Google Maps API

Geocodificación de clientes y rutas

Autenticación

Sistema nativo Antigravity

Login por rol, sesiones seguras

## __3\.2 Módulos del sistema__

*El sistema se divide en 6 módulos funcionales\. Cada módulo tiene su propia sección en este PRD con requerimientos detallados\.*

__\#__

__Módulo__

__Descripción corta__

__Prioridad__

M1

Producción

Gestión de lotes, rondas, tiempos y merma

P0 — Crítico

M2

Stock e Insumos

Inventario en tiempo real, FIFO, alertas

P0 — Crítico

M3

Clientes y Pedidos

Gestión de clientes, pedidos y trazabilidad

P0 — Crítico

M4

Logística

Rutas, entregas, cadena de frío, OTD

P1 — Alto

M5

Costos y Finanzas

Costeo unitario, márgenes, rentabilidad por cliente

P1 — Alto

M6

Dashboard y Reportes

KPIs en tiempo real, reportes automáticos

P1 — Alto

## __3\.3 Modelo de datos — Tablas principales__

Las siguientes tablas conforman el núcleo relacional del sistema\. Cada tabla es un modelo de datos en Antigravity\.

__TABLA: clientes__

__Campo__

__Tipo__

__Descripción__

id\_cliente

UUID / PK

Identificador único autoincremental

nombre\_comercial

String

Nombre del negocio cliente

contacto\_nombre

String

Nombre de la persona de contacto

contacto\_telefono

String

Teléfono \(WhatsApp preferentemente\)

direccion

String

Dirección completa del punto de entrega

latitud / longitud

Decimal

Coordenadas GPS para cálculo de rutas

zona

Enum \(A/B/C/D\)

Zona logística asignada

segmento

Enum \(A/B/C\)

Segmento de rentabilidad: A=alto, B=medio, C=revisar

frecuencia\_semanal

Integer

Cantidad de visitas por semana

pedido\_promedio\_u

Integer

Unidades promedio por pedido \(calculado\)

precio\_diferencial

Boolean

¿Tiene precio negociado diferente al precio lista?

activo

Boolean

Si está activo en el sistema

fecha\_alta

DateTime

Fecha de incorporación al sistema

__TABLA: productos__

__Campo__

__Tipo__

__Descripción__

id\_producto

UUID / PK

Identificador único

nombre

String

Nombre comercial \(ej: Clásico, Especial, JQ\)

codigo\_interno

String

Código corto para uso interno \(ej: CLÁ, ESP, JQ\)

precio\_venta

Decimal

Precio de venta al cliente \($ por unidad\)

costo\_unitario

Decimal

Costo real calculado \(actualización mensual\)

vida\_util\_horas

Integer

Horas desde producción hasta vencimiento

temp\_conservacion\_max

Decimal

Temperatura máxima de conservación en °C

activo

Boolean

Si está activo en el sistema

__TABLA: insumos__

__Campo__

__Tipo__

__Descripción__

id\_insumo

UUID / PK

Identificador único

nombre

String

Nombre del insumo \(ej: Pan lactal, Jamón cocido\)

unidad\_medida

Enum \(kg/u/lt/g\)

Unidad de medida para stock

stock\_actual

Decimal

Cantidad actual en inventario \(actualización automática\)

stock\_minimo

Decimal

Punto de reorden: dispara alerta automática

precio\_unitario

Decimal

Precio de compra actual por unidad de medida

id\_proveedor

FK → proveedores

Proveedor principal de este insumo

dias\_reposicion

Integer

Días hábiles que tarda el proveedor en entregar

__TABLA: fichas\_tecnicas__

__Campo__

__Tipo__

__Descripción__

id\_ficha

UUID / PK

Identificador único

id\_producto

FK → productos

Producto al que pertenece esta ficha

id\_insumo

FK → insumos

Insumo que interviene en la receta

cantidad\_por\_unidad

Decimal

Cantidad de este insumo por sandwich producido

unidad\_medida

String

Unidad usada en este ítem de la receta

__TABLA: lotes__

__Campo__

__Tipo__

__Descripción__

id\_lote

String / PK

Formato: SC\-YYYYMMDD\-COD\-NN \(ej: SC\-20260227\-JQ\-02\)

id\_producto

FK → productos

Variedad producida en este lote

fecha\_produccion

Date

Fecha del lote

hora\_inicio

Time

Hora de inicio de la ronda

hora\_fin

Time

Hora de finalización de la ronda

unidades\_producidas

Integer

Total de unidades producidas

unidades\_rechazadas

Integer

Unidades que no pasaron control de calidad

motivo\_rechazo

String \(nullable\)

Descripción del motivo de rechazo

empleados\_ronda

Integer

Cantidad de operarios en esta ronda

id\_empleado\_coord

FK → empleados

Coordinador responsable del lote

estado

Enum

en\_camara / distribuido / merma / vencido

__TABLA: movimientos\_stock__

__Campo__

__Tipo__

__Descripción__

id\_movimiento

UUID / PK

Identificador único

id\_insumo

FK → insumos

Insumo involucrado

tipo

Enum \(entrada/salida\)

Entrada = compra/recepción\. Salida = consumo en lote\.

cantidad

Decimal

Cantidad del movimiento

fecha

DateTime

Timestamp exacto del movimiento

id\_lote\_origen

FK → lotes \(nullable\)

Solo en salidas: lote que consumió el insumo

id\_proveedor

FK → proveedores \(nullable\)

Solo en entradas: proveedor del ingreso

observaciones

String \(nullable\)

Notas adicionales

__TABLA: pedidos \+ detalle\_pedidos__

__Campo__

__Tipo__

__Descripción__

id\_pedido

UUID / PK

Identificador único del pedido

id\_cliente

FK → clientes

Cliente que realiza el pedido

fecha\_pedido

Date

Cuándo se tomó el pedido

fecha\_entrega

Date

Cuándo debe entregarse

estado

Enum

pendiente / confirmado / en\_ruta / entregado / rechazado

total\_unidades

Integer

Total de unidades en el pedido \(calculado\)

total\_importe

Decimal

Importe total del pedido \(calculado\)

— — — detalle\_pedidos — — —

id\_producto

FK → productos

Variedad pedida

id\_lote

FK → lotes \(nullable\)

Lote asignado para trazabilidad

cantidad

Integer

Unidades de este producto en este pedido

precio\_unitario

Decimal

Precio aplicado en el momento del pedido

__TABLA: rutas \+ entregas__

__Campo__

__Tipo__

__Descripción__

id\_ruta

UUID / PK

Identificador único de la ruta

fecha

Date

Fecha de la ruta

zona

String

Zona geográfica que cubre esta ruta

id\_empleado\_chofer

FK → empleados

Repartidor asignado

hora\_salida / hora\_regreso

Time

Control de duración de ruta

km\_recorridos

Decimal

Para calcular eficiencia y costo logístico

costo\_combustible

Decimal

Costo de combustible de la ruta

temp\_salida

Decimal

Temperatura al salir con el producto \(°C\)

— — — entregas — — —

id\_entrega

UUID / PK

Identificador único de entrega

id\_ruta / id\_pedido / id\_cliente

FKs

Referencias a la ruta, pedido y cliente

hora\_entrega

Time

Hora real de entrega

dentro\_ventana

Boolean

¿Entregó dentro del horario pactado?

temp\_entrega

Decimal

Temperatura del producto al momento de entrega \(°C\)

unidades\_rechazadas

Integer

Unidades que el cliente rechazó

motivo\_rechazo

String \(nullable\)

Motivo del rechazo si aplica

# __4\. MÓDULOS FUNCIONALES — REQUERIMIENTOS__

__M1 — MÓDULO DE PRODUCCIÓN__

## __4\.1 Funcionalidades requeridas__

### __4\.1\.1 Plan diario de producción__

El sistema debe mostrar cada mañana, antes del inicio del turno, el plan de producción del día con los siguientes datos:

- Objetivo de unidades por variedad \(cargado manualmente o generado automáticamente desde pedidos del día\)\.
- Número de rondas estimadas para alcanzar el objetivo\.
- Insumos necesarios para el plan \(calculados desde fichas técnicas\)\.
- Alerta si el stock actual no alcanza para el plan del día\.

### __4\.1\.2 Apertura y cierre de lotes__

El coordinador de producción abre un lote antes de iniciar cada ronda\. El sistema genera el ID de lote automáticamente en formato SC\-YYYYMMDD\-COD\-NN\. Al abrir un lote, el sistema descuenta automáticamente los insumos del stock según la ficha técnica del producto\.

Al cerrar el lote, el coordinador ingresa:

- Unidades efectivamente producidas
- Unidades rechazadas y motivo
- Hora de fin de ronda \(el sistema toma el timestamp automáticamente como sugerencia\)

*Requerimiento de UX: La apertura de lote debe poder hacerse en máximo 3 taps/clicks desde la pantalla principal de producción\. El coordinador no puede estar perdiendo tiempo en formularios largos durante la ronda\.*

### __4\.1\.3 Vista en tiempo real del turno__

- Barra de progreso: unidades producidas hoy vs\. objetivo del día\.
- Rondas completadas vs\. planificadas\.
- Velocidad de línea actual \(u/hora\) calculada automáticamente\.
- Tiempo transcurrido del turno\.
- Merma acumulada del día en % y unidades\.

### __4\.1\.4 Checklists digitales__

El sistema debe permitir la ejecución de tres checklists diarios:

- Checklist de apertura: se habilita desde las 7:00\. Debe completarse antes de poder abrir el primer lote del día\.
- Checklist de mitad de turno: se habilita 3 horas después de apertura\.
- Checklist de cierre: se habilita cuando el último lote del día es cerrado\.

Cada ítem del checklist es una casilla de verificación con campo de observación opcional\. El sistema registra quién completó el checklist y a qué hora\.

### __4\.1\.5 Registro de tiempos por estación__

El sistema debe permitir registrar manualmente \(o capturar automáticamente via timestamp\) los tiempos de:

- Setup de estación \(antes de la primera ronda\)
- Producción efectiva por ronda
- Limpieza y cierre de estación

Con estos datos, el sistema calcula automáticamente la velocidad de línea \(u/hora\) y la eficiencia productiva \(% vs\. máximo teórico registrado\)\.

__M2 — MÓDULO DE STOCK E INSUMOS__

## __4\.2 Funcionalidades requeridas__

### __4\.2\.1 Vista de inventario en tiempo real__

Pantalla principal con todos los insumos activos mostrando:

- Stock actual vs\. stock mínimo con indicador visual de semáforo \(verde / amarillo / rojo\)\.
- Días de stock restante calculados en base al consumo diario promedio de los últimos 30 días\.
- Proveedor y días de reposición de cada insumo\.
- Botón de acción directa para registrar ingreso de mercadería\.

### __4\.2\.2 Registro de ingresos de insumos__

Al ingresar mercadería, el operario o administrativo registra:

- Insumo recibido
- Cantidad recibida
- Fecha de ingreso \(timestamp automático\)
- Proveedor
- Precio facturado \(para actualización del costo\)
- Temperatura de recepción \(para insumos refrigerados\)

El sistema actualiza el stock actual automáticamente y registra el movimiento en movimientos\_stock con tipo=entrada\.

### __4\.2\.3 Lógica FIFO automática__

El sistema debe mantener el orden FIFO internamente\. Cuando un lote consume insumos, el sistema debe marcar como consumido el ingreso más antiguo disponible de ese insumo\. El stock disponible siempre refleja los ingresos por fecha de entrada, no por cantidad total\.

### __4\.2\.4 Alertas de stock__

El sistema genera alertas automáticas \(vía n8n\) cuando:

- Un insumo cae por debajo del stock mínimo — Alerta inmediata\.
- Un insumo está proyectado a caer por debajo del mínimo en los próximos 2 días — Alerta preventiva\.
- Hay insumos próximos a vencer \(si se registra fecha de vencimiento en el ingreso\)\.

__M3 — MÓDULO DE CLIENTES Y PEDIDOS__

## __4\.3 Funcionalidades requeridas__

### __4\.3\.1 Gestión de clientes__

El sistema debe permitir crear, editar y desactivar clientes\. Cada cliente tiene:

- Ficha completa con datos de contacto, dirección y coordenadas GPS\.
- Zona asignada y segmento \(A/B/C\)\.
- Frecuencia de visita semanal y ventana horaria de entrega\.
- Historial de pedidos y ticket promedio calculado automáticamente\.
- Indicador de rentabilidad \(calculado en M5\)\.

### __4\.3\.2 Gestión de pedidos__

- Creación de pedido: selección de cliente, fecha de entrega, detalle de productos y cantidades\.
- El precio se toma del precio lista del cliente \(diferenciado si aplica\)\.
- El importe total se calcula automáticamente\.
- El pedido queda en estado 'pendiente' hasta que es incorporado al plan de producción\.

### __4\.3\.3 Asignación de lotes a pedidos \(trazabilidad\)__

Al preparar la distribución, el sistema asigna lotes a los pedidos\. Esta asignación respeta el orden FIFO: los lotes más antiguos se asignan primero\. El sistema alerta si hay lotes con tiempo restante de vida útil menor a X horas \(configurable\)\.

### __4\.3\.4 Estados del pedido__

El flujo de estados de un pedido es:

PENDIENTE → CONFIRMADO → EN\_RUTA → ENTREGADO

                              ↓

                          RECHAZADO \(parcial o total\)

Cada cambio de estado queda registrado con timestamp y usuario\.

__M4 — MÓDULO DE LOGÍSTICA__

## __4\.4 Funcionalidades requeridas__

### __4\.4\.1 Planificación de rutas__

- El sistema muestra los pedidos pendientes de entrega agrupados por zona\.
- El coordinador arma la ruta del día asignando pedidos a un repartidor y definiendo el orden de visita\.
- Vista de mapa con los clientes del día marcados y el orden de visita numerado\.
- Cálculo estimado de duración de ruta y km totales\.

### __4\.4\.2 Módulo móvil para repartidor__

El repartidor accede desde su celular\. La interfaz muestra:

- Lista de entregas del día en el orden de ruta, con dirección y mapa embebido\.
- Para cada entrega: nombre del cliente, productos a entregar, cantidades\.
- Al completar la entrega, registra: hora, temperatura del producto, unidades entregadas / rechazadas y observaciones\.
- El estado del pedido se actualiza a ENTREGADO automáticamente\.

### __4\.4\.3 Control de cadena de frío__

__Punto de control__

__Responsable__

__Registro requerido__

__Rango aceptable__

Salida de cámara

Logística / Coord\.

Temperatura al cargar el vehículo

≤ 4°C

Llegada al cliente

Repartidor

Temperatura al momento de entregar

≤ 8°C

Recepción de insumos

Logística

Temperatura al recibir mercadería refrigerada

≤ 4°C

Si se registra una temperatura fuera de rango, el sistema genera alerta automática al ADMIN y al COORD\_PROD\.

### __4\.4\.4 Métricas logísticas calculadas automáticamente__

- On\-Time Delivery \(OTD\) diario y mensual\.
- Tasa de rechazo en entrega \(% de unidades rechazadas sobre entregadas\)\.
- Eficiencia de ruta \(unidades entregadas / km recorridos\)\.
- Incidencias de cadena de frío \(% de entregas fuera de temperatura\)\.

__M5 — MÓDULO DE COSTOS Y FINANZAS__

## __4\.5 Funcionalidades requeridas__

### __4\.5\.1 Costeo unitario real__

El sistema calcula mensualmente el costo unitario real de cada variedad a partir de cuatro componentes:

__Componente__

__Fuente de datos__

__Cálculo__

Costo directo de insumos \(CDI\)

Fichas técnicas \+ precios de insumos

Suma de \(cantidad\_por\_unidad × precio\_unitario\) por insumo de la receta

Costo de mano de obra directa \(CMOD\)

Empleados \+ tiempo de producción

\(Costo hora × horas producción\) / unidades producidas

Costos indirectos de fabricación \(CIF\)

Gastos fijos configurables

Total CIF mensual / total unidades producidas en el mes

Merma ajustada

Registro de merma por lote

Costo del lote / unidades vendibles \(no merma\)

### __4\.5\.2 Rentabilidad por cliente__

El sistema calcula mensualmente la rentabilidad neta de cada cliente:

Rentabilidad = Ingreso cliente

             \- \(Costo unitario × Unidades vendidas\)

             \- Costo logístico atribuido

             \- Costo administrativo atribuido

El costo logístico se proratea por zona: el costo total de la ruta se divide entre los clientes según las unidades entregadas a cada uno\.

El resultado segmenta automáticamente al cliente en A \(rentable\), B \(neutro\) o C \(a revisar\)\.

### __4\.5\.3 Configuración de costos fijos__

El ADMIN puede ingresar y actualizar mensualmente:

- Alquiler del espacio productivo \(o porcentaje si es compartido\)\.
- Costo mensual de energía \(electricidad, gas\)\.
- Costos de limpieza, desinfección y materiales\.
- Amortización de equipos \(con número de meses y valor de compra\)\.

__M6 — DASHBOARD Y REPORTES__

## __4\.6 Funcionalidades requeridas__

### __4\.6\.1 Dashboard ejecutivo \(rol ADMIN\)__

__Vista__

__KPIs mostrados__

__Frecuencia de actualización__

Producción del día

Objetivo vs\. real, rondas completadas, merma %, velocidad de línea

Tiempo real \(al cerrar cada lote\)

Stock crítico

Insumos bajo mínimo o proyectados a caer

Tiempo real

Logística del día

Pedidos entregados / en ruta / pendientes, OTD del día

Cada 30 min o al registrar entrega

Financiero

Ventas del día, margen bruto, costo unitario vs\. objetivo

Diario \(cierre\)

Mensual

Merma mensual, OTD mensual, rentabilidad top 5 clientes

Diario \(acumulado\)

### __4\.6\.2 Reportes automáticos vía n8n__

__Reporte__

__Trigger__

__Destinatario__

__Canal__

Plan del día siguiente

Cron 18:00 día anterior

ADMIN \+ COORD\_PROD

WhatsApp / Telegram

Alerta stock bajo

Cron 7:00 diario

ADMIN

WhatsApp

Resumen de cierre del día

Cron 21:00 o al cerrar último lote

ADMIN

WhatsApp / Email

Alerta temperatura fuera de rango

Webhook al registrar entrega

ADMIN \+ COORD\_PROD

WhatsApp inmediato

Alerta objetivo no alcanzado

Cron 20:00 si prod < 95% objetivo

ADMIN

WhatsApp

Reporte semanal de KPIs

Cron viernes 22:00

ADMIN

Email con PDF

Notificación de pedido en camino

Cambio de estado a EN\_RUTA

Cliente

WhatsApp

# __5\. KPIs CRÍTICOS DEL SISTEMA__

## __5\.1 KPIs de producción__

__KPI__

__Fórmula__

__Frecuencia__

__Objetivo__

Cumplimiento de objetivo

\(Producción real / Objetivo\) × 100

Diaria

≥ 95%

Merma de producción

\(Unid\. rechazadas / Unid\. producidas\) × 100

Diaria

< 5% por variedad

Velocidad de línea

Unidades producidas / Horas efectivas

Por ronda

Baseline \+ 10% a 90 días

Eficiencia productiva

\(Real / Máximo teórico\) × 100

Diaria

≥ 85%

Costo unitario real vs\. objetivo

\(\(Real – Objetivo\) / Objetivo\) × 100

Mensual

Dentro de ±5%

## __5\.2 KPIs de stock y compras__

__KPI__

__Fórmula__

__Frecuencia__

__Objetivo__

Stock\-outs

Cantidad de veces que un insumo llegó a 0

Mensual

0 por mes

Rotación de inventario

Consumo mensual / Stock promedio

Mensual

Definir baseline en Mes 1

Exactitud de stock

\(Stock sistema / Stock físico conteo\) × 100

Quincenal

≥ 98%

Días de stock promedio

Stock actual / Consumo diario promedio

Semanal

Entre mínimo y 2× mínimo

## __5\.3 KPIs logísticos__

__KPI__

__Fórmula__

__Frecuencia__

__Objetivo__

On\-Time Delivery \(OTD\)

\(Entregas en ventana / Total entregas\) × 100

Diaria / Mensual

≥ 95%

Tasa de rechazo en entrega

\(Unid\. rechazadas / Unid\. entregadas\) × 100

Diaria / Mensual

< 1%

Cumplimiento cadena de frío

\(Entregas temp\. OK / Total entregas\) × 100

Diaria

100%

Eficiencia de ruta

Unidades entregadas / Km recorridos

Por ruta

Mejorar baseline Mes 1

Costo logístico por unidad

Costo total ruta / Unidades entregadas

Mensual

Reducir 15% en 90 días

## __5\.4 KPIs financieros__

__KPI__

__Fórmula__

__Frecuencia__

__Objetivo__

Margen bruto por variedad

\(\(PVP – Costo real\) / PVP\) × 100

Mensual

Definir por variedad

Rentabilidad por cliente

Ingreso – Costos atribuidos \(prod \+ log \+ admin\)

Mensual

Segmentar en A/B/C

Merma económica

Unidades merma × Costo unitario real

Mensual

Reducir 20% en 90 días

Índice de Cumplimiento Logístico

OTD×0\.5 \+ No rechazo×0\.3 \+ Temp OK×0\.2

Mensual

≥ 92%

# __6\. AUTOMATIZACIONES n8n — ESPECIFICACIÓN__

*Todas las automatizaciones se construyen en n8n self\-hosted\. El sistema Antigravity expone una API REST que n8n consulta y actualiza\. Los mensajes de WhatsApp se envían vía WhatsApp Business API o Twilio\. Los de Telegram vía Telegram Bot API\.*

## __6\.1 Flujo 1 — Generación del plan diario__

__Campo__

__Detalle__

Nombre

SC\_Plan\_Diario

Trigger

Cron: todos los días a las 18:00

Pasos

1\. GET /api/pedidos?fecha=mañana → obtiene pedidos del día siguiente

2\. Agrupa por producto y suma unidades requeridas

3\. Para cada producto, consulta ficha técnica y calcula insumos necesarios

4\. Compara insumos necesarios vs\. stock actual \(GET /api/stock\)

5\. POST /api/objetivos → crea el plan del día siguiente

6\. Compone mensaje con el plan y alertas de stock si corresponde

7\. Envía WhatsApp a ADMIN y COORD\_PROD

Output

Plan de producción en sistema \+ mensaje WhatsApp con resumen

Manejo de error

Si falla la API, reintenta 2 veces con delay de 5 min y alerta por email

## __6\.2 Flujo 2 — Alerta de stock bajo__

__Campo__

__Detalle__

Nombre

SC\_Alerta\_Stock

Trigger

Cron: todos los días a las 7:00 \+ Webhook al registrar salida de stock

Pasos

1\. GET /api/stock/bajo\-minimo → insumos por debajo del mínimo

2\. GET /api/stock/proyeccion?dias=2 → insumos proyectados a caer en 2 días

3\. Filtra duplicados y genera lista consolidada

4\. Para cada insumo: incluye nombre, stock actual, mínimo, proveedor y teléfono

5\. Envía WhatsApp formateado al ADMIN

Output

Mensaje WhatsApp con semáforo de insumos críticos

Condición de no envío

Si no hay insumos bajo mínimo ni proyectados, no envía mensaje \(evita spam\)

## __6\.3 Flujo 3 — Reporte de cierre diario__

__Campo__

__Detalle__

Nombre

SC\_Reporte\_Cierre

Trigger

Cron: 21:00 todos los días

Pasos

1\. GET /api/produccion/hoy → lotes del día, unidades, merma

2\. GET /api/logistica/hoy → pedidos entregados, OTD, rechazos, incidencias temperatura

3\. GET /api/stock/movimientos?fecha=hoy → ingresos del día

4\. Calcula: cumplimiento de objetivo, merma %, OTD %, incidencias

5\. Genera resumen ejecutivo en formato texto estructurado

6\. Envía WhatsApp a ADMIN con el resumen del día

Output

Mensaje WhatsApp con: producción, merma, OTD, incidencias y nota de color del día

## __6\.4 Flujo 4 — Descuento automático de stock al cerrar lote__

__Campo__

__Detalle__

Nombre

SC\_Stock\_Post\_Lote

Trigger

Webhook: POST /webhook/lote\-cerrado \(disparado por Antigravity al cerrar lote\)

Pasos

1\. Recibe payload con id\_lote, id\_producto, unidades\_producidas

2\. GET /api/fichas\-tecnicas/:id\_producto → insumos y cantidades por unidad

3\. Calcula consumo total: cantidad\_por\_unidad × unidades\_producidas por cada insumo

4\. Para cada insumo, registra salida FIFO \(consume ingreso más antiguo primero\)

5\. POST /api/movimientos\-stock \(tipo: salida, id\_lote\)

6\. Verifica si stock resultante cae bajo mínimo → dispara Flujo 2 si corresponde

Output

Stock actualizado en tiempo real\. Sin intervención manual\.

## __6\.5 Flujo 5 — Notificación al cliente \(pedido en camino\)__

__Campo__

__Detalle__

Nombre

SC\_Notif\_Cliente\_EnRuta

Trigger

Webhook: cambio de estado del pedido a EN\_RUTA

Pasos

1\. Recibe id\_pedido

2\. GET /api/pedidos/:id → datos del pedido y cliente

3\. GET /api/rutas → obtiene hora estimada de llegada basada en el orden de ruta

4\. Compone mensaje personalizado: 'Hola \[nombre\], tu pedido de Santa Catalina está en camino\. Llegamos aproximadamente a las \[hora\]\.'

5\. Envía WhatsApp al número del cliente

Output

Mensaje automático al cliente sin intervención del equipo

## __6\.6 Flujo 6 — Alerta de temperatura fuera de rango__

__Campo__

__Detalle__

Nombre

SC\_Alerta\_Temperatura

Trigger

Webhook: al registrar temperatura en entrega o recepción de insumos

Pasos

1\. Recibe temperatura registrada, punto de control y contexto \(id\_entrega o id\_movimiento\)

2\. Evalúa contra rango aceptable según el punto de control

3\. Si está fuera de rango: genera alerta inmediata

4\. Envía WhatsApp a ADMIN y COORD\_PROD con: cliente, hora, temperatura registrada y rango esperado

5\. Registra incidencia en sistema para el reporte diario

Output

Alerta inmediata\. Incidencia registrada\.

# __7\. LINEAMIENTOS DE UX/UI__

## __7\.1 Identidad de marca — Sistema de diseño__

__Elemento__

__Valor__

__Uso__

Color primario

\#D11F35 \(Rojo\)

CTAs, alertas activas, headers de módulo

Color secundario

\#540302 \(Bordó\)

Títulos, textos de énfasis, tablas header

Color base

\#FDFBEE \(Crema\)

Fondos de pantallas de datos, tarjetas

Tipografía títulos

Built Titling

Headings H1 y H2 del sistema

Tipografía cuerpo

Bell MT

Textos, labels, contenido de tablas

Tipografía UI

Arial / System font

Formularios, inputs, botones \(legibilidad en pantalla\)

## __7\.2 Principios de UX por rol__

### __Para COORD\_PROD y OPERARIO \(uso en planta\)__

- Las manos están sucias o ocupadas: los botones deben ser grandes \(mínimo 48px de alto\)\.
- Máximo 3 acciones por pantalla\. No puede haber menús anidados en el flujo de producción\.
- Los estados críticos \(merma alta, objetivo en riesgo\) deben ser imposibles de ignorar: colores de alerta, no solo íconos\.
- El sistema debe funcionar con la pantalla al 50% de brillo \(condiciones de planta con luz variable\)\.
- Optimizado para tablet en orientación landscape\. Funcional en celular vertical\.

### __Para LOGISTICA \(uso en ruta\)__

- Mobile\-first absoluto\. El repartidor no tiene tiempo de aprender una interfaz compleja\.
- La pantalla principal muestra la próxima entrega con la dirección y un botón de 'Navegar' que abre Google Maps\.
- Registrar una entrega completada debe ser máximo 4 taps: confirmar entrega, ingresar temperatura, ingresar unidades si difieren, guardar\.
- Funcionalidad offline básica: si pierde señal en ruta, puede seguir registrando y sincroniza al recuperar conexión\.

### __Para ADMIN \(dashboard\)__

- Vista desktop preferida\. El dashboard debe cargar en menos de 3 segundos\.
- Los KPIs negativos \(merma alta, OTD bajo, cliente deficitario\) deben tener semáforo rojo visible en la vista principal sin necesidad de hacer scroll\.
- Acceso rápido a los 3 módulos más usados desde la pantalla principal\.

## __7\.3 Pantallas clave a diseñar \(por orden de prioridad\)__

1. Dashboard ejecutivo ADMIN — Vista principal con KPIs del día\.
2. Pantalla de producción del turno — Vista COORD\_PROD con objetivo, lotes activos y botón de apertura/cierre\.
3. Apertura de lote — Formulario simplificado \(variedad \+ cantidad objetivo \+ operarios\)\.
4. Cierre de lote — Formulario de resultado \(unidades producidas, rechazadas, motivo\)\.
5. Vista de inventario — Semáforo de insumos con búsqueda y filtro por estado\.
6. Registro de entrega — Vista móvil del repartidor para completar una entrega\.
7. Pantalla de pedidos — Lista de pedidos del día con estado y acciones\.
8. Ficha de cliente — Vista completa con historial y KPIs de rentabilidad\.

# __8\. ROADMAP DE DESARROLLO — 90 DÍAS__

## __8\.1 Fase 1 — MVP Core \(Semanas 1–4\)__

*Objetivo: El sistema reemplaza las hojas de cálculo para producción, stock y tareas\. El equipo puede operar 100% desde la plataforma\.*

__Sprint__

__Semana__

__Entregables__

Sprint 1

1–2

Modelos de datos completos en Antigravity\. Auth con roles\. Módulo de Empleados\.

Sprint 1

1–2

Módulo de Productos y Fichas Técnicas\. CRUD completo\.

Sprint 1

1–2

Módulo de Insumos y Proveedores\. Vista de inventario básica\.

Sprint 2

3–4

Módulo M1 Producción: apertura/cierre de lotes, checklist de apertura\.

Sprint 2

3–4

Módulo M2 Stock: descuento automático de stock al cerrar lote \(webhook → n8n\)\.

Sprint 2

3–4

Módulo M3 Clientes: CRUD de clientes con geocodificación\.

Sprint 2

3–4

Flujo n8n \#2 \(alerta stock\) y \#4 \(stock post\-lote\) operativos\.

## __8\.2 Fase 2 — Optimización y Logística \(Semanas 5–8\)__

*Objetivo: El sistema gestiona el ciclo completo de pedido\-producción\-entrega\. Los KPIs logísticos están siendo medidos\.*

__Sprint__

__Semana__

__Entregables__

Sprint 3

5–6

Módulo M3 Pedidos: creación, estados, asignación de lotes \(FIFO\)\.

Sprint 3

5–6

Módulo M4 Logística: planificación de rutas, asignación de pedidos\.

Sprint 3

5–6

Vista móvil para repartidor\. Registro de entregas con temperatura\.

Sprint 4

7–8

Dashboard ADMIN: KPIs de producción y logística en tiempo real\.

Sprint 4

7–8

Flujo n8n \#1 \(plan diario\), \#3 \(cierre\) y \#5 \(notif\. cliente\) operativos\.

Sprint 4

7–8

Flujo n8n \#6 \(alerta temperatura\)\. Registro de incidencias\.

## __8\.3 Fase 3 — Escalabilidad e Inteligencia \(Semanas 9–12\)__

*Objetivo: El sistema calcula costos reales, rentabilidad por cliente y permite proyectar el crecimiento con datos\.*

__Sprint__

__Semana__

__Entregables__

Sprint 5

9–10

Módulo M5 Costos: costeo unitario real con los 4 componentes\.

Sprint 5

9–10

Rentabilidad por cliente\. Segmentación automática A/B/C\.

Sprint 5

9–10

Configuración de costos fijos por el ADMIN\.

Sprint 6

11–12

Dashboard financiero completo con tendencias y comparativas\.

Sprint 6

11–12

Reporte semanal automático en PDF \(flujo n8n\)\.

Sprint 6

11–12

Refinamiento de UX basado en feedback del equipo\.

Sprint 6

11–12

Documentación operativa del sistema para onboarding de nuevos empleados\.

# __9\. API REST — ENDPOINTS REQUERIDOS PARA n8n__

Los siguientes endpoints deben ser expuestos por Antigravity para que n8n pueda operar los flujos automáticos\. Todos los endpoints requieren autenticación por API Key o Bearer Token de servicio\.

## __9\.1 Producción__

__Método__

__Endpoint__

__Descripción__

GET

/api/lotes?fecha=\{date\}

Lotes del día\. Retorna: id, producto, estado, unidades\.

POST

/api/lotes

Crear nuevo lote \(apertura de ronda\)\.

PATCH

/api/lotes/:id/cerrar

Cerrar lote con unidades producidas y merma\.

GET

/api/objetivos?fecha=\{date\}

Objetivo del día por producto\.

POST

/api/objetivos

Crear objetivo del día \(disparado por n8n\)\.

GET

/api/produccion/hoy

Resumen del día: total producido, merma, cumplimiento %\.

## __9\.2 Stock__

__Método__

__Endpoint__

__Descripción__

GET

/api/stock

Stock actual de todos los insumos\.

GET

/api/stock/bajo\-minimo

Insumos con stock\_actual < stock\_minimo\.

GET

/api/stock/proyeccion?dias=\{n\}

Insumos proyectados a caer bajo mínimo en n días\.

POST

/api/movimientos\-stock

Registrar movimiento \(entrada o salida\)\.

## __9\.3 Logística__

__Método__

__Endpoint__

__Descripción__

GET

/api/pedidos?fecha=\{date\}&estado=\{estado\}

Pedidos del día filtrados por estado\.

PATCH

/api/pedidos/:id/estado

Cambiar estado del pedido\.

POST

/api/entregas

Registrar entrega con temperatura y resultado\.

GET

/api/logistica/hoy

Resumen logístico: OTD, rechazos, incidencias de temperatura\.

## __9\.4 Webhooks salientes \(Antigravity → n8n\)__

__Evento__

__URL destino__

__Payload__

Lote cerrado

n8n/webhook/lote\-cerrado

\{ id\_lote, id\_producto, unidades\_producidas \}

Pedido → EN\_RUTA

n8n/webhook/pedido\-en\-ruta

\{ id\_pedido, id\_cliente, hora\_estimada \}

Temperatura registrada

n8n/webhook/temperatura

\{ tipo, valor, rango\_min, rango\_max, contexto \}

Stock bajo mínimo

n8n/webhook/stock\-critico

\{ id\_insumo, nombre, stock\_actual, stock\_minimo \}

# __10\. GLOSARIO DE TÉRMINOS__

__Término__

__Definición__

Lote

Unidad mínima trazable de producción: un conjunto de unidades de una misma variedad producidas en una ronda continua\.

Ronda

Ciclo de producción dentro de un turno\. Un turno puede tener múltiples rondas de distintas variedades\.

Merma de producción

Unidades producidas que no cumplen el estándar de calidad y no salen a la venta\.

Merma de distribución

Unidades que vuelven del cliente por sobrante, daño o rechazo\.

FIFO

First In, First Out\. Los insumos o productos que ingresaron primero son los primeros en ser usados o entregados\.

CDI

Costo Directo de Insumos\. Costo de los ingredientes que conforman una unidad de producto\.

CMOD

Costo de Mano de Obra Directa\. Costo proporcional del trabajo operario por unidad producida\.

CIF

Costos Indirectos de Fabricación\. Gastos de operación no directamente atribuibles a una unidad \(energía, alquiler, etc\.\)\.

OTD

On\-Time Delivery\. Porcentaje de entregas realizadas dentro de la ventana horaria pactada con el cliente\.

Cadena de frío

Control de temperatura desde la producción hasta la entrega al cliente\. El producto no puede superar 8°C en ningún punto\.

Ventana de entrega

Rango horario acordado con cada cliente para recibir sus pedidos \(ej: 9:00 a 11:00\)\.

Stock mínimo

Punto de reorden: nivel de stock al que se debe emitir una orden de compra para no quedarse sin insumo\.

Segmento A/B/C

Clasificación de clientes por rentabilidad neta: A=rentable, B=neutro, C=deficitario o a revisar\.

ICL

Índice de Cumplimiento Logístico\. KPI compuesto que mide OTD, tasa de no rechazo y cadena de frío\.

__SANTA CATALINA — Sistema Operativo de Gestión__

*PRD v1\.0 — Febrero 2026 — Para revisión en Antigravity*

