"use client";

import { useState } from "react";
import * as xlsx from "xlsx";
import { ExcelRow, PreviewRowResult } from "../../api/importar-pedidos/preview/route";

export default function ImportarPedidosPage() {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [previewData, setPreviewData] = useState<PreviewRowResult[] | null>(null);
    const [summary, setSummary] = useState({ verdes: 0, amarillos: 0, rojos: 0, totalRows: 0 });
    const [importStatus, setImportStatus] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);
    const [importMode, setImportMode] = useState<"excel" | "paste">("excel");
    const [pasteText, setPasteText] = useState("");

    // Procesar archivo seleccionado
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (selected) {
            setFile(selected);
            setPreviewData(null); // resetea preview interior
            setImportStatus(null);
        }
    };

    // Leer Excel y llamar a API Preview
    const handlePreview = async () => {
        if (!file) return;

        setLoading(true);
        setImportStatus({ type: "info", msg: "Leyendo Excel..." });

        try {
            const data = await file.arrayBuffer();
            const workbook = xlsx.read(data);
            
            // Intentar buscar la hoja "2026" o usar la que tenga más filas
            let sheetName = workbook.SheetNames.find(n => n.includes("2026")) || workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            
            // Leemos como array de arrays para no depender de nombres de encabezados (header: 1)
            // O mejor, usamos { header: "A" } para tener r["A"], r["B"], etc.
            const rawJson = xlsx.utils.sheet_to_json<any>(sheet, { header: "A", defval: "" });

            // Función para convertir fecha de Excel (número) a string ISO
            const formatExcelDate = (val: any) => {
                if (!val) return new Date().toISOString().split("T")[0];
                if (typeof val === "number") {
                    // Excel base date is 1899-12-30
                    const date = new Date((val - 25569) * 86400 * 1000);
                    return date.toISOString().split("T")[0];
                }
                return String(val);
            };

            // Transformar datos crudos a ExcelRow
            // Saltamos la primera fila si detectamos que es el encabezado (Fecha, Nombre...)
            const rows: ExcelRow[] = rawJson
                .map((r: any, index: number) => ({
                    rowId: index,
                    fecha: formatExcelDate(r["A"]),
                    nombreCliente: r["B"]?.toString() || "",
                    pedidoTexto: r["C"]?.toString() || "",
                    direccion: r["E"]?.toString() || "",
                    localidad: r["F"]?.toString() || "",
                    telefono: r["G"]?.toString() || "",
                    turno: (r["H"]?.toString().toUpperCase().includes("MA") ? "MANANA" : 
                            r["H"]?.toString().toUpperCase().includes("SI") ? "SIESTA" : 
                            r["H"]?.toString().toUpperCase().includes("TA") ? "TARDE" : undefined) as "MANANA" | "SIESTA" | "TARDE" | undefined,
                }))
                .filter(r => r.nombreCliente && r.pedidoTexto && r.nombreCliente !== "Nombre y Apellido");

            if (rows.length === 0) {
                throw new Error("No se encontraron filas válidas en la hoja " + sheetName);
            }

            setImportStatus({ type: "info", msg: `Enviando ${rows.length} filas a validación...` });

            // Llamar al API preview
            const res = await fetch("/api/importar-pedidos/preview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rows }),
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Falló preview");

            setPreviewData(result.results);
            setSummary({ verdes: result.verdes, amarillos: result.amarillos, rojos: result.rojos, totalRows: result.totalRows });
            setImportStatus(null);

        } catch (err: any) {
            setImportStatus({ type: "error", msg: err.message });
        } finally {
            setLoading(false);
        }
    };

    const [colMapping, setColMapping] = useState<Record<number, string>>({});
    const [pasteRows, setPasteRows] = useState<string[][]>([]);

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

    // Detectar cabeceras automáticamente
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

    const handlePasteChange = (text: string) => {
        setPasteText(text);
        if (!text.trim()) {
            setPasteRows([]);
            return;
        }
        const lines = text.trim().split("\n");
        const parsedRows = lines.map(line => line.split("\t"));
        setPasteRows(parsedRows);
        
        // Si acabamos de pegar y no hay mapeo, intentamos auto-detectar con la primera fila
        if (Object.keys(colMapping).length === 0 && parsedRows.length > 0) {
            autoDetectMapping(parsedRows[0]);
        }
    };

    const handlePastePreview = async () => {
        if (!pasteText.trim()) return;

        // Validar que los campos requeridos estén mapeados
        const missing = MAPPABLE_FIELDS.filter(f => f.required && !Object.values(colMapping).includes(f.id));
        if (missing.length > 0) {
            setImportStatus({ type: "error", msg: `Faltan mapear columnas obligatorias: ${missing.map(m => m.label).join(", ")}` });
            return;
        }

        setLoading(true);
        setImportStatus({ type: "info", msg: "Procesando mapeo de columnas..." });

        try {
            // Decidir si la primera fila es cabecera para ignorarla si es necesario
            // (Si alguna columna mapeada coincide con el nombre del campo en la primera fila, es cabecera)
            const firstRowIsHeader = pasteRows.length > 0 && pasteRows[0].some(cell => 
                MAPPABLE_FIELDS.some(f => f.label.toLowerCase().includes(cell.toLowerCase().trim()))
            );

            const dataRows = firstRowIsHeader ? pasteRows.slice(1) : pasteRows;

            const rows: ExcelRow[] = dataRows.map((cols, index) => {
                const getVal = (fieldId: string) => {
                    const idx = Object.keys(colMapping).find(k => colMapping[parseInt(k)] === fieldId);
                    return idx !== undefined ? cols[parseInt(idx)]?.trim() : "";
                };

                const rawFecha = getVal('fecha');
                const rawTurno = getVal('turno')?.toUpperCase() || "";
                
                return {
                    rowId: index,
                    fecha: rawFecha || new Date().toISOString().split("T")[0],
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

            if (rows.length === 0) throw new Error("No se detectaron filas válidas con el mapeo actual.");

            const res = await fetch("/api/importar-pedidos/preview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rows }),
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Falló preview");

            setPreviewData(result.results);
            setSummary({ verdes: result.verdes, amarillos: result.amarillos, rojos: result.rojos, totalRows: result.totalRows });
            setImportStatus(null);
        } catch (err: any) {
            setImportStatus({ type: "error", msg: err.message });
        } finally {
            setLoading(false);
        }
    };

    // Confirmar Importación a Base de Datos
    const handleConfirm = async () => {
        if (!previewData) return;
        setLoading(true);
        setImportStatus({ type: "info", msg: "Guardando en base de datos..." });

        try {
            const res = await fetch("/api/importar-pedidos/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rows: previewData }),
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Error al confirmar");

            setImportStatus({ type: "success", msg: result.message });
            setPreviewData(null); // Limpiar preview

        } catch (err: any) {
            setImportStatus({ type: "error", msg: err.message });
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Importación de Pedidos (Excel)</h1>
            <p className="text-gray-500">Sube el archivo Excel operativo para procesar pedidos de forma masiva.</p>

            {/* Selector de Modo */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
                <button 
                    onClick={() => { setImportMode("excel"); setPreviewData(null); }}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${importMode === 'excel' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    📁 Archivo Excel
                </button>
                <button 
                    onClick={() => { setImportMode("paste"); setPreviewData(null); }}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${importMode === 'paste' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    📋 Pegar Contenido
                </button>
            </div>

            {/* Tarjeta de Carga */}
            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                {importMode === "excel" ? (
                    <div className="flex items-center space-x-4">
                        <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleFileChange}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        <button
                            onClick={handlePreview}
                            disabled={!file || loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 min-w-[140px]"
                        >
                            {loading ? "Procesando..." : "Previsualizar"}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-blue-50 p-4 rounded-lg flex items-start space-x-3 text-sm text-blue-800">
                            <span className="text-xl">💡</span>
                            <div>
                                <p className="font-semibold">Modo Inteligente Activado</p>
                                <p>Pegue sus celdas y el sistema intentará detectar el orden automáticamente. Puede corregir el mapeo usando los selectores debajo.</p>
                            </div>
                        </div>

                        <textarea 
                            className="w-full h-40 p-3 text-sm font-mono border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="Pegue aquí (Ctrl+V) las celdas de Excel..."
                            value={pasteText}
                            onChange={(e) => handlePasteChange(e.target.value)}
                        />

                        {pasteRows.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-gray-700">Configuración de Columnas ({pasteRows[0].length} detectadas)</h3>
                                <div className="overflow-x-auto border rounded-lg bg-gray-50">
                                    <table className="w-full text-xs text-left">
                                        <thead>
                                            <tr>
                                                {pasteRows[0].map((_, idx) => (
                                                    <th key={idx} className="p-2 min-w-[140px] border-r border-b bg-white">
                                                        <select 
                                                            value={colMapping[idx] || "ignore"}
                                                            onChange={(e) => setColMapping({...colMapping, [idx]: e.target.value})}
                                                            className={`w-full p-1 border rounded font-bold ${colMapping[idx] && colMapping[idx] !== 'ignore' ? 'border-blue-500 text-blue-700 bg-blue-50' : 'border-gray-300 text-gray-500'}`}
                                                        >
                                                            <option value="ignore">🔽 Ignorar</option>
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
                                            {pasteRows.slice(0, 3).map((row, rIdx) => (
                                                <tr key={rIdx} className="bg-white">
                                                    {row.map((cell, cIdx) => (
                                                        <td key={cIdx} className="p-2 border-r border-b text-gray-400 truncate max-w-[140px]">
                                                            {cell}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="text-[11px] text-gray-400 italic">
                                        * Columnas con (*) son obligatorias para previsualizar.
                                    </div>
                                    <button
                                        onClick={handlePastePreview}
                                        disabled={loading || !pasteText.trim()}
                                        className="px-6 py-2 bg-blue-600 text-white font-bold rounded shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-all"
                                    >
                                        {loading ? "Procesando..." : "Analizar y Previsualizar"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Menaje de Estado */}
            {importStatus && (
                <div className={`p-4 rounded-lg ${importStatus.type === 'error' ? 'bg-red-50 text-red-700' : importStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                    {importStatus.msg}
                </div>
            )}

            {/* Vista Previa de Tabla */}
            {previewData && (
                <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                        <div className="flex gap-4">
                            <span className="font-semibold text-gray-700">Total: {summary.totalRows}</span>
                            <span className="text-green-600 font-medium">🟢 Ok: {summary.verdes}</span>
                            <span className="text-yellow-600 font-medium">🟡 A revisar: {summary.amarillos}</span>
                            <span className="text-red-600 font-medium">🔴 Error: {summary.rojos}</span>
                        </div>
                        <button
                            onClick={handleConfirm}
                            disabled={loading}
                            className="px-4 py-2 bg-green-600 text-white font-medium rounded hover:bg-green-700 disabled:opacity-50"
                        >
                            Confirmar e Importar
                        </button>
                    </div>

                    <div className="overflow-x-auto max-h-[600px]">
                        <table className="w-full text-sm text-left relative">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3">Estado</th>
                                    <th className="px-4 py-3">Cliente (Excel)</th>
                                    <th className="px-4 py-3">Pedido (Excel)</th>
                                    <th className="px-4 py-3">Match Cliente</th>
                                    <th className="px-4 py-3">Interpretación</th>
                                    <th className="px-4 py-3">Mensajes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {previewData.slice(0, 50).map((row) => ( // Paginamos a 50 para no reventar DOM si son 5000
                                    <tr key={row.rowId} className={`
                    ${row.status === 'verde' ? 'bg-white' : ''}
                    ${row.status === 'amarillo' ? 'bg-yellow-50' : ''}
                    ${row.status === 'rojo' ? 'bg-red-50' : ''}
                  `}>
                                        <td className="px-4 py-3">
                                            {row.status === 'verde' && "🟢"}
                                            {row.status === 'amarillo' && "🟡"}
                                            {row.status === 'rojo' && "🔴"}
                                        </td>
                                        <td className="px-4 py-3 font-medium">
                                            {row.original.nombreCliente} <br />
                                            <span className="text-xs text-gray-500">{row.original.telefono}</span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">{row.original.pedidoTexto}</td>

                                        <td className="px-4 py-3">
                                            {row.clientMatch.isNew ? (
                                                <span className="text-yellow-700 bg-yellow-100 px-2 py-1 rounded text-xs">Nuevo (+Crear)</span>
                                            ) : (
                                                <span className="text-green-700 bg-green-100 px-2 py-1 rounded text-xs">ID Existe</span>
                                            )}
                                        </td>

                                        <td className="px-4 py-3">
                                            {row.orderMatch.detalles.length > 0 ? (
                                                <ul className="list-disc list-inside text-xs">
                                                    {row.orderMatch.detalles.map((d, i) => (
                                                        <li key={i}>{d.cantidad} unid. ({d.observaciones || "Sin nota"})</li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <span className="text-red-500 italic text-xs">Ninguno</span>
                                            )}
                                            {!row.orderMatch.isFullyMatched && (
                                                <span className="block mt-1 text-xs text-yellow-600 underline cursor-pointer">Revisar (Manual)</span>
                                            )}
                                        </td>

                                        <td className="px-4 py-3 text-xs text-red-600 max-w-xs truncate" title={row.errors.join(", ")}>
                                            {row.errors.length > 0 ? row.errors[0] + (row.errors.length > 1 ? "..." : "") : "-"}
                                        </td>

                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {previewData.length > 50 && (
                            <div className="p-4 text-center text-gray-500 bg-white border-t">
                                Mostrando 50 de {previewData.length} resultados.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
