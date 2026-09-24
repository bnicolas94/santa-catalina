'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type Constancia = {
    empleado: { nombreCompleto: string; dni: string | null; puesto: string }
    empleador: { razonSocial: string; cuit: string } | null
    establecimiento: { direccion: string; localidad: string; codigoPostal: string; provincia: string } | null
    eppNecesarios: string
    filas: {
        entregaId: string; fecha: string; producto: string; talle: string; tipoModelo: string | null
        marca: string | null; certificado: boolean | null; cantidad: number; observaciones: string | null
    }[]
    historicasSinDetalle: number
    faltantes: string[]
}

const POR_PAGINA = 12

function fechaVisible(fecha: string) {
    const [anio, mes, dia] = fecha.split('-')
    return `${dia}/${mes}/${anio}`
}

export default function ConstanciaRopaTrabajo() {
    const { id } = useParams<{ id: string }>()
    const [datos, setDatos] = useState<Constancia | null>(null)
    const [error, setError] = useState('')

    useEffect(() => {
        const controlador = new AbortController()
        fetch(`/api/empleados/${id}/uniformes/constancia`, { signal: controlador.signal })
            .then(async respuesta => {
                const cuerpo = await respuesta.json()
                if (!respuesta.ok) throw new Error(cuerpo.error || 'No se pudo cargar la constancia.')
                setDatos(cuerpo)
            })
            .catch(fallo => { if (!controlador.signal.aborted) setError(fallo instanceof Error ? fallo.message : 'No se pudo cargar la constancia.') })
        return () => controlador.abort()
    }, [id])

    if (error) return <div role="alert" style={{ padding: 24 }}>{error}</div>
    if (!datos) return <div style={{ padding: 24 }}>Preparando constancia...</div>

    const paginas = Array.from({ length: Math.max(1, Math.ceil(datos.filas.length / POR_PAGINA)) }, (_, indice) =>
        datos.filas.slice(indice * POR_PAGINA, (indice + 1) * POR_PAGINA),
    )
    const listaFaltantes = datos.faltantes

    return <main className="constancia">
        <style>{`
            .constancia { font-family: Arial, sans-serif; color: #111; background: #f5f5f5; padding: 18px; }
            .constancia .controles { max-width: 1120px; margin: 0 auto 18px; padding: 16px; background: #fff; border: 1px solid #ccc; }
            .constancia .hoja { width: 277mm; min-height: 190mm; margin: 0 auto 18px; padding: 9mm; background: #fff; box-sizing: border-box; border: 1px solid #bbb; }
            .constancia h1 { text-align: center; font-size: 17px; margin: 0 0 5mm; }
            .constancia .referencia { text-align: right; font-size: 10px; margin-bottom: 3mm; }
            .constancia .datos { display: grid; grid-template-columns: repeat(6, 1fr); border-top: 1px solid #333; border-left: 1px solid #333; font-size: 11px; }
            .constancia .dato { border-right: 1px solid #333; border-bottom: 1px solid #333; padding: 5px; min-height: 25px; }
            .constancia .dato strong { display: block; font-size: 9px; margin-bottom: 3px; }
            .constancia .tabla { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 4mm; font-size: 10px; }
            .constancia .tabla th, .constancia .tabla td { border: 1px solid #333; padding: 4px; overflow-wrap: anywhere; }
            .constancia .tabla th { text-align: center; height: 38px; }
            .constancia .tabla td { height: 31px; }
            .constancia .informacion { border: 1px solid #333; min-height: 18mm; padding: 5px; font-size: 10px; margin-top: 4mm; }
            @media print {
                @page { size: A4 landscape; margin: 8mm; }
                body { background: #fff; }
                .constancia { padding: 0; background: #fff; }
                .constancia .controles { display: none; }
                .constancia .hoja { width: auto; min-height: 0; margin: 0; padding: 0; border: 0; break-after: page; }
                .constancia .hoja:last-child { break-after: auto; }
            }
        `}</style>
        <div className="controles">
            <h2>Constancia de entrega · Resolución SRT 299/11</h2>
            {listaFaltantes.length > 0 ? <div role="alert">
                <p>Completá estos datos antes de imprimir:</p><ul>{listaFaltantes.map(item => <li key={item}>{item}</li>)}</ul>
            </div> : <button type="button" onClick={() => window.print()}>Imprimir constancia</button>}
            {datos.historicasSinDetalle > 0 && <p>Hay {datos.historicasSinDetalle} entrega(s) anteriores sin detalle de talle y producto. Conservá sus constancias originales; no se incluyen como renglones nuevos.</p>}
        </div>
        {paginas.map((filas, pagina) => <section className="hoja" key={pagina}>
            <div className="referencia">Resolución SRT 299/11 · Anexo I · Hoja {pagina + 1} de {paginas.length}</div>
            <h1>CONSTANCIA DE ENTREGA DE ROPA DE TRABAJO Y ELEMENTOS DE PROTECCIÓN PERSONAL</h1>
            <div className="datos">
                <div className="dato" style={{ gridColumn: 'span 4' }}><strong>(1) Razón social</strong>{datos.empleador?.razonSocial || '—'}</div>
                <div className="dato" style={{ gridColumn: 'span 2' }}><strong>(2) CUIT</strong>{datos.empleador?.cuit || '—'}</div>
                <div className="dato" style={{ gridColumn: 'span 2' }}><strong>(3) Dirección del establecimiento</strong>{datos.establecimiento?.direccion || '—'}</div>
                <div className="dato"><strong>(4) Localidad</strong>{datos.establecimiento?.localidad || '—'}</div>
                <div className="dato"><strong>(5) CP</strong>{datos.establecimiento?.codigoPostal || '—'}</div>
                <div className="dato" style={{ gridColumn: 'span 2' }}><strong>(6) Provincia</strong>{datos.establecimiento?.provincia || '—'}</div>
                <div className="dato" style={{ gridColumn: 'span 4' }}><strong>(7) Nombre y apellido del trabajador</strong>{datos.empleado.nombreCompleto}</div>
                <div className="dato" style={{ gridColumn: 'span 2' }}><strong>(8) DNI</strong>{datos.empleado.dni || '—'}</div>
                <div className="dato" style={{ gridColumn: 'span 3' }}><strong>(9) Puesto de trabajo</strong>{datos.empleado.puesto}</div>
                <div className="dato" style={{ gridColumn: 'span 3' }}><strong>(10) EPP necesarios para el puesto</strong>{datos.eppNecesarios || '—'}</div>
            </div>
            <table className="tabla"><colgroup><col style={{ width: '5%' }} /><col style={{ width: '15%' }} /><col style={{ width: '20%' }} /><col style={{ width: '11%' }} /><col style={{ width: '9%' }} /><col style={{ width: '7%' }} /><col style={{ width: '10%' }} /><col style={{ width: '23%' }} /></colgroup>
                <thead><tr><th>Nº</th><th>(11) Producto</th><th>(12) Tipo / modelo / talle</th><th>(13) Marca</th><th>(14) Certificación SI / NO</th><th>(15) Cantidad</th><th>(16) Fecha de entrega</th><th>(17) Firma del trabajador</th></tr></thead>
                <tbody>{Array.from({ length: POR_PAGINA }, (_, indice) => {
                    const fila = filas[indice]
                    return <tr key={indice}><td style={{ textAlign: 'center' }}>{pagina * POR_PAGINA + indice + 1}</td><td>{fila?.producto || ''}</td><td>{fila ? `${fila.tipoModelo || ''} · Talle ${fila.talle}` : ''}</td><td>{fila?.marca || ''}</td><td style={{ textAlign: 'center' }}>{fila?.certificado === true ? 'SI' : fila?.certificado === false ? 'NO' : ''}</td><td style={{ textAlign: 'center' }}>{fila?.cantidad || ''}</td><td>{fila ? fechaVisible(fila.fecha) : ''}</td><td></td></tr>
                })}</tbody>
            </table>
            <div className="informacion"><strong>(18) Información adicional</strong>
                {filas.filter(fila => fila.observaciones).map(fila => <div key={fila.entregaId + fila.producto + fila.talle}>{fechaVisible(fila.fecha)} · {fila.producto} talle {fila.talle}: {fila.observaciones}</div>)}
            </div>
        </section>)}
    </main>
}
