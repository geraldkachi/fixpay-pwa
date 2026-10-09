import { api } from '@/lib/api'
import type { Transaction } from '@/types'

// New response shape from GET /favourites
export interface FrequentPayment {
  id: string
  service_id: string
  amount_kobo: number
  times_done: number
  payment_reference: string
  counterparty_name: string
  description?: string
  service_name?: string
  type: string
  created_at: string
}

interface FrequentPaymentsResponse {
  transactions: FrequentPayment[]
}

export const favouriteService = {
  getFavourites: async (): Promise<FrequentPayment[]> => {
    const res = await api.get<FrequentPaymentsResponse>('/transaction/favourites')
    return res.data.transactions ?? []
  },

  // POST body likely unchanged — verify against backend
  saveFavourite: async (tx: Transaction): Promise<void> => {
    await api.post('/transaction/favourites', {
      type: tx.type,
      service_id: tx.serviceId,
      service_name: tx.serviceName,
      counterparty_name: tx.counterpartyName || 'Unknown',
      description: tx.description,
      amount_kobo: tx.amountKobo,
      transaction_reference: tx.reference,
    })
  },

  // Delete now needs service_id + amount_kobo, not an id
  deleteFavourite: async (serviceId: string, amountKobo: number): Promise<void> => {
    await api.delete('/transaction/favourites', {
      params: { service_id: serviceId, amount_kobo: amountKobo },
    })
  },
}

// import { api } from '@/lib/api'
// import type { Transaction } from '@/types'

// export interface FavouritePayload {
//   id: string
//   type: string
//   service_id?: string
//   service_name?: string
//   counterparty_name: string
//   description?: string
//   amount_kobo?: number
//   transaction_reference?: string
// }

// export const favouriteService = {
//   getFavourites: async (): Promise<FavouritePayload[]> => {
//     const res = await api.get<{ data: FavouritePayload[] }>('/transaction/favourites')
//     return res.data.data
//   },

//   saveFavourite: async (tx: Transaction): Promise<FavouritePayload> => {
//     const payload = {
//       type: tx.type,
//       service_id: tx.serviceId,
//       service_name: tx.serviceName,
//       counterparty_name: tx.counterpartyName || 'Unknown',
//       description: tx.description,
//       amount_kobo: tx.amountKobo,
//       transaction_reference: tx.reference,
//     }
//     const res = await api.post<{ data: FavouritePayload }>('/transaction/favourites', payload)
//     return res.data.data
//   },

//   deleteFavourite: async (id: string): Promise<void> => {
//     await api.delete(`/transaction/favourites/${id}`)
//   }
// }
