import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { DocumentDuplicateIcon } from '@heroicons/react/24/outline'
import type { Wallet } from '@/types'
import { walletService } from '@/lib/services/wallet.service'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { vibrate } from '@/lib/utils'
import toast from 'react-hot-toast'

export function FundWalletScreen() {
  const navigate = useNavigate()
  const [amount, setAmount] = useState('')

  const { data: wallet } = useQuery<Wallet>({
    queryKey: ['wallet'],
    queryFn: () => walletService.getBalance(),
  })

  const acct = wallet?.virtualAccount?.accountNumber ?? '—'
  const bank = wallet?.virtualAccount?.bankName ?? ''

  const copy = () => {
    navigator.clipboard.writeText(acct)
    vibrate([10])
  }

  const { mutate: fundWallet, isPending } = useMutation({
    mutationFn: (amountNaira: number) =>
      walletService.fundWallet({ amount: amountNaira }),
    // onSuccess: (data) => {
    //   // Redirect the user to the payment widget
    //   // window.location.href = data.payment_url
    //   window.open(data.payment_url, '_blank');
    // },
    onSuccess: (data, _vars, context: any) => {
    if (context?.newTab && !context.newTab.closed) {
      context.newTab.location.href = data.payment_url
    } else {
      // fallback if the popup was blocked
      window.location.href = data.payment_url
    }
  },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to start payment')
    },
  })

  const handleFund = () => {
    const parsed = Number(amount)

    if (!amount || isNaN(parsed) || parsed < 100) {
      toast.error('Enter a valid amount (min ₦100)')
      return
    }

    if (parsed > 1_000_000) {
      toast.error('Maximum single funding is ₦1,000,000')
      return
    }

    fundWallet(parsed)
  }

  // Quick-select chips
  const quickAmounts = [1000, 2000, 5000, 10000, 20000, 50000]

  return (
    <div className="flex flex-col h-[100dvh] bg-[#F2F2F7]">
      <PageHeader title="Fund Wallet" onBack="default" />
      <div className="flex-1 px-4 pt-4 pb-8 animate-slide-up overflow-y-auto">

        {/* How it works */}
        <div className="bg-blue-50 rounded-[16px] p-4 mb-6 flex gap-3">
          <span className="text-2xl">ℹ️</span>
          <p className="text-[14px] text-blue-700 leading-relaxed">
            Enter an amount and pay via card, transfer, or USSD. Your wallet is funded{' '}
            <strong>instantly</strong> once payment is confirmed.
          </p>
        </div>

        {/* Amount input */}
        <div className="bg-white rounded-[20px] p-5 mb-4">
          <label className="text-[13px] text-gray-400 uppercase tracking-wide font-semibold">
            Amount
          </label>
          <div className="flex items-center gap-2 mt-2 border-b border-gray-100 focus-within:border-brand-primary transition-colors pb-2">
            <span className="text-[28px] font-bold text-gray-400">₦</span>
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              min={100}
              className="flex-1 text-[32px] font-black text-gray-900 outline-none bg-transparent placeholder:text-gray-300"
            />
          </div>

          {/* Quick amounts */}
          <div className="flex flex-wrap gap-2 mt-4">
            {quickAmounts.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => {
                  setAmount(String(amt))
                  vibrate([5])
                }}
                className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                  amount === String(amt)
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                ₦{amt.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* Virtual account (alternative funding option) */}
        <div className="bg-white rounded-[20px] p-5 mb-4 hidden">
          <p className="text-[13px] text-gray-400 mb-4 uppercase tracking-wide font-semibold">
            Or Transfer To Your Dedicated Account
          </p>
          <p className="text-[13px] text-gray-500">Bank Name</p>
          <p className="text-[17px] font-semibold text-gray-900 mb-3">{bank}</p>
          <p className="text-[13px] text-gray-500">Account Number</p>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-[28px] font-black text-gray-900 tracking-widest">{acct}</p>
            <button
              onClick={copy}
              className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center pressable"
            >
              <DocumentDuplicateIcon className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <p className="text-[13px] text-gray-400 mt-3">
            Account Name: <strong className="text-gray-700">FixPay / John Adeyemi</strong>
          </p>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-3">
          <Button
            fullWidth
            onClick={handleFund}
            disabled={isPending || !amount}
            style={{ background: 'var(--brand-primary)' }}
          >
            {isPending ? (
              <Spinner color="white" size="sm" />
            ) : (
              `Pay ₦${Number(amount || 0).toLocaleString()}`
            )}
          </Button>
          <Button fullWidth variant="outline" onClick={() => navigate(-1)}>
            Back to Wallet
          </Button>
        </div>
      </div>
    </div>
  )
}

// import { useNavigate } from 'react-router-dom'
// import { useQuery } from '@tanstack/react-query'
// import { DocumentDuplicateIcon } from '@heroicons/react/24/outline'
// import type { Wallet } from '@/types'
// import { walletService } from '@/lib/services/wallet.service'
// import { PageHeader } from '@/components/layout/PageHeader'
// import { Button } from '@/components/ui/Button'
// import { vibrate } from '@/lib/utils'

// export function FundWalletScreen() {
//   const navigate = useNavigate()
//   const { data: wallet } = useQuery<Wallet>({
//     queryKey: ['wallet'],
//     queryFn: () => walletService.getBalance(),
//   })

//   const acct = wallet?.virtualAccount?.accountNumber ?? '—'
//   const bank = wallet?.virtualAccount?.bankName ?? ''

//   const copy = () => {
//     navigator.clipboard.writeText(acct)
//     vibrate([10])
//   }

//   return (
//     <div className="flex flex-col h-[100dvh] bg-[#F2F2F7]">
//       <PageHeader title="Fund Wallet" onBack="default" />
//       <div className="flex-1 px-4 pt-4 pb-8 animate-slide-up">

//         {/* How it works */}
//         <div className="bg-blue-50 rounded-[16px] p-4 mb-6 flex gap-3">
//           <span className="text-2xl">ℹ️</span>
//           <p className="text-[14px] text-blue-700 leading-relaxed">
//             Transfer any amount to the account below. Your wallet is funded <strong>instantly</strong> once we receive your transfer.
//           </p>
//         </div>

//         {/* Virtual account */}
//         <div className="bg-white rounded-[20px] p-5">
//           <p className="text-[13px] text-gray-400 mb-4 uppercase tracking-wide font-semibold">Your Dedicated Account</p>
//           <p className="text-[13px] text-gray-500">Bank Name</p>
//           <p className="text-[17px] font-semibold text-gray-900 mb-3">{bank}</p>
//           <p className="text-[13px] text-gray-500">Account Number</p>
//           <div className="flex items-center gap-3 mt-1">
//             <p className="text-[32px] font-black text-gray-900 tracking-widest">{acct}</p>
//             <button onClick={copy} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center pressable">
//               <DocumentDuplicateIcon className="w-5 h-5 text-gray-500" />
//             </button>
//           </div>
//           <p className="text-[13px] text-gray-400 mt-3">Account Name: <strong className="text-gray-700">FixPay / John Adeyemi</strong></p>
//         </div>

//         <div className="mt-6 flex flex-col gap-3">
//           <Button fullWidth variant="outline" onClick={() => navigate(-1)}>Back to Wallet</Button>
//         </div>
//       </div>
//     </div>
//   )
// }
