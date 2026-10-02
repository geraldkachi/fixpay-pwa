
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { paymentsService } from '@/lib/services/payments.service'
import { queryClient } from '@/lib/query-client'
import { useAuthStore } from '@/store/auth.store'
import { Spinner } from '@/components/ui/Spinner'

type Phase = 'verifying' | 'success' | 'failed'

export function PaymentCallbackScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [phase, setPhase] = useState<Phase>('verifying')
  const [message, setMessage] = useState('Verifying your payment…')
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true

    const run = async () => {
      // Extract vtpayment_id from the URL
      const raw =
        params.get('vtpayment_id') ||
        params.get('vtpaymentId') ||
        params.get('payment_id') ||
        params.get('reference') ||
        params.get('payment_reference') ||
        ''
      const vtpaymentId = raw.split('?')[0].split('&')[0].trim()

      const ctxRaw = sessionStorage.getItem('pending_payment')
      const ctx = ctxRaw ? JSON.parse(ctxRaw) : null

      const finalId = vtpaymentId || ctx?.payment_reference
      if (!finalId) {
        setPhase('failed')
        setMessage('Missing payment reference.')
        setTimeout(() => navigate('/wallet', { replace: true }), 2000)
        return
      }

      try {
  await new Promise(r => setTimeout(r, 1500))
  const ack = await paymentsService.webhookConfirm(finalId)

  if (!ack.ok) {
    setPhase('failed')
    setMessage(ack.message || 'Payment could not be verified.')
    setTimeout(() => navigate('/wallet', { replace: true }), 2200)
    return
  }

  await queryClient.invalidateQueries({ queryKey: ['wallet'] })
  await queryClient.invalidateQueries({ queryKey: ['transactions'] })

  sessionStorage.removeItem('pending_payment')

  setPhase('success')
  setMessage('Payment successful')

  // ⬇️ prevents RequireAuth from bouncing to /splash on the way to /wallet
  sessionStorage.setItem('splash_shown', '1')

  setTimeout(() => navigate('/wallet', { replace: true }), 1600)
} catch (err: any) {
  const status = err?.response?.status

  if (status === 401 || status === 403) {
    setPhase('failed')
    setMessage('Session expired. Please log in again.')
    sessionStorage.removeItem('pending_payment')
    setTimeout(() => {
      useAuthStore.getState().logout()
      navigate('/auth/login', { replace: true })
    }, 1500)
    return
  }

  setPhase('failed')
  setMessage(err?.response?.data?.message || 'Could not verify payment.')
  setTimeout(() => navigate('/wallet', { replace: true }), 2200)
}

    //   try {
    //     // Give Payfixy a moment to settle
    //     await new Promise(r => setTimeout(r, 1500))

    //     const ack = await paymentsService.webhookConfirm(finalId)

    //     if (!ack.ok) {
    //       setPhase('failed')
    //       setMessage(ack.message || 'Payment could not be verified.')
    //       setTimeout(() => navigate('/wallet', { replace: true }), 2200)
    //       return
    //     }

    //     // Refresh cached data so /wallet reflects the new transaction
    //     await queryClient.invalidateQueries({ queryKey: ['wallet'] })
    //     await queryClient.invalidateQueries({ queryKey: ['transactions'] })

    //     sessionStorage.removeItem('pending_payment')

    //     // Show success animation briefly, then drop into the wallet list
    //     setPhase('success')
    //     setMessage('Payment successful')
    //     setTimeout(() => navigate('/wallet', { replace: true }), 1600)
    //   } catch (err: any) {
    //     const status = err?.response?.status

    //     if (status === 401 || status === 403) {
    //       setPhase('failed')
    //       setMessage('Session expired. Please log in again.')
    //       sessionStorage.removeItem('pending_payment')
    //       setTimeout(() => {
    //         useAuthStore.getState().logout()
    //         navigate('/auth/login', { replace: true })
    //       }, 1500)
    //       return
    //     }

    //     setPhase('failed')
    //     setMessage(err?.response?.data?.message || 'Could not verify payment.')
    //     setTimeout(() => navigate('/wallet', { replace: true }), 2200)
    //   }
    }
    run()
  }, [navigate, params])

  return (
    <div className="flex flex-col items-center justify-center h-[100dvh] bg-[#F2F2F7] gap-4 px-6">
      {phase === 'verifying' && (
        <>
          <Spinner />
          <p className="text-[14px] text-gray-500">{message}</p>
        </>
      )}

      {phase === 'success' && (
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 15, stiffness: 200 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', damping: 12 }}
          >
            <CheckCircleIcon className="w-24 h-24 text-green-500" />
          </motion.div>
          <h2 className="text-[22px] font-bold text-gray-900">Payment Successful</h2>
          <p className="text-[14px] text-gray-500 text-center">
            Your transaction has been completed. Taking you to your wallet…
          </p>
        </motion.div>
      )}

      {phase === 'failed' && (
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
            <span className="text-4xl">⚠️</span>
          </div>
          <h2 className="text-[20px] font-bold text-gray-900">Payment Issue</h2>
          <p className="text-[14px] text-gray-500 text-center">{message}</p>
        </div>
      )}
    </div>
  )
}

// import { useEffect, useRef, useState } from 'react'
// import { useNavigate, useSearchParams } from 'react-router-dom'
// import { paymentsService } from '@/lib/services/payments.service'
// import { queryClient } from '@/lib/query-client'
// import { resolveVtpassCode } from '@/lib/vtpass-codes'
// import { Spinner } from '@/components/ui/Spinner'

// /**
//  * Universal gateway return handler.
//  *
//  * Payfixy (and others) redirect the user here with:
//  *   /payments/callback?vtpayment_id=<id>
//  *
//  * We hit the backend webhook with NO body — that triggers server-side
//  * requery + wallet reconciliation — then route to receipt/pending/failed.
//  */
// export function PaymentCallbackScreen() {
//   const navigate = useNavigate()
//   const [params] = useSearchParams()
//   const [message, setMessage] = useState('Verifying your payment…')
//   const fired = useRef(false)

//   useEffect(() => {
//     if (fired.current) return
//     fired.current = true

//     const run = async () => {
//       const vtpaymentId =
//         params.get('vtpayment_id') ||
//         params.get('vtpaymentId') ||
//         params.get('payment_id') ||
//         params.get('reference') ||
//         params.get('payment_reference')

//       // Context saved by AirtimeScreen before redirect
//       const raw = sessionStorage.getItem('pending_payment')
//       const ctx = raw ? JSON.parse(raw) : null

//       if (!vtpaymentId && !ctx?.payment_reference) {
//         navigate('/payments/failed', { replace: true })
//         return
//       }

//       try {
//         // Give Payfixy ~2s to settle before we requery
//         await new Promise(r => setTimeout(r, 2000))

//         // POST with no body — the query param is the only input
//         const res = await paymentsService.webhookConfirm(
//           vtpaymentId || ctx.payment_reference
//         )

//         queryClient.invalidateQueries({ queryKey: ['wallet'] })
//         queryClient.invalidateQueries({ queryKey: ['transactions'] })

//         const outcome = resolveVtpassCode(res.vtpass_code)
//         const statePayload = {
//           type: ctx?.type ?? 'airtime',
//           network: ctx?.network,
//           phone: ctx?.phone,
//           amount_kobo: res.amount_kobo || ctx?.amount_kobo,
//           requestId: res.payment_reference || ctx?.payment_reference,
//           date: new Date().toISOString(),
//         }

//         sessionStorage.removeItem('pending_payment')

//         if (res.status === 'pending' || outcome.isPending) {
//           navigate('/payments/pending', { state: statePayload, replace: true })
//         } else if (res.status === 'failed') {
//           navigate('/payments/failed', { state: statePayload, replace: true })
//         } else {
//           navigate('/payments/receipt', { state: statePayload, replace: true })
//         }
//       } catch (err: any) {
//         setMessage(err?.response?.data?.message || 'Could not verify payment.')
//         // Let the user retry manually or go home
//         setTimeout(() => navigate('/home', { replace: true }), 2500)
//       }
//     }
//     run()
//   }, [navigate, params])

//   return (
//     <div className="flex flex-col items-center justify-center h-[100dvh] bg-[#F2F2F7] gap-4">
//       <Spinner />
//       <p className="text-[14px] text-gray-500">{message}</p>
//     </div>
//   )
// }