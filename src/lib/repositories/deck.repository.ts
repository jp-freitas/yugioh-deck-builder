import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

// Schemas de validação
export const CreateDeckSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
})

export const UpdateDeckSchema = CreateDeckSchema.partial()

export const AddCardToDeckSchema = z.object({
  cardId: z.number(),
  cardName: z.string(),
  cardType: z.string().optional(),
  cardRace: z.string().optional(),
  cardAttribute: z.string().optional(),
  cardLevel: z.number().optional(),
  cardAtk: z.number().optional(),
  cardDef: z.number().optional(),
  cardPrice: z.number(),
  cardImageUrl: z.string().optional(),
  quantity: z.number().min(1).max(3).default(1),
})

export class DeckRepository {
  // Buscar todos os decks do usuário
  async findAllByUserId(userId: string) {
    return prisma.deck.findMany({
      where: { userId },
      include: {
        cards: {
          orderBy: { cardName: 'asc' }
        },
        _count: {
          select: { cards: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  // Buscar deck por ID
  async findById(id: string, userId: string) {
    return prisma.deck.findFirst({
      where: { id, userId },
      include: {
        cards: {
          orderBy: { cardName: 'asc' }
        }
      }
    })
  }

  // Criar novo deck
  async create(userId: string, data: z.infer<typeof CreateDeckSchema>) {
    return prisma.deck.create({
      data: {
        ...data,
        userId
      }
    })
  }

  // Atualizar deck
  async update(id: string, userId: string, data: z.infer<typeof UpdateDeckSchema>) {
    return prisma.deck.updateMany({
      where: { id, userId },
      data
    })
  }

  // Deletar deck
  async delete(id: string, userId: string) {
    return prisma.deck.deleteMany({
      where: { id, userId }
    })
  }

  // Adicionar carta ao deck
  async addCard(deckId: string, userId: string, cardData: z.infer<typeof AddCardToDeckSchema>) {
    // Verificar se o deck pertence ao usuário
    const deck = await prisma.deck.findFirst({
      where: { id: deckId, userId }
    })

    if (!deck) {
      throw new Error('Deck not found')
    }

    // Verificar limite de 3 cartas
    const existingCard = await prisma.deckCard.findUnique({
      where: {
        deckId_cardId: {
          deckId,
          cardId: BigInt(cardData.cardId)
        }
      }
    })

    if (existingCard && existingCard.quantity >= 3) {
      throw new Error('Maximum 3 copies of the same card allowed')
    }

    // Usar transação para atualizar carta e recalcular totais
    return prisma.$transaction(async (tx) => {
      // Upsert da carta
      const card = await tx.deckCard.upsert({
        where: {
          deckId_cardId: {
            deckId,
            cardId: BigInt(cardData.cardId)
          }
        },
        update: {
          quantity: {
            increment: 1
          }
        },
        create: {
          deckId,
          cardId: BigInt(cardData.cardId),
          cardName: cardData.cardName,
          cardType: cardData.cardType,
          cardRace: cardData.cardRace,
          cardAttribute: cardData.cardAttribute,
          cardLevel: cardData.cardLevel,
          cardAtk: cardData.cardAtk,
          cardDef: cardData.cardDef,
          cardPrice: cardData.cardPrice,
          cardImageUrl: cardData.cardImageUrl,
          quantity: cardData.quantity
        }
      })

      // Recalcular totais
      await this.recalculateDeckTotals(tx, deckId)

      return card
    })
  }

  // Remover carta do deck
  async removeCard(deckId: string, userId: string, cardId: number) {
    const deck = await prisma.deck.findFirst({
      where: { id: deckId, userId }
    })

    if (!deck) {
      throw new Error('Deck not found')
    }

    return prisma.$transaction(async (tx) => {
      await tx.deckCard.delete({
        where: {
          deckId_cardId: {
            deckId,
            cardId: BigInt(cardId)
          }
        }
      })

      await this.recalculateDeckTotals(tx, deckId)
    })
  }

  // Atualizar quantidade de cartas
  async updateCardQuantity(deckId: string, userId: string, cardId: number, quantity: number) {
    if (quantity < 1 || quantity > 3) {
      throw new Error('Quantity must be between 1 and 3')
    }

    const deck = await prisma.deck.findFirst({
      where: { id: deckId, userId }
    })

    if (!deck) {
      throw new Error('Deck not found')
    }

    return prisma.$transaction(async (tx) => {
      await tx.deckCard.update({
        where: {
          deckId_cardId: {
            deckId,
            cardId: BigInt(cardId)
          }
        },
        data: { quantity }
      })

      await this.recalculateDeckTotals(tx, deckId)
    })
  }

  // Método privado para recalcular totais
  private async recalculateDeckTotals(tx: Prisma.TransactionClient, deckId: string) {
    const aggregation = await tx.deckCard.aggregate({
      where: { deckId },
      _sum: {
        quantity: true
      }
    })

    const cards = await tx.deckCard.findMany({
      where: { deckId }
    })

    const totalValue = cards.reduce((sum, card) => {
      return sum + (Number(card.cardPrice) * card.quantity)
    }, 0)

    await tx.deck.update({
      where: { id: deckId },
      data: {
        cardCount: aggregation._sum.quantity || 0,
        totalValue
      }
    })
  }
}

export const deckRepository = new DeckRepository()