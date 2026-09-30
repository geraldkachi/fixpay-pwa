import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { paymentsService } from '@/lib/services/payments.service'
import { queryClient } from '@/lib/query-client'
import { resolveVtpassCode } from '@/lib/vtpass-codes'
import { Spinner } from '@/components/ui/Spinner'

/**
 * Universal gateway return handler.
 *
 * Payfixy (and others) redirect the user here with:
 *   /payments/callback?vtpayment_id=<id>
 *
 * We hit the backend webhook with NO body — that triggers server-side
 * requery + wallet reconciliation — then route to receipt/pending/failed.
 */
export function PaymentCallbackScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [message, setMessage] = useState('Verifying your payment…')
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true

    const run = async () => {
      const vtpaymentId =
        params.get('vtpayment_id') ||
        params.get('vtpaymentId') ||
        params.get('payment_id') ||
        params.get('reference') ||
        params.get('payment_reference')

      // Context saved by AirtimeScreen before redirect
      const raw = sessionStorage.getItem('pending_payment')
      const ctx = raw ? JSON.parse(raw) : null

      if (!vtpaymentId && !ctx?.payment_reference) {
        navigate('/payments/failed', { replace: true })
        return
      }

      try {
        // Give Payfixy ~2s to settle before we requery
        await new Promise(r => setTimeout(r, 2000))

        // POST with no body — the query param is the only input
        const res = await paymentsService.webhookConfirm(
          vtpaymentId || ctx.payment_reference
        )

        queryClient.invalidateQueries({ queryKey: ['wallet'] })
        queryClient.invalidateQueries({ queryKey: ['transactions'] })

        const outcome = resolveVtpassCode(res.vtpass_code)
        const statePayload = {
          type: ctx?.type ?? 'airtime',
          network: ctx?.network,
          phone: ctx?.phone,
          amount_kobo: res.amount_kobo || ctx?.amount_kobo,
          requestId: res.payment_reference || ctx?.payment_reference,
          date: new Date().toISOString(),
        }

        sessionStorage.removeItem('pending_payment')

        if (res.status === 'pending' || outcome.isPending) {
          navigate('/payments/pending', { state: statePayload, replace: true })
        } else if (res.status === 'failed') {
          navigate('/payments/failed', { state: statePayload, replace: true })
        } else {
          navigate('/payments/receipt', { state: statePayload, replace: true })
        }
      } catch (err: any) {
        setMessage(err?.response?.data?.message || 'Could not verify payment.')
        // Let the user retry manually or go home
        setTimeout(() => navigate('/home', { replace: true }), 2500)
      }
    }
    run()
  }, [navigate, params])

  return (
    <div className="flex flex-col items-center justify-center h-[100dvh] bg-[#F2F2F7] gap-4">
      <Spinner />
      <p className="text-[14px] text-gray-500">{message}</p>
    </div>
  )
}