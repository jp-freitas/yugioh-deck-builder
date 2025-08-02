import { z } from 'zod'

const CardSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.string(),
  desc: z.string(),
  card_prices: z.array(z.object({
    cardmarket_price: z.string(),
    tcgplayer_price: z.string(),
    ebay_price: z.string(),
    amazon_price: z.string(),
    coolstuffinc_price: z.string()
  }))
})

export type Card = z.infer<typeof CardSchema>

class YuGiOhAPI {
  private baseURL = 'https://db.ygoprodeck.com/api/v7'
  private cache = new Map<string, { data: unknown, timestamp: number }>()
  private CACHE_DURATION = 5 * 60 * 1000 // 5 minutos

  async searchCards(query: string): Promise<Card[]> {
    const cacheKey = `search:${query}`
    const cached = this.getFromCache(cacheKey)
    
    if (cached) return cached as Card[]

    try {
      const response = await fetch(
        `${this.baseURL}/cardinfo.php?fname=${encodeURIComponent(query)}`,
        { next: { revalidate: 300 } } // Cache Next.js de 5 min
      )
      
      if (!response.ok) throw new Error('Failed to fetch cards')
      
      const data = await response.json()
      const cards = z.array(CardSchema).parse(data.data)
      
      this.setCache(cacheKey, cards)
      return cards
    } catch (error) {
      console.error('Error fetching cards:', error)
      return []
    }
  }

  private getFromCache(key: string) {
    const cached = this.cache.get(key)
    if (!cached) return null
    
    if (Date.now() - cached.timestamp > this.CACHE_DURATION) {
      this.cache.delete(key)
      return null
    }
    
    return cached.data
  }

  private setCache(key: string, data: unknown) {
    this.cache.set(key, { data, timestamp: Date.now() })
  }
}

export const yugiohAPI = new YuGiOhAPI()