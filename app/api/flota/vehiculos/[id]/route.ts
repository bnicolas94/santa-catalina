import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const params = await context.params;
    const vehiculo = await prisma.vehiculo.findUnique({
      where: { id: params.id },
      include: {
        vencimientos: { orderBy: { fechaVencimiento: 'asc' } },
        kilometrajes: { orderBy: { fecha: 'desc' }, take: 20 },
        gastos: { include: { categoria: true }, orderBy: { fecha: 'desc' }, take: 50 },
      },
    });
    if (!vehiculo) return NextResponse.json({ error: 'Vehiculo no encontrado' }, { status: 404 });
    return NextResponse.json(vehiculo);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const params = await context.params;
    const data = await req.json();
    const vehiculo = await prisma.vehiculo.update({
      where: { id: params.id },
      data: {
        patente: data.patente?.toUpperCase(),
        marca: data.marca,
        modelo: data.modelo,
        anio: data.anio ? parseInt(data.anio) : undefined,
        kmProximoService: data.kmProximoService !== undefined ? (data.kmProximoService ? parseInt(data.kmProximoService) : null) : undefined,
        avisoKmsAntes: data.avisoKmsAntes ? parseInt(data.avisoKmsAntes) : undefined,
        estado: data.estado,
        activo: data.activo,
      },
    });
    return NextResponse.json(vehiculo);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const params = await context.params;
    await prisma.vehiculo.delete({
      where: { id: params.id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
