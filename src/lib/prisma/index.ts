import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Middleware para atualizar updated_at automaticamente
prisma.$use(async (params, next) => {
  if (params.model && ['Deck', 'Profile'].includes(params.model)) {
    if (params.action === 'update' || params.action === 'updateMany') {
      params.args.data.updatedAt = new Date()
    }
  }
  return next(params)
})