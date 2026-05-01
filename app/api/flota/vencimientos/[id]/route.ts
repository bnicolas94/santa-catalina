import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(req: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const params = await context.params;
    const data = await req.json();
    const vencimiento = await prisma.vencimientoVehiculo.update({
      where: { id: params.id },
      data: {
        tipo: data.tipo,
        fechaVencimiento: data.fechaVencimiento ? new Date(data.fechaVencimiento) : null,
        kmVencimiento: data.kmVencimiento ? parseInt(data.kmVencimiento) : null,
        kmAviso: data.kmAviso ? parseInt(data.kmAviso) : null,
        observaciones: data.observaciones,
        notificado: data.notificado,
        diasAviso: data.diasAviso ? parseInt(data.diasAviso) : undefined,
      },
    });
    return NextResponse.json(vencimiento);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const params = await context.params;
    await prisma.vencimientoVehiculo.delete({
      where: { id: params.id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
