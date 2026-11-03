'use client'

import { useState } from 'react'
import { CONSULTAS_CLIENTES, FILAS_CONTROL, PLANILLA_FILAS, REGLAS_CLIENTES, TEXTO_TIPEO_V3, metricasErrores, metricasPlanilla, metricasTipeo, type PlanillaResultado, type RespuestasV3 } from '@/lib/postulaciones/habilidades'
import styles from './page.module.css'

type Resultado = {
    respuestas?: RespuestasV3 | null
    revision: { comunicacion: number; observaciones: string } | null
    tipeoInicioAt?: string | null
    tipeoFinAt?: string | null
    tipeoTexto?: string | null
    planilla?: PlanillaResultado | null
}

export default function RevisionHabilidades({ prueba, onSave, guardando }: { prueba: Resultado; onSave: (revision: { comunicacion: number; observaciones: string }) => Promise<void>; guardando: boolean }) {
    const [comunicacion, setComunicacion] = useState<number | null>(prueba.revision?.comunicacion ?? null)
    const [observaciones, setObservaciones] = useState(prueba.revision?.observaciones || '')
    const tipeo = metricasTipeo(prueba.tipeoTexto || null, prueba.tipeoInicioAt ? new Date(prueba.tipeoInicioAt) : null, prueba.tipeoFinAt ? new Date(prueba.tipeoFinAt) : null)
    const errores = prueba.respuestas ? metricasErrores(prueba.respuestas) : null
    const planilla = metricasPlanilla(prueba.planilla || null)
    const totalesEsperados = PLANILLA_FILAS.map(fila => fila[1] * fila[2])
    const resumenEsperado = [PLANILLA_FILAS.reduce((n, fila) => n + (fila[3] === 'Confirmado' ? fila[1] * fila[2] : 0), 0), PLANILLA_FILAS.filter(fila => fila[3] === 'Pendiente').length, Math.max(...totalesEsperados)]
    const celdas = [...(prueba.planilla?.totales || []), ...(prueba.planilla?.resumen || [])]

    return <>
        <section className={styles.answer}><h3>1. Tipeo</h3>{tipeo && <p><strong>{tipeo.palabrasNetasPorMinuto} palabras netas/min</strong> · {tipeo.palabrasPorMinuto} brutas/min · {tipeo.exactitud}% de precisión · {tipeo.segundos} segundos</p>}<strong>Texto original</strong><p className={styles.pre}>{TEXTO_TIPEO_V3}</p><strong>Texto tipeado</strong><p className={styles.pre}>{prueba.tipeoTexto || 'Sin texto'}</p></section>
        <section className={styles.answer}><h3>2. Control de errores</h3>{errores && <p><strong>{errores.detectadas}/{errores.erroresReales} diferencias detectadas</strong> · {errores.falsasAlarmas} falsas alarmas · {errores.omitidas} omitidas</p>}{prueba.respuestas?.errores.length ? <ul>{prueba.respuestas.errores.map(item => <li key={item.id}><strong>{item.id}:</strong> {item.correccion}</li>)}</ul> : <p>No marcó ninguna fila.</p>}<div className={styles.tableWrap}><table><thead><tr><th>Fila</th><th>Original</th><th>Cargado</th><th>Marcada</th></tr></thead><tbody>{FILAS_CONTROL.map(fila => <tr key={fila.id}><td>{fila.id}</td><td>{Object.values(fila.original).slice(1).join(' · ')}</td><td>{Object.values(fila.cargado).slice(1).join(' · ')}</td><td>{prueba.respuestas?.errores.some(item => item.id === fila.id) ? 'Sí' : 'No'}</td></tr>)}</tbody></table></div></section>
        <section className={styles.answer}><h3>3. Planilla</h3>{planilla ? <><p><strong>{planilla.valoresCorrectos}/{planilla.celdas} valores correctos</strong> · {planilla.formulas}/{planilla.celdas} celdas con fórmula · Datos originales {planilla.origenIntacto ? 'intactos' : 'modificados'}</p><p>Archivo: {prueba.planilla?.nombreArchivo}</p><div className={styles.tableWrap}><table><thead><tr><th>Celda</th><th>Esperado</th><th>Obtenido</th><th>Fórmula</th></tr></thead><tbody>{[...totalesEsperados, ...resumenEsperado].map((esperado, i) => <tr key={i}><td>{i < 8 ? `Datos!E${i + 2}` : `Resumen!B${i - 6}`}</td><td>{esperado}</td><td>{celdas[i]?.valor ?? 'Vacía'}</td><td>{celdas[i]?.formula || 'Sin fórmula'}</td></tr>)}</tbody></table></div></> : <p>Sin planilla.</p>}</section>
        <section className={styles.answer}><h3>4. Atención escrita</h3><p>Reglas que recibió el postulante:</p><ul>{REGLAS_CLIENTES.map(regla => <li key={regla}>{regla}</li>)}</ul>{CONSULTAS_CLIENTES.map((consulta, i) => <div key={consulta}><strong>Consulta {i + 1}: {consulta}</strong><p className={styles.pre}>{prueba.respuestas?.clientes[i] || 'Sin respuesta'}</p></div>)}</section>
        <section className={styles.review}><h3>Revisión de comunicación</h3><p>Puntuá de 0 a 5 la claridad, el trato y la aplicación de las reglas. Revisá que no prometa entregas, cambios o reintegros sin verificar.</p><label>Comunicación<select value={comunicacion ?? ''} onChange={e => setComunicacion(e.target.value === '' ? null : Number(e.target.value))}><option value="">Sin puntuar</option>{[0, 1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}</select></label><label>Observaciones<textarea rows={4} maxLength={4000} value={observaciones} onChange={e => setObservaciones(e.target.value)} /></label><button className={styles.primary} disabled={guardando || comunicacion === null} onClick={() => { if (comunicacion !== null) void onSave({ comunicacion, observaciones }) }}>Guardar revisión</button></section>
    </>
}
