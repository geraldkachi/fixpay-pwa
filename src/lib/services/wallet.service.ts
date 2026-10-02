import { api } from '@/lib/api'
import { saveTransactions, loadTransactions, loadTransaction } from '@/lib/db'
import type { Wallet, Transaction, TxType } from '@/types'

export type TxStatus = 'initiated' | 'processing' | 'pending' | 'completed' | 'failed' | 'reversed'
export interface CreateWalletPayload {
  image: File | Blob           // ← NEW: profile/KYC image
  bvn: string                  // ← NEW: Bank Verification Number
  nin: string                  // ← NEW: National Identity Number
  accountName: string          // ← NEW: account holder name
  dateOfBirth: string
  gender: number
  lastName: string
  otherNames: string
  phoneNo: string
  transactionTrackingRef: string
  placeOfBirth: string
  address: string
  ninUserId: string
  nextOfKinPhoneNo: string
  nextOfKinName: string
  email: string
}

export interface WalletBalanceResponse {
  id: string
  user_id: string
  tenant_id: string | null
  balance_kobo: number
  ledger_balance_kobo: number
  currency: string
  status: string
  virtual_account_number: string | null
  virtual_account_bank: string | null
  virtual_account_bank_code: string | null
  virtual_account_reference: string | null
  updated_at?: string
  created_at?: string
}

export interface FundWalletPayload {
  amount: number   // in NGN (naira), NOT kobo — e.g. 1850 = ₦1,850
}

export interface FundWalletResponse {
  payment_url: string
  access_code: string
  reference: string
}



function toWallet(b: any): Wallet {
  let balanceKobo = 0
  if (b.balance_kobo !== undefined && b.balance_kobo !== null) {
    balanceKobo = Number(b.balance_kobo)
  } else if (b.balanceKobo !== undefined && b.balanceKobo !== null) {
    balanceKobo = Number(b.balanceKobo)
  } else if (b.availableBalance !== undefined && b.availableBalance !== null) {
    balanceKobo = Math.round(Number(b.availableBalance) * 100)
  }

  const virtualAccount = b.virtualAccount || {
    accountNumber: b.virtual_account_number ?? '',
    bankName: b.virtual_account_bank ?? '',
    bankCode: b.virtual_account_bank_code ?? '',
  }

  return {
    id: b.id ?? b.walletId ?? b.user_id,
    balanceKobo,
    currency: b.currency ?? 'NGN',
    status: (b.status ?? 'active').toLowerCase() as Wallet['status'],
    virtualAccount: {
      accountNumber: virtualAccount.accountNumber ?? '',
      bankName: virtualAccount.bankName ?? '',
      bankCode: virtualAccount.bankCode ?? '',
    },
  }
}

// function toTransaction(tx: any): Transaction {
//   let type: TxType = 'transfer_out'
//   if (tx.type) {
//     type = tx.type
//   } else if (tx.entry_type) {
//     if (tx.entry_type === 'credit') {
//       const desc = (tx.description ?? '').toLowerCase()
//       if (desc.includes('fund') || desc.includes('deposit') || desc.includes('topup')) {
//         type = 'wallet_funding'
//       } else {
//         type = 'transfer_in'
//       }
//     } else {
//       const desc = (tx.description ?? '').toLowerCase()
//       if (desc.includes('bill') || desc.includes('purchase') || desc.includes('airtime') || desc.includes('data') || desc.includes('power') || desc.includes('tv') || desc.includes('insurance') || desc.includes('education')) {
//         type = 'bill_payment'
//       } else {
//         type = 'transfer_out'
//       }
//     }
//   }

//   let serviceId = tx.serviceId ?? tx.service_id
//   let serviceName = tx.serviceName ?? tx.service_name
//   if (!serviceId && type === 'bill_payment') {
//     const desc = (tx.description ?? '').toLowerCase()
//     if (desc.includes('airtime')) {
//       serviceId = 'airtime'
//       serviceName = 'Airtime'
//     } else if (desc.includes('data')) {
//       serviceId = 'data'
//       serviceName = 'Data'
//     } else if (desc.includes('dstv') || desc.includes('gotv') || desc.includes('startimes') || desc.includes('showmax') || desc.includes('tv')) {
//       serviceId = 'tv'
//       serviceName = 'TV'
//     } else if (desc.includes('electricity') || desc.includes('power') || desc.includes('meter')) {
//       serviceId = 'electricity'
//       serviceName = 'Electricity'
//     }
//   }

//   return {
//     id: tx.id,
//     type,
//     amountKobo: tx.amountKobo ?? tx.amount_kobo ?? 0,
//     feeKobo: tx.feeKobo ?? tx.fee_kobo ?? 0,
//     status: tx.status ?? 'completed',
//     reference: tx.reference ?? tx.correlation_id ?? tx.id,
//     description: tx.description ?? '',
//     counterpartyName: tx.counterpartyName ?? tx.counterparty_name,
//     serviceId,
//     serviceName,
//     token: tx.token,
//     units: tx.units,
//     Pin: tx.Pin ?? tx.pin,
//     purchased_code: tx.purchased_code ?? tx.purchasedCode,
//     createdAt: tx.createdAt ?? tx.created_at ?? new Date().toISOString(),
//   }
// }
function toTransaction(tx: any): Transaction {
  const serviceIdRaw = tx.service_id ?? tx.serviceId ?? null

  // Map backend payment_status → your TxStatus
  const rawStatus = (tx.payment_status ?? tx.status ?? 'completed').toLowerCase()
  const statusMap: Record<string, TxStatus> = {
    completed:  'completed',
    processing: 'processing',
    pending:    'pending',
    initiated:  'initiated',
    failed:     'failed',
    reversed:   'reversed',
  }
  const status: TxStatus = statusMap[rawStatus] ?? 'completed'

  // Infer type from service_id (bill_payment) unless wallet/transfer keywords
  let type: TxType = 'bill_payment'
  const sid = (serviceIdRaw ?? '').toLowerCase()
  if (sid === 'wallet_funding' || sid === 'wallet') type = 'wallet_funding'
  else if (sid === 'transfer_in')  type = 'transfer_in'
  else if (sid === 'transfer_out') type = 'transfer_out'
  else if (!sid && tx.entry_type === 'credit') type = 'transfer_in'
  else if (!sid && tx.entry_type === 'debit')  type = 'transfer_out'

  // Build description from response_payload when present
  const productName = tx.response_payload?.content?.transactions?.product_name
  const providerDesc = tx.response_payload?.response_description
  const description =
    tx.description ??
    productName ??
    (sid ? `${sid.toUpperCase()} Purchase` : (providerDesc ?? 'Transaction'))

  // Extract token/units from response_payload if top-level missing
  const rTx = tx.response_payload?.content?.transactions
  const token = tx.token ?? rTx?.token ?? tx.purchased_code
  const units = tx.units ?? rTx?.units

  return {
    id: tx.id,
    type,
    amountKobo: tx.amount_kobo ?? tx.amountKobo ?? 0,
    feeKobo:    tx.fee_kobo    ?? tx.feeKobo    ?? 0,
    status,
    reference:  tx.payment_reference ?? tx.reference ?? tx.correlation_id ?? tx.id,
    description,
    counterpartyName: tx.phone ?? tx.counterpartyName ?? tx.counterparty_name,
    serviceId:  serviceIdRaw ?? undefined,
    serviceName: tx.serviceName ?? tx.service_name,
    token: token ?? undefined,
    units: units ?? undefined,
    Pin: tx.Pin ?? tx.pin,
    purchased_code: tx.purchased_code ?? tx.purchasedCode,
    createdAt: tx.created_at ?? tx.createdAt ?? new Date().toISOString(),
  }
}

export interface TransactionPage {
  content: Transaction[]
  totalElements: number
  totalPages: number
  number: number
}

export const walletService = {
  //  POST /wallet/create — Create a new wallet
  createWallet: (payload: CreateWalletPayload): Promise<Wallet> => {
  const formData = new FormData()

  // File field
  formData.append('image', payload.image)

  // Text fields — all values must be strings in FormData
  formData.append('bvn', payload.bvn)
  formData.append('nin', payload.nin)
  formData.append('accountName', payload.accountName)
  formData.append('dateOfBirth', payload.dateOfBirth)
  formData.append('gender', String(payload.gender))
  formData.append('lastName', payload.lastName)
  formData.append('otherNames', payload.otherNames)
  formData.append('phoneNo', payload.phoneNo)
  formData.append('transactionTrackingRef', payload.transactionTrackingRef)
  formData.append('placeOfBirth', payload.placeOfBirth)
  formData.append('address', payload.address)
  formData.append('ninUserId', payload.ninUserId)
  formData.append('nextOfKinPhoneNo', payload.nextOfKinPhoneNo)
  formData.append('nextOfKinName', payload.nextOfKinName)
  formData.append('email', payload.email)

  return api.post<{ status: boolean; message: string; data: WalletBalanceResponse }>(
    '/wallet/create',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  ).then(r => {
    const response = r.data as { status: boolean; message: string; data: WalletBalanceResponse }
    if (!response.status) {
      throw new Error(response.message || 'Failed to create wallet')
    }
    return toWallet(response.data)
  })
},
  // createWallet: (payload: CreateWalletPayload): Promise<Wallet> =>
  //   api.post<{ status: boolean; message: string; data: WalletBalanceResponse }>(
  //     '/wallet/create',
  //     payload
  //   ).then(r => {
  //     const response = r.data as { status: boolean; message: string; data: WalletBalanceResponse }
  //     if (!response.status) {
  //       throw new Error(response.message || 'Failed to create wallet')
  //     }
  //     return toWallet(response.data)
  //   }),

  /**
   * GET /wallet — wrapped in ApiResponse<WalletBalanceResponse>.
   * Backend returns balance_kobo (integer kobo), NOT a float NGN value.
   */
  getBalance: (): Promise<Wallet> =>
    api.get<{ success: boolean; data: WalletBalanceResponse } | WalletBalanceResponse>('/wallet').then(r => {
      const payload = r.data as { success?: boolean; data?: WalletBalanceResponse }
      if (payload.success !== undefined && payload.data) {
        return toWallet(payload.data)
      }
      // direct shape (no ApiResponse wrapper)
      return toWallet(r.data as WalletBalanceResponse)
    }),

    /**
   * POST /wallet/fund — Initiates a funding session.
   * Returns a payment_url the client must redirect the user to.
   *
   * NOTE: `amount` is sent in NGN (naira), not kobo.
   * The backend example shows `{ "amount": 1850 }` for ₦1,850.
   */
  fundWallet: (payload: FundWalletPayload): Promise<FundWalletResponse> =>
    api
      .post<FundWalletResponse>('/wallet/fund', payload)
      .then(r => {
        const data = r.data as FundWalletResponse
        if (!data?.payment_url) {
          throw new Error('Failed to initiate funding — no payment URL returned')
        }
        return data
      }),

  /**
   * GET /wallet/transactions?page&size&type
   *
   * On success  → writes to encrypted IndexedDB then returns fresh data.
   * On network failure → falls back to the locally cached (encrypted) copy.
   */
  getTransactions: async (page = 0, size = 50, type?: string): Promise<TransactionPage> => {
    const params = new URLSearchParams({ page: String(page), size: String(size) })
    if (type) params.set('type', type)
       try {
    const r = await api.get<any>(`/transaction/history?${params}`)
    const raw = r.data

    // Unwrap: { success, data: {...} }  OR  { transactions: {...} }  OR  {...}
    let inner: any
    if (raw?.success !== undefined && raw.data) inner = raw.data
    else if (raw?.transactions) inner = raw.transactions
    else inner = raw

    const rawContent: any[] =
      inner?.data ??          // ← Laravel pagination uses .data
      inner?.content ??
      (Array.isArray(inner) ? inner : [])

    const content = rawContent.map(toTransaction)
    const totalElements = inner?.total ?? inner?.totalElements ?? content.length
    const totalPages    = inner?.last_page ?? inner?.totalPages ?? 1
    const number        = (inner?.current_page ?? inner?.number ?? 1) - 1

    const pageData: TransactionPage = { content, totalElements, totalPages, number }

    if (pageData.content.length) saveTransactions(pageData.content).catch(() => undefined)
    return pageData
  }

    // try {
    //   const r = await api.get<{ success?: boolean; data?: TransactionPage } | TransactionPage>(
    //     `/transaction/history?${params}`
    //   )
    //   const rawData = r.data as any
    //   const innerData = (rawData.success !== undefined && rawData.data) ? rawData.data : rawData

    //   const rawContent = innerData.content ?? innerData.data ?? []
    //   const content = Array.isArray(rawContent) ? rawContent.map(toTransaction) : []
    //   const totalElements = innerData.totalElements ?? innerData.total ?? 0
    //   const totalPages = innerData.totalPages ?? innerData.last_page ?? 0
    //   const number = innerData.number ?? innerData.current_page ?? 0

    //   const page_data: TransactionPage = {
    //     content,
    //     totalElements,
    //     totalPages,
    //     number,
    //   }

    //   // Persist to encrypted IndexedDB for offline access
    //   if (page_data.content?.length) {
    //     saveTransactions(page_data.content).catch(() => undefined) // fire-and-forget
    //   }

    //   return page_data
    // } 
    catch (err) {
      // Network / server failure → serve from encrypted local cache
      const cached = await loadTransactions()
      if (cached.length > 0) {
        const slice = cached.slice(page * size, page * size + size)
        return {
          content: slice,
          totalElements: cached.length,
          totalPages: Math.ceil(cached.length / size),
          number: page,
        }
      }
      throw err // cache empty — surface the original error
    }
  },
  // getTransactions: async (page = 0, size = 50, type?: string): Promise<TransactionPage> => {
  //   const params = new URLSearchParams({ page: String(page), size: String(size) })
  //   if (type) params.set('type', type)

  //   try {
  //     const r = await api.get<{ success?: boolean; data?: TransactionPage } | TransactionPage>(
  //       `/wallet/transactions?${params}`
  //     )
  //     const rawData = r.data as any
  //     const innerData = (rawData.success !== undefined && rawData.data) ? rawData.data : rawData

  //     const rawContent = innerData.content ?? innerData.data ?? []
  //     const content = Array.isArray(rawContent) ? rawContent.map(toTransaction) : []
  //     const totalElements = innerData.totalElements ?? innerData.total ?? 0
  //     const totalPages = innerData.totalPages ?? innerData.last_page ?? 0
  //     const number = innerData.number ?? innerData.current_page ?? 0

  //     const page_data: TransactionPage = {
  //       content,
  //       totalElements,
  //       totalPages,
  //       number,
  //     }

  //     // Persist to encrypted IndexedDB for offline access
  //     if (page_data.content?.length) {
  //       saveTransactions(page_data.content).catch(() => undefined) // fire-and-forget
  //     }

  //     return page_data
  //   } catch (err) {
  //     // Network / server failure → serve from encrypted local cache
  //     const cached = await loadTransactions()
  //     if (cached.length > 0) {
  //       const slice = cached.slice(page * size, page * size + size)
  //       return {
  //         content: slice,
  //         totalElements: cached.length,
  //         totalPages: Math.ceil(cached.length / size),
  //         number: page,
  //       }
  //     }
  //     throw err // cache empty — surface the original error
  //   }
  // },

  /**
   * GET /wallet/transactions/:id
   *
   * Tries the network first; falls back to the encrypted IndexedDB row.
   */
  getTransaction: async (id: string): Promise<Transaction> => {
    try {
      const r = await api.get<{ success?: boolean; data?: Transaction } | Transaction>(
        `/wallet/transactions/${id}`
      )
      const payload = r.data as { success?: boolean; data?: any }
      const rawTx =
        payload.success !== undefined && payload.data
          ? payload.data
          : (r.data as any)
      const tx = toTransaction(rawTx)

      // Keep the local cache up-to-date
      saveTransactions([tx]).catch(() => undefined)
      return tx
    } catch (err) {
      const cached = await loadTransaction(id)
      if (cached) return cached
      throw err
    }
  },
}
