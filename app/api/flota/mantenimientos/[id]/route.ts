import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(req: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const params = await context.params;
    const data = await req.json();
    const mantenimiento = await prisma.mantenimientoVehiculo.update({
      where: { id: params.id },
      data: {
        tipo: data.tipo,
        fecha: data.fecha ? new Date(data.fecha) : undefined,
        taller: data.taller,
        costo: data.costo !== undefined ? parseFloat(data.costo) : undefined,
        descripcion: data.descripcion,
        kilometraje: data.kilometraje ? parseInt(data.kilometraje) : null,
      },
    });
    return NextResponse.json(mantenimiento);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const params = await context.params;
    await prisma.mantenimientoVehiculo.delete({
      where: { id: params.id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
