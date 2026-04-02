'use client'

import { useState } from 'react'

interface Category {
    id: string
    nombre: string
    esOperativo: boolean
}

interface ReportSettingsModalProps {
    isOpen: boolean
    onClose: () => void
    userPrefs: any
    onUpdatePrefs: (newPrefs: any) => void
    isAdmin: boolean
    categories: Category[]
    onUpdateCategory: (id: string, esOperativo: boolean) => void
    globalConfig: {
        sanguchitosPorPlancha: number
        planchasPorPaqueteDefault: number
    }
    onUpdateGlobalConfig: (clave: string, valor: any) => void
}

export default function ReportSettingsModal({
    isOpen,
    onClose,
    userPrefs,
    onUpdatePrefs,
    isAdmin,
    categories,
    onUpdateCategory,
    globalConfig,
    onUpdateGlobalConfig
}: ReportSettingsModalProps) {
    const [activeTab, setActiveTab] = useState<'personal' | 'categories' | 'global'>(isAdmin ? 'personal' : 'personal')

    if (!isOpen) return null

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%', backgroundColor: 'var(--color-white)' }}>
                <div className="modal-header">
                    <h2>Configuración de Reportes (BI)</h2>
                    <button className="btn-close" onClick={onClose}>&times;</button>
                </div>

                <div className="tabs" style={{ marginBottom: 'var(--space-6)', borderBottom: '1px solid var(--color-gray-200)' }}>
                    <button 
                        className={`tab-btn ${activeTab === 'personal' ? 'active' : ''}`}
                        onClick={() => setActiveTab('personal')}
                    >
                        Mis Preferencias
                    </button>
                    {isAdmin && (
                        <>
                            <button 
                                className={`tab-btn ${activeTab === 'categories' ? 'active' : ''}`}
                                onClick={() => setActiveTab('categories')}
                            >
                                Gasto Operativo
                            </button>
                            <button 
                                className={`tab-btn ${activeTab === 'global' ? 'active' : ''}`}
                                onClick={() => setActiveTab('global')}
                            >
                                Coeficientes
                            </button>
                        </>
                    )}
                </div>

                <div className="modal-body">
                    {activeTab === 'personal' && (
                        <div className="fade-in">
                            <p style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-gray-500)' }}>
                                Selecciona qué indicadores quieres ver en tu dashboard. Estos cambios se guardan en tu perfil.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={userPrefs.showIngresos} 
                                        onChange={e => onUpdatePrefs({ ...userPrefs, showIngresos: e.target.checked })}
                                    />
                                    Ingresos Brutos
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={userPrefs.showGastos} 
                                        onChange={e => onUpdatePrefs({ ...userPrefs, showGastos: e.target.checked })}
                                    />
                                    Gastos Operativos
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={userPrefs.showMargen} 
                                        onChange={e => onUpdatePrefs({ ...userPrefs, showMargen: e.target.checked })}
                                    />
                                    Margen EBITDA / Contribución
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={userPrefs.showProduccion} 
                                        onChange={e => onUpdatePrefs({ ...userPrefs, showProduccion: e.target.checked })}
                                    />
                                    Sección Reporte de Producción
                                </label>
                                {userPrefs.showProduccion && (
                                    <div style={{ marginLeft: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', borderLeft: '2px solid var(--color-gray-100)', paddingLeft: 'var(--space-4)' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={userPrefs.showProdPaquetes} 
                                                onChange={e => onUpdatePrefs({ ...userPrefs, showProdPaquetes: e.target.checked })}
                                            />
                                            Total Paquetes
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={userPrefs.showProdPlanchas} 
                                                onChange={e => onUpdatePrefs({ ...userPrefs, showProdPlanchas: e.target.checked })}
                                            />
                                            Total Planchas
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={userPrefs.showProdSanguchitos} 
                                                onChange={e => onUpdatePrefs({ ...userPrefs, showProdSanguchitos: e.target.checked })}
                                            />
                                            Total Sanguchitos
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={userPrefs.showProdRechazados} 
                                                onChange={e => onUpdatePrefs({ ...userPrefs, showProdRechazados: e.target.checked })}
                                            />
                                            Merma/Rechazos
                                        </label>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'categories' && isAdmin && (
                        <div className="fade-in">
                            <p style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-gray-500)' }}>
                                Los gastos en categorías marcadas como "Operativo" se restan de los ingresos para calcular la rentabilidad neta.
                            </p>
                            <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: 'var(--space-2)' }}>
                                {categories.map(cat => (
                                    <div key={cat.id} style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center', 
                                        padding: 'var(--space-3)', 
                                        borderBottom: '1px solid var(--color-gray-100)' 
                                    }}>
                                        <span style={{ fontWeight: 500 }}>{cat.nombre}</span>
                                        <button 
                                            className={`btn ${cat.esOperativo ? 'btn-success' : 'btn-outline'}`}
                                            style={{ padding: '4px 12px', fontSize: '12px' }}
                                            onClick={() => onUpdateCategory(cat.id, !cat.esOperativo)}
                                        >
                                            {cat.esOperativo ? 'Operativo' : 'No Operativo'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'global' && isAdmin && (
                        <div className="fade-in">
                            <p style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-gray-500)' }}>
                                Configuración de coeficientes de producción globales.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                                <div className="form-group">
                                    <label>Sándwiches por Plancha</label>
                                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                        <input 
                                            type="number" 
                                            className="form-control"
                                            defaultValue={globalConfig.sanguchitosPorPlancha}
                                            id="sanguchitosInput"
                                        />
                                        <button 
                                            className="btn btn-primary"
                                            onClick={() => {
                                                const val = (document.getElementById('sanguchitosInput') as HTMLInputElement).value
                                                onUpdateGlobalConfig('SANGUCHITOS_POR_PLANCHA', parseInt(val))
                                            }}
                                        >
                                            Guardar
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Planchas por Paquete (Default)</label>
                                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                        <input 
                                            type="number" 
                                            className="form-control"
                                            defaultValue={globalConfig.planchasPorPaqueteDefault}
                                            id="planchasInput"
                                        />
                                        <button 
                                            className="btn btn-primary"
                                            onClick={() => {
                                                const val = (document.getElementById('planchasInput') as HTMLInputElement).value
                                                onUpdateGlobalConfig('PLANCHAS_POR_PAQUETE_DEFAULT', parseInt(val))
                                            }}
                                        >
                                            Guardar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer" style={{ marginTop: 'var(--space-6)' }}>
                    <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
                </div>
            </div>

            <style jsx>{`
                .tabs { display: flex; gap: var(--space-4); }
                .tab-btn {
                    padding: var(--space-2) var(--space-4);
                    border: none;
                    background: none;
                    cursor: pointer;
                    font-size: var(--text-sm);
                    color: var(--color-gray-500);
                    border-bottom: 2px solid transparent;
                    transition: all 0.2s;
                }
                .tab-btn:hover { color: var(--color-primary); }
                .tab-btn.active {
                    color: var(--color-primary);
                    border-bottom-color: var(--color-primary);
                    font-weight: 600;
                }
            `}</style>
        </div>
    )
}
