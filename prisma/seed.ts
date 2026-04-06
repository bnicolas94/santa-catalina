import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Iniciando seed de la base de datos...')

    // ---- Empleado Admin ----
    const passwordHash = await bcrypt.hash('admin123', 10)
    const admin = await prisma.empleado.upsert({
        where: { email: 'admin@santacatalina.com' },
        update: {},
        create: {
            nombre: 'Administrador',
            email: 'admin@santacatalina.com',
            password: passwordHash,
            rol: 'ADMIN',
            telefono: '+54 9 11 0000-0000',
        },
    })
    console.log('✅ Empleado admin creado:', admin.email)

    // ---- Coordinador de producción ----
    const coordHash = await bcrypt.hash('coord123', 10)
    const coord = await prisma.empleado.upsert({
        where: { email: 'produccion@santacatalina.com' },
        update: {},
        create: {
            nombre: 'Juan Producción',
            email: 'produccion@santacatalina.com',
            password: coordHash,
            rol: 'COORD_PROD',
        },
    })
    console.log('✅ Coordinador creado:', coord.email)

    // ---- Proveedor ----
    const proveedor = await prisma.proveedor.create({
        data: {
            nombre: 'Distribuidora Norte',
            contacto: 'Carlos López',
            telefono: '+54 9 11 1111-1111',
            email: 'ventas@distnorte.com',
        },
    })
    console.log('✅ Proveedor creado:', proveedor.nombre)

    // ---- Insumos ----
    const panLactal = await prisma.insumo.create({
        data: {
            nombre: 'Pan lactal',
            unidadMedida: 'u',
            stockActual: 200,
            stockMinimo: 50,
            precioUnitario: 120,
            diasReposicion: 1,
            proveedorId: proveedor.id,
        },
    })

    const jamonCocido = await prisma.insumo.create({
        data: {
            nombre: 'Jamón cocido',
            unidadMedida: 'kg',
            stockActual: 15,
            stockMinimo: 5,
            precioUnitario: 4500,
            diasReposicion: 2,
            proveedorId: proveedor.id,
        },
    })

    const quesoBar = await prisma.insumo.create({
        data: {
            nombre: 'Queso en barra',
            unidadMedida: 'kg',
            stockActual: 10,
            stockMinimo: 4,
            precioUnitario: 3800,
            diasReposicion: 2,
            proveedorId: proveedor.id,
        },
    })

    const mayonesa = await prisma.insumo.create({
        data: {
            nombre: 'Mayonesa',
            unidadMedida: 'kg',
            stockActual: 3,
            stockMinimo: 2,
            precioUnitario: 2200,
            diasReposicion: 3,
        },
    })

    const manteca = await prisma.insumo.create({
        data: {
            nombre: 'Manteca',
            unidadMedida: 'kg',
            stockActual: 1.5,
            stockMinimo: 2,
            precioUnitario: 3500,
            diasReposicion: 2,
            proveedorId: proveedor.id,
        },
    })
    console.log('✅ 5 insumos creados')

    // ---- Producto: Jamón y Queso ----
    const jq = await prisma.producto.create({
        data: {
            nombre: 'Jamón y Queso',
            codigoInterno: 'JQ',
            planchasPorPaquete: 6,
            paquetesPorRonda: 14,
            vidaUtilHoras: 48,
            tempConservacionMax: 4,
        },
    })

    // Presentaciones de JQ
    await prisma.presentacion.createMany({
        data: [
            { productoId: jq.id, cantidad: 48, precioVenta: 27000 },
            { productoId: jq.id, cantidad: 24, precioVenta: 15000 },
            { productoId: jq.id, cantidad: 8, precioVenta: 6000 },
        ],
    })
    console.log('✅ Producto "Jamón y Queso" con 3 presentaciones (x48, x24, x8)')

    // ---- Ficha Técnica de JQ ----
    await prisma.fichaTecnica.createMany({
        data: [
            { productoId: jq.id, insumoId: panLactal.id, cantidadPorUnidad: 2, unidadMedida: 'u' },
            { productoId: jq.id, insumoId: jamonCocido.id, cantidadPorUnidad: 0.035, unidadMedida: 'kg' },
            { productoId: jq.id, insumoId: quesoBar.id, cantidadPorUnidad: 0.025, unidadMedida: 'kg' },
            { productoId: jq.id, insumoId: mayonesa.id, cantidadPorUnidad: 0.01, unidadMedida: 'kg' },
            { productoId: jq.id, insumoId: manteca.id, cantidadPorUnidad: 0.005, unidadMedida: 'kg' },
        ],
    })
    console.log('✅ Ficha técnica de JQ creada con 5 insumos')

    // ---- Producto: Especial (Triple) ----
    const esp = await prisma.producto.create({
        data: {
            nombre: 'Especial (Triple)',
            codigoInterno: 'ESP',
            planchasPorPaquete: 6,
            paquetesPorRonda: 14,
            vidaUtilHoras: 36,
            tempConservacionMax: 4,
        },
    })

    await prisma.presentacion.createMany({
        data: [
            { productoId: esp.id, cantidad: 48, precioVenta: 35000 },
            { productoId: esp.id, cantidad: 24, precioVenta: 19000 },
            { productoId: esp.id, cantidad: 8, precioVenta: 7500 },
        ],
    })
    console.log('✅ Producto "Especial (Triple)" con 3 presentaciones')

    // ---- Producto: Surtido Clásico ----
    const cla = await prisma.producto.create({
        data: {
            nombre: 'Surtido Clásico',
            codigoInterno: 'CLA',
            planchasPorPaquete: 6,
            paquetesPorRonda: 21,
            vidaUtilHoras: 48,
            tempConservacionMax: 4,
        },
    })

    await prisma.presentacion.createMany({
        data: [
            { productoId: cla.id, cantidad: 48, precioVenta: 30000 },
            { productoId: cla.id, cantidad: 24, precioVenta: 16000 },
            { productoId: cla.id, cantidad: 8, precioVenta: 6500 },
        ],
    })
    console.log('✅ Producto "Surtido Clásico" con 3 presentaciones')

    // ---- Producto: Elegidos (Personalizables) ----
    const ele = await prisma.producto.create({
        data: {
            nombre: 'Elegidos',
            codigoInterno: 'ELE',
            alias: 'tom, lechu, zyh, zyq, hue, ace, jyq, cho',
            planchasPorPaquete: 6,
            paquetesPorRonda: 14,
            vidaUtilHoras: 48,
        },
    })

    await prisma.presentacion.createMany({
        data: [
            { productoId: ele.id, cantidad: 48, precioVenta: 25500 },
            { productoId: ele.id, cantidad: 40, precioVenta: 21500 },
            { productoId: ele.id, cantidad: 32, precioVenta: 17500 },
            { productoId: ele.id, cantidad: 24, precioVenta: 13500 },
            { productoId: ele.id, cantidad: 16, precioVenta: 9500 },
            { productoId: ele.id, cantidad: 8, precioVenta: 4700 },
        ],
    })
    console.log('✅ Producto "Elegidos" con 6 presentaciones y 8 alias configurados')

    console.log('\n🎉 Seed completado!')
    console.log('📧 Login: admin@santacatalina.com / admin123')
    console.log('📧 Login: produccion@santacatalina.com / coord123')
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
