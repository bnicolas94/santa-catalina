"use client";

import { useState } from "react";
import * as xlsx from "xlsx";
import { ExcelRow, PreviewRowResult } from "../../app/api/importar-pedidos/preview/route";

interface ImportarPedidosModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (message: string) => void;
}

const MAPPABLE_FIELDS = [
    { id: 'fecha', label: '📅 Fecha', required: true },
    { id: 'nombreCliente', label: '👤 Cliente', required: true },
    { id: 'pedidoTexto', label: '📦 Pedido', required: true },
    { id: 'direccion', label: '🏠 Dirección', required: true },
    { id: 'localidad', label: '📍 Localidad', required: true },
    { id: 'telefono', label: '📞 Teléfono', required: true },
    { id: 'turno', label: '⏰ Turno', required: false },
    { id: 'ignore', label: '🚫 Ignorar', required: false },
];

export default function ImportarPedidosModal({ isOpen, onClose, onSuccess }: ImportarPedidosModalProps) {
    const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
    const [importMode, setImportMode] = useState<"excel" | "paste">("excel");
    const [file, setFile] = useState<File | null>(null);
    const [pasteText, setPasteText] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const [headers, setHeaders] = useState<string[]>([]);
    const [rawRows, setRawRows] = useState<string[][]>([]);
    const [colMapping, setColMapping] = useState<Record<number, string>>({});
    
    const [previewData, setPreviewData] = useState<PreviewRowResult[] | null>(null);
    const [summary, setSummary] = useState({ verdes: 0, amarillos: 0, rojos: 0, totalRows: 0 });

    if (!isOpen) return null;

    const reset = () => {
        setStep('upload');
        setFile(null);
        setPasteText("");
        setHeaders([]);
        setRawRows([]);
        setColMapping({});
        setPreviewData(null);
        setError(null);
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    // --- LOGICA DE CARGA ---

    const handleExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (!selected) return;
        setFile(selected);
        setLoading(true);
        setError(null);

        try {
            const data = await selected.arrayBuffer();
            const workbook = xlsx.read(data);
            const sheetName = workbook.SheetNames.find(n => n.includes("2026")) || workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            
            // Leemos con header: 1 para obtener array de arrays
            const json: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" });
            if (json.length < 1) throw new Error("Archivo vacío");

            const detectedHeaders = json[0].map((h, i) => String(h || `Columna ${i + 1}`).trim());
            setHeaders(detectedHeaders);
            setRawRows(json.slice(1).map(row => row.map(cell => String(cell))));
            
            autoDetectMapping(detectedHeaders);
            setStep('mapping');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePasteChange = (text: string) => {
        setPasteText(text);
        if (!text.trim()) return;

        const lines = text.trim().split("\n");
        const parsedRows = lines.map(line => line.split("\t"));
        if (parsedRows.length < 1) return;

        const detectedHeaders = parsedRows[0].map((h, i) => h.trim() || `Columna ${i + 1}`);
        setHeaders(detectedHeaders);
        setRawRows(parsedRows.slice(1));
        
        autoDetectMapping(detectedHeaders);
        setStep('mapping');
    };

    const autoDetectMapping = (firstRow: string[]) => {
        const mapping: Record<number, string> = {};
        const keywords: Record<string, RegExp[]> = {
            fecha: [/fecha/i, /dia/i],
            nombreCliente: [/cliente/i, /nombre/i, /apellido/i, /comercial/i],
            pedidoTexto: [/pedido/i, /detalle/i, /texto/i, /concepto/i],
            direccion: [/direccion/i, /calle/i, /domicilio/i],
            localidad: [/localidad/i, /barrio/i, /ciudad/i],
            telefono: [/tel/i, /cel/i, /contacto/i, /whatsapp/i],
            turno: [/turno/i, /horario/i],
        };

        firstRow.forEach((val, idx) => {
            const cleanVal = val.toLowerCase().trim();
            for (const [field, regexes] of Object.entries(keywords)) {
                if (regexes.some(r => r.test(cleanVal))) {
                    mapping[idx] = field;
                    break;
                }
            }
        });
        setColMapping(mapping);
    };

    // --- LOGICA DE PREVIEW ---

    const handlePreview = async () => {
        const missing = MAPPABLE_FIELDS.filter(f => f.required && !Object.values(colMapping).includes(f.id));
        if (missing.length > 0) {
            setError(`Faltan mapear columnas obligatorias: ${missing.map(m => m.label).join(", ")}`);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const rows: ExcelRow[] = rawRows.map((cols, index) => {
                const getVal = (fieldId: string) => {
                    const idxStr = Object.keys(colMapping).find(k => colMapping[parseInt(k)] === fieldId);
                    if (idxStr === undefined) return "";
                    return cols[parseInt(idxStr)]?.trim() || "";
                };

                const rawFecha = getVal('fecha');
                const rawTurno = getVal('turno')?.toUpperCase() || "";
                
                // Conversión de fecha si viene de Excel (numérico)
                let finalFecha = rawFecha;
                if (/^\d{5}$/.test(rawFecha)) { 
                    const date = new Date((parseInt(rawFecha) - 25569) * 86400 * 1000);
                    finalFecha = date.toISOString().split("T")[0];
                }

                return {
                    rowId: index,
                    fecha: finalFecha || new Date().toISOString().split("T")[0],
                    nombreCliente: getVal('nombreCliente'),
                    pedidoTexto: getVal('pedidoTexto'),
                    direccion: getVal('direccion'),
                    localidad: getVal('localidad'),
                    telefono: getVal('telefono'),
                    turno: (rawTurno.includes("MA") ? "MANANA" : 
                            rawTurno.includes("SI") ? "SIESTA" : 
                            rawTurno.includes("TA") ? "TARDE" : undefined) as any,
                };
            }).filter(r => r.nombreCliente && r.pedidoTexto);

            if (rows.length === 0) throw new Error("No hay filas válidas para procesar.");

            const res = await fetch("/api/importar-pedidos/preview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rows }),
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Error en validación");

            setPreviewData(result.results);
            setSummary({ verdes: result.verdes, amarillos: result.amarillos, rojos: result.rojos, totalRows: result.totalRows });
            setStep('preview');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (!previewData) return;
        setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/importar-pedidos/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rows: previewData }),
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Error al guardar");

            onSuccess(result.message);
            handleClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal" style={{ maxWidth: '800px', width: '95vw' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>🚀 Importar Pedidos Express</h2>
                    <button className="btn btn-ghost" onClick={handleClose}>✕</button>
                </div>

                <div className="modal-body">
                    {error && (
                        <div className="toast toast-error" style={{ position: 'relative', top: 0, right: 0, marginBottom: 'var(--space-4)', width: '100%' }}>
                            {error}
                        </div>
                    )}

                    {step === 'upload' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                            {/* TABS DE MODO */}
                            <div style={{ display: 'flex', backgroundColor: 'var(--color-gray-100)', padding: '4px', borderRadius: 'var(--radius-md)', width: 'fit-content' }}>
                                <button
                                    onClick={() => setImportMode('excel')}
                                    className={`btn btn-sm ${importMode === 'excel' ? 'btn-primary' : 'btn-ghost'}`}
                                    style={{ minHeight: '36px' }}
                                >📁 Archivo Excel</button>
                                <button
                                    onClick={() => setImportMode('paste')}
                                    className={`btn btn-sm ${importMode === 'paste' ? 'btn-primary' : 'btn-ghost'}`}
                                    style={{ minHeight: '36px' }}
                                >📋 Pegar desde Excel</button>
                            </div>

                            {importMode === 'excel' ? (
                                <div className="form-group" style={{ border: '2px dashed var(--color-gray-300)', padding: 'var(--space-10)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                                    <label className="form-label" style={{ display: 'block', marginBottom: 'var(--space-4)', fontSize: 'var(--text-lg)' }}>Seleccioná el archivo .xlsx o .xls</label>
                                    <input
                                        type="file"
                                        accept=".xlsx,.xls"
                                        onChange={handleExcelFile}
                                        style={{ display: 'none' }}
                                        id="excel-upload"
                                    />
                                    <label htmlFor="excel-upload" className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                                        {loading ? 'Leyendo...' : 'Explorar Archivos'}
                                    </label>
                                </div>
                            ) : (
                                <div className="form-group">
                                    <label className="form-label">Pegá aquí las celdas de tu Excel (incluyendo encabezados)</label>
                                    <textarea
                                        className="form-textarea"
                                        style={{ minHeight: '200px', fontFamily: 'monospace', fontSize: '12px' }}
                                        placeholder={"Fecha\tCliente\tPedido\tDirección\tLocalidad\tTeléfono\n2026-04-01\tJuan Perez\t10 48jyq\tCalle Falsa 123\tVilla Elisa\t011-123456"}
                                        onChange={(e) => handlePasteChange(e.target.value)}
                                        value={pasteText}
                                    />
                                </div>
                            )}

                            <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-info-bg)', borderRadius: 'var(--radius-md)', display: 'flex', gap: 'var(--space-3)' }}>
                                <span style={{ fontSize: '1.2rem' }}>💡</span>
                                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-info)', margin: 0 }}>
                                    <strong>Mapeo Inteligente:</strong> Podés usar cualquier orden de columnas. 
                                    El sistema intentará detectarlas automáticamente y te permitirá corregirlas en el siguiente paso.
                                </p>
                            </div>
                        </div>
                    )}

                    {step === 'mapping' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ fontSize: 'var(--text-lg)', color: 'var(--color-gray-700)' }}>Asignar Columnas</h3>
                                <button className="btn btn-ghost btn-sm" onClick={() => setStep('upload')}>← Volver</button>
                            </div>

                            <div className="table-container" style={{ margin: 0, border: '1px solid var(--color-gray-200)' }}>
                                <table className="table" style={{ fontSize: '11px' }}>
                                    <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                        <tr>
                                            {headers.map((h, idx) => (
                                                <th key={idx} style={{ padding: 'var(--space-2)', minWidth: '140px', backgroundColor: 'var(--color-white)' }}>
                                                    <select 
                                                        value={colMapping[idx] || "ignore"}
                                                        onChange={(e) => setColMapping({...colMapping, [idx]: e.target.value})}
                                                        className="form-select"
                                                        style={{ minHeight: '32px', padding: '0 8px', fontSize: '10px', fontWeight: 'bold', border: colMapping[idx] && colMapping[idx] !== 'ignore' ? '2px solid var(--color-info)' : '1px solid var(--color-gray-300)' }}
                                                    >
                                                        <option value="ignore">🔻 Ignorar</option>
                                                        {MAPPABLE_FIELDS.filter(f => f.id !== 'ignore').map(field => (
                                                            <option key={field.id} value={field.id}>
                                                                {field.label} {field.required ? '*' : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr style={{ backgroundColor: 'var(--color-gray-50)', fontWeight: 'bold' }}>
                                            {headers.map((h, i) => (
                                                <td key={i} style={{ padding: '4px 8px', color: 'var(--color-gray-500)', borderBottom: '2px solid var(--color-gray-200)' }}>
                                                    {h}
                                                </td>
                                            ))}
                                        </tr>
                                        {rawRows.slice(0, 3).map((row, rIdx) => (
                                            <tr key={rIdx}>
                                                {headers.map((_, cIdx) => (
                                                    <td key={cIdx} style={{ padding: '4px 8px', color: 'var(--color-gray-400)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
                                                        {row[cIdx] || '—'}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <p style={{ fontSize: '11px', color: 'var(--color-gray-500)', margin: 0 }}>
                                    Columnas con (*) son obligatorias. Se detectaron <strong>{rawRows.length}</strong> pedidos.
                                </p>
                                <button className="btn btn-primary" onClick={handlePreview} disabled={loading}>
                                    {loading ? 'Analizando...' : 'Ver Previsualización →'}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'preview' && previewData && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                                    <span className="badge badge-success">✅ {summary.verdes} OK</span>
                                    <span className="badge badge-warning">🟡 {summary.amarillos} Revisar</span>
                                    <span className="badge badge-danger">🔴 {summary.rojos} Error</span>
                                </div>
                                <button className="btn btn-ghost btn-sm" onClick={() => setStep('mapping')}>← Ajustar Mapeo</button>
                            </div>

                            <div className="table-container" style={{ margin: 0, maxHeight: '400px', overflowY: 'auto' }}>
                                <table className="table table-compact" style={{ fontSize: '11px' }}>
                                    <thead>
                                        <tr>
                                            <th>Estado</th>
                                            <th>Cliente</th>
                                            <th>Pedido Detectado</th>
                                            <th>Dirección</th>
                                            <th>Mensajes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewData.map((row) => (
                                            <tr key={row.rowId} style={{ backgroundColor: row.status === 'rojo' ? 'var(--color-danger-bg)' : row.status === 'amarillo' ? 'var(--color-warning-bg)' : 'transparent' }}>
                                                <td>
                                                    {row.status === 'verde' ? '✅' : row.status === 'amarillo' ? '🟡' : '🔴'}
                                                </td>
                                                <td>
                                                    <strong>{row.original.nombreCliente}</strong>
                                                    {row.clientMatch.isNew && <span style={{ display: 'block', fontSize: '9px', color: 'var(--color-warning)' }}>+ Nuevo Cliente</span>}
                                                </td>
                                                <td>
                                                    {row.orderMatch.detalles.map((d, i) => (
                                                        <div key={i}>{d.cantidad} × {d.observaciones || "Item"}</div>
                                                    ))}
                                                    {row.orderMatch.detalles.length === 0 && <span style={{ color: 'var(--color-danger)' }}>Sin productos</span>}
                                                </td>
                                                <td>
                                                    <div style={{ maxWidth: '200px', fontWeight: 'bold' }}>{row.clientMatch.proposedData.direccion || row.original.direccion}</div>
                                                    {row.clientMatch.proposedData.direccion !== row.original.direccion && (
                                                        <div style={{ fontSize: '9px', color: 'var(--color-gray-400)', fontStyle: 'italic' }}>Orig: {row.original.direccion}</div>
                                                    )}
                                                </td>
                                                <td style={{ color: 'var(--color-danger)', fontSize: '10px' }}>
                                                    {row.errors[0]}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="modal-footer" style={{ margin: 'var(--space-2) -var(--space-6) -var(--space-6)', borderRadius: '0 0 var(--radius-xl) var(--radius-xl)' }}>
                                <button className="btn btn-ghost" onClick={handleClose}>Cancelar</button>
                                <button 
                                    className="btn btn-primary" 
                                    onClick={handleConfirm} 
                                    disabled={loading || summary.rojos === summary.totalRows}
                                >
                                    {loading ? 'Guardando...' : `Confirmar Importación (${summary.verdes + summary.amarillos} filas)`}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
