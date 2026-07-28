'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'

import { formatCurrencyToWords } from '@/lib/utils/numberToWords'
import { getPrintLogos } from '@/lib/utils/printLogos'

interface EmpleadoPago {
    id: string
    nombre: string
    apellido?: string | null
    activo: boolean
}

interface Pendiente {
    id: string
    empleadoId: string
    empleadoNombre: string
    empleadoDni?: string | null
    empleadoActivo: boolean
    cantidadHoras: number
    montoCalculado: number
    fechaOrigen: string
    periodoOrigen: string
    observaciones?: string | null
}

interface Pagado extends Pendiente {
    liquidacionId: string
    fechaPago: string
}

interface Caja {
    id: string
    nombre: string
    saldo: number
}

interface Props {
    empleados: EmpleadoPago[]
    onClose: () => void
}

const dinero = (monto: number) => `$${Math.round(monto).toLocaleString('es-AR')}`

const escaparHtml = (valor: string) => valor
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

function lunesSemanaAnterior() {
    const hoy = new Date()
    const dia = hoy.getDay() || 7
    const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - dia + 1 - 7)
    const anio = lunes.getFullYear()
    const mes = String(lunes.getMonth() + 1).padStart(2, '0')
    const fecha = String(lunes.getDate()).padStart(2, '0')
    return `${anio}-${mes}-${fecha}`
}

async function imprimirReciboHorasAdeudadas(pendiente: Pendiente, fechaPago: string) {
    const { logo, watermark } = await getPrintLogos()
    const fecha = new Date(fechaPago)
    const fechaTexto = fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
    const montoLetras = escaparHtml(formatCurrencyToWords(pendiente.montoCalculado))
    const nombre = escaparHtml(pendiente.empleadoNombre)
    const dni = escaparHtml(pendiente.empleadoDni || 'Sin informar')
    const semana = escaparHtml(pendiente.periodoOrigen)
    const horas = pendiente.cantidadHoras.toLocaleString('es-AR')
    const valorHora = dinero(pendiente.montoCalculado / pendiente.cantidadHoras)
    const observaciones = pendiente.observaciones ? escaparHtml(pendiente.observaciones) : 'Sin observaciones'

    const marco = document.createElement('iframe')
    marco.setAttribute('aria-hidden', 'true')
    marco.style.position = 'fixed'
    marco.style.right = '0'
    marco.style.bottom = '0'
    marco.style.width = '1px'
    marco.style.height = '1px'
    marco.style.border = '0'
    marco.style.opacity = '0'
    document.body.appendChild(marco)
    const documento = marco.contentDocument
    if (!documento) {
        marco.remove()
        throw new Error('No se pudo preparar el recibo para imprimir.')
    }

    documento.write(`
        <!doctype html>
        <html lang="es">
        <head>
            <title>Recibo de horas extras adeudadas - ${nombre}</title>
            <style>
                @page { size: A4; margin: 18mm; }
                * { box-sizing: border-box; }
                body { margin: 0; color: #111827; font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.5; }
                .receipt { position: relative; min-height: 245mm; padding: 34px; border: 1px solid #d1d5db; overflow: hidden; }
                .watermark { position: absolute; width: 70%; max-width: 480px; top: 52%; left: 50%; transform: translate(-50%, -50%); opacity: .08; z-index: 0; }
                .content { position: relative; z-index: 1; }
                .header { display: flex; justify-content: space-between; gap: 24px; padding-bottom: 24px; border-bottom: 2px solid #dc1f35; }
                .logo { height: 58px; width: auto; }
                .header-copy { text-align: right; }
                .eyebrow { color: #dc1f35; font-size: 10pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
                h1 { margin: 4px 0; font-size: 19pt; text-transform: uppercase; }
                .date { color: #4b5563; font-size: 10pt; }
                .employee { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 26px 0; padding: 18px; background: #f9fafb; border-radius: 8px; }
                .label { display: block; color: #6b7280; font-size: 9pt; font-weight: 700; text-transform: uppercase; }
                .value { font-weight: 700; }
                table { width: 100%; border-collapse: collapse; margin: 22px 0; }
                th, td { padding: 12px; border: 1px solid #d1d5db; text-align: left; }
                th { background: #f3f4f6; color: #374151; font-size: 9pt; text-transform: uppercase; }
                .amount { text-align: right; font-weight: 700; }
                .total { display: flex; justify-content: space-between; gap: 24px; margin-top: 18px; padding: 18px 20px; color: white; background: #dc1f35; border-radius: 8px; }
                .total strong { font-size: 18pt; }
                .words { margin-top: 12px; color: #4b5563; font-size: 10pt; }
                .note { margin-top: 26px; padding: 14px 16px; border-left: 4px solid #dc1f35; background: #fff7f8; font-size: 10pt; }
                .signature { display: flex; justify-content: flex-end; margin-top: 75px; }
                .signature-line { width: 280px; padding-top: 8px; border-top: 1px solid #111827; text-align: center; }
                @media print { * { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
            </style>
        </head>
        <body>
            <main class="receipt">
                <img class="watermark" src="${watermark}" alt="" />
                <div class="content">
                    <header class="header">
                        <img class="logo" src="${logo}" alt="Santa Catalina" />
                        <div class="header-copy"><div class="eyebrow">Comprobante de pago</div><h1>Horas extras adeudadas</h1><div class="date">Emitido el ${fechaTexto}</div></div>
                    </header>
                    <section class="employee"><div><span class="label">Empleado</span><span class="value">${nombre}</span></div><div><span class="label">DNI</span><span class="value">${dni}</span></div></section>
                    <p>Se deja constancia del pago correspondiente exclusivamente a horas extras omitidas de una liquidación anterior.</p>
                    <table><thead><tr><th>Semana de origen</th><th>Horas</th><th>Valor por hora</th><th class="amount">Importe</th></tr></thead><tbody><tr><td>${semana}</td><td>${horas} h</td><td>${valorHora}</td><td class="amount">${dinero(pendiente.montoCalculado)}</td></tr></tbody></table>
                    <div class="total"><span>Total abonado</span><strong>${dinero(pendiente.montoCalculado)}</strong></div>
                    <div class="words">Son pesos: ${montoLetras}.</div>
                    <div class="note"><strong>Detalle:</strong> ${observaciones}<br />Este pago es independiente de la liquidación salarial de la semana en curso y se atribuye a la semana indicada.</div>
                    <div class="signature"><div class="signature-line">Firma y aclaración del empleado</div></div>
                </div>
            </main>
            <script>
                window.onload = () => {
                    const images = Array.from(document.images);
                    Promise.all(images.map(image => image.complete ? Promise.resolve() : new Promise(resolve => { image.onload = resolve; image.onerror = resolve; }))).then(() => {
                        window.focus();
                        window.print();
                    });
                };
                window.addEventListener('afterprint', () => window.frameElement?.remove(), { once: true });
            </script>
        </body>
        </html>
    `)
    documento.close()
    window.setTimeout(() => marco.remove(), 120000)
}

export function HorasExtrasAdeudadasModal({ empleados, onClose }: Props) {
    const { data: session } = useSession()
    const esAdmin = (session?.user as { rol?: string } | undefined)?.rol === 'ADMIN'
    const activos = useMemo(() => empleados.filter(empleado => empleado.activo), [empleados])
    const [empleadoId, setEmpleadoId] = useState('')
    const [fechaOrigen, setFechaOrigen] = useState(lunesSemanaAnterior)
    const [cantidadHoras, setCantidadHoras] = useState('')
    const [observaciones, setObservaciones] = useState('')
    const [pendientes, setPendientes] = useState<Pendiente[]>([])
    const [pagados, setPagados] = useState<Pagado[]>([])
    const [valoresHora, setValoresHora] = useState<Record<string, number>>({})
    const [cajas, setCajas] = useState<Caja[]>([])
    const [cajaId, setCajaId] = useState('caja_madre')
    const [cargando, setCargando] = useState(true)
    const [guardando, setGuardando] = useState(false)
    const [pagandoId, setPagandoId] = useState<string | null>(null)
    const [anulandoId, setAnulandoId] = useState<string | null>(null)
    const [filtroEstado, setFiltroEstado] = useState<'todos' | 'pendiente' | 'pagado'>('todos')
    const [filtroEmpleado, setFiltroEmpleado] = useState('')
    const [filtroSemana, setFiltroSemana] = useState('')
    const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

    const cargar = useCallback(async () => {
        setCargando(true)
        try {
            const [respuestaDeudas, respuestaCajas] = await Promise.all([
                fetch('/api/empleados/horas-extras-pendientes'),
                fetch('/api/caja/saldos'),
            ])
            const deudas = await respuestaDeudas.json()
            const saldos = await respuestaCajas.json()
            if (!respuestaDeudas.ok) throw new Error(deudas.error || 'No se pudieron cargar las deudas.')
            if (!respuestaCajas.ok) throw new Error(saldos.error || 'No se pudieron cargar las cajas.')

            setPendientes(deudas.pendientes || [])
            setPagados(deudas.pagados || [])
            setValoresHora(deudas.valoresHora || {})
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
    }, [])

    useEffect(() => { void cargar() }, [cargar])

    const horas = Number(cantidadHoras)
    const valorHora = valoresHora[empleadoId] || 0
    const importeEstimado = Number.isFinite(horas) && horas > 0 ? Math.round(horas * valorHora) : 0
    const totalPendiente = pendientes.reduce((total, pendiente) => total + pendiente.montoCalculado, 0)
    const totalPagado = pagados.reduce((total, pago) => total + pago.montoCalculado, 0)
    const semanasDisponibles = useMemo(() => {
        const semanas = new Map<string, string>()
        ;[...pendientes, ...pagados].forEach(registro => semanas.set(registro.fechaOrigen, registro.periodoOrigen))
        return [...semanas.entries()].sort(([fechaA], [fechaB]) => fechaB.localeCompare(fechaA))
    }, [pendientes, pagados])
    const registrosFiltrados = useMemo(() => {
        const registros = [
            ...pendientes.map(registro => ({ ...registro, estado: 'pendiente' as const, fechaPago: null })),
            ...pagados.map(registro => ({ ...registro, estado: 'pagado' as const })),
        ]
        return registros.filter(registro => {
            if (filtroEstado !== 'todos' && registro.estado !== filtroEstado) return false
            if (filtroEmpleado && registro.empleadoId !== filtroEmpleado) return false
            if (filtroSemana && registro.fechaOrigen !== filtroSemana) return false
            return true
        })
    }, [pendientes, pagados, filtroEstado, filtroEmpleado, filtroSemana])

    const registrar = async () => {
        setMensaje(null)
        setGuardando(true)
        try {
            const respuesta = await fetch('/api/empleados/horas-extras-pendientes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ empleadoId, fechaOrigen, cantidadHoras: horas, observaciones }),
            })
            const data = await respuesta.json()
            if (!respuesta.ok) throw new Error(data.error || 'No se pudo registrar la deuda.')
            setCantidadHoras('')
            setObservaciones('')
            setMensaje({ tipo: 'ok', texto: 'Las horas quedaron registradas con su semana original. Ya podés pagarlas.' })
            await cargar()
        } catch (error) {
            setMensaje({ tipo: 'error', texto: error instanceof Error ? error.message : 'No se pudo registrar la deuda.' })
        } finally {
            setGuardando(false)
        }
    }

    const pagar = async (pendiente: Pendiente, imprimir = false) => {
        const accion = imprimir ? 'registrar e imprimir' : 'registrar'
        if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} el pago de ${dinero(pendiente.montoCalculado)} a ${pendiente.empleadoNombre}?`)) return
        setMensaje(null)
        setPagandoId(pendiente.id)
        try {
            const respuesta = await fetch('/api/empleados/horas-extras-pendientes/pagar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: pendiente.id, cajaId }),
            })
            const data = await respuesta.json()
            if (!respuesta.ok) throw new Error(data.error || 'No se pudo registrar el pago.')

            let impresionCorrecta = false
            if (imprimir) {
                try {
                    await imprimirReciboHorasAdeudadas(pendiente, data.fechaGeneracion)
                    impresionCorrecta = true
                } catch (error) {
                    console.error('Error generando recibo de horas adeudadas:', error)
                }
            }

            const detalleImpresion = imprimir
                ? impresionCorrecta
                    ? ' Se abrió el recibo específico para imprimir.'
                    : ' El pago quedó guardado, pero el navegador no pudo abrir la impresión; podés reimprimirlo desde Reportes → Recibos.'
                : ''
            setMensaje({ tipo: 'ok', texto: `Pago registrado para ${pendiente.empleadoNombre}. No se incorporó a la semana actual.${detalleImpresion}` })
            await cargar()
        } catch (error) {
            setMensaje({ tipo: 'error', texto: error instanceof Error ? error.message : 'No se pudo registrar el pago.' })
        } finally {
            setPagandoId(null)
        }
    }

    const eliminar = async (pendiente: Pendiente) => {
        if (!confirm(`¿Eliminar la deuda sin pagar de ${pendiente.empleadoNombre}?`)) return
        const respuesta = await fetch(`/api/empleados/horas-extras-pendientes?id=${encodeURIComponent(pendiente.id)}`, { method: 'DELETE' })
        const data = await respuesta.json()
        if (!respuesta.ok) {
            setMensaje({ tipo: 'error', texto: data.error || 'No se pudo eliminar la deuda.' })
            return
        }
        await cargar()
    }

    const reimprimir = async (pago: Pagado) => {
        setMensaje(null)
        try {
            await imprimirReciboHorasAdeudadas(pago, pago.fechaPago)
        } catch (error) {
            setMensaje({ tipo: 'error', texto: error instanceof Error ? error.message : 'No se pudo preparar el recibo.' })
        }
    }

    const anularPago = async (pago: Pagado) => {
        const motivo = window.prompt('Indicá el motivo de la anulación (entre 10 y 500 caracteres):', '')
        if (motivo === null) return
        if (motivo.trim().length < 10 || motivo.trim().length > 500) {
            setMensaje({ tipo: 'error', texto: 'El motivo de anulación debe tener entre 10 y 500 caracteres.' })
            return
        }
        if (!confirm(`¿Anular el pago de ${dinero(pago.montoCalculado)} a ${pago.empleadoNombre}? El importe volverá a la caja y las horas quedarán nuevamente pendientes.`)) return
        setMensaje(null)
        setAnulandoId(pago.id)
        try {
            const respuesta = await fetch('/api/empleados/horas-extras-pendientes/anular', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: pago.id, motivo: motivo.trim() }),
            })
            const data = await respuesta.json()
            if (!respuesta.ok) throw new Error(data.error || 'No se pudo anular el pago.')
            setMensaje({ tipo: 'ok', texto: `Pago anulado. ${pago.cantidadHoras.toLocaleString('es-AR')} horas de ${pago.empleadoNombre} volvieron a pendientes y el importe fue reintegrado a la caja.` })
            await cargar()
        } catch (error) {
            setMensaje({ tipo: 'error', texto: error instanceof Error ? error.message : 'No se pudo anular el pago.' })
        } finally {
            setAnulandoId(null)
        }
    }

    return <div className="modal-overlay overtime-overlay" onMouseDown={onClose}>
        <div className="modal overtime-modal" onMouseDown={evento => evento.stopPropagation()}>
            <div className="modal-header" style={{ alignItems: 'flex-start' }}>
                <div>
                    <div style={{ color: 'var(--color-primary)', fontSize: 'var(--text-xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>Pago extraordinario</div>
                    <h2 style={{ margin: '4px 0' }}>Horas extras adeudadas</h2>
                    <p style={{ margin: 0, color: 'var(--color-gray-500)', fontSize: 'var(--text-sm)' }}>Pagá horas omitidas de una semana anterior sin alterar la liquidación en curso.</p>
                </div>
                <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Cerrar">✕</button>
            </div>

            <div className="modal-body overtime-body">
                {mensaje && <div style={{ marginBottom: 'var(--space-4)', padding: '12px 14px', borderRadius: 'var(--radius-md)', background: mensaje.tipo === 'ok' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)', color: mensaje.tipo === 'ok' ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600 }}>{mensaje.texto}</div>}

                <div className="overtime-layout">
                    <section className="card" style={{ border: '1px solid var(--color-gray-200)' }}>
                        <div className="card-body">
                            <h3 style={{ marginTop: 0 }}>1. Registrar horas omitidas</h3>
                            <div className="overtime-form-grid">
                                <label className="form-group" style={{ gridColumn: '1 / -1' }}><span className="form-label">Empleado</span>
                                    <select className="form-select" value={empleadoId} onChange={evento => setEmpleadoId(evento.target.value)}>
                                        <option value="">Seleccionar empleado…</option>
                                        {activos.map(empleado => <option key={empleado.id} value={empleado.id}>{empleado.nombre} {empleado.apellido || ''}</option>)}
                                    </select>
                                </label>
                                <label className="form-group"><span className="form-label">Fecha de la semana adeudada</span><input className="form-input" type="date" value={fechaOrigen} onChange={evento => setFechaOrigen(evento.target.value)} /></label>
                                <label className="form-group"><span className="form-label">Horas extras omitidas</span><input className="form-input" type="number" min="0.25" max="200" step="0.25" value={cantidadHoras} onChange={evento => setCantidadHoras(evento.target.value)} placeholder="Ej. 4,5" /></label>
                                <label className="form-group" style={{ gridColumn: '1 / -1' }}><span className="form-label">Detalle opcional</span><textarea className="form-input" rows={2} maxLength={500} value={observaciones} onChange={evento => setObservaciones(evento.target.value)} placeholder="Ej. Omitidas en la liquidación anterior" /></label>
                            </div>
                            <div className="overtime-form-total">
                                <div><div style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-xs)' }}>Importe calculado por el sistema</div><strong style={{ fontSize: 'var(--text-xl)' }}>{dinero(importeEstimado)}</strong>{valorHora > 0 && <span style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-xs)', marginLeft: 8 }}>({dinero(valorHora)}/h)</span>}</div>
                                <button className="btn btn-primary" disabled={guardando || !empleadoId || !fechaOrigen || horas <= 0 || valorHora <= 0} onClick={registrar}>{guardando ? 'Registrando…' : 'Registrar deuda'}</button>
                            </div>
                        </div>
                    </section>

                    <aside className="card" style={{ border: '1px solid var(--color-gray-200)', background: 'linear-gradient(145deg, white, var(--color-gray-50))' }}>
                        <div className="card-body">
                            <h3 style={{ marginTop: 0 }}>2. Elegir caja de pago</h3>
                            <select className="form-select" value={cajaId} onChange={evento => setCajaId(evento.target.value)}>
                                {cajas.map(caja => <option key={caja.id} value={caja.id}>{caja.nombre} · {dinero(caja.saldo)}</option>)}
                            </select>
                            <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', background: 'var(--color-primary)', color: 'white' }}>
                                <div style={{ opacity: .8, fontSize: 'var(--text-xs)', textTransform: 'uppercase', fontWeight: 700 }}>Total pendiente</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{dinero(totalPendiente)}</div>
                                <div style={{ opacity: .8, fontSize: 'var(--text-xs)' }}>{pendientes.length} deuda{pendientes.length === 1 ? '' : 's'} sin pagar</div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-3)', padding: '12px 14px', border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-md)', background: 'white' }}>
                                <div><div style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase' }}>Pagado históricamente</div><div style={{ color: 'var(--color-gray-500)', fontSize: '10px' }}>{pagados.length} comprobante{pagados.length === 1 ? '' : 's'}</div></div>
                                <strong style={{ color: 'var(--color-success)', fontSize: 'var(--text-lg)' }}>{dinero(totalPagado)}</strong>
                            </div>
                            <p style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-xs)', lineHeight: 1.5, marginBottom: 0 }}>Cada pago crea un comprobante independiente, afecta la caja elegida y queda atribuido a su semana original.</p>
                        </div>
                    </aside>
                </div>

                <section style={{ marginTop: 'var(--space-5)' }}>
                    <div className="overtime-history-header">
                        <div><h3 style={{ margin: 0 }}>Historial y pendientes</h3><span style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-sm)' }}>Consultá, pagá, reimprimí o anulá cada operación desde un único lugar.</span></div>
                        <div className="overtime-filters">
                            <select className="form-select" aria-label="Filtrar por estado" value={filtroEstado} onChange={evento => setFiltroEstado(evento.target.value as 'todos' | 'pendiente' | 'pagado')}>
                                <option value="todos">Todos los estados</option><option value="pendiente">Pendientes</option><option value="pagado">Pagados</option>
                            </select>
                            <select className="form-select" aria-label="Filtrar por empleado" value={filtroEmpleado} onChange={evento => setFiltroEmpleado(evento.target.value)}>
                                <option value="">Todos los empleados</option>{empleados.map(empleado => <option key={empleado.id} value={empleado.id}>{empleado.nombre} {empleado.apellido || ''}</option>)}
                            </select>
                            <select className="form-select" aria-label="Filtrar por semana" value={filtroSemana} onChange={evento => setFiltroSemana(evento.target.value)}>
                                <option value="">Todas las semanas</option>{semanasDisponibles.map(([fecha, etiqueta]) => <option key={fecha} value={fecha}>{etiqueta}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="table-container overtime-table">
                        <table className="table"><thead><tr><th>Estado</th><th>Empleado</th><th>Semana de origen</th><th style={{ textAlign: 'right' }}>Horas</th><th style={{ textAlign: 'right' }}>Importe</th><th>Pago</th><th style={{ textAlign: 'right' }}>Acciones</th></tr></thead>
                            <tbody>{cargando ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 28 }}>Cargando…</td></tr> : registrosFiltrados.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--color-gray-500)' }}>No hay operaciones que coincidan con los filtros.</td></tr> : registrosFiltrados.map(registro => {
                                const esPagado = registro.estado === 'pagado'
                                const pago = esPagado ? registro as Pagado : null
                                const operando = pagandoId !== null || anulandoId !== null
                                return <tr key={`${registro.estado}-${registro.id}`}>
                                    <td><span className={`badge ${esPagado ? 'badge-success' : 'badge-warning'}`}>{esPagado ? 'PAGADO' : 'PENDIENTE'}</span></td>
                                    <td><strong>{registro.empleadoNombre}</strong>{!registro.empleadoActivo && <span className="badge badge-warning" style={{ marginLeft: 6 }}>Inactivo</span>}<div style={{ color: 'var(--color-gray-500)', fontSize: '10px', marginTop: 2 }}>{registro.observaciones || 'Sin detalle'}</div></td>
                                    <td><span style={{ fontSize: 'var(--text-sm)' }}>{registro.periodoOrigen}</span></td>
                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{registro.cantidadHoras.toLocaleString('es-AR')} h</td>
                                    <td style={{ textAlign: 'right', fontWeight: 800 }}>{dinero(registro.montoCalculado)}</td>
                                    <td style={{ fontSize: 'var(--text-sm)', color: 'var(--color-gray-500)' }}>{pago ? new Date(pago.fechaPago).toLocaleDateString('es-AR') : '—'}</td>
                                    <td><div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 6 }}>{pago ? <><button className="btn btn-outline btn-sm" disabled={operando} onClick={() => void reimprimir(pago)}>Reimprimir</button>{esAdmin && <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} disabled={operando} onClick={() => void anularPago(pago)}>{anulandoId === pago.id ? 'Anulando…' : 'Anular'}</button>}</> : <><button className="btn btn-ghost btn-sm" disabled={operando} onClick={() => void eliminar(registro)}>Eliminar</button><button className="btn btn-outline btn-sm" disabled={operando || !cajaId} onClick={() => void pagar(registro)}>{pagandoId === registro.id ? 'Pagando…' : 'Sólo pagar'}</button><button className="btn btn-primary btn-sm" disabled={operando || !cajaId} onClick={() => void pagar(registro, true)}>{pagandoId === registro.id ? 'Pagando…' : 'Pagar e imprimir'}</button></>}</div></td>
                                </tr>
                            })}</tbody>
                        </table>
                    </div>
                </section>
            </div>
            <div className="modal-footer"><button className="btn btn-outline" onClick={onClose}>Cerrar</button></div>
        </div>
        <style jsx>{`
            .overtime-overlay {
                padding: 18px;
                backdrop-filter: blur(3px);
            }

            .overtime-modal {
                width: calc(100vw - 48px);
                max-width: 1080px;
                height: min(820px, calc(100vh - 36px));
                max-height: 94vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }

            .overtime-body {
                flex: 1;
                min-height: 0;
                overflow-y: auto;
                overflow-x: hidden;
                background: var(--color-gray-50);
                scrollbar-gutter: stable;
            }

            .overtime-layout {
                display: grid;
                grid-template-columns: minmax(0, 1.4fr) minmax(280px, .6fr);
                gap: var(--space-4);
                align-items: start;
            }

            .overtime-form-grid {
                display: grid;
                grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
                gap: var(--space-3);
            }

            .overtime-form-grid :global(.form-group) {
                min-width: 0;
            }

            .overtime-form-total {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: var(--space-3);
                margin-top: var(--space-4);
                padding-top: var(--space-4);
                border-top: 1px solid var(--color-gray-200);
            }

            .overtime-table {
                max-width: 100%;
                overflow-x: auto;
                background: white;
                border: 1px solid var(--color-gray-200);
                border-radius: var(--radius-lg);
            }

            .overtime-table :global(table) {
                min-width: 1050px;
            }

            .overtime-history-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
                gap: var(--space-4);
                margin-bottom: var(--space-3);
            }

            .overtime-filters {
                display: grid;
                grid-template-columns: repeat(3, minmax(150px, 1fr));
                gap: 8px;
                min-width: min(590px, 62%);
            }

            .overtime-filters :global(.form-select) {
                min-width: 0;
                font-size: var(--text-xs);
            }

            @media (max-width: 820px) {
                .overtime-overlay { padding: 8px; }
                .overtime-modal {
                    width: calc(100vw - 16px);
                    height: calc(100vh - 16px);
                    max-height: none;
                    border-radius: var(--radius-lg);
                }
                .overtime-layout { grid-template-columns: 1fr; }
                .overtime-history-header { align-items: stretch; flex-direction: column; }
                .overtime-filters { width: 100%; min-width: 0; }
            }

            @media (max-width: 560px) {
                .overtime-form-grid { grid-template-columns: 1fr; }
                .overtime-form-grid :global(.form-group) { grid-column: 1 !important; }
                .overtime-form-total {
                    align-items: stretch;
                    flex-direction: column;
                }
                .overtime-form-total :global(.btn) { width: 100%; }
                .overtime-filters { grid-template-columns: 1fr; }
            }
        `}</style>
    </div>
}
