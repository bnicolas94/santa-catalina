import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const [totalVehiculos, vehiculosActivos, vencimientos, vehiculos, choferDocs] = await Promise.all([
      // @ts-ignore
      prisma.vehiculo.count(),
      // @ts-ignore
      prisma.vehiculo.count({ where: { activo: true, estado: 'disponible' } }),
      // @ts-ignore
      prisma.vencimientoVehiculo.findMany({
        include: { vehiculo: true },
      }),
      // @ts-ignore
      prisma.vehiculo.findMany({ where: { activo: true } }),
      // @ts-ignore
      prisma.documentoEmpleado.findMany({
        where: {
          tipoDocumento: 'LICENCIA_CONDUCIR',
          empleado: { rolRel: { nombre: 'LOGISTICA' }, activo: true }
        },
        include: { empleado: true }
      })
    ]);

    const hoy = new Date();
    let proximosVencer = 0;
    let vencidos = 0;
    let ok = 0;

    let alertasArray: any[] = [];

    // 1. Vencimientos Vehículos (Fechas)
    vencimientos.forEach((v: any) => {
      // 1.1 Alerta por Fecha
      if (v.fechaVencimiento) {
        const fecha = new Date(v.fechaVencimiento);
        const diasAviso = v.diasAviso || 30;
        const limiteAviso = new Date(fecha);
        limiteAviso.setDate(fecha.getDate() - diasAviso);

        if (fecha < hoy) {
          vencidos++;
          alertasArray.push({ id: `venc-${v.id}`, tipo: 'vencimiento', gravedad: 'roja', titulo: `${v.tipo} vencido`, fecha: v.fechaVencimiento, vehiculo: v.vehiculo });
        } else if (hoy >= limiteAviso) {
          proximosVencer++;
          alertasArray.push({ id: `venc-${v.id}`, tipo: 'vencimiento', gravedad: 'naranja', titulo: `${v.tipo} próximo (en <${diasAviso}d)`, fecha: v.fechaVencimiento, vehiculo: v.vehiculo });
        } else {
          ok++;
        }
      } 
      // 1.2 Alerta por KM (dentro de VencimientoVehiculo)
      else if (v.kmVencimiento) {
        const kmsFaltantes = v.kmVencimiento - v.vehiculo.kmActual;
        const aviso = v.kmAviso || 2000;

        if (kmsFaltantes <= 0) {
          vencidos++;
          alertasArray.push({ id: `venc-km-${v.id}`, tipo: 'vencimiento-km', gravedad: 'roja', titulo: `${v.tipo} Pasado (${Math.abs(kmsFaltantes)} km)`, vehiculo: v.vehiculo });
        } else if (kmsFaltantes <= aviso) {
          proximosVencer++;
          alertasArray.push({ id: `venc-km-${v.id}`, tipo: 'vencimiento-km', gravedad: 'naranja', titulo: `${v.tipo} en ${kmsFaltantes} km`, vehiculo: v.vehiculo });
        } else {
          ok++;
        }
      }
    });

    // 2. Vencimientos Choferes (Licencias)
    choferDocs.forEach((doc: any) => {
      if (!doc.fechaVencimiento) return;
      const fecha = new Date(doc.fechaVencimiento);
      const diasAviso = doc.diasAviso || 30;
      
      const limiteAviso = new Date(fecha);
      limiteAviso.setDate(fecha.getDate() - diasAviso);

      if (fecha < hoy) {
        alertasArray.push({ id: `chofer-${doc.id}`, tipo: 'chofer', gravedad: 'roja', titulo: `Licencia Vencida: ${doc.empleado.nombre} ${doc.empleado.apellido}`, fecha: doc.fechaVencimiento });
      } else if (hoy >= limiteAviso) {
        alertasArray.push({ id: `chofer-${doc.id}`, tipo: 'chofer', gravedad: 'naranja', titulo: `Licencia por vencer: ${doc.empleado.nombre} ${doc.empleado.apellido}`, fecha: doc.fechaVencimiento });
      }
    });

    // 3. Mantenimientos por KM
    vehiculos.forEach((v: any) => {
      if (v.kmProximoService) {
        const kmsFaltantes = v.kmProximoService - v.kmActual;
        const aviso = v.avisoKmsAntes || 2000;
        
        if (kmsFaltantes <= 0) {
          alertasArray.push({ id: `km-${v.id}`, tipo: 'km', gravedad: 'roja', titulo: `Demorado de Service (${Math.abs(kmsFaltantes)} km)`, vehiculo: v });
        } else if (kmsFaltantes <= aviso) {
          alertasArray.push({ id: `km-${v.id}`, tipo: 'km', gravedad: 'naranja', titulo: `Service en ${kmsFaltantes} km`, vehiculo: v });
        }
      }
    });

    const alertas = alertasArray.sort((a, b) => {
      if (a.gravedad === 'roja' && b.gravedad !== 'roja') return -1;
      if (b.gravedad === 'roja' && a.gravedad !== 'roja') return 1;
      return 0; // sort by gravity
    }).slice(0, 8); // Top 8 alertas

    return NextResponse.json({
      totalVehiculos,
      vehiculosActivos,
      vencimientosStats: {
        vencidos,
        proximosVencer,
        ok,
        total: vencimientos.length
      },
      alertas
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
