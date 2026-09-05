import { prisma } from '@/lib/prisma'
import { eventBus } from '@/lib/events'
import bcrypt from 'bcryptjs'
import { cambioSalarialRelevante, configuracionSalarialEfectiva } from '@/lib/rrhh/historialSalarial'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface CreateEmpleadoInput {
    nombre: string
    apellido?: string | null
    dni?: string | null
    email?: string | null
    password?: string | null
    rol: string
    rolId?: string | null
    telefono?: string | null
    fechaIngreso?: string | null
    sueldoBaseMensual?: number
    cicloPago?: string
    modalidadPago?: string
    porcentajeHoraExtra?: number
    valorHoraExtra?: number
    porcentajeFeriado?: number
    horasTrabajoDiarias?: number
    horasTrabajoSabado?: number | null
    diasTrabajoSemana?: string
    horarioEntrada?: string | null
    horarioSalida?: string | null
    jornal?: number
    codigoBiometrico?: string | null
    ubicacionId?: string | null
    areaId?: string | null
    puestoId?: string | null
    turnoId?: string | null
}

export interface UpdateEmpleadoInput {
    nombre?: string
    apellido?: string | null
    dni?: string | null
    email?: string | null
    password?: string | null
    rol?: string
    rolId?: string | null
    telefono?: string | null
    fechaIngreso?: string | null
    sueldoBaseMensual?: number
    cicloPago?: string
    modalidadPago?: string
    porcentajeHoraExtra?: number
    valorHoraExtra?: number
    porcentajeFeriado?: number
    horasTrabajoDiarias?: number
    horasTrabajoSabado?: number | null
    diasTrabajoSemana?: string
    horarioEntrada?: string | null
    horarioSalida?: string | null
    jornal?: number
    codigoBiometrico?: string | null
    ubicacionId?: string | null
    areaId?: string | null
    puestoId?: string | null
    turnoId?: string | null
    activo?: boolean
}

export interface EmpleadoFilters {
    activo?: boolean
    rol?: string
    ubicacionId?: string
    areaId?: string
    search?: string
}

// ─── Select por defecto para consultas ───────────────────────────────────────

const EMPLEADO_SELECT = {
    id: true,
    nombre: true,
    apellido: true,
    dni: true,
    email: true,
    rol: true,
    telefono: true,
    activo: true,
    createdAt: true,
    fechaIngreso: true,
    sueldoBaseMensual: true,
    cicloPago: true,
    modalidadPago: true,
    porcentajeHoraExtra: true,
    valorHoraExtra: true,
    porcentajeFeriado: true,
    horasTrabajoDiarias: true,
    horasTrabajoSabado: true,
    diasTrabajoSemana: true,
    horarioEntrada: true,
    horarioSalida: true,
    jornal: true,
    codigoBiometrico: true,
    ubicacionId: true,
    rolId: true,
    areaId: true,
    puestoId: true,
    turnoId: true,
    ubicacion: { select: { id: true, nombre: true, tipo: true } },
    rolRel: { select: { id: true, nombre: true, jornal: true, cicloPago: true, valorHoraExtra: true } },
    area: { select: { id: true, nombre: true, color: true } },
    puesto: { select: { id: true, nombre: true } },
    turno: { select: { id: true, nombre: true, horaInicio: true, horaFin: true, toleranciaMinutos: true } },
} as const

// ─── Servicio ────────────────────────────────────────────────────────────────

export class EmpleadoService {

    // ─── Listar Empleados ────────────────────────────────────────────────────
    static async findAll(filters?: EmpleadoFilters) {
        const where: any = {}

        if (filters?.activo !== undefined) {
            where.activo = filters.activo
        }
        if (filters?.rol) {
            where.rol = filters.rol
        }
        if (filters?.ubicacionId) {
            where.ubicacionId = filters.ubicacionId
        }
        if (filters?.areaId) {
            where.areaId = filters.areaId
        }

        const empleados = await prisma.empleado.findMany({
            where,
            orderBy: { nombre: 'asc' },
            select: {
                ...EMPLEADO_SELECT,
                fichadas: {
                    where: {
                        fechaHora: {
                            gte: new Date(new Date().setHours(0, 0, 0, 0)),
                            lte: new Date(new Date().setHours(23, 59, 59, 999))
                        }
                    },
                    select: {
                        tipo: true,
                        fechaHora: true
                    }
                }
            },
        })

        // Mapear para facilitar consumo en frontend
        return empleados.map(e => {
            const entrada = e.fichadas.find(f => f.tipo === 'entrada')
            let esTarde = false
            
            if (entrada && (e.turno?.horaInicio || e.horarioEntrada)) {
                const horaObjetivo = e.turno?.horaInicio || e.horarioEntrada
                const tolerancia = e.turno?.toleranciaMinutos ?? 10
                const [h, m] = horaObjetivo!.split(':').map(Number)
                const limite = new Date(entrada.fechaHora)
                limite.setHours(h, m + tolerancia, 0, 0)
                esTarde = entrada.fechaHora > limite
            }

            return {
                ...e,
                asistenciaHoy: {
                    tieneEntrada: !!entrada,
                    tieneSalida: e.fichadas.some(f => f.tipo === 'salida'),
                    esTarde,
                    esAusente: e.fichadas.length === 0,
                    fichadas: e.fichadas
                }
            }
        })
    }

    // ─── Buscar por ID ───────────────────────────────────────────────────────
    static async findById(id: string) {
        return prisma.empleado.findUnique({
            where: { id },
            select: EMPLEADO_SELECT,
        })
    }

    // ─── Crear Empleado ──────────────────────────────────────────────────────
    /**
     * Crea un empleado con validaciones de unicidad estrictas.
     * Emite evento 'empleado:created' con el empleado creado.
     */
    static async create(input: CreateEmpleadoInput) {
        // Validaciones obligatorias
        if (!input.nombre || !input.rol) {
            throw new EmpleadoValidationError('Nombre y rol son requeridos')
        }

        const rolSeleccionado = input.rolId
            ? await prisma.rolEmpleado.findUnique({ where: { id: input.rolId }, select: { nombre: true } })
            : null
        if (input.rolId && !rolSeleccionado) throw new EmpleadoValidationError('El tipo de empleado seleccionado ya no existe.')

        // Validar unicidad de email
        if (input.email && input.email.trim() !== '') {
            const existingEmail = await prisma.empleado.findUnique({ where: { email: input.email } })
            if (existingEmail) {
                throw new EmpleadoValidationError('Ya existe un empleado con este email')
            }
        }

        // Validar unicidad de DNI
        if (input.dni && input.dni.trim() !== '') {
            const existingDni = await prisma.empleado.findUnique({ where: { dni: input.dni } })
            if (existingDni) {
                throw new EmpleadoValidationError('Ya existe un empleado con este DNI')
            }
        }

        // Validar unicidad de código biométrico
        if (input.codigoBiometrico) {
            const existingBio = await prisma.empleado.findUnique({ where: { codigoBiometrico: input.codigoBiometrico } })
            if (existingBio) {
                throw new EmpleadoValidationError('El código biométrico ya está en uso por otro empleado')
            }
        }

        // Hash de contraseña (opcional)
        let hashedPassword = null
        if (input.password) {
            hashedPassword = await bcrypt.hash(input.password, 10)
        }

        const empleado = await prisma.empleado.create({
            data: {
                nombre: input.nombre,
                apellido: input.apellido || null,
                dni: (input.dni && input.dni.trim() !== '') ? input.dni : null,
                email: (input.email && input.email.trim() !== '') ? input.email : null,
                password: hashedPassword,
                rol: rolSeleccionado?.nombre || input.rol,
                telefono: (input.telefono && input.telefono.trim() !== '') ? input.telefono : null,
                fechaIngreso: input.fechaIngreso ? new Date(input.fechaIngreso) : null,
                sueldoBaseMensual: input.sueldoBaseMensual ? parseFloat(String(input.sueldoBaseMensual)) : 0,
                cicloPago: input.cicloPago || 'SEMANAL',
                modalidadPago: input.modalidadPago === 'MENSUAL_MIXTA' ? 'MENSUAL_MIXTA' : 'SEMANAL_EFECTIVO',
                porcentajeHoraExtra: input.porcentajeHoraExtra ? parseFloat(String(input.porcentajeHoraExtra)) : 50,
                valorHoraExtra: input.valorHoraExtra ? parseFloat(String(input.valorHoraExtra)) : 0,
                porcentajeFeriado: input.porcentajeFeriado ? parseFloat(String(input.porcentajeFeriado)) : 100,
                horasTrabajoDiarias: input.horasTrabajoDiarias ? parseFloat(String(input.horasTrabajoDiarias)) : 8,
                horasTrabajoSabado: input.horasTrabajoSabado && input.horasTrabajoSabado > 0
                    ? parseFloat(String(input.horasTrabajoSabado))
                    : null,
                diasTrabajoSemana: input.diasTrabajoSemana || 'Lunes a Viernes',
                horarioEntrada: input.horarioEntrada || null,
                horarioSalida: input.horarioSalida || null,
                jornal: input.jornal ? parseFloat(String(input.jornal)) : 0,
                codigoBiometrico: input.codigoBiometrico || null,
                ubicacionId: input.ubicacionId || null,
                rolId: input.rolId || null,
                areaId: input.areaId || null,
                puestoId: input.puestoId || null,
                turnoId: input.turnoId || null,
            },
        })

        // Evento de dominio
        eventBus.emit('empleado:created', { empleadoId: empleado.id, nombre: empleado.nombre })

        // Devolver sin password
        const { password: _, ...empleadoSinPassword } = empleado
        return empleadoSinPassword
    }

    // ─── Actualizar Empleado ─────────────────────────────────────────────────
    /**
     * Actualiza campos del empleado. Maneja correctamente campos opcionales
     * (undefined = no tocar, null = limpiar, valor = actualizar).
     */
    static async update(id: string, input: UpdateEmpleadoInput, registradoPorId?: string | null) {
        // Robustecimiento de fecha de ingreso
        let validatedFechaIngreso = undefined as Date | null | undefined
        if (input.fechaIngreso !== undefined) {
            if (input.fechaIngreso) {
                const dateObj = new Date(input.fechaIngreso)
                if (!isNaN(dateObj.getTime())) {
                    validatedFechaIngreso = dateObj
                }
            } else {
                validatedFechaIngreso = null
            }
        }

        const rolSeleccionado = input.rolId
            ? await prisma.rolEmpleado.findUnique({ where: { id: input.rolId }, select: { nombre: true } })
            : null
        if (input.rolId && !rolSeleccionado) throw new EmpleadoValidationError('El tipo de empleado seleccionado ya no existe.')

        const dataToUpdate: any = {
            nombre: input.nombre || undefined,
            apellido: (input.apellido !== undefined) ? input.apellido : undefined,
            dni: (input.dni !== undefined) ? (input.dni || null) : undefined,
            email: (input.email !== undefined) ? (input.email || null) : undefined,
            rol: rolSeleccionado?.nombre || input.rol || undefined,
            telefono: (input.telefono !== undefined) ? (input.telefono || null) : undefined,
            fechaIngreso: validatedFechaIngreso,
            sueldoBaseMensual: !isNaN(parseFloat(String(input.sueldoBaseMensual))) ? parseFloat(String(input.sueldoBaseMensual)) : undefined,
            cicloPago: input.cicloPago || undefined,
            modalidadPago: input.modalidadPago === 'MENSUAL_MIXTA'
                ? 'MENSUAL_MIXTA'
                : input.modalidadPago === 'SEMANAL_EFECTIVO'
                    ? 'SEMANAL_EFECTIVO'
                    : undefined,
            porcentajeHoraExtra: !isNaN(parseFloat(String(input.porcentajeHoraExtra))) ? parseFloat(String(input.porcentajeHoraExtra)) : undefined,
            valorHoraExtra: !isNaN(parseFloat(String(input.valorHoraExtra))) ? parseFloat(String(input.valorHoraExtra)) : undefined,
            porcentajeFeriado: !isNaN(parseFloat(String(input.porcentajeFeriado))) ? parseFloat(String(input.porcentajeFeriado)) : undefined,
            horasTrabajoDiarias: !isNaN(parseFloat(String(input.horasTrabajoDiarias))) ? parseFloat(String(input.horasTrabajoDiarias)) : undefined,
            horasTrabajoSabado: input.horasTrabajoSabado !== undefined
                ? (input.horasTrabajoSabado && Number(input.horasTrabajoSabado) > 0 ? Number(input.horasTrabajoSabado) : null)
                : undefined,
            diasTrabajoSemana: input.diasTrabajoSemana || undefined,
            horarioEntrada: (input.horarioEntrada !== undefined) ? (input.horarioEntrada || null) : undefined,
            horarioSalida: (input.horarioSalida !== undefined) ? (input.horarioSalida || null) : undefined,
            jornal: !isNaN(parseFloat(String(input.jornal))) ? parseFloat(String(input.jornal)) : undefined,
            codigoBiometrico: (input.codigoBiometrico !== undefined) ? (input.codigoBiometrico || null) : undefined,
            ubicacionId: (input.ubicacionId !== undefined) ? (input.ubicacionId || null) : undefined,
            rolId: (input.rolId !== undefined) ? (input.rolId || null) : undefined,
            areaId: (input.areaId !== undefined) ? (input.areaId || null) : undefined,
            puestoId: (input.puestoId !== undefined) ? (input.puestoId || null) : undefined,
            turnoId: (input.turnoId !== undefined) ? (input.turnoId || null) : undefined,
        }

        if (input.activo !== undefined) {
            dataToUpdate.activo = input.activo
        }

        // Hash de contraseña si se proporciona
        if (input.password && input.password.trim() !== '') {
            dataToUpdate.password = await bcrypt.hash(input.password, 10)
        }

        const empleado = await prisma.$transaction(async tx => {
            const anterior = await tx.empleado.findUniqueOrThrow({
                where: { id },
                select: {
                    jornal: true,
                    sueldoBaseMensual: true,
                    cicloPago: true,
                    valorHoraExtra: true,
                    rolRel: { select: { id: true, nombre: true, jornal: true, cicloPago: true, valorHoraExtra: true } },
                },
            })

            const actualizado = await tx.empleado.update({
                where: { id },
                data: dataToUpdate,
                select: EMPLEADO_SELECT,
            })

            const configuracionAnterior = configuracionSalarialEfectiva(anterior)
            const configuracionNueva = configuracionSalarialEfectiva(actualizado)
            if (cambioSalarialRelevante(configuracionAnterior, configuracionNueva)) {
                await tx.historialSalarial.create({
                    data: {
                        origen: 'EMPLEADO',
                        empleadoId: id,
                        rolId: actualizado.rolId,
                        registradoPorId: registradoPorId || null,
                        montoAnterior: configuracionAnterior.monto,
                        montoNuevo: configuracionNueva.monto,
                        cicloPagoAnterior: configuracionAnterior.cicloPago,
                        cicloPagoNuevo: configuracionNueva.cicloPago,
                        valorHoraExtraAnterior: configuracionAnterior.valorHoraExtra,
                        valorHoraExtraNuevo: configuracionNueva.valorHoraExtra,
                        fuenteAnterior: configuracionAnterior.fuente,
                        fuenteNueva: configuracionNueva.fuente,
                    },
                })
            }

            return actualizado
        })

        // Evento de dominio
        eventBus.emit('empleado:updated', { empleadoId: id })

        return empleado
    }

    // ─── Soft Delete (Dar de Baja) ───────────────────────────────────────────
    /**
     * NUNCA elimina el registro. Solo marca activo = false.
     * Regla de negocio crítica: no borrar datos históricos.
     */
    static async softDelete(id: string) {
        const empleado = await prisma.empleado.update({
            where: { id },
            data: { activo: false },
            select: { id: true, nombre: true, apellido: true },
        })

        eventBus.emit('empleado:deactivated', { empleadoId: id, nombre: `${empleado.nombre} ${empleado.apellido || ''}` })
        return empleado
    }

    // ─── Reactivar ───────────────────────────────────────────────────────────
    static async reactivate(id: string) {
        return prisma.empleado.update({
            where: { id },
            data: { activo: true },
            select: EMPLEADO_SELECT,
        })
    }
}

// ─── Error personalizado ─────────────────────────────────────────────────────

export class EmpleadoValidationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'EmpleadoValidationError'
    }
}
