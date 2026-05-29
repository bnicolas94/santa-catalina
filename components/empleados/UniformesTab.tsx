'use client'

import { useState, useEffect } from 'react'

interface UniformesTabProps {
    empleadoId: string
}

export function UniformesTab({ empleadoId }: UniformesTabProps) {
    const [talles, setTalles] = useState({ remera: '', buzo: '' })
    const [entregas, setEntregas] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [savingTalles, setSavingTalles] = useState(false)
    const [showModal, setShowModal] = useState(false)

    // Form for new entrega
    const [newEntrega, setNewEntrega] = useState({
        remera: 0,
        buzo: 0,
        observaciones: '',
        fecha: new Date().toISOString().split('T')[0]
    })
    const [savingEntrega, setSavingEntrega] = useState(false)

    useEffect(() => {
        fetchData()
    }, [empleadoId])

    const fetchData = async () => {
        setLoading(true)
        try {
            const [resTalles, resEntregas] = await Promise.all([
                fetch(`/api/empleados/${empleadoId}/uniformes/talles`),
                fetch(`/api/empleados/${empleadoId}/uniformes/entregas`)
            ])
            const dataTalles = await resTalles.json()
            const dataEntregas = await resEntregas.json()
            
            if (dataTalles && !dataTalles.error) {
                setTalles({
                    remera: dataTalles.remera || '',
                    buzo: dataTalles.buzo || ''
                })
            }
            if (Array.isArray(dataEntregas)) {
                setEntregas(dataEntregas)
            }
        } catch (error) {
            console.error('Error fetching uniformes data:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSaveTalles = async () => {
        setSavingTalles(true)
        try {
            const res = await fetch(`/api/empleados/${empleadoId}/uniformes/talles`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(talles)
            })
            if (!res.ok) throw new Error('Error al guardar talles')
            alert('Talles guardados correctamente')
        } catch (error) {
            console.error(error)
            alert('Error al guardar talles')
        } finally {
            setSavingTalles(false)
        }
    }

    const handleCreateEntrega = async (e: React.FormEvent) => {
        e.preventDefault()
        if (newEntrega.remera === 0 && newEntrega.buzo === 0) {
            alert('Debes ingresar al menos una cantidad')
            return
        }

        setSavingEntrega(true)
        try {
            const res = await fetch(`/api/empleados/${empleadoId}/uniformes/entregas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newEntrega)
            })
            
            if (!res.ok) throw new Error('Error al registrar entrega')
            
            // Refetch
            await fetchData()
            setShowModal(false)
            setNewEntrega({
                remera: 0,
                buzo: 0,
                observaciones: '',
                fecha: new Date().toISOString().split('T')[0]
            })
        } catch (error) {
            console.error(error)
            alert('Error al registrar la entrega')
        } finally {
            setSavingEntrega(false)
        }
    }

    const handleImprimir = (entregaId: string) => {
        window.open(`/empleados/${empleadoId}/uniformes/imprimir/${entregaId}`, '_blank')
    }

    if (loading) {
        return <div className="p-4 text-center">Cargando datos de uniformes...</div>
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            
            {/* Talles */}
            <div className="card">
                <div className="card-body">
                    <h3 style={{ margin: '0 0 var(--space-4) 0', fontSize: 'var(--text-lg)' }}>Talles del Empleado</h3>
                    <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div className="form-control">
                            <label className="label">Talle Remera</label>
                            <input 
                                type="text" 
                                className="input" 
                                value={talles.remera} 
                                onChange={(e) => setTalles({...talles, remera: e.target.value})}
                                placeholder="Ej: M, L, XL..."
                            />
                        </div>
                        <div className="form-control">
                            <label className="label">Talle Buzo</label>
                            <input 
                                type="text" 
                                className="input" 
                                value={talles.buzo} 
                                onChange={(e) => setTalles({...talles, buzo: e.target.value})}
                                placeholder="Ej: M, L, XL..."
                            />
                        </div>
                        <button 
                            className="btn btn-primary" 
                            onClick={handleSaveTalles} 
                            disabled={savingTalles}
                        >
                            {savingTalles ? 'Guardando...' : 'Guardar Talles'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Historial de Entregas */}
            <div className="card">
                <div className="card-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                        <h3 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Historial de Entregas</h3>
                        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                            + Registrar Entrega
                        </button>
                    </div>

                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Remeras</th>
                                    <th>Buzos</th>
                                    <th>Observaciones</th>
                                    <th style={{ textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entregas.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-gray-500)' }}>
                                            No hay entregas registradas.
                                        </td>
                                    </tr>
                                ) : (
                                    entregas.map(entrega => (
                                        <tr key={entrega.id}>
                                            <td>{new Date(entrega.fecha).toLocaleDateString('es-AR')}</td>
                                            <td>{entrega.remera}</td>
                                            <td>{entrega.buzo}</td>
                                            <td>{entrega.observaciones || '-'}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button 
                                                    className="btn btn-sm btn-ghost" 
                                                    onClick={() => handleImprimir(entrega.id)}
                                                    title="Imprimir Recibo"
                                                >
                                                    🖨️ Imprimir
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal Nueva Entrega */}
            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div className="card" style={{ width: '100%', maxWidth: '500px', backgroundColor: 'var(--color-bg)' }}>
                        <div className="card-body">
                            <h3 style={{ marginTop: 0 }}>Registrar Entrega de Uniforme</h3>
                            <form onSubmit={handleCreateEntrega} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                                <div className="form-control">
                                    <label className="label">Fecha</label>
                                    <input 
                                        type="date" 
                                        className="input" 
                                        value={newEntrega.fecha}
                                        onChange={(e) => setNewEntrega({...newEntrega, fecha: e.target.value})}
                                        required
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-control">
                                        <label className="label">Cantidad Remeras</label>
                                        <input 
                                            type="number" 
                                            className="input" 
                                            min="0"
                                            value={newEntrega.remera}
                                            onChange={(e) => setNewEntrega({...newEntrega, remera: parseInt(e.target.value) || 0})}
                                        />
                                    </div>
                                    <div className="form-control">
                                        <label className="label">Cantidad Buzos</label>
                                        <input 
                                            type="number" 
                                            className="input" 
                                            min="0"
                                            value={newEntrega.buzo}
                                            onChange={(e) => setNewEntrega({...newEntrega, buzo: parseInt(e.target.value) || 0})}
                                        />
                                    </div>
                                </div>
                                <div className="form-control">
                                    <label className="label">Observaciones (Opcional)</label>
                                    <input 
                                        type="text" 
                                        className="input" 
                                        value={newEntrega.observaciones}
                                        onChange={(e) => setNewEntrega({...newEntrega, observaciones: e.target.value})}
                                    />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
                                    <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                                        Cancelar
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={savingEntrega}>
                                        {savingEntrega ? 'Guardando...' : 'Guardar Entrega'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
