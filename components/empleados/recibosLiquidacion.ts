import { formatCurrencyToWords } from '@/lib/utils/numberToWords'
import { getPrintLogos } from '@/lib/utils/printLogos'
import { semanaAnteriorDeLiquidacion, separarHorasExtrasYAdeudadas } from '@/lib/payroll/ajustesHorasExtras'

export type ModeloRecibo = 'A' | 'B'

export const MODELOS_RECIBO: Array<{ value: ModeloRecibo, label: string, detalle: string }> = [
    { value: 'A', label: 'Modelo A · Clásico', detalle: 'Texto narrativo con marca de agua' },
    { value: 'B', label: 'Modelo B · Detallado', detalle: 'Conceptos e importes en filas' },
]

export interface ConceptoRecibo {
    nombre: string
    monto: number
    detalle?: string
}

export interface DatosReciboLiquidacion {
    empleado: {
        nombre: string
        apellido?: string | null
        dni?: string | null
    }
    periodo: string
    fechaGeneracion?: string | Date | null
    fechaImpresion?: string | Date | null
    tipo?: string | null
    horasExtras?: number | null
    ajusteHorasExtras?: number | null
    sueldoProporcional?: number | null
    montoHorasNormales?: number | null
    montoHorasExtras?: number | null
    montoAjusteHorasExtras?: number | null
    montoHorasFeriado?: number | null
    montoAdicionales?: number | null
    descuentos?: number | null
    totalNeto: number
    desglose?: Record<string, unknown> | null
    conceptos?: ConceptoRecibo[]
    licenciaNombre?: string | null
}

const escaparHtml = (valor: unknown) => String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

const numero = (valor: unknown) => {
    const resultado = Number(valor)
    return Number.isFinite(resultado) ? resultado : 0
}

const dinero = (valor: unknown) => numero(valor).toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
})

function fechaCivil(valor?: string | Date | null): Date {
    if (!valor) return new Date()
    if (valor instanceof Date) return valor
    const soloFecha = valor.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (soloFecha) return new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3]), 12)
    const fecha = new Date(valor)
    return Number.isNaN(fecha.getTime()) ? new Date() : fecha
}

function fechaLarga(valor?: string | Date | null) {
    const fecha = fechaCivil(valor)
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    return `${fecha.getDate()} de ${meses[fecha.getMonth()]} de ${fecha.getFullYear()}`
}

function rangoPeriodo(periodo: string) {
    const express = periodo.match(/Express\s+([\d/]+)\s+-\s+([\d/]+)/i)
    if (express) return { desde: express[1], hasta: express[2] }
    const normal = periodo.match(/del\s+([\d/]+)\s+al\s+([\d/]+)/i)
    if (normal) return { desde: normal[1], hasta: normal[2] }
    return { desde: periodo, hasta: periodo }
}

function datosCalculados(recibo: DatosReciboLiquidacion) {
    const desglose = recibo.desglose || {}
    const sueldoBase = numero(recibo.sueldoProporcional) + numero(recibo.montoHorasNormales) + numero(recibo.montoHorasFeriado)
    const adicionales = numero(recibo.montoAdicionales)
    const descuentos = Math.abs(numero(recibo.descuentos))
    const totalNeto = numero(recibo.totalNeto)
    const tipo = String(recibo.tipo || '')
    const periodo = String(recibo.periodo || '')
    const detalleHoras = separarHorasExtrasYAdeudadas({
        horasExtras: recibo.horasExtras,
        ajusteHorasExtras: recibo.ajusteHorasExtras,
        montoHorasExtras: recibo.montoHorasExtras,
        desglose: recibo.desglose,
    })
    if (recibo.montoAjusteHorasExtras != null) {
        detalleHoras.montoHorasAdeudadas = numero(recibo.montoAjusteHorasExtras)
        detalleHoras.montoHorasExtras = numero(recibo.montoHorasExtras) - detalleHoras.montoHorasAdeudadas
    }
    const semanaOrigenAjuste = semanaAnteriorDeLiquidacion(periodo, recibo.desglose)
    return {
        desglose,
        sueldoBase,
        adicionales,
        descuentos,
        totalNeto,
        detalleHoras,
        semanaOrigenAjuste,
        rango: rangoPeriodo(periodo),
        esHorasAdeudadas: tipo === 'HORAS_EXTRAS_ADEUDADAS' || desglose.origen === 'HORAS_EXTRAS_ADEUDADAS',
        esFeriadoAdeudado: tipo === 'FERIADO_ADEUDADO' || desglose.origen === 'FERIADO_ADEUDADO',
        esMixtoEfectivo: tipo === 'MENSUAL_MIXTA' || desglose.origen === 'MENSUAL_MIXTA_EFECTIVO',
        esVacaciones: tipo === 'VACACIONES' || desglose.esVacaciones === true || periodo.toLowerCase().includes('vacaciones'),
        esFinal: tipo === 'FINAL' || desglose.esLiquidacionFinal === true,
    }
}

export function conceptosDetallados(recibo: DatosReciboLiquidacion): ConceptoRecibo[] {
    const calc = datosCalculados(recibo)
    if (calc.esFinal && Array.isArray(calc.desglose.conceptos)) {
        return (calc.desglose.conceptos as Array<Record<string, unknown>>).map(concepto => {
            const nombre = String(concepto.nombre || 'Concepto')
            const esDiasTrabajados = nombre.trim().toLocaleLowerCase('es-AR').startsWith('días trabajados')
            return {
                nombre,
                monto: numero(concepto.monto),
                detalle: !esDiasTrabajados && concepto.metodologia
                    ? String(concepto.metodologia)
                    : undefined,
            }
        })
    }
    if (calc.esHorasAdeudadas) {
        return [{
            nombre: `Horas extras adeudadas (${dinero(calc.desglose.cantidadHoras || recibo.horasExtras)} h)`,
            monto: numero(calc.desglose.monto || recibo.montoHorasExtras || recibo.totalNeto),
            detalle: `Semana de origen: ${String(calc.desglose.semanaOrigen || recibo.periodo)}`,
        }]
    }
    if (calc.esFeriadoAdeudado) {
        return [{
            nombre: `Adicional de feriado adeudado · ${String(calc.desglose.nombreFeriado || 'Feriado')}`,
            monto: numero(calc.desglose.monto || recibo.montoHorasFeriado || recibo.totalNeto),
            detalle: `Fecha: ${String(calc.desglose.fechaFeriado || 'Sin informar')} · ${String(calc.desglose.semanaOrigen || recibo.periodo)}`,
        }]
    }
    if (calc.esMixtoEfectivo) {
        return [{
            nombre: 'Diferencia salarial abonada en efectivo',
            monto: calc.totalNeto,
            detalle: 'El importe del recibo oficial se documenta por separado.',
        }]
    }
    if (calc.esVacaciones) {
        return [{ nombre: 'Vacaciones anuales', monto: calc.totalNeto }]
    }

    const conceptos: ConceptoRecibo[] = []
    if (calc.sueldoBase !== 0) conceptos.push({ nombre: 'Sueldo / período', monto: calc.sueldoBase })
    if (calc.detalleHoras.montoHorasExtras !== 0) conceptos.push({
        nombre: `Horas extras de la semana (${dinero(calc.detalleHoras.horasExtras)} h)`,
        monto: calc.detalleHoras.montoHorasExtras,
    })
    if (calc.detalleHoras.montoHorasAdeudadas !== 0 || calc.detalleHoras.horasAdeudadas !== 0) conceptos.push({
        nombre: `Horas de ajuste / adeudadas (${dinero(calc.detalleHoras.horasAdeudadas)} h)`,
        monto: calc.detalleHoras.montoHorasAdeudadas,
        detalle: calc.semanaOrigenAjuste
            ? `Semana de origen: ${calc.semanaOrigenAjuste.etiqueta}`
            : 'Horas incorporadas manualmente a esta liquidación.',
    })
    if (recibo.conceptos?.length) conceptos.push(...recibo.conceptos.filter(concepto => numero(concepto.monto) > 0))
    else if (calc.adicionales > 0) conceptos.push({ nombre: 'Adicionales / otros', monto: calc.adicionales })
    return conceptos
}

export function importeMostradoEnRecibo(recibo: DatosReciboLiquidacion): number {
    const calc = datosCalculados(recibo)
    const esReciboSemanal = !calc.esHorasAdeudadas
        && !calc.esFeriadoAdeudado
        && !calc.esMixtoEfectivo
        && !calc.esVacaciones
        && !calc.esFinal
    const descuentosAdicionales = recibo.conceptos?.length
        ? recibo.conceptos.reduce((total, concepto) => total + Math.abs(Math.min(0, numero(concepto.monto))), 0)
        : Math.abs(Math.min(0, calc.adicionales))
    return esReciboSemanal
        ? calc.totalNeto + calc.descuentos + descuentosAdicionales
        : calc.totalNeto
}

export function contenidoEspecialClasico(recibo: DatosReciboLiquidacion) {
    const calc = datosCalculados(recibo)
    if (calc.esHorasAdeudadas) {
        const horas = numero(calc.desglose.cantidadHoras || recibo.horasExtras)
        const monto = numero(calc.desglose.monto || recibo.montoHorasExtras || recibo.totalNeto)
        const valorHora = numero(calc.desglose.valorHoraExtra || (horas > 0 ? monto / horas : 0))
        return `
            <div class="titulo-especial"><h2>Recibo de horas extras adeudadas</h2><p>Pago extraordinario independiente de la liquidación semanal en curso</p></div>
            <p>Se deja constancia de la recepción de <strong>$${dinero(monto)}</strong> (pesos ${formatCurrencyToWords(monto)}) en concepto exclusivo de horas extras omitidas de una liquidación anterior.</p>
            <table class="tabla-especial"><thead><tr><th>Semana de origen</th><th>Horas</th><th>Valor hora</th><th>Total</th></tr></thead><tbody><tr><td>${escaparHtml(calc.desglose.semanaOrigen || recibo.periodo)}</td><td>${dinero(horas)} h</td><td>$${dinero(valorHora)}</td><td><strong>$${dinero(monto)}</strong></td></tr></tbody></table>
            <p class="detalle-observacion"><strong>Detalle:</strong> ${escaparHtml(calc.desglose.observaciones || 'Sin observaciones')}</p>`
    }
    if (calc.esFeriadoAdeudado) {
        const monto = numero(calc.desglose.monto || recibo.montoHorasFeriado || recibo.totalNeto)
        const fecha = String(calc.desglose.fechaFeriado || '').split('-').reverse().join('/')
        return `
            <div class="titulo-especial"><h2>Recibo de feriado adeudado</h2><p>Pago complementario independiente de la liquidación semanal</p></div>
            <p>Se deja constancia de la recepción de <strong>$${dinero(monto)}</strong> (pesos ${formatCurrencyToWords(monto)}) correspondiente exclusivamente al adicional omitido del feriado <strong>${escaparHtml(calc.desglose.nombreFeriado || 'Feriado')}</strong>, trabajado el <strong>${escaparHtml(fecha)}</strong>.</p>
            ${tablaConceptos(recibo)}
            <p class="detalle-observacion">Este comprobante se atribuye a <strong>${escaparHtml(calc.desglose.semanaOrigen || recibo.periodo)}</strong> y no modifica ni duplica la liquidación salarial original.</p>`
    }
    if (calc.esMixtoEfectivo) {
        return `
            <div class="titulo-especial"><h2>Recibo de pago en efectivo</h2><p>Cierre mensual mixto</p></div>
            <p>Se deja constancia de la recepción de <strong>$${dinero(calc.totalNeto)}</strong> (pesos ${formatCurrencyToWords(calc.totalNeto)}) en concepto exclusivo de diferencia salarial abonada en efectivo correspondiente al período <strong>${escaparHtml(calc.desglose.periodo || recibo.periodo)}</strong>.</p>
            <p class="detalle-observacion">El importe liquidado mediante el recibo oficial del contador se documenta por separado y <strong>no integra este comprobante</strong>.</p>`
    }
    if (calc.esVacaciones) {
        const inicio = calc.desglose.fechaInicioGoce ? String(calc.desglose.fechaInicioGoce).split('-').reverse().join('/') : '___'
        const fin = calc.desglose.fechaFinGoce ? String(calc.desglose.fechaFinGoce).split('-').reverse().join('/') : '___'
        return `<div class="titulo-especial"><h2>Vacaciones anuales</h2></div><p>Se abona la suma de <strong>$${dinero(calc.totalNeto)}</strong> (pesos ${formatCurrencyToWords(calc.totalNeto)}) correspondiente a <strong>${escaparHtml(calc.desglose.diasTrabajados || '___')}</strong> días corridos de vacaciones anuales.</p><p>El período de goce fue desde <strong>${inicio}</strong> hasta <strong>${fin}</strong>, inclusive.</p>`
    }
    if (calc.esFinal) {
        return `<div class="titulo-especial"><h2>Liquidación final de haberes</h2><p>Ley de Contrato de Trabajo N° 20.744</p></div><p>Certifico haber recibido la suma de <strong>$${dinero(calc.totalNeto)}</strong> (pesos ${formatCurrencyToWords(calc.totalNeto)}) en concepto de liquidación final por <strong>${escaparHtml(calc.desglose.tipoEgreso || 'egreso')}</strong>.</p>${tablaConceptos(recibo)}`
    }
    return null
}

function tablaConceptos(recibo: DatosReciboLiquidacion) {
    const calc = datosCalculados(recibo)
    const conceptos = conceptosDetallados(recibo)
    const mostrarDescuentos = calc.esHorasAdeudadas
        || calc.esFeriadoAdeudado
        || calc.esMixtoEfectivo
        || calc.esVacaciones
        || calc.esFinal
    const filas = conceptos.map(concepto => {
        const esDescuento = concepto.monto < 0
        const nombre = `${escaparHtml(concepto.nombre)}${concepto.detalle ? `<small>${escaparHtml(concepto.detalle)}</small>` : ''}`
        return mostrarDescuentos
            ? `<tr><td>${nombre}</td><td>${esDescuento ? '-' : `$${dinero(concepto.monto)}`}</td><td>${esDescuento ? `-$${dinero(Math.abs(concepto.monto))}` : '-'}</td></tr>`
            : `<tr><td>${nombre}</td><td>$${dinero(concepto.monto)}</td></tr>`
    }).join('')
    const totalHaberes = conceptos.filter(c => c.monto > 0).reduce((total, c) => total + c.monto, 0)
    const totalDescuentos = conceptos.filter(c => c.monto < 0).reduce((total, c) => total + Math.abs(c.monto), 0)
    if (mostrarDescuentos) {
        return `<table class="tabla-detalle"><thead><tr><th>Concepto</th><th>Haberes</th><th>Descuentos</th></tr></thead><tbody>${filas || '<tr><td colspan="3">Sin conceptos detallados</td></tr>'}</tbody><tfoot><tr><td>Totales</td><td>$${dinero(totalHaberes)}</td><td>$${dinero(totalDescuentos)}</td></tr><tr class="neto"><td colspan="2">Total neto recibido</td><td>$${dinero(recibo.totalNeto)}</td></tr></tfoot></table>`
    }
    return `<table class="tabla-detalle"><thead><tr><th>Concepto</th><th>Importe</th></tr></thead><tbody>${filas || '<tr><td colspan="2">Sin conceptos detallados</td></tr>'}</tbody><tfoot><tr class="neto"><td>Importe total a pagar</td><td>$${dinero(importeMostradoEnRecibo(recibo))}</td></tr></tfoot></table>`
}

export function contenidoReciboFinalRenuncia(recibo: DatosReciboLiquidacion): string | null {
    const calc = datosCalculados(recibo)
    const tipoEgreso = String(calc.desglose.tipoEgreso || '').trim().toUpperCase()
    if (!calc.esFinal || tipoEgreso !== 'RENUNCIA') return null

    const nombre = `${recibo.empleado.nombre} ${recibo.empleado.apellido || ''}`.trim()
    const dni = recibo.empleado.dni || '________________'

    return `
        <div class="titulo-especial"><h2>Liquidación final por renuncia</h2></div>
        <p class="declaracion-renuncia">Quien suscribe, <strong>${escaparHtml(nombre)}</strong>, con DNI <strong>${escaparHtml(dni)}</strong>, manifiesta haber recibido a su entera satisfacción la cantidad de <strong>$${dinero(calc.totalNeto)}</strong> (pesos ${formatCurrencyToWords(calc.totalNeto)}), misma es entregada por Eliana Melisa Bassi en efectivo, por concepto de tareas realizadas en Sandwicheria Santa Catalina a la fecha.</p>
        ${tablaConceptos(recibo)}
        <p class="clausula-renuncia">Por la que sirva el presente como recibo mas amplio y eficaz que en derecho proceda, no reservándome acción legal alguna por ejercer.</p>
        <p class="recibi">Recibí</p>`
}

export function cuerpoModeloA(recibo: DatosReciboLiquidacion) {
    const especial = contenidoEspecialClasico(recibo)
    if (especial) return especial
    const calc = datosCalculados(recibo)
    const extras = calc.detalleHoras.montoHorasExtras
    const ajusteHoras = calc.detalleHoras.montoHorasAdeudadas
    const partes = [
        `<strong>$${dinero(calc.sueldoBase)}</strong> (pesos ${formatCurrencyToWords(calc.sueldoBase)}) en concepto de pago por el período laboral del <strong>${escaparHtml(calc.rango.desde)}</strong> al <strong>${escaparHtml(calc.rango.hasta)}</strong>`,
    ]
    if (extras !== 0) partes.push(`<strong>$${dinero(extras)}</strong> (pesos ${formatCurrencyToWords(extras)}) por <strong>${dinero(calc.detalleHoras.horasExtras)} horas extras de la semana</strong>`)
    if (ajusteHoras !== 0 || calc.detalleHoras.horasAdeudadas !== 0) {
        const origen = calc.semanaOrigenAjuste
            ? ` correspondientes a la <strong>${escaparHtml(calc.semanaOrigenAjuste.etiqueta)}</strong>`
            : ''
        partes.push(`<strong>$${dinero(ajusteHoras)}</strong> (pesos ${formatCurrencyToWords(Math.abs(ajusteHoras))}) por <strong>${dinero(calc.detalleHoras.horasAdeudadas)} horas de ajuste / adeudadas</strong>${origen}`)
    }
    if (calc.adicionales !== 0) partes.push(`<strong>$${dinero(calc.adicionales)}</strong> (pesos ${formatCurrencyToWords(Math.abs(calc.adicionales))}) por adicionales y otros conceptos`)
    const licencia = recibo.licenciaNombre ? ` Se contemplan días de licencia por <strong>${escaparHtml(recibo.licenciaNombre)}</strong>.` : ''
    const importe = importeMostradoEnRecibo(recibo)
    return `<p>Recibo la cantidad de ${partes.join(', más ')}.${licencia} El importe total a pagar es de <strong>$${dinero(importe)}</strong> (pesos ${formatCurrencyToWords(importe)}).</p>`
}

function reciboHtml(recibo: DatosReciboLiquidacion, modelo: ModeloRecibo, logo: string, watermark: string, pageBreak: boolean) {
    const nombre = `${recibo.empleado.nombre} ${recibo.empleado.apellido || ''}`.trim()
    const contenidoRenuncia = contenidoReciboFinalRenuncia(recibo)
    const contenido = contenidoRenuncia
        ? `<div class="texto texto-renuncia">${contenidoRenuncia}</div>`
        : modelo === 'A'
            ? `<div class="texto">${cuerpoModeloA(recibo)}</div>`
            : `<div class="encabezado-detalle"><span>RECIBO DE PAGO</span><strong>${escaparHtml(recibo.periodo)}</strong></div>${recibo.licenciaNombre ? `<p class="aviso">Incluye licencia: ${escaparHtml(recibo.licenciaNombre)}</p>` : ''}${tablaConceptos(recibo)}<p class="en-letras">Son pesos ${formatCurrencyToWords(importeMostradoEnRecibo(recibo))}.</p>`
    return `<section class="recibo ${contenidoRenuncia ? 'recibo-renuncia' : ''} ${pageBreak ? 'salto' : ''}"><img src="${watermark}" class="watermark" alt=""><header><img src="${logo}" alt="Santa Catalina"><p>Berazategui, ${fechaLarga(recibo.fechaImpresion || recibo.fechaGeneracion)}</p></header><main>${contenido}</main><footer><div class="firma">Firma</div><div>Aclaración: ${escaparHtml(nombre)}</div><div>D.N.I: ${escaparHtml(recibo.empleado.dni || '')}</div></footer></section>`
}

export async function imprimirRecibosLiquidacion(recibos: DatosReciboLiquidacion[], modelo: ModeloRecibo, ventanaReservada?: Window | null) {
    if (recibos.length === 0) return false
    const ventana = ventanaReservada || window.open('', '_blank')
    if (!ventana) {
        window.alert('El navegador bloqueó la ventana de impresión. Habilitá las ventanas emergentes e intentá nuevamente.')
        return false
    }
    ventana.document.write('<p style="font-family:sans-serif;padding:24px">Preparando recibo…</p>')
    const { logo, watermark } = await getPrintLogos()
    const paginas = recibos.map((recibo, indice) => reciboHtml(recibo, modelo, logo, watermark, indice < recibos.length - 1)).join('')
    ventana.document.open()
    ventana.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Recibos · Modelo ${modelo}</title><style>
        @page{size:A4;margin:18mm}*{box-sizing:border-box}body{margin:0;color:#111;font-family:${modelo === 'A' ? "'Times New Roman',serif" : "Arial,sans-serif"};font-size:${modelo === 'A' ? '14pt' : '11pt'}}
        .recibo{border:1px solid #ddd;min-height:245mm;padding:34px 38px;position:relative;overflow:hidden}.salto{page-break-after:always}.watermark{position:absolute;width:78%;max-width:500px;left:50%;top:50%;transform:translate(-50%,-50%);opacity:.3;z-index:0}.recibo>*:not(.watermark){position:relative;z-index:1}
        header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:42px}header img{height:60px;max-width:170px;object-fit:contain}header p{margin:0;text-align:right}.texto{text-align:justify;line-height:1.65;margin-top:35px}.titulo-especial{text-align:center;margin-bottom:24px}.titulo-especial h2{text-decoration:underline;margin:0 0 4px}.titulo-especial p{font-size:10pt;margin:0}
        .tabla-especial,.tabla-detalle{width:100%;border-collapse:collapse;margin:24px 0;background:rgba(255,255,255,.72)}th,td{border:1px solid #555;padding:8px;text-align:right}.tabla-especial th:first-child,.tabla-especial td:first-child,.tabla-detalle th:first-child,.tabla-detalle td:first-child{text-align:left}.tabla-detalle th{background:#222;color:#fff;text-transform:uppercase;font-size:9pt;letter-spacing:.04em}.tabla-detalle th:first-child{width:58%}.tabla-detalle td small{display:block;color:#555;margin-top:3px}.tabla-detalle tfoot{font-weight:700}.tabla-detalle .neto{font-size:13pt;background:#eee}.encabezado-detalle{border-left:5px solid #dc1f3d;padding:10px 14px;margin-bottom:24px;display:flex;flex-direction:column;gap:4px}.encabezado-detalle span{color:#dc1f3d;font-size:10pt;font-weight:800;letter-spacing:.08em}.encabezado-detalle strong{font-size:15pt}.aviso{background:#f3f4f6;padding:10px 12px}.en-letras{font-family:'Times New Roman',serif;font-style:italic;margin-top:24px}
        .texto-renuncia{margin-top:0}.declaracion-renuncia,.clausula-renuncia{text-align:justify}.clausula-renuncia{margin-top:28px}.recibi{font-weight:700;margin-top:28px}.recibo-renuncia footer{margin-top:48px}
        footer{display:flex;flex-direction:column;align-items:flex-end;gap:14px;margin-top:75px}footer>div{width:250px}.firma{border-top:1px solid #111;text-align:center;padding-top:5px}.detalle-observacion{font-size:10pt}@media print{*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}
    </style></head><body>${paginas}<script>window.onload=()=>{const i=[...document.images];Promise.all(i.map(x=>x.complete?Promise.resolve():new Promise(r=>{x.onload=r;x.onerror=r}))).then(()=>window.print())}<\/script></body></html>`)
    ventana.document.close()
    return true
}
