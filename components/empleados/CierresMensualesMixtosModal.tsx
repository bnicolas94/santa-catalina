'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import styles from './CierresMensualesMixtosModal.module.css'
import { CambiarCajaPagoButton } from './CambiarCajaPagoButton'

type Medio = 'TRANSFERENCIA' | 'EFECTIVO'

interface Caja {
    id: string
    nombre: string
    saldo: number
}

interface Pago {
    id: string
    medio: Medio
    monto: number
    cajaOrigen: string
    estado: string
    fechaPago: string
    movimientoCaja?: { id: string; cajaOrigen: string | null } | null
}

interface Cierre {
    id: string
    totalDevengado: number
    netoRecibo: number
    efectivoCalculado: number
    estado: 'PENDIENTE' | 'PARCIAL' | 'PAGADO' | 'ANULADO'
    cerradoAt: string
    pagos: Pago[]
    liquidacionSueldo: { id: string; estado: string }
    totalConciliado: number
}

interface FilaMensual {
    empleado: { id: string; nombre: string; apellido?: string | null; dni?: string | null }
    periodo: string
    rango: { desde: string; hasta: string }
    totalCalculado: number
    consolidado?: {
        historicoSemanal: number
        seguimientoNoCubierto: number
        descuentoPendiente: number
        diasCubiertosPorHistorial: number
    } | null
    resumen?: { diasSeguimientoGuardados?: number } | null
    cierre: Cierre | null
    referenciasSemanales: {
        cantidad: number
        cantidadPagadas: number
        total: number
        totalDevengado: number
        liquidaciones: Array<{
            id: string
            periodo: string
            totalNeto: number
            montoPagado: number
            montoDevengadoPeriodo: number
            cruzaPeriodo: boolean
        }>
    }
}

interface Props {
    onClose: () => void
}

const dinero = (monto: number) => monto.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
})

function periodoInicial() {
    const hoy = new Date()
    const fecha = hoy.getDate() <= 7
        ? new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
        : new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
}

function periodoTerminado(periodo: string) {
    const [anio, mes] = periodo.split('-').map(Number)
    if (!anio || !mes) return false
    const fin = new Date(anio, mes, 0, 23, 59, 59, 999)
    return fin.getTime() < Date.now()
}

function etiquetaPeriodo(periodo: string) {
    const [anio, mes] = periodo.split('-').map(Number)
    return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' })
        .format(new Date(anio, mes - 1, 1))
}

function nombreCaja(cajas: Caja[], id: string) {
    return cajas.find(caja => caja.id === id)?.nombre || id.replaceAll('_', ' ')
}

export function CierresMensualesMixtosModal({ onClose }: Props) {
    const bodyRef = useRef<HTMLElement>(null)
    const [periodo, setPeriodo] = useState(periodoInicial)
    const [filas, setFilas] = useState<FilaMensual[]>([])
    const [cajas, setCajas] = useState<Caja[]>([])
    const [netosRecibo, setNetosRecibo] = useState<Record<string, string>>({})
    const [liquidacionesConciliadas, setLiquidacionesConciliadas] = useState<Record<string, string[]>>({})
    const [montosConciliados, setMontosConciliados] = useState<Record<string, Record<string, string>>>({})
    const [conciliacionesRevisadas, setConciliacionesRevisadas] = useState<Record<string, boolean>>({})
    const [cajasPago, setCajasPago] = useState<Record<Medio, string>>({
        TRANSFERENCIA: 'mercado_pago',
        EFECTIVO: 'caja_madre',
    })
    const [cargando, setCargando] = useState(true)
    const [procesando, setProcesando] = useState<string | null>(null)
    const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

    const cargar = useCallback(async () => {
        setCargando(true)
        setMensaje(null)
        try {
            const [respuestaCierres, respuestaCajas] = await Promise.all([
                fetch(`/api/empleados/cierres-mensuales?periodo=${encodeURIComponent(periodo)}`),
                fetch('/api/caja/saldos'),
            ])
            const cierres = await respuestaCierres.json()
            const saldos = await respuestaCajas.json()
            if (!respuestaCierres.ok) throw new Error(cierres.error || 'No se pudieron cargar los cierres.')
            if (!respuestaCajas.ok) throw new Error(saldos.error || 'No se pudieron cargar las cajas.')

            const filasCargadas = (cierres.empleados || []) as FilaMensual[]
            setFilas(filasCargadas)
            setLiquidacionesConciliadas(actual => {
                const siguiente = { ...actual }
                filasCargadas.forEach(fila => {
                    if (siguiente[fila.empleado.id] !== undefined) return
                    siguiente[fila.empleado.id] = fila.referenciasSemanales.liquidaciones
                        .filter(liquidacion => Math.min(liquidacion.montoPagado, liquidacion.montoDevengadoPeriodo) > 0)
                        .map(liquidacion => liquidacion.id)
                })
                return siguiente
            })
            setMontosConciliados(actual => {
                const siguiente = { ...actual }
                filasCargadas.forEach(fila => {
                    if (siguiente[fila.empleado.id] !== undefined) return
                    siguiente[fila.empleado.id] = Object.fromEntries(fila.referenciasSemanales.liquidaciones.map(liquidacion => [
                        liquidacion.id,
                        String(Math.min(liquidacion.montoPagado, liquidacion.montoDevengadoPeriodo)),
                    ]))
                })
                return siguiente
            })
            setCajas([
                { id: 'caja_madre', nombre: 'Caja Madre', saldo: saldos.cajaMadre?.saldo || 0 },
                { id: 'caja_chica', nombre: 'Caja Chica', saldo: saldos.cajaChica?.saldo || 0 },
                { id: 'local', nombre: 'Caja Local', saldo: saldos.local?.saldo || 0 },
                { id: 'caja_chica_local', nombre: 'Caja Chica Local', saldo: saldos.cajaChicaLocal?.saldo || 0 },
                { id: 'mercado_pago', nombre: 'Mercado Pago', saldo: saldos.mercadoPago?.saldo || 0 },
                { id: 'mercado_pago_juani', nombre: 'Mercado Pago Juani', saldo: saldos.mercadoPagoJuani?.saldo || 0 },
            ])
        } catch (error) {
            setMensaje({ tipo: 'error', texto: error instanceof Error ? error.message : 'No se pudo cargar el módulo.' })
        } finally {
            setCargando(false)
        }
    }, [periodo])

    useEffect(() => { void cargar() }, [cargar])
    useEffect(() => {
        setNetosRecibo({})
        setLiquidacionesConciliadas({})
        setMontosConciliados({})
        setConciliacionesRevisadas({})
    }, [periodo])

    const resumen = useMemo(() => filas.reduce((acumulado, fila) => {
        const cierre = fila.cierre
        acumulado.total += cierre?.totalDevengado ?? fila.totalCalculado
        acumulado.transferencia += cierre?.netoRecibo ?? 0
        acumulado.efectivo += cierre?.efectivoCalculado ?? 0
        if (cierre?.estado === 'PAGADO') acumulado.pagados += 1
        return acumulado
    }, { total: 0, transferencia: 0, efectivo: 0, pagados: 0 }), [filas])

    const mostrarError = (texto: string) => {
        setMensaje({ tipo: 'error', texto })
        requestAnimationFrame(() => bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' }))
    }

    const cerrar = async (fila: FilaMensual) => {
        const netoRecibo = Number(netosRecibo[fila.empleado.id])
        if (!Number.isFinite(netoRecibo) || netoRecibo < 0) {
            mostrarError('Ingresá el neto exacto del recibo oficial.')
            return
        }
        const idsConciliados = liquidacionesConciliadas[fila.empleado.id] || []
        if (fila.referenciasSemanales.cantidad > 0 && !conciliacionesRevisadas[fila.empleado.id]) {
            mostrarError('Confirmá que revisaste todos los pagos semanales detectados.')
            return
        }
        const aplicaciones = fila.referenciasSemanales.liquidaciones.map(liquidacion => ({
            id: liquidacion.id,
            monto: idsConciliados.includes(liquidacion.id)
                ? Number(montosConciliados[fila.empleado.id]?.[liquidacion.id] ?? Math.min(liquidacion.montoPagado, liquidacion.montoDevengadoPeriodo))
                : 0,
        }))
        if (aplicaciones.some((aplicacion, indice) => {
            const referencia = fila.referenciasSemanales.liquidaciones[indice]
            return !Number.isFinite(aplicacion.monto) || aplicacion.monto < 0 || aplicacion.monto > Math.min(referencia.montoPagado, referencia.montoDevengadoPeriodo)
        })) {
            mostrarError('Revisá los importes aplicados: no pueden superar el pago que corresponde a este mes.')
            return
        }
        const totalConciliado = Math.round(aplicaciones.reduce((total, aplicacion) => total + aplicacion.monto, 0) * 100) / 100
        const efectivo = Math.round((fila.totalCalculado - netoRecibo - totalConciliado) * 100) / 100
        if (efectivo < 0) {
            mostrarError('El recibo más los pagos semanales aplicados no pueden superar el sueldo real calculado. Desmarcá o reducí un pago si no corresponde íntegramente a este mes.')
            return
        }
        const nombre = `${fila.empleado.nombre} ${fila.empleado.apellido || ''}`.trim()
        if (!confirm(`¿Cerrar ${etiquetaPeriodo(periodo)} para ${nombre}?\n\nYa abonado en semanas: ${dinero(totalConciliado)}\nTransferencia del recibo: ${dinero(netoRecibo)}\nEfectivo restante: ${dinero(efectivo)}\n\nLuego los importes quedarán congelados.`)) return

        setProcesando(`cerrar-${fila.empleado.id}`)
        setMensaje(null)
        try {
            const respuesta = await fetch('/api/empleados/cierres-mensuales', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    empleadoId: fila.empleado.id,
                    periodo,
                    netoRecibo,
                    liquidacionesConciliadas: aplicaciones,
                    conciliacionConfirmada: fila.referenciasSemanales.cantidad === 0 || conciliacionesRevisadas[fila.empleado.id] === true,
                }),
            })
            const data = await respuesta.json()
            if (!respuesta.ok) throw new Error(data.error || 'No se pudo cerrar el período.')
            setMensaje({ tipo: 'ok', texto: `El cierre de ${nombre} quedó guardado. Ahora podés registrar cada medio de pago por separado.` })
            await cargar()
        } catch (error) {
            mostrarError(error instanceof Error ? error.message : 'No se pudo cerrar el período.')
        } finally {
            setProcesando(null)
        }
    }

    const pagar = async (fila: FilaMensual, medio: Medio) => {
        if (!fila.cierre) return
        const monto = medio === 'TRANSFERENCIA' ? fila.cierre.netoRecibo : fila.cierre.efectivoCalculado
        const nombre = `${fila.empleado.nombre} ${fila.empleado.apellido || ''}`.trim()
        const cajaId = cajasPago[medio]
        if (!confirm(`¿Registrar ${dinero(monto)} por ${medio.toLowerCase()} para ${nombre} desde ${nombreCaja(cajas, cajaId)}?`)) return

        setProcesando(`${medio}-${fila.cierre.id}`)
        setMensaje(null)
        try {
            const respuesta = await fetch(`/api/empleados/cierres-mensuales/${fila.cierre.id}/pagar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ medio, cajaId }),
            })
            const data = await respuesta.json()
            if (!respuesta.ok) throw new Error(data.error || 'No se pudo registrar el pago.')
            setMensaje({ tipo: 'ok', texto: `Pago por ${medio.toLowerCase()} registrado para ${nombre}. El movimiento quedó vinculado al cierre de ${etiquetaPeriodo(periodo)}.` })
            await cargar()
        } catch (error) {
            setMensaje({ tipo: 'error', texto: error instanceof Error ? error.message : 'No se pudo registrar el pago.' })
        } finally {
            setProcesando(null)
        }
    }

    const terminado = periodoTerminado(periodo)

    return <div className="modal-overlay" onMouseDown={onClose}>
        <div className={`modal ${styles.modal}`} onMouseDown={evento => evento.stopPropagation()}>
            <header className={styles.header}>
                <div>
                    <span className={styles.eyebrow}>Liquidación diferenciada</span>
                    <h2>Cierres mensuales mixtos</h2>
                    <p>Separá el recibo transferido del excedente en efectivo, sin mezclarlo con las liquidaciones semanales.</p>
                </div>
                <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Cerrar">✕</button>
            </header>

            <div className={styles.toolbar}>
                <label>
                    <span>Período calendario</span>
                    <input type="month" value={periodo} onChange={evento => setPeriodo(evento.target.value)} />
                </label>
                <div className={`${styles.periodStatus} ${terminado ? styles.ready : styles.preview}`}>
                    <strong>{terminado ? 'Mes listo para cerrar' : 'Mes en curso · sólo vista previa'}</strong>
                    <span>{terminado ? 'Los importes pueden congelarse.' : 'Podrás cerrarlo desde el primer día del mes siguiente.'}</span>
                </div>
            </div>

            <main className={styles.body} ref={bodyRef}>
                {mensaje && <div className={`${styles.message} ${mensaje.tipo === 'ok' ? styles.success : styles.error}`}>{mensaje.texto}</div>}

                <section className={styles.summary}>
                    <div><span>Total real del período</span><strong>{dinero(resumen.total)}</strong></div>
                    <div><span>Recibos / transferencia</span><strong>{dinero(resumen.transferencia)}</strong></div>
                    <div><span>Diferencia en efectivo</span><strong>{dinero(resumen.efectivo)}</strong></div>
                    <div><span>Cierres completados</span><strong>{resumen.pagados} / {filas.length}</strong></div>
                </section>

                {cargando ? <div className={styles.empty}>Calculando el período completo…</div> : filas.length === 0 ? <div className={styles.empty}>
                    <strong>No hay empleados con modalidad mensual mixta.</strong>
                    <span>Podés habilitarla desde la ficha del empleado, en la sección salarial.</span>
                </div> : <div className={styles.list}>
                    {filas.map(fila => {
                        const cierre = fila.cierre
                        const netoTexto = netosRecibo[fila.empleado.id]
                        const neto = netoTexto?.trim() ? Number(netoTexto) : Number.NaN
                        const idsConciliados = liquidacionesConciliadas[fila.empleado.id] || []
                        const totalConciliado = Math.round(fila.referenciasSemanales.liquidaciones
                            .filter(liquidacion => idsConciliados.includes(liquidacion.id))
                            .reduce((total, liquidacion) => total + Number(montosConciliados[fila.empleado.id]?.[liquidacion.id] ?? Math.min(liquidacion.montoPagado, liquidacion.montoDevengadoPeriodo)), 0) * 100) / 100
                        const diferencia = Number.isFinite(neto) ? fila.totalCalculado - neto - totalConciliado : null
                        const pagoTransferencia = cierre?.pagos.find(pago => pago.medio === 'TRANSFERENCIA' && pago.estado !== 'ANULADO')
                        const pagoEfectivo = cierre?.pagos.find(pago => pago.medio === 'EFECTIVO' && pago.estado !== 'ANULADO')
                        return <article className={styles.employeeCard} key={fila.empleado.id}>
                            <div className={styles.employeeHeader}>
                                <div className={styles.avatar}>{fila.empleado.nombre[0]}{fila.empleado.apellido?.[0] || ''}</div>
                                <div className={styles.employeeIdentity}>
                                    <h3>{fila.empleado.nombre} {fila.empleado.apellido || ''}</h3>
                                    <span>{fila.empleado.dni ? `DNI ${fila.empleado.dni}` : 'DNI sin informar'} · {fila.rango.desde.split('-').reverse().join('/')} al {fila.rango.hasta.split('-').reverse().join('/')}</span>
                                </div>
                                <span className={`${styles.badge} ${cierre ? styles[cierre.estado.toLowerCase()] : styles.sinCerrar}`}>
                                    {cierre ? cierre.estado.replace('_', ' ') : 'Sin cerrar'}
                                </span>
                            </div>

                            {fila.referenciasSemanales.cantidad > 0 && !cierre && <div className={styles.reconciliation}>
                                <div className={styles.reconciliationHeader}>
                                    <div>
                                        <strong>Conciliación del historial semanal</strong>
                                        <span>El total mensual incorpora estas liquidaciones como antecedentes. Marcá únicamente los importes que la empleada ya recibió.</span>
                                    </div>
                                    <span>{dinero(fila.referenciasSemanales.total)} pagados</span>
                                </div>
                                <div className={styles.reconciliationList}>
                                    {fila.referenciasSemanales.liquidaciones.map(liquidacion => {
                                        const seleccionada = idsConciliados.includes(liquidacion.id)
                                        const maximoAplicable = Math.min(liquidacion.montoPagado, liquidacion.montoDevengadoPeriodo)
                                        return <div key={liquidacion.id} className={seleccionada ? styles.reconciliationSelected : ''}>
                                            <label className={styles.reconciliationRow}>
                                                <input type="checkbox" checked={seleccionada} disabled={maximoAplicable <= 0} onChange={evento => {
                                                    setConciliacionesRevisadas(actual => ({ ...actual, [fila.empleado.id]: false }))
                                                    setLiquidacionesConciliadas(actual => {
                                                        const actuales = actual[fila.empleado.id] || []
                                                        const siguientes = evento.target.checked
                                                            ? [...actuales, liquidacion.id]
                                                            : actuales.filter(id => id !== liquidacion.id)
                                                        return { ...actual, [fila.empleado.id]: siguientes }
                                                    })
                                                    if (evento.target.checked) setMontosConciliados(actual => ({
                                                        ...actual,
                                                        [fila.empleado.id]: {
                                                            ...actual[fila.empleado.id],
                                                            [liquidacion.id]: actual[fila.empleado.id]?.[liquidacion.id] ?? String(maximoAplicable),
                                                        },
                                                    }))
                                                }} />
                                                <span>
                                                    <strong>{liquidacion.periodo}</strong>
                                                    <small>{liquidacion.cruzaPeriodo ? `Corresponden ${dinero(liquidacion.montoDevengadoPeriodo)} a este mes · ` : ''}{liquidacion.montoPagado > 0 ? 'Con egreso real en Caja' : 'Sin egreso registrado en Caja'}</small>
                                                </span>
                                                <b>{liquidacion.montoPagado > 0 ? dinero(liquidacion.montoPagado) : 'No abonado'}</b>
                                            </label>
                                            {seleccionada && <label className={styles.reconciliationAmount}>
                                                <span>Monto a aplicar a {etiquetaPeriodo(periodo)}</span>
                                                <div><span>$</span><input type="number" min="0" max={maximoAplicable} step="0.01" value={montosConciliados[fila.empleado.id]?.[liquidacion.id] ?? String(maximoAplicable)} onChange={evento => {
                                                    setConciliacionesRevisadas(actual => ({ ...actual, [fila.empleado.id]: false }))
                                                    setMontosConciliados(actual => ({
                                                        ...actual,
                                                        [fila.empleado.id]: { ...actual[fila.empleado.id], [liquidacion.id]: evento.target.value },
                                                    }))
                                                }} /></div>
                                            </label>}
                                        </div>
                                    })}
                                </div>
                                <div className={styles.reconciliationTotal}>
                                    <label className={conciliacionesRevisadas[fila.empleado.id] ? styles.reconciliationReady : styles.reconciliationPending}>
                                        <input type="checkbox" checked={conciliacionesRevisadas[fila.empleado.id] || false} onChange={evento => setConciliacionesRevisadas(actual => ({ ...actual, [fila.empleado.id]: evento.target.checked }))} />
                                        <span>Revisé todos los pagos y sus importes aplicados al mes.</span>
                                    </label>
                                    <div><span>Total aplicado</span><strong>{dinero(totalConciliado)}</strong></div>
                                </div>
                            </div>}

                            {!cierre ? <div className={styles.closeGrid}>
                                <div className={styles.realTotal}>
                                    <span>Total mensual consolidado</span>
                                    <strong>{dinero(fila.totalCalculado)}</strong>
                                    <small>
                                        {fila.consolidado && fila.referenciasSemanales.cantidad > 0
                                            ? `${dinero(fila.consolidado.historicoSemanal)} del historial semanal y ${dinero(fila.consolidado.seguimientoNoCubierto)} de días posteriores no cubiertos.`
                                            : 'Fichadas, extras, feriados, licencias y descuentos del 1 al último día.'}
                                        {(fila.resumen?.diasSeguimientoGuardados || 0) > 0 && ` ${fila.resumen?.diasSeguimientoGuardados} días usan seguimientos guardados.`}
                                    </small>
                                </div>
                                <label className={styles.amountInput}>
                                    <span>Neto del recibo oficial</span>
                                    <div><span>$</span><input type="number" min="0" step="0.01" placeholder="600000" value={netosRecibo[fila.empleado.id] || ''} onChange={evento => setNetosRecibo(actual => ({ ...actual, [fila.empleado.id]: evento.target.value }))} /></div>
                                    <small>Es el importe que se transferirá.</small>
                                </label>
                                <div className={styles.cashResult}>
                                    <span>Efectivo restante</span>
                                    <strong className={diferencia !== null && diferencia < 0 ? styles.negativeAmount : ''}>{diferencia === null ? '—' : dinero(diferencia)}</strong>
                                    <small>{diferencia !== null && diferencia < 0
                                        ? 'El recibo y lo conciliado superan el sueldo calculado. Reducí el importe aplicado o revisá los datos.'
                                        : 'Devengado menos recibo y pagos semanales conciliados.'}</small>
                                </div>
                                <button className="btn btn-primary" disabled={!terminado || procesando !== null} onClick={() => void cerrar(fila)}>
                                    {procesando === `cerrar-${fila.empleado.id}` ? 'Cerrando…' : 'Cerrar período'}
                                </button>
                            </div> : <div className={styles.paymentGrid}>
                                {cierre.totalConciliado > 0 && <div className={styles.reconciledSummary}>
                                    <span>Ya abonado y conciliado desde liquidaciones semanales</span>
                                    <strong>{dinero(cierre.totalConciliado)}</strong>
                                </div>}
                                <PaymentBlock medio="TRANSFERENCIA" titulo="Transferencia del recibo" monto={cierre.netoRecibo} pago={pagoTransferencia} cajas={cajas} cajaId={cajasPago.TRANSFERENCIA} onCaja={valor => setCajasPago(actual => ({ ...actual, TRANSFERENCIA: valor }))} onPagar={() => void pagar(fila, 'TRANSFERENCIA')} onCajaCambiada={cargar} procesando={procesando === `TRANSFERENCIA-${cierre.id}`} disabled={procesando !== null || cierre.estado === 'ANULADO'} />
                                <PaymentBlock medio="EFECTIVO" titulo="Efectivo restante" monto={cierre.efectivoCalculado} pago={pagoEfectivo} cajas={cajas} cajaId={cajasPago.EFECTIVO} onCaja={valor => setCajasPago(actual => ({ ...actual, EFECTIVO: valor }))} onPagar={() => void pagar(fila, 'EFECTIVO')} onCajaCambiada={cargar} procesando={procesando === `EFECTIVO-${cierre.id}`} disabled={procesando !== null || cierre.estado === 'ANULADO'} />
                            </div>}
                        </article>
                    })}
                </div>}
            </main>

            <footer className={styles.footer}>
                <span>Cada pago genera un movimiento de caja independiente y queda atribuido a su mes original.</span>
                <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
            </footer>
        </div>
    </div>
}

function PaymentBlock({ titulo, monto, pago, cajas, cajaId, onCaja, onPagar, onCajaCambiada, procesando, disabled }: {
    medio: Medio
    titulo: string
    monto: number
    pago?: Pago
    cajas: Caja[]
    cajaId: string
    onCaja: (valor: string) => void
    onPagar: () => void
    onCajaCambiada: () => void | Promise<void>
    procesando: boolean
    disabled: boolean
}) {
    return <section className={`${styles.payment} ${pago ? styles.paymentDone : ''}`}>
        <div className={styles.paymentTitle}>
            <div><span>{titulo}</span><strong>{dinero(monto)}</strong></div>
            <span className={styles.paymentState}>{pago ? 'Pagado' : monto <= 0 ? 'Sin saldo' : 'Pendiente'}</span>
        </div>
        {pago ? <div className={styles.paymentDetail}>
            <div><span>{nombreCaja(cajas, pago.cajaOrigen)}</span><span>{new Date(pago.fechaPago).toLocaleString('es-AR')}</span></div>
            {pago.movimientoCaja && <CambiarCajaPagoButton compact movimientoId={pago.movimientoCaja.id} cajaActual={pago.movimientoCaja.cajaOrigen} onSuccess={onCajaCambiada} />}
        </div> : monto > 0 ? <div className={styles.paymentActions}>
            <select value={cajaId} onChange={evento => onCaja(evento.target.value)} disabled={disabled}>
                {cajas.map(caja => <option value={caja.id} key={caja.id}>{caja.nombre} · {dinero(caja.saldo)}</option>)}
            </select>
            <button className="btn btn-primary" onClick={onPagar} disabled={disabled}>{procesando ? 'Registrando…' : 'Registrar pago'}</button>
        </div> : <p className={styles.noBalance}>Este cierre no requiere un pago por este medio.</p>}
    </section>
}
