/**
 * Bridge file: Re-exporta tipos y función desde el nuevo PayrollService.
 * Mantiene compatibilidad con imports existentes mientras la lógica
 * se centraliza en lib/services/payroll.service.ts
 */
import { PayrollService } from '@/lib/services/payroll.service'

// Re-exportar tipos
export type { DiaTrabajado, ResumenSemanal } from '@/lib/services/payroll.service'

// Re-exportar función con la firma original
export const calcularSueldoSemanal = PayrollService.calcularSueldoSemanal.bind(PayrollService)
