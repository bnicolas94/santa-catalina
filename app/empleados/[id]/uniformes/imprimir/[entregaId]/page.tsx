'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

export default function ImprimirReciboUniforme() {
    const params = useParams()
    const [entrega, setEntrega] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch(`/api/empleados/${params.id}/uniformes/entregas/${params.entregaId}`)
            .then(res => res.json())
            .then(data => {
                setEntrega(data)
                setLoading(false)
                // Auto print after render
                setTimeout(() => {
                    window.print()
                }, 500)
            })
            .catch(err => {
                console.error(err)
                setLoading(false)
            })
    }, [params.id, params.entregaId])

    if (loading) return <div style={{ padding: 20 }}>Cargando...</div>
    if (!entrega || entrega.error) return <div style={{ padding: 20 }}>Entrega no encontrada</div>

    const empleado = entrega.empleado
    const talles = empleado.talleUniforme || {}

    return (
        <div style={{
            fontFamily: 'sans-serif',
            padding: '40px',
            maxWidth: '800px',
            margin: '0 auto',
            color: '#000'
        }}>
            {/* Styles for print */}
            <style dangerouslySetInnerHTML={{__html: `
                @media print {
                    @page { margin: 15mm; }
                    body { background: white; -webkit-print-color-adjust: exact; }
                    .no-print { display: none !important; }
                }
            `}} />

            <div className="no-print" style={{ marginBottom: 20, textAlign: 'right' }}>
                <button onClick={() => window.print()} style={{ padding: '8px 16px', background: '#000', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                    Imprimir
                </button>
            </div>

            <div style={{ border: '2px solid #000', padding: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '20px', marginBottom: '20px' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '24px', textTransform: 'uppercase' }}>Fábrica de Sándwiches</h1>
                        <h2 style={{ margin: '5px 0 0 0', fontSize: '18px', color: '#555' }}>Recibo de Entrega de Uniforme</h2>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontWeight: 'bold' }}>Fecha de Entrega:</p>
                        <p style={{ margin: '5px 0 0 0' }}>{new Date(entrega.fecha).toLocaleDateString('es-AR')}</p>
                    </div>
                </div>

                <div style={{ marginBottom: '30px' }}>
                    <p><strong>Empleado:</strong> {empleado.nombre} {empleado.apellido}</p>
                    <p><strong>DNI:</strong> {empleado.dni || '-'}</p>
                    <p><strong>Puesto/Rol:</strong> {empleado.rol}</p>
                </div>

                <div style={{ marginBottom: '40px' }}>
                    <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: '5px' }}>Detalle de Prendas Entregadas</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                        <thead>
                            <tr>
                                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Prenda</th>
                                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>Talle</th>
                                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>Cantidad</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entrega.remera > 0 && (
                                <tr>
                                    <td style={{ border: '1px solid #000', padding: '8px' }}>Remera</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{talles.remera || '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{entrega.remera}</td>
                                </tr>
                            )}
                            {entrega.buzo > 0 && (
                                <tr>
                                    <td style={{ border: '1px solid #000', padding: '8px' }}>Buzo</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{talles.buzo || '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{entrega.buzo}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {entrega.observaciones && (
                    <div style={{ marginBottom: '30px' }}>
                        <p><strong>Observaciones:</strong> {entrega.observaciones}</p>
                    </div>
                )}

                <div style={{ marginTop: '60px', marginBottom: '20px' }}>
                    <p style={{ textAlign: 'justify', fontSize: '14px', lineHeight: '1.5' }}>
                        Por la presente acuso recibo de las prendas arriba detalladas, las cuales son provistas por la empresa para uso exclusivo durante la jornada laboral. Me comprometo a cuidarlas y mantenerlas en buen estado.
                    </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '80px', padding: '0 40px' }}>
                    <div style={{ textAlign: 'center', width: '200px' }}>
                        <div style={{ borderBottom: '1px solid #000', height: '40px' }}></div>
                        <p style={{ marginTop: '10px' }}>Firma Empleado</p>
                    </div>
                    <div style={{ textAlign: 'center', width: '200px' }}>
                        <div style={{ borderBottom: '1px solid #000', height: '40px' }}></div>
                        <p style={{ marginTop: '10px' }}>Aclaración</p>
                    </div>
                </div>
            </div>
            
            <div style={{ marginTop: '20px', textAlign: 'center', color: '#666', fontSize: '12px' }} className="no-print">
                <p>Este comprobante es generado automáticamente por el sistema de RRHH.</p>
            </div>
        </div>
    )
}
