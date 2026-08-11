'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from 'react'
import { calculateJqPresentationSplit } from '@/lib/produccion/presentationConversion'
import styles from './operator-production.module.css'

type Notice = { type: 'success' | 'error'; text: string } | null

interface Props {
    userName: string
    userLocationId?: string
    date: string
    onDateChange: (date: string) => void
    data: any
    onRefresh: () => void | Promise<unknown>
}

interface ProductionOption {
    key: string; productId: string; presentationId: string; name: string; code: string
    presentationSize: number; packagesPerRound: number
    inputsPerPackage: { id: string; name: string; unit: string; quantity: number }[]
}

const PRODUCTION_OPTIONS = [
    { code: 'JQ', size: 48 },
    { code: 'ESP', size: 48 },
    { code: 'CLA', size: 48 },
]
const PACKAGES_PER_ROUND = 7
const REJECTION_REASONS = ['Rotura', 'Mal sellado', 'Calidad', 'Producto dañado', 'Otro']

function localDate(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDate(value: string) {
    const [year, month, day] = value.split('-')
    return `${day}/${month}/${year}`
}

export function OperatorProductionView({ userName, userLocationId, date, onDateChange, data, onRefresh }: Props) {
    const lots = data?.lotes || []
    const locations = data?.ubicaciones || []
    const coordinators = data?.coordinadores || []
    const [selected, setSelected] = useState<ProductionOption | null>(null)
    const [rounds, setRounds] = useState(1)
    const [closing, setClosing] = useState<any>(null)
    const [produced, setProduced] = useState('')
    const [rejected, setRejected] = useState('0')
    const [reason, setReason] = useState('')
    const [busy, setBusy] = useState(false)
    const [notice, setNotice] = useState<Notice>(null)

    const productionOptions = useMemo<ProductionOption[]>(() => {
        const availableProducts = data?.productos || []
        return PRODUCTION_OPTIONS.map(option => {
            const product = availableProducts.find((item: any) => item.codigoInterno === option.code)
            const presentation = product?.presentaciones?.find((item: any) => item.cantidad === option.size)
            if (!product || !presentation) return null
            return {
                key: `${product.id}-${presentation.id}`,
                productId: product.id,
                presentationId: presentation.id,
                name: product.nombre,
                code: product.codigoInterno,
                presentationSize: presentation.cantidad,
                packagesPerRound: PACKAGES_PER_ROUND,
                inputsPerPackage: (product.fichasTecnicas || []).map((recipe: any) => ({
                    id: recipe.insumoId,
                    name: recipe.insumo?.nombre || 'Insumo',
                    unit: recipe.insumo?.unidadMedida || recipe.unidadMedida,
                    quantity: recipe.cantidadPorUnidad * presentation.cantidad / (1 - Math.min(Math.max(Number(recipe.merma) || 0, 0), 99.99) / 100),
                })),
            }
        }).filter(Boolean) as ProductionOption[]
    }, [data?.productos])

    const dateLots = lots.filter((lot: any) => lot.fechaProduccion?.split('T')[0] === date)
    const activeLots = dateLots.filter((lot: any) => lot.estado === 'en_produccion')
    const historyLots = dateLots.filter((lot: any) => lot.estado !== 'en_produccion')

    useEffect(() => {
        document.body.classList.add('operator-production-mode')
        return () => document.body.classList.remove('operator-production-mode')
    }, [])

    function changeDay(offset: number) {
        const next = new Date(`${date}T12:00:00`)
        next.setDate(next.getDate() + offset)
        onDateChange(localDate(next))
    }

    function openStart(item: ProductionOption) {
        setSelected(item); setRounds(1); setNotice(null)
    }

    async function startProduction() {
        if (!selected || busy) return
        setBusy(true); setNotice(null)
        try {
            const location = locations.find((item: any) => item.id === userLocationId) || locations.find((item: any) => item.tipo === 'FABRICA') || locations[0]
            const response = await fetch('/api/lotes', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productoId: selected.productId, presentacionId: selected.presentationId,
                    fechaProduccion: date, unidadesProducidas: rounds * selected.packagesPerRound, empleadosRonda: 1,
                    coordinadorId: coordinators[0]?.id || '', estado: 'en_produccion', ubicacionId: location?.id || '' }),
            })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload.error || 'No se pudo iniciar la producción')
            const text = `${selected.name}: producción iniciada (${rounds} ronda${rounds === 1 ? '' : 's'}).`
            setSelected(null); setNotice({ type: 'success', text }); await onRefresh()
        } catch (error) {
            setNotice({ type: 'error', text: error instanceof Error ? error.message : 'No se pudo iniciar la producción' })
        } finally { setBusy(false) }
    }

    function openClose(lot: any) {
        setClosing(lot); setProduced(String(lot.unidadesProducidas || '')); setRejected(String(lot.unidadesRechazadas || 0))
        setReason(lot.motivoRechazo || ''); setNotice(null)
    }

    async function finishProduction(distributionOverride?: { presentacionId: string; cantidad: number }[]) {
        if (!closing || busy) return
        setBusy(true)
        try {
            const response = await fetch(`/api/lotes/${closing.id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ unidadesProducidas: produced, unidadesRechazadas: rejected,
                    motivoRechazo: Number(rejected) > 0 ? reason : '', empleadosRonda: closing.empleadosRonda || 1,
                    fechaProduccion: closing.fechaProduccion?.split('T')[0] || date,
                    coordinadorId: closing.coordinador?.id || '', ubicacionId: closing.ubicacion?.id || '',
                    estado: 'en_camara', horaFin: new Date().toISOString(),
                    distribucionPresentaciones: distributionOverride || (Array.isArray(closing.distribucion) ? closing.distribucion : undefined) }),
            })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload.error || 'No se pudo finalizar el lote')
            const text = `${closing.producto.nombre}: lote finalizado correctamente.`
            setClosing(null); setNotice({ type: 'success', text }); await onRefresh()
        } catch (error) {
            setNotice({ type: 'error', text: error instanceof Error ? error.message : 'No se pudo finalizar el lote' })
        } finally { setBusy(false) }
    }

    return <main className={styles.shell}>
        <header className={styles.header}>
            <div><span className={styles.eyebrow}>Vista operativa</span><h1>Producción</h1></div>
            <div className={styles.operator}>Hola, <strong>{userName.split(' ')[0]}</strong><small>● Actualizado</small></div>
        </header>
        {notice && <div className={`${styles.notice} ${styles[notice.type]}`} role="status">{notice.text}</div>}
        <section className={styles.toolbar} aria-label="Fecha de producción">
            <button onClick={() => changeDay(-1)} aria-label="Día anterior">←</button>
            <label><span>Fecha de producción</span><input type="date" value={date} onChange={event => onDateChange(event.target.value)} /></label>
            <button onClick={() => changeDay(1)} aria-label="Día siguiente">→</button>
        </section>
        <section className={styles.section}>
            <div className={styles.sectionTitle}><div><span className={styles.eyebrow}>Producción · {formatDate(date)}</span><h2>Elegí qué producir</h2></div></div>
            <div className={styles.productGrid}>{productionOptions.map(item => <ProductCard key={item.key} item={item} onStart={openStart} />)}{!productionOptions.length && <div className={styles.empty}>No hay productos habilitados para producción.</div>}</div>
        </section>
        {activeLots.length > 0 && <section className={styles.section}>
            <div className={styles.sectionTitle}><div><span className={styles.eyebrow}>Ahora</span><h2>Lotes en producción</h2></div></div>
            <div className={styles.activeGrid}>{activeLots.map((lot: any) => <article className={styles.activeLot} key={lot.id}>
                <div><span>● En producción</span><h3>{lot.producto.nombre}</h3><p>{lot.unidadesProducidas} paquetes · {lot.ubicacion?.nombre || 'Sin ubicación'}</p></div>
                <button onClick={() => openClose(lot)}>Finalizar lote</button>
            </article>)}</div>
        </section>}
        <ProductionHistory lots={historyLots} />
        {selected && <StartModal item={selected} rounds={rounds} setRounds={setRounds} busy={busy} onClose={() => setSelected(null)} onStart={startProduction} />}
        {closing && <FinishModal lot={closing} produced={produced} setProduced={setProduced} rejected={rejected} setRejected={setRejected} reason={reason} setReason={setReason} busy={busy} onClose={() => setClosing(null)} onFinish={finishProduction} />}
    </main>
}

function ProductCard({ item, onStart }: { item: ProductionOption; onStart: (item: ProductionOption) => void }) {
    return <article className={styles.card}>
        <div className={styles.cardTop}><div className={styles.icon}>{item.code.slice(0,2)}</div><div><span>{item.code}</span><h3>{item.name}</h3><small>Presentación x{item.presentationSize}</small></div></div>
        <div className={styles.optionSummary}><span>Paquetes por ronda</span><strong>{item.packagesPerRound}</strong></div>
        <button className={styles.primary} onClick={() => onStart(item)}>Seleccionar para producir</button>
    </article>
}

function StartModal({ item, rounds, setRounds, busy, onClose, onStart }: any) {
    return <div className={styles.overlay} onMouseDown={onClose}><section className={styles.modal} onMouseDown={event => event.stopPropagation()} role="dialog" aria-modal="true">
        <header><div><span className={styles.eyebrow}>Nuevo lote</span><h2>Iniciar producción</h2><p>{item.name} · x{item.presentationSize}</p></div><button onClick={onClose}>×</button></header>
        <div className={styles.rounds}><span>Rondas de 7 paquetes</span><div><button onClick={() => setRounds(Math.max(1, rounds - 1))}>−</button><strong>{rounds}<small>rondas</small></strong><button onClick={() => setRounds(rounds + 1)}>+</button></div></div>
        <div className={styles.quick}><button onClick={() => setRounds(rounds + 1)}>+1 ronda (7)</button><button onClick={() => setRounds(rounds + 2)}>+2 rondas (14)</button></div>
        <div className={styles.estimate}><span>Total estimado</span><strong>{rounds * item.packagesPerRound} paquetes</strong></div>
        <div style={{ padding: '12px', borderRadius: 10, background: 'var(--color-gray-50)', marginTop: 10 }}>
            <strong style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>Insumos que se descontarán al iniciar</strong>
            {item.inputsPerPackage.length === 0
                ? <small style={{ color: 'var(--color-danger)' }}>Este producto no tiene ficha técnica.</small>
                : item.inputsPerPackage.map((input: any) => <div key={input.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, padding: '3px 0' }}>
                    <span>{input.name}</span><strong>{(input.quantity * rounds * item.packagesPerRound).toLocaleString('es-AR', { maximumFractionDigits: 3 })} {input.unit}</strong>
                </div>)}
        </div>
        <footer><button onClick={onClose}>Cancelar</button><button className={styles.primary} onClick={onStart} disabled={busy}>{busy ? 'Iniciando…' : '▷ Iniciar producción'}</button></footer>
    </section></div>
}

function FinishModal({ lot, produced, setProduced, rejected, setRejected, reason, setReason, busy, onClose, onFinish }: any) {
    type NumericField = 'produced' | 'rejected' | 'jq48' | 'jq24'
    const initialPresentationId = Array.isArray(lot.distribucion) ? lot.distribucion[0]?.presentacionId : undefined
    const presentation48 = lot.producto.presentaciones?.find((item: any) => item.cantidad === 48)
    const presentation24 = lot.producto.presentaciones?.find((item: any) => item.cantidad === 24)
    const isJq48Lot = lot.producto.codigoInterno === 'JQ' && initialPresentationId === presentation48?.id && Boolean(presentation24)
    const [activeField, setActiveField] = useState<NumericField>('produced')
    const [split48, setSplit48] = useState(String(Math.max((lot.unidadesProducidas || 0) - (lot.unidadesRechazadas || 0), 0)))
    const [split24, setSplit24] = useState('0')
    const [editedFields, setEditedFields] = useState<Record<NumericField, boolean>>({ produced: false, rejected: false, jq48: false, jq24: false })
    const currentValue = activeField === 'produced' ? produced : activeField === 'rejected' ? rejected : activeField === 'jq48' ? split48 : split24
    const updateValue = (value: string) => {
        if (activeField === 'produced') {
            setProduced(value)
            if (isJq48Lot && !editedFields.jq48 && !editedFields.jq24) {
                setSplit48(String(Math.max(Number(value || 0) - Number(rejected || 0), 0)))
            }
        }
        else if (activeField === 'rejected') {
            setRejected(value || '0')
            if (isJq48Lot && !editedFields.jq48 && !editedFields.jq24) {
                setSplit48(String(Math.max(Number(produced || 0) - Number(value || 0), 0)))
            }
        }
        else if (activeField === 'jq48') setSplit48(value || '0')
        else setSplit24(value || '0')
    }
    const markAsEdited = () => setEditedFields(current => ({ ...current, [activeField]: true }))
    const appendDigit = (digit: number) => {
        if (!editedFields[activeField]) {
            updateValue(String(digit))
            markAsEdited()
            return
        }
        const base = currentValue === '0' ? '' : currentValue
        updateValue(`${base}${digit}`.replace(/^0+(?=\d)/, '').slice(0, 5))
    }
    const removeDigit = () => { updateValue(currentValue.slice(0, -1)); markAsEdited() }
    const clearValue = () => { updateValue(''); markAsEdited() }
    const totalProduced = Number(produced || 0)
    const rejectedPackages = Number(rejected || 0)
    const validTotals = Number.isInteger(totalProduced) && Number.isInteger(rejectedPackages)
        && totalProduced > 0 && rejectedPackages >= 0 && rejectedPackages <= totalProduced
    const goodPackages = validTotals ? totalProduced - rejectedPackages : Math.max(totalProduced - rejectedPackages, 0)
    const split = calculateJqPresentationSplit(Number(split48), Number(split24))
    const expectedBasePackages = goodPackages
    const splitDifference = expectedBasePackages - split.basePackages
    const validSplit = !isJq48Lot || splitDifference === 0
    const activeFieldLabel = activeField === 'produced' ? 'paquetes producidos' : activeField === 'rejected' ? 'paquetes rechazados' : activeField === 'jq48' ? 'paquetes destinados a x48' : 'paquetes destinados a x24'
    const distribution = isJq48Lot
        ? [
            { presentacionId: presentation48.id, cantidad: split.outputX48 },
            { presentacionId: presentation24.id, cantidad: split.outputX24 },
        ]
        : initialPresentationId
            ? [{ presentacionId: initialPresentationId, cantidad: goodPackages }]
            : undefined

    return <div className={styles.overlay} onMouseDown={onClose}><section className={`${styles.modal} ${styles.finish}`} onMouseDown={event => event.stopPropagation()} role="dialog" aria-modal="true">
        <header><div><span className={styles.eyebrow}>Lote en curso</span><h2>Finalizar lote</h2><p>{lot.producto.nombre}</p></div><button onClick={onClose}>×</button></header>
        <div className={styles.fields}>
            <button type="button" className={`${styles.numberField} ${activeField === 'produced' ? styles.numberFieldActive : ''}`} onClick={() => setActiveField('produced')}>
                <span>1 · Total elaborado</span><strong>{produced || '—'}</strong><small>Buenos + rechazados · Estimado: {lot.unidadesProducidas}</small>
            </button>
            <button type="button" className={`${styles.numberField} ${activeField === 'rejected' ? styles.numberFieldActive : ''}`} onClick={() => setActiveField('rejected')}>
                <span>2 · Rechazados / merma</span><strong>{rejected || '0'}</strong><small>Paquetes que NO ingresan a cámara</small>
            </button>
        </div>
        <div className={styles.estimate}>
            <span>Resultado del lote</span>
            <strong>{validTotals ? `${goodPackages} a cámara · ${rejectedPackages} de merma` : 'Revisá las cantidades'}</strong>
        </div>
        {rejectedPackages > totalProduced && <div className={styles.splitBalanceError}>Los rechazados no pueden superar el total producido.</div>}
        {isJq48Lot && <section className={styles.splitPanel}>
            <div className={styles.splitHeader}><div><span>3 · Presentación de los paquetes buenos</span><strong>Distribuí solamente los {goodPackages} paquetes que ingresan a cámara</strong></div><small>Convertir a x24 no registra una merma. Los rechazados se cargan en el paso 2.</small></div>
            <div className={styles.splitGrid}>
                <button type="button" className={`${styles.numberField} ${activeField === 'jq48' ? styles.numberFieldActive : ''}`} onClick={() => setActiveField('jq48')}>
                    <span>Buenos que quedan x48</span><strong>{split48 || '0'}</strong><small>Ingresan {split.outputX48} paquetes x48 a cámara</small>
                </button>
                <button type="button" className={`${styles.numberField} ${activeField === 'jq24' ? styles.numberFieldActive : ''}`} onClick={() => setActiveField('jq24')}>
                    <span>Buenos a convertir en x24</span><strong>{split24 || '0'}</strong><small>No son rechazados · Ingresan {split.outputX24} paquetes x24</small>
                </button>
            </div>
            <div className={`${styles.splitBalance} ${validSplit ? '' : styles.splitBalanceError}`}>
                {validSplit
                    ? `Distribución completa · Stock final: ${split.outputX48} x48 + ${split.outputX24} x24`
                    : splitDifference > 0
                        ? `Falta asignar ${splitDifference} paquete${splitDifference === 1 ? '' : 's'} base`
                        : `Hay ${Math.abs(splitDifference)} paquete${Math.abs(splitDifference) === 1 ? '' : 's'} base de más`}
            </div>
        </section>}
        <div className={styles.numberPad} aria-label={`Teclado para ${activeFieldLabel}`}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(number => <button type="button" key={number} onClick={() => appendDigit(number)}>{number}</button>)}
            <button type="button" className={styles.clearKey} onClick={clearValue}>C</button>
            <button type="button" onClick={() => appendDigit(0)}>0</button>
            <button type="button" className={styles.deleteKey} onClick={removeDigit} aria-label="Borrar último número">⌫</button>
        </div>
        {Number(rejected) > 0 && <div className={styles.reason}><span>Motivo del rechazo</span><div className={styles.reasonOptions}>{REJECTION_REASONS.map(option => <button type="button" key={option} className={reason === option ? styles.reasonSelected : ''} onClick={() => setReason(option)}>{option}</button>)}</div></div>}
        <footer><button onClick={onClose}>Cancelar</button><button className={styles.primary} onClick={() => onFinish(distribution)} disabled={busy || !validTotals || !validSplit || (Number(rejected) > 0 && !reason)}>{busy ? 'Finalizando…' : `✓ Finalizar: ${goodPackages} a cámara · ${rejectedPackages} merma`}</button></footer>
    </section></div>
}

function ProductionHistory({ lots }: { lots: any[] }) {
    const stateLabels: Record<string, string> = { en_camara: 'En cámara', distribuido: 'Distribuido', merma: 'Merma', vencido: 'Vencido', cancelado: 'Anulado' }
    const presentationSize = (lot: any) => {
        const distribution = Array.isArray(lot.distribucion) ? lot.distribucion[0] : null
        const presentationId = distribution?.presentacionId || lot.movimientosProducto?.[0]?.presentacionId
        return lot.producto?.presentaciones?.find((item: any) => item.id === presentationId)?.cantidad
    }

    return <section className={`${styles.section} ${styles.history}`}>
        <div className={styles.sectionTitle}><div><span className={styles.eyebrow}>Solo lectura</span><h2>Historial producido del día</h2></div><span>{lots.length} lote{lots.length === 1 ? '' : 's'}</span></div>
        {lots.length === 0 ? <div className={styles.empty}>Todavía no hay lotes finalizados para esta fecha.</div> : <div className={styles.historyList}>
            {lots.map(lot => <article key={lot.id} className={styles.historyItem}>
                <div><span className={styles.historyCode}>{lot.producto?.codigoInterno}{presentationSize(lot) ? ` x${presentationSize(lot)}` : ''}</span><h3>{lot.producto?.nombre}</h3><small>{lot.id}</small></div>
                <div className={styles.historyMetrics}><span><strong>{lot.unidadesProducidas}</strong> producidos</span><span><strong>{lot.unidadesRechazadas || 0}</strong> rechazados</span><span className={styles.readonlyState}>{stateLabels[lot.estado] || lot.estado}</span></div>
            </article>)}
        </div>}
    </section>
}
