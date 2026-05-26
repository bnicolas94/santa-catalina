import { prisma } from '@/lib/prisma'

export interface ConceptoDesglose {
    nombre: string
    efectivo: number
    transferencia: number
    total: number
}

function formatConceptLabel(concept: string): string {
    const mappings: Record<string, string> = {
        pago_proveedor: 'Pago a Proveedores',
        pago_sueldo: 'Pago de Sueldos',
        rendicion_chofer: 'Rendiciones Choferes',
        cobro_pedido: 'Cobros Pedidos',
        transferencia_interna: 'Transferencias Internas',
        gasto_operativo: 'Gastos Operativos',
        caja_chica: 'Caja Chica',
        arqueo_caja: 'Ajuste de Arqueo',
        retiro_socio: 'Retiro Socio',
        gastos_generales: 'Gastos Generales'
    }
    if (mappings[concept]) return mappings[concept]
    
    // Fallback formatting: replace underscores and capitalize
    return concept
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
}

function isInternalTransfer(concept: string): boolean {
    const conceptLower = concept.toLowerCase()
    return (
        conceptLower === 'transferencia_interna' ||
        conceptLower.includes('depósito diario') ||
        conceptLower.includes('deposito diario') ||
        conceptLower.includes('transferencia entre cajas') ||
        conceptLower.includes('transferencias internas')
    )
}

/**
 * Servicio de reportes de flujo de caja.
 * Analiza ingresos, egresos y saldos netos agrupados por medio de pago (efectivo/transferencia) y concepto.
 */
export async function getCajaReport(
    desdeIso: string,
    hastaIso: string,
    ubicacionId?: string
) {
    const start = new Date(desdeIso)
    const end = new Date(hastaIso)

    let allowedBoxes: string[] | undefined = undefined
    if (ubicacionId) {
        const ubi = await prisma.ubicacion.findUnique({
            where: { id: ubicacionId },
            select: { tipo: true }
        })
        if (ubi) {
            const tipo = ubi.tipo.toUpperCase()
            if (tipo === 'LOCAL') {
                allowedBoxes = ['local', 'caja_chica_local']
            } else if (tipo === 'FABRICA') {
                allowedBoxes = ['caja_madre', 'caja_chica', 'mercado_pago', 'mercado_pago_juani']
            }
        }
    }

    const queryWhere: any = {
        fecha: { gte: start, lte: end }
    }
    if (allowedBoxes) {
        queryWhere.cajaOrigen = { in: allowedBoxes }
    }

    // Obtener todos los movimientos en el período
    const movimientos = await prisma.movimientoCaja.findMany({
        where: queryWhere,
        orderBy: { fecha: 'desc' },
        include: {
            pedido: { select: { id: true, totalImporte: true, cliente: { select: { nombreComercial: true } } } },
            rendicion: { select: { id: true, chofer: { select: { nombre: true } } } },
            gasto: { select: { id: true, descripcion: true } }
        }
    })

    // Totales globales
    let ingresosEfectivo = 0
    let ingresosTransferencia = 0
    let egresosEfectivo = 0
    let egresosTransferencia = 0

    // Agrupación por conceptos
    const egresosPorConcepto: Record<string, ConceptoDesglose> = {}
    const ingresosPorConcepto: Record<string, ConceptoDesglose> = {}

    // Agrupación por día para tendencia
    const porDia: Record<string, { fecha: string; label: string; ingresosEf: number; ingresosTr: number; egresosEf: number; egresosTr: number }> = {}

    // Generar días intermedios para la tendencia
    const tempDate = new Date(start)
    // Límite defensivo para evitar bucles infinitos en rangos erróneos
    const maxDays = 366
    let daysCount = 0
    while (tempDate <= end && daysCount < maxDays) {
        const key = tempDate.toISOString().slice(0, 10)
        const label = tempDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
        porDia[key] = {
            fecha: key,
            label,
            ingresosEf: 0,
            ingresosTr: 0,
            egresosEf: 0,
            egresosTr: 0
        }
        tempDate.setDate(tempDate.getDate() + 1)
        daysCount++
    }

    // Procesar movimientos
    for (const m of movimientos) {
        const val = m.monto
        const mp = m.medioPago === 'transferencia' ? 'transferencia' : 'efectivo'
        const label = formatConceptLabel(m.concepto)
        const isInternal = isInternalTransfer(m.concepto)

        // Si es una transferencia o depósito interno, no lo sumamos a los KPIs ni a los desgloses de ingresos/egresos reales
        if (isInternal) {
            continue
        }

        // Acumular totales globales
        if (m.tipo === 'ingreso') {
            if (mp === 'efectivo') ingresosEfectivo += val
            else ingresosTransferencia += val

            // Desglose concepto
            if (!ingresosPorConcepto[m.concepto]) {
                ingresosPorConcepto[m.concepto] = { nombre: label, efectivo: 0, transferencia: 0, total: 0 }
            }
            ingresosPorConcepto[m.concepto][mp] += val
            ingresosPorConcepto[m.concepto].total += val
        } else {
            if (mp === 'efectivo') egresosEfectivo += val
            else egresosTransferencia += val

            // Desglose concepto
            if (!egresosPorConcepto[m.concepto]) {
                egresosPorConcepto[m.concepto] = { nombre: label, efectivo: 0, transferencia: 0, total: 0 }
            }
            egresosPorConcepto[m.concepto][mp] += val
            egresosPorConcepto[m.concepto].total += val
        }

        // Acumular por día para tendencia
        const dayKey = m.fecha.toISOString().slice(0, 10)
        if (porDia[dayKey]) {
            const prefix = m.tipo === 'ingreso' ? 'ingresos' : 'egresos'
            const suffix = mp === 'transferencia' ? 'Tr' : 'Ef'
            porDia[dayKey][`${prefix}${suffix}`] += val
        }
    }

    // Dar formato final y ordenar desgloses
    const egresosDesglose = Object.values(egresosPorConcepto).sort((a, b) => b.total - a.total)
    const ingresosDesglose = Object.values(ingresosPorConcepto).sort((a, b) => b.total - a.total)
    
    // Tendencia diaria ordenada cronológicamente
    const tendenciaDiaria = Object.values(porDia).sort((a, b) => a.fecha.localeCompare(b.fecha))

    // Listado detallado de transacciones
    const movimientosDetalle = movimientos.map(m => {
        let desc = m.descripcion || ''
        
        if (m.pedido) {
            const cli = m.pedido.cliente?.nombreComercial || 'Cliente General'
            desc = `Pedido a ${cli} ${desc ? '— ' + desc : ''}`.trim()
        } else if (m.rendicion) {
            const chof = m.rendicion.chofer?.nombre || 'Chofer'
            desc = `Rendición de ${chof} ${desc ? '— ' + desc : ''}`.trim()
        } else if (m.gasto) {
            desc = desc || m.gasto.descripcion || ''
        }

        return {
            id: m.id,
            fecha: m.fecha.toISOString(),
            tipo: m.tipo,
            conceptoKey: m.concepto,
            concepto: formatConceptLabel(m.concepto),
            monto: m.monto,
            medioPago: m.medioPago,
            cajaOrigen: m.cajaOrigen || 'Sin caja',
            descripcion: desc
        }
    })

    const ingresosTotal = ingresosEfectivo + ingresosTransferencia
    const egresosTotal = egresosEfectivo + egresosTransferencia

    return {
        desde: desdeIso,
        hasta: hastaIso,
        kpis: {
            ingresosEfectivo,
            ingresosTransferencia,
            ingresosTotal,
            egresosEfectivo,
            egresosTransferencia,
            egresosTotal,
            flujoNetoEfectivo: ingresosEfectivo - egresosEfectivo,
            flujoNetoTransferencia: ingresosTransferencia - egresosTransferencia,
            flujoNetoTotal: ingresosTotal - egresosTotal
        },
        ingresosDesglose,
        egresosDesglose,
        tendenciaDiaria,
        movimientosDetalle
    }
}
