import { randomInt } from 'node:crypto'
import type { ConfigModulo, Ejercicio, Plan, Modulo } from './tipos'

export const CONFIG_INICIAL: ConfigModulo[] = [
    { modulo: 'TIPEO', segundos: 180, cantidad: 1, activo: true },
    { modulo: 'PLANILLA', segundos: 300, cantidad: 4, activo: true },
    { modulo: 'CONVERSACIONES', segundos: 600, cantidad: 12, activo: true },
    { modulo: 'DETALLE', segundos: 300, cantidad: 5, activo: true },
    { modulo: 'ATENCION', segundos: 240, cantidad: 4, activo: true },
]
const textos = [
    'Mariana Fernández solicitó 14 cajas de cuadernos para entregar en Avenida Rivadavia 1250, el jueves 12 de noviembre de 2026 por la mañana. El importe confirmado fue de $48.750. Tomás Pérez revisó el comprobante y anotó la referencia AB-204. Antes de despachar, hay que comprobar las cantidades, el domicilio y el nombre de quien recibe. Si falta algún dato, corresponde consultarlo y dejar el pedido pendiente. La entrega incluye 8 carpetas azules, 6 lápices y 2 agendas. No se confirmó un horario exacto; el turno acordado es de 9:00 a 13:00. Lucía Gómez recibirá las cajas en la entrada principal. El teléfono ficticio de referencia es 011-5555-0124.',
    'Nicolás Álvarez pidió 16 cajas de sobres para recibir en Calle Moreno 1430, el jueves 12 de noviembre de 2026 por la tarde. El importe informado fue de $52.480. Sofía Ramírez verificó el recibo y anotó la referencia CD-318. Antes de preparar la entrega, se deben revisar las cantidades, la dirección y el nombre del destinatario. Cuando un dato no está confirmado, hay que preguntar y mantener el registro pendiente. El pedido incluye 9 carpetas verdes, 5 bolígrafos y 3 agendas. No se prometió una hora puntual; la franja acordada es de 14:00 a 18:00. Andrés López atenderá en la recepción. El teléfono ficticio de referencia es 011-5555-0236.',
]
const columnas = ['Cliente', 'Producto', 'Cantidad', 'Localidad', 'Entrega', 'Pago'].map(nombre => ({ nombre, tipo: nombre === 'Cantidad' ? 'numero' as const : undefined }))
const personas = ['Daniel Acosta', 'Laura Méndez', 'Pablo Ríos', 'Ana Torres', 'Bruno Díaz', 'Celia Soto', 'Diego Paz', 'Elena Vidal', 'Fabio Luna', 'Gloria Costa', 'Hugo Gil', 'Inés Vera']
const temas = ['Pedido sencillo', 'Información en varios mensajes', 'Cambio de cantidad', 'Corrección de dirección', 'Cambio de fecha', 'Dirección incompleta', 'Dos productos', 'Clientes simultáneos', 'Corrección posterior', 'Fechas contradictorias', 'Comentario irrelevante', 'Entrega con observaciones']
export function crearPlan(config = CONFIG_INICIAL, variante = randomInt(2)): Plan {
    const soluciones: Record<string, unknown> = {}
    const conversaciones: Ejercicio[] = personas.map((nombre, i) => {
        const cliente = variante ? `${nombre} (cuenta B)` : nombre
        const id = `C${i + 1}`
        const direccion = i === 5 ? 'San Martín' : 'Belgrano 1250'
        const base = `Soy ${cliente}. Pedido ${id}: ${i === 6 ? '2 carpetas y 4 cuadernos' : '3 paquetes de galletitas'}. Dirección: ${direccion}, Quilmes. Entrega: 2026-11-11, turno mañana. Pago en efectivo.`
        const partes = i === 1 ? [`Soy ${cliente}. Pedido ${id}: 3 paquetes de galletitas.`, 'Dirección: Belgrano 1250, Quilmes.', 'Entrega: 2026-11-11, turno mañana. Pago en efectivo.'] : [base]
        const cambios: Record<number, string> = { 2: 'Perdón, mejor 5 paquetes.', 3: 'Me equivoqué: la dirección es Belgrano 1520.', 4: 'Cambio la fecha al jueves 2026-11-12.', 5: 'No recuerdo la altura. ¿Podemos confirmarla antes del envío?', 8: 'Cambio el pedido: finalmente necesito 7 paquetes. Actualizá el registro anterior.', 9: 'También necesito recibirlo el 2026-11-12. No sé si corresponde el miércoles o el jueves; confirmemos antes.', 10: '¡Qué lindo día! Gracias por la atención.', 11: 'Por favor, tocar el timbre lateral y preguntar por Recepción.' }
        const mensajes: NonNullable<Ejercicio['mensajes']> = partes.map((texto, n) => ({ id: `${id}-${n}`, texto, segundo: 0, hora: `09:0${n}`, origen: 'cliente' as const }))
        if (cambios[i]) mensajes.push({ id: `${id}-cambio`, texto: cambios[i], segundo: i === 8 ? 90 : i === 2 || i === 3 || i === 4 ? 30 : 0, hora: '09:02', origen: 'cliente', requiereRegistro: i === 8 })
        soluciones[id] = { cliente, pedido: id, productos: i === 6 ? ['carpetas', 'cuadernos'] : ['galletitas'], cantidades: i === 2 ? [5] : i === 8 ? [7] : i === 6 ? [2, 4] : [3], localidad: 'Quilmes', turno: 'mañana', pago: 'efectivo', direccion: i === 3 ? 'Belgrano 1520' : direccion, fecha: i === 4 ? '2026-11-12' : i === 9 ? null : '2026-11-11', pendiente: i === 5 || i === 9, observaciones: i === 11 ? cambios[i] : '' }
        return { id, version: 1, cliente, titulo: temas[i], nivel: i < 2 ? 'Fácil' : i < 7 ? 'Intermedio' : 'Avanzado', instrucciones: 'Registrá la última información confirmada. Si falta un dato o hay contradicciones, marcá Pendiente y redactá la consulta; no inventes información.', mensajes }
    })
    const filas = Array.from({ length: 20 }, (_, i) => [`Cliente ${i + 1}`, 'Cuadernos', String(i + 1), i % 2 ? 'Bernal' : 'Quilmes', '2026-11-12', i % 3 ? 'Pendiente' : 'Pagado'])
    const planilla: Ejercicio[] = [
        { id: 'B1', version: 1, titulo: 'Carga de datos', instrucciones: 'Distribuí la información de referencia en la fila vacía.', columnas, filas: [columnas.map(() => '')], referencia: ['Daniel Acosta solicita 12 cuadernos, para Quilmes, entrega Mañana, pago Efectivo.'] },
        { id: 'B2', version: 1, titulo: 'Corrección', instrucciones: 'Corregí el registro usando exclusivamente la referencia.', columnas, filas: [['Lara Méndez', 'Carpetas', '8', 'Bernal', '2026-11-11', 'Efectivo']], referencia: ['Laura Méndez: 6 carpetas; localidad Quilmes; entrega 2026-11-12; pago Transferencia.'] },
        { id: 'B3', version: 1, titulo: 'Ordenar y filtrar', instrucciones: 'Filtrá Quilmes, ordená Cantidad de mayor a menor, encontrá Cliente 9 y anotá cuántos pedidos de Quilmes están pendientes. Se conservan tus filtros y orden.', columnas, filas },
        { id: 'B4', version: 1, titulo: 'Operaciones básicas', instrucciones: 'Completá Importe (cantidad × precio). Luego anotá total de unidades, suma de importes y diferencia entre 20 unidades disponibles y las solicitadas. Podés ingresar números o fórmulas simples como =3*120 y =SUMA(A1:A3).', columnas: [{ nombre: 'Cantidad', tipo: 'numero' }, { nombre: 'Precio', tipo: 'numero' }, { nombre: 'Importe', tipo: 'numero' }], filas: [['3', '120', ''], ['5', '80', ''], ['2', '250', '']] },
    ]
    const detalle: Ejercicio[] = [
        ['D1', 'Comparación', 'Original: Ana Torres, 12 cuadernos, Moreno 150, 2026-11-12.', 'Ana Torres | 21 cuadernos | Moreno 150 | 2026-11-12'],
        ['D2', 'Duplicados', 'Cada número de pedido debe aparecer una sola vez.', 'P-10 Ana; P-11 Bruno; P-10 Ana; P-12 Celia'],
        ['D3', 'Datos faltantes', 'Para entregar se requiere calle y altura.', 'Diego: San Martín, Quilmes; Elena: Moreno 120, Bernal'],
        ['D4', 'Inconsistencias', 'Cantidad confirmada: 5; fecha: 2026-11-12; dirección: Mitre 80.', 'Cantidad: -5; fecha: 2026-11-31; dirección: Mitre 80'],
        ['D5', 'Control final', 'Referencia: Fabio Luna, 4 agendas, pago Transferencia, turno Tarde.', 'Fabio Luna | 4 agendas | Efectivo | Tarde'],
    ].map(([id, titulo, original, cargado]) => ({ id, version: 1, titulo, instrucciones: 'Marcá si requiere revisión y describí los campos o registros incorrectos y la corrección propuesta.', referencia: [original, cargado] }))
    const atencion = [
        ['E1', 'Consulta sencilla', '¿Cuándo llega mi pedido?', 'El registro confirma turno mañana, de 9 a 13. No hay horario exacto.'],
        ['E2', 'Cliente molesto', '¡Me llegó un producto equivocado y lo necesito hoy!', 'Solicitá número de pedido y detalle o foto del producto. La reposición requiere revisión; no está confirmada.'],
        ['E3', 'Información faltante', 'Quiero que me lo manden a San Martín.', 'Faltan altura, localidad, fecha y turno.'],
        ['E4', 'Solicitud no confirmada', '¿Me garantizás que llega a las 10 en punto?', 'Sólo se ofrecen franjas de entrega; una hora exacta requiere consultar al responsable.'],
    ].map(([id, titulo, texto, regla]) => ({ id, version: 1, titulo, texto, instrucciones: `Respondé de forma clara y cordial. Regla operativa: ${regla}` }))
    const bancos: Record<Modulo, Ejercicio[]> = { TIPEO: [{ id: `A${variante + 1}`, version: 1, titulo: 'Transcripción', instrucciones: 'Copiá el texto. El reloj empieza al pulsar Comenzar módulo. Podés corregir con normalidad; no pegues texto externo.', texto: textos[variante] }], PLANILLA: planilla, CONVERSACIONES: conversaciones, DETALLE: detalle, ATENCION: atencion }
    soluciones.B1 = ['Daniel Acosta', 'Cuadernos', 12, 'Quilmes', 'Mañana', 'Efectivo']
    soluciones.B2 = ['Laura Méndez', 'Carpetas', 6, 'Quilmes', '2026-11-12', 'Transferencia']
    soluciones.B3 = { pendientesQuilmes: 6, cliente: 'Cliente 9', cantidad: 9 }
    soluciones.B4 = { importes: [360, 400, 500], unidades: 10, total: 1260, diferencia: 10 }
    soluciones.D1 = 'Cantidad: 21 debe ser 12'; soluciones.D2 = 'P-10 duplicado'; soluciones.D3 = 'Diego: falta altura'; soluciones.D4 = 'Cantidad negativa y fecha inexistente'; soluciones.D5 = 'Pago debe ser Transferencia'
    return { version: 2, variante, modulos: config.filter(c => c.activo).map(c => ({ modulo: c.modulo, segundos: c.segundos, ejercicios: bancos[c.modulo].slice(0, c.cantidad).map(e => ({ ...e, mensajes: e.mensajes?.map(m => ({ ...m, segundo: Math.round(m.segundo * Math.min(1, c.segundos / 180)) })) })) })), soluciones }
}
