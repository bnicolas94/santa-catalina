'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from 'react'
import styles from './operator-production.module.css'

type Destination = 'TODOS' | 'FABRICA' | 'LOCAL'
type Notice = { type: 'success' | 'error'; text: string } | null

interface Props {
    userName: string
    userLocationId?: string
    date: string
    onDateChange: (date: string) => void
    data: any
    onRefresh: () => void | Promise<unknown>
}

interface PlannedItem {
    key: string; productId: string; presentationId: string; name: string; code: string
    presentationSize: number; requested: number; stock: number; inProduction: number
    missing: number; rounds: number; packagesPerRound: number; destination: string
}

const SHIFTS = ['Mañana', 'Siesta', 'Tarde']
const rounded = (value: number) => Math.round(value * 10) / 10

function localDate(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDate(value: string) {
    const [year, month, day] = value.split('-')
    return `${day}/${month}/${year}`
}

export function OperatorProductionView({ userName, userLocationId, date, onDateChange, data, onRefresh }: Props) {
    const planning = data?.planning
    const lots = data?.lotes || []
    const locations = data?.ubicaciones || []
    const coordinators = data?.coordinadores || []
    const [shift, setShift] = useState('Mañana')
    const [destination, setDestination] = useState<Destination>('TODOS')
    const [selected, setSelected] = useState<PlannedItem | null>(null)
    const [rounds, setRounds] = useState(1)
    const [closing, setClosing] = useState<any>(null)
    const [produced, setProduced] = useState(0)
    const [rejected, setRejected] = useState(0)
    const [reason, setReason] = useState('')
    const [busy, setBusy] = useState(false)
    const [notice, setNotice] = useState<Notice>(null)

    const shifts = useMemo(() => {
        const available = Object.keys(planning?.necesidades || {})
        const ordered = SHIFTS.filter(value => available.includes(value))
        return ordered.length ? ordered : SHIFTS
    }, [planning])

    const items = useMemo<PlannedItem[]>(() => {
        if (!planning) return []
        const needs = planning.necesidades?.[shift] || {}
        const routes = planning.demandaRutas?.[shift] || {}
        const manual = planning.manualesDetalle?.[shift] || {}
        const keys = Array.from(new Set([...Object.keys(needs), ...Object.keys(routes)]))

        return keys.map(key => {
            const info = planning.infoProductos?.[key]
            if (!info || ['ELE', 'PRE'].includes(info.codigoInterno)) return null
            const route = routes[key] || { fabrica: 0, local: 0 }
            const manualDetail = manual[key] || { fabrica: 0, local: 0 }
            const routeUnits = destination === 'TODOS' ? route.fabrica + route.local : destination === 'LOCAL' ? route.local : route.fabrica
            const manualUnits = destination === 'TODOS' ? manualDetail.fabrica + manualDetail.local : destination === 'LOCAL' ? manualDetail.local : manualDetail.fabrica
            const requestedUnits = Math.max(routeUnits, manualUnits)
            if (requestedUnits <= 0) return null
            const presentationSize = info.presentacion?.cantidad || 48
            const factoryStock = planning.stockFabricacion?.[key] || 0
            const localStock = planning.stockLocal?.[key] || 0
            const stockUnits = destination === 'FABRICA' ? factoryStock : destination === 'LOCAL' ? localStock : factoryStock + localStock
            const processUnits = planning.enProduccion?.[key]?.total || 0
            const missingUnits = Math.max(0, requestedUnits - stockUnits - processUnits)
            const packagesPerRound = info.paquetesPorRonda || 14
            return {
                key, productId: info.id, presentationId: info.presentacion?.id || '', name: info.nombre,
                code: info.codigoInterno, presentationSize, packagesPerRound,
                requested: rounded(requestedUnits / presentationSize), stock: rounded(stockUnits / presentationSize),
                inProduction: rounded(processUnits / presentationSize), missing: rounded(missingUnits / presentationSize),
                rounds: Math.ceil(missingUnits / (packagesPerRound * presentationSize)),
                destination: destination === 'TODOS' ? 'Fábrica y Local' : destination === 'FABRICA' ? 'Fábrica' : 'Local',
            }
        }).filter(Boolean).sort((a, b) => b!.missing - a!.missing) as PlannedItem[]
    }, [planning, shift, destination])

    const dateLots = lots.filter((lot: any) => lot.fechaProduccion?.split('T')[0] === date)
    const activeLots = dateLots.filter((lot: any) => lot.estado === 'en_produccion')
    const finishedLots = dateLots.filter((lot: any) => lot.estado !== 'en_produccion')
    const pending = items.filter(item => item.missing > 0)

    function changeDay(offset: number) {
        const next = new Date(`${date}T12:00:00`)
        next.setDate(next.getDate() + offset)
        onDateChange(localDate(next))
    }

    function openStart(item: PlannedItem) {
        setSelected(item); setRounds(Math.max(1, item.rounds)); setNotice(null)
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
        setClosing(lot); setProduced(lot.unidadesProducidas || 0); setRejected(lot.unidadesRechazadas || 0)
        setReason(lot.motivoRechazo || ''); setNotice(null)
    }

    async function finishProduction() {
        if (!closing || busy) return
        setBusy(true)
        try {
            const response = await fetch(`/api/lotes/${closing.id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ unidadesProducidas: produced, unidadesRechazadas: rejected,
                    motivoRechazo: rejected > 0 ? reason : '', empleadosRonda: closing.empleadosRonda || 1,
                    fechaProduccion: closing.fechaProduccion?.split('T')[0] || date,
                    coordinadorId: closing.coordinador?.id || '', ubicacionId: closing.ubicacion?.id || '',
                    estado: 'en_camara', horaFin: new Date().toISOString() }),
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
        <section className={styles.stats} aria-label="Resumen del día">
            <article><span>Pendientes</span><strong>{pending.length}</strong><small>productos por cubrir</small></article>
            <article className={styles.green}><span>En producción</span><strong>{activeLots.length}</strong><small>lotes activos</small></article>
            <article><span>Terminados</span><strong>{finishedLots.length}</strong><small>lotes del día</small></article>
            <article className={pending.some(item => item.stock === 0) ? styles.alert : ''}><span>Atención</span><strong>{pending.filter(item => item.stock === 0).length}</strong><small>sin stock disponible</small></article>
        </section>
        {activeLots.length > 0 && <section className={styles.section}>
            <div className={styles.sectionTitle}><div><span className={styles.eyebrow}>Ahora</span><h2>Lotes en producción</h2></div></div>
            <div className={styles.activeGrid}>{activeLots.map((lot: any) => <article className={styles.activeLot} key={lot.id}>
                <div><span>● En producción</span><h3>{lot.producto.nombre}</h3><p>{lot.unidadesProducidas} paquetes · {lot.ubicacion?.nombre || 'Sin ubicación'}</p></div>
                <button onClick={() => openClose(lot)}>Finalizar lote</button>
            </article>)}</div>
        </section>}
        <section className={styles.section}>
            <div className={styles.sectionTitle}><div><span className={styles.eyebrow}>Planificación · {formatDate(date)}</span><h2>¿Qué producimos?</h2></div><span>{items.length} productos</span></div>
            <div className={styles.filters}>
                <div>{shifts.map(value => <button key={value} className={shift === value ? styles.selected : ''} onClick={() => setShift(value)}>{value}</button>)}</div>
                <div>{(['TODOS','FABRICA','LOCAL'] as Destination[]).map(value => <button key={value} className={destination === value ? styles.selected : ''} onClick={() => setDestination(value)}>{value === 'TODOS' ? 'Todos' : value === 'FABRICA' ? 'Fábrica' : 'Local'}</button>)}</div>
            </div>
            <div className={styles.productGrid}>{items.map(item => <ProductCard key={item.key} item={item} onStart={openStart} />)}{!items.length && <div className={styles.empty}>No hay requerimientos para este turno y destino.</div>}</div>
        </section>
        {selected && <StartModal item={selected} rounds={rounds} setRounds={setRounds} busy={busy} onClose={() => setSelected(null)} onStart={startProduction} />}
        {closing && <FinishModal lot={closing} produced={produced} setProduced={setProduced} rejected={rejected} setRejected={setRejected} reason={reason} setReason={setReason} busy={busy} onClose={() => setClosing(null)} onFinish={finishProduction} />}
    </main>
}

function ProductCard({ item, onStart }: { item: PlannedItem; onStart: (item: PlannedItem) => void }) {
    const covered = item.missing <= 0
    return <article className={`${styles.card} ${covered ? styles.covered : ''}`}>
        <div className={styles.cardTop}><div className={styles.icon}>{item.code.slice(0,2)}</div><div><span>{item.code} · x{item.presentationSize}</span><h3>{item.name}</h3><small>{item.destination}</small></div><strong>{covered ? '✓' : `−${item.missing}`}</strong></div>
        <dl><div><dt>Solicitado</dt><dd>{item.requested} paq</dd></div><div><dt>Stock</dt><dd>{item.stock} paq</dd></div><div><dt>En proceso</dt><dd>{item.inProduction} paq</dd></div></dl>
        {covered ? <div className={styles.coveredLabel}>✓ Necesidad cubierta</div> : <button className={styles.primary} onClick={() => onStart(item)}>▷ Producir {item.rounds} ronda{item.rounds === 1 ? '' : 's'}</button>}
    </article>
}

function StartModal({ item, rounds, setRounds, busy, onClose, onStart }: any) {
    return <div className={styles.overlay} onMouseDown={onClose}><section className={styles.modal} onMouseDown={event => event.stopPropagation()} role="dialog" aria-modal="true">
        <header><div><span className={styles.eyebrow}>Nuevo lote</span><h2>Iniciar producción</h2><p>{item.name} · x{item.presentationSize}</p></div><button onClick={onClose}>×</button></header>
        <div className={styles.rounds}><span>Rondas de producción</span><div><button onClick={() => setRounds(Math.max(1, rounds - 1))}>−</button><strong>{rounds}<small>rondas</small></strong><button onClick={() => setRounds(rounds + 1)}>+</button></div></div>
        <div className={styles.quick}><button onClick={() => setRounds(rounds + 1)}>+1 ronda</button><button onClick={() => setRounds(rounds + 5)}>+5 rondas</button><button onClick={() => setRounds(Math.max(1,item.rounds))}>Recomendado: {item.rounds}</button></div>
        <div className={styles.estimate}><span>Total estimado</span><strong>{rounds * item.packagesPerRound} paquetes</strong></div>
        <footer><button onClick={onClose}>Cancelar</button><button className={styles.primary} onClick={onStart} disabled={busy}>{busy ? 'Iniciando…' : '▷ Iniciar producción'}</button></footer>
    </section></div>
}

function FinishModal({ lot, produced, setProduced, rejected, setRejected, reason, setReason, busy, onClose, onFinish }: any) {
    return <div className={styles.overlay} onMouseDown={onClose}><section className={`${styles.modal} ${styles.finish}`} onMouseDown={event => event.stopPropagation()} role="dialog" aria-modal="true">
        <header><div><span className={styles.eyebrow}>Lote en curso</span><h2>Finalizar lote</h2><p>{lot.producto.nombre}</p></div><button onClick={onClose}>×</button></header>
        <div className={styles.fields}><label><span>Paquetes producidos</span><input type="number" min="0" value={produced} onChange={event => setProduced(Math.max(0,Number(event.target.value)))} /></label><label><span>Paquetes rechazados / merma</span><input type="number" min="0" value={rejected} onChange={event => setRejected(Math.max(0,Number(event.target.value)))} /></label></div>
        {rejected > 0 && <label className={styles.reason}><span>Motivo del rechazo</span><input value={reason} onChange={event => setReason(event.target.value)} placeholder="Ej.: rotura, mal sellado…" /></label>}
        <footer><button onClick={onClose}>Cancelar</button><button className={styles.primary} onClick={onFinish} disabled={busy || (rejected > 0 && !reason.trim())}>{busy ? 'Finalizando…' : '✓ Confirmar y finalizar'}</button></footer>
    </section></div>
}
