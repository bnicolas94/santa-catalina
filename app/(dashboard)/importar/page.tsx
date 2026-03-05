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
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]]; // Usamos la primera por ahora o la llamada "2026"
            const rawJson = xlsx.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });

            // Transformar datos crudos a ExcelRow
            const rows: ExcelRow[] = rawJson.map((r, index) => ({
                rowId: index,
                // En Excel la fecha usualmente viene como número serial si no está formateada
                // Para simplificar, asumimos que A es fecha y está como string. Si viene serial hay que convertirlo (TODO)
                fecha: (r["A"] as string) || new Date().toISOString().split("T")[0],
                nombreCliente: (r["B"] as string)?.toString() || "",
                pedidoTexto: (r["C"] as string)?.toString() || "",
                direccion: (r["E"] as string)?.toString() || "",
                telefono: (r["F"] as string)?.toString() || "",
                turno: ((r["G"] as string)?.toString().toUpperCase() as "MANANA" | "SIESTA" | "TARDE") || undefined,
            })).filter(r => r.nombreCliente && r.pedidoTexto); // Filtrar filas vacías de Excel

            setImportStatus({ type: "info", msg: "Enviando a validación..." });

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

            {/* Tarjeta de Carga */}
            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
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
