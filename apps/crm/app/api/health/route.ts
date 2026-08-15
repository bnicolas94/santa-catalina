import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json({
    service: 'santa-catalina-crm',
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
}
