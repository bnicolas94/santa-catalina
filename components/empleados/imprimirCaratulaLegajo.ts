import { getPrintLogos } from '@/lib/utils/printLogos'

export interface EmpleadoCaratula {
    id: string
    nombre: string
    apellido?: string | null
    dni?: string | null
    email?: string | null
    telefono?: string | null
    fechaIngreso?: string | Date | null
    rol?: string | null
    activo?: boolean
    horasTrabajoDiarias?: number | null
    diasTrabajoSemana?: string | null
    horarioEntrada?: string | null
    horarioSalida?: string | null
    ubicacion?: { nombre?: string | null } | null
    area?: { nombre?: string | null } | null
    puesto?: { nombre?: string | null } | null
    turno?: { nombre?: string | null; horaInicio?: string | null; horaFin?: string | null } | null
}

export const escaparHtmlCaratula = (valor: unknown) => String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

export function formatearFechaIngresoCaratula(valor: string | Date | null | undefined): string {
    if (!valor) return 'Sin registrar'
    const clave = valor instanceof Date ? valor.toISOString().slice(0, 10) : String(valor).slice(0, 10)
    const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clave)
    if (!coincidencia) return 'Sin registrar'
    return `${coincidencia[3]}/${coincidencia[2]}/${coincidencia[1]}`
}

const dato = (etiqueta: string, valor: unknown) => `
    <div class="dato">
        <span>${escaparHtmlCaratula(etiqueta)}</span>
        <strong>${escaparHtmlCaratula(valor || 'Sin registrar')}</strong>
    </div>`

function textoHorario(empleado: EmpleadoCaratula): string {
    const inicio = empleado.turno?.horaInicio || empleado.horarioEntrada
    const fin = empleado.turno?.horaFin || empleado.horarioSalida
    if (!inicio || !fin) return empleado.turno?.nombre || 'Sin horario fijo'
    return `${inicio} a ${fin}${empleado.turno?.nombre ? ` · ${empleado.turno.nombre}` : ''}`
}

export function crearHtmlCaratulaLegajo(empleado: EmpleadoCaratula, logo: string, watermark: string): string {
    const nombreCompleto = `${empleado.nombre || ''} ${empleado.apellido || ''}`.trim()
    const iniciales = `${empleado.nombre?.charAt(0) || ''}${empleado.apellido?.charAt(0) || ''}`.toUpperCase()
    const rol = empleado.rol?.replaceAll('_', ' ') || 'Sin tipo asignado'
    const estado = empleado.activo === false ? 'INACTIVO' : 'ACTIVO'
    const generado = new Intl.DateTimeFormat('es-AR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Buenos_Aires',
    }).format(new Date())

    return `<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Carátula de legajo - ${escaparHtmlCaratula(nombreCompleto)}</title>
    <style>
        @page { size: A4 portrait; margin: 0; }
        * { box-sizing: border-box; }
        body { margin: 0; background: #e7e7e7; color: #172033; font-family: Arial, Helvetica, sans-serif; }
        .hoja { position: relative; width: 210mm; height: 297mm; margin: 10mm auto; padding: 11mm 16mm 12mm; overflow: hidden; background: #fff; }
        .barra { position: absolute; inset: 0 auto 0 0; width: 5mm; background: #b5122b; }
        .marca-agua { position: absolute; right: -18mm; bottom: 1mm; width: 112mm; opacity: .035; pointer-events: none; }
        header { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 5mm; border-bottom: 1.5px solid #b5122b; }
        .marca { display: flex; align-items: center; gap: 5mm; }
        .logo { width: auto; height: 16mm; object-fit: contain; }
        .empresa small { display: block; margin-top: 1.5mm; color: #667085; font-size: 8.5pt; letter-spacing: .08em; text-transform: uppercase; }
        .titulo { text-align: right; }
        .titulo span { display: block; color: #b5122b; font-size: 8pt; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
        .titulo h1 { margin: 1.5mm 0 0; font-size: 22pt; line-height: 1; letter-spacing: -.02em; }
        .persona { display: grid; grid-template-columns: 21mm 1fr auto; align-items: center; gap: 5mm; margin: 6mm 0 5mm; padding: 4.5mm 6mm; border-radius: 4mm; background: #f7f4f1; border: 1px solid #eadfd9; }
        .iniciales { display: grid; place-items: center; width: 21mm; height: 21mm; border-radius: 50%; background: #b5122b; color: #fff; font-size: 17pt; font-weight: 900; letter-spacing: -.03em; }
        .persona h2 { margin: 0 0 1.5mm; font-size: 19pt; line-height: 1.08; text-transform: uppercase; }
        .persona p { margin: 0; color: #667085; font-size: 10pt; text-transform: uppercase; letter-spacing: .06em; }
        .estado { padding: 2.2mm 4mm; border-radius: 99px; color: ${empleado.activo === false ? '#8d1c1c' : '#137333'}; background: ${empleado.activo === false ? '#fde8e8' : '#e5f7eb'}; font-size: 8pt; font-weight: 900; letter-spacing: .08em; }
        .seccion { margin-top: 4.5mm; break-inside: avoid; }
        .seccion h3 { display: flex; align-items: center; gap: 3mm; margin: 0 0 2.5mm; color: #8d0d20; font-size: 9pt; letter-spacing: .14em; text-transform: uppercase; }
        .seccion h3::after { content: ''; height: 1px; flex: 1; background: #e6c9cf; }
        .grilla { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #dfe3e8; border-radius: 3mm; overflow: hidden; }
        .dato { min-height: 14mm; padding: 2.5mm 4mm; border-right: 1px solid #e6e9ed; border-bottom: 1px solid #e6e9ed; }
        .dato:nth-child(even) { border-right: 0; }
        .dato:nth-last-child(-n+2) { border-bottom: 0; }
        .dato span { display: block; margin-bottom: 1.4mm; color: #7b8494; font-size: 7.5pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
        .dato strong { font-size: 11pt; line-height: 1.3; }
        .laboral { display: grid; grid-template-columns: 1.15fr .85fr 1fr; border: 1px solid #dfe3e8; border-radius: 3mm; overflow: hidden; }
        .laboral .dato { border-bottom: 0; }
        .laboral .dato:nth-child(2) { border-right: 1px solid #e6e9ed; }
        .documentos { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2mm 8mm; padding: 3.5mm 5mm; border: 1px solid #dfe3e8; border-radius: 3mm; }
        .check { display: flex; align-items: center; gap: 3mm; color: #344054; font-size: 9pt; }
        .casilla { width: 4.5mm; height: 4.5mm; border: 1.4px solid #667085; border-radius: .7mm; }
        .observaciones { height: 22mm; padding: 4mm; border: 1px solid #dfe3e8; border-radius: 3mm; background: repeating-linear-gradient(to bottom, #fff 0, #fff 7mm, #e8eaed 7.2mm); }
        footer { position: absolute; left: 16mm; right: 16mm; bottom: 9mm; display: flex; justify-content: space-between; padding-top: 3mm; border-top: 1px solid #dfe3e8; color: #7b8494; font-size: 7.5pt; }
        @media print {
            body { background: #fff; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .hoja { margin: 0; }
        }
    </style>
</head>
<body>
    <main class="hoja">
        <div class="barra"></div>
        <img class="marca-agua" src="${watermark}" alt="">
        <header>
            <div class="marca"><img class="logo" src="${logo}" alt="Santa Catalina"><div class="empresa"><small>Gestión de Recursos Humanos</small></div></div>
            <div class="titulo"><span>Documentación interna</span><h1>CARÁTULA DE LEGAJO</h1></div>
        </header>

        <section class="persona">
            <div class="iniciales">${escaparHtmlCaratula(iniciales || 'SC')}</div>
            <div><h2>${escaparHtmlCaratula(nombreCompleto)}</h2><p>${escaparHtmlCaratula(rol)}</p></div>
            <div class="estado">${estado}</div>
        </section>

        <section class="seccion">
            <h3>Datos personales</h3>
            <div class="grilla">
                ${dato('DNI', empleado.dni)}
                ${dato('Fecha de ingreso', formatearFechaIngresoCaratula(empleado.fechaIngreso))}
                ${dato('Teléfono', empleado.telefono)}
                ${dato('Correo electrónico', empleado.email)}
            </div>
        </section>

        <section class="seccion">
            <h3>Asignación laboral</h3>
            <div class="grilla">
                ${dato('Sede', empleado.ubicacion?.nombre)}
                ${dato('Área', empleado.area?.nombre)}
                ${dato('Puesto', empleado.puesto?.nombre)}
                ${dato('Tipo de empleado', rol)}
            </div>
            <div class="laboral" style="margin-top: 3mm">
                ${dato('Días habituales', empleado.diasTrabajoSemana)}
                ${dato('Jornada esperada', empleado.horasTrabajoDiarias ? `${empleado.horasTrabajoDiarias} horas` : null)}
                ${dato('Horario / turno', textoHorario(empleado))}
            </div>
        </section>

        <section class="seccion">
            <h3>Control de documentación</h3>
            <div class="documentos">
                ${['Copia de DNI', 'Constancia de CUIL', 'Alta temprana / AFIP', 'Contrato o acuerdo laboral', 'Apto médico', 'Comprobante de domicilio', 'Constancia de entrega de ropa', 'Otra documentación'].map(item => `<div class="check"><span class="casilla"></span>${item}</div>`).join('')}
            </div>
        </section>

        <section class="seccion">
            <h3>Observaciones</h3>
            <div class="observaciones"></div>
        </section>

        <footer><span>Uso interno · Recursos Humanos</span><span>ID interno: ${escaparHtmlCaratula(empleado.id)}</span><span>Emitida: ${escaparHtmlCaratula(generado)}</span></footer>
    </main>
    <script>
        window.onload = () => {
            const imagenes = [...document.images];
            Promise.all(imagenes.map(img => img.complete ? Promise.resolve() : new Promise(resolve => { img.onload = resolve; img.onerror = resolve; }))).then(() => window.print());
        };
    <\/script>
</body>
</html>`
}

export async function imprimirCaratulaLegajo(empleado: EmpleadoCaratula): Promise<void> {
    const ventana = window.open('', '_blank')
    if (!ventana) throw new Error('El navegador bloqueó la ventana de impresión.')
    ventana.document.write('<!doctype html><title>Preparando carátula…</title><p style="font-family:Arial;padding:24px">Preparando carátula…</p>')
    const { logo, watermark } = await getPrintLogos()
    ventana.document.open()
    ventana.document.write(crearHtmlCaratulaLegajo(empleado, logo, watermark))
    ventana.document.close()
}
