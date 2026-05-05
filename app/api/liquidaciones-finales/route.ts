import { NextResponse } from 'next/server'
import { LiquidacionFinalService } from '@/lib/services/liquidacion-final.service'

/**
 * API para el cálculo y registro de Liquidaciones Finales (LCT Argentina)
 */
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { isPreview, input, itemsFinales } = body

        if (!input?.empleadoId || !input?.fechaEgreso || !input?.causaEgreso) {
            return NextResponse.json({ error: 'Faltan datos obligatorios (empleadoId, fechaEgreso, causaEgreso)' }, { status: 400 })
        }

        if (isPreview) {
            // Modo simulación / cálculo inicial
            const calculo = await LiquidacionFinalService.calcular(input)
            return NextResponse.json(calculo)
        }

        // Modo confirmación
        if (!itemsFinales || !Array.isArray(itemsFinales)) {
            return NextResponse.json({ error: 'Se requieren los conceptos finales para confirmar la liquidación' }, { status: 400 })
        }

        const liquidacion = await LiquidacionFinalService.confirmar(input, itemsFinales)
        
        return NextResponse.json({
            success: true,
            message: 'Liquidación confirmada exitosamente',
            data: liquidacion
        })

    } catch (error: any) {
        console.error('Error en LiquidacionFinal API:', error)
        return NextResponse.json({ 
            error: error.message || 'Ocurrió un error inesperado al procesar la liquidación' 
        }, { status: 500 })
    }
}
