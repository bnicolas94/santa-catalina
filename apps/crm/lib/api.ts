import { NextResponse } from 'next/server'

export class CrmApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'CrmApiError'
  }
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof CrmApiError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
  }

  console.error('[CRM API]', error)
  return NextResponse.json(
    { error: 'Ocurrió un error interno en Atención.', code: 'INTERNAL_ERROR' },
    { status: 500 },
  )
}

export function requireText(value: unknown, field: string, maxLength: number) {
  const normalized = String(value ?? '').trim()
  if (!normalized) throw new CrmApiError(400, 'VALIDATION_ERROR', `${field} es requerido.`)
  if (normalized.length > maxLength) {
    throw new CrmApiError(400, 'VALIDATION_ERROR', `${field} supera el máximo de ${maxLength} caracteres.`)
  }
  return normalized
}
