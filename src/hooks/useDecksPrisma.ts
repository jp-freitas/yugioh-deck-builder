import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { CreateDeckSchema, UpdateDeckSchema, AddCardToDeckSchema } from '@/lib/repositories/deck.repository'
import type { z } from 'zod'

export function useDecksPrisma() {
  const queryClient = useQueryClient()

  // Query para listar decks
  const { data: decks, isLoading } = useQuery({
    queryKey: ['decks'],
    queryFn: async () => {
      const response = await fetch('/api/decks')
      if (!response.ok) throw new Error('Failed to fetch decks')
      return response.json()
    }
  })

  // Mutation para criar deck
  const createDeck = useMutation({
    mutationFn: async (data: z.infer<typeof CreateDeckSchema>) => {
      const response = await fetch('/api/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!response.ok) throw new Error('Failed to create deck')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decks'] })
      toast.success('Deck criado com sucesso!')
    },
    onError: () => {
      toast.error('Erro ao criar deck')
    }
  })

  // Mutation para adicionar carta
  const addCardToDeck = useMutation({
    mutationFn: async ({ 
      deckId, 
      card 
    }: { 
      deckId: string, 
      card: z.infer<typeof AddCardToDeckSchema> 
    }) => {
      const response = await fetch(`/api/decks/${deckId}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(card)
      })
      if (!response.ok) throw new Error('Failed to add card')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decks'] })
      toast.success('Carta adicionada ao deck!')
    },
    onError: (error: unknown) => {
      const message = (typeof error === 'object' && error !== null && 'message' in error)
        ? (error as { message: string }).message
        : 'Erro ao adicionar carta'
      toast.error(message)
    }
  })

  return {
    decks,
    isLoading,
    createDeck,
    addCardToDeck
  }
}