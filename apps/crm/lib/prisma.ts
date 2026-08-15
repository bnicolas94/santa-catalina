import { PrismaClient } from '@/generated/prisma'

const globalForCrmPrisma = globalThis as unknown as { crmPrisma?: PrismaClient }

export const crmPrisma = globalForCrmPrisma.crmPrisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForCrmPrisma.crmPrisma = crmPrisma
