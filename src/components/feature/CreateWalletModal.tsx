import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { XMarkIcon, ChevronLeftIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Input } from '@/components/ui/Input'
import { walletService, type CreateWalletPayload } from '@/lib/services/wallet.service'
import { formatDateToDDMMYYYY, generateTransactionRef } from '@/lib/utils'
import toast from 'react-hot-toast'

interface CreateWalletModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CreateWalletModal({ isOpen, onClose }: CreateWalletModalProps) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState(1)
  // Separate file from the rest since it's not a string
  const [imageFile, setImageFile] = useState<File | null>(null)

  // ninUserId is NOT part of the form state — it is derived from `nin` at submit time.
  const [formData, setFormData] = useState<Omit<CreateWalletPayload, 'image' | 'ninUserId'>>({
    bvn: '',
    nin: '',
    accountName: '',
    dateOfBirth: '',
    gender: 1,
    lastName: '',
    otherNames: '',
    phoneNo: '',
    transactionTrackingRef: generateTransactionRef(),
    placeOfBirth: '',
    address: '',
    nextOfKinPhoneNo: '',
    nextOfKinName: '',
    email: '',
  })

  const { mutate, isPending } = useMutation({
    mutationFn: (data: CreateWalletPayload) => walletService.createWallet(data),
    onSuccess: () => {
      toast.success('Wallet created successfully!')
      queryClient.invalidateQueries({ queryKey: ['wallet'] })
      onClose()
      resetForm()
      setStep(1)
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to create wallet')
    },
  })

  const resetForm = () => {
    setFormData({
      bvn: '',
      nin: '',
      accountName: '',
      dateOfBirth: '',
      gender: 1,
      lastName: '',
      otherNames: '',
      phoneNo: '',
      transactionTrackingRef: generateTransactionRef(),
      placeOfBirth: '',
      address: '',
      nextOfKinPhoneNo: '',
      nextOfKinName: '',
      email: '',
    })
    setImageFile(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!imageFile) {
      toast.error('Please upload an image')
      return
    }

    const formattedDob = formatDateToDDMMYYYY(formData.dateOfBirth)
    if (!formattedDob) {
      toast.error('Please enter a valid date of birth (dd/mm/yyyy)')
      return
    }

    const ninDigits = formData.nin.replace(/\D/g, '')
    if (ninDigits.length < 4) {
      toast.error('Please enter a valid NIN')
      return
    }

    // Auto-derive ninUserId from last 4 digits of NIN
    // e.g. NIN "4812791595" -> "NINUSR-1595"
    const derivedNinUserId = `NINUSR-${ninDigits.slice(-4)}`

    mutate({
      ...formData,
      dateOfBirth: formattedDob,
      ninUserId: derivedNinUserId,
      image: imageFile,
    } as CreateWalletPayload, {
    onSuccess: () => {
      resetForm()
    }
    })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'gender' ? Number(value) : value,
    }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    if (file && file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB')
      return
    }
    setImageFile(file)
  }

  const nextStep = () => setStep(prev => prev + 1)
  const prevStep = () => setStep(prev => prev - 1)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-t-3xl w-full max-w-md max-h-[92vh] overflow-y-auto animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                onClick={prevStep}
                className="p-1 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
            )}
            <h2 className="text-lg font-semibold">
              {step === 1 ? 'Personal Info' : step === 2 ? 'Contact & Address' : 'Next of Kin'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-5 pt-4">
          <div className="flex gap-1">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  s <= step ? 'bg-brand-primary' : 'bg-gray-200'
                )}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400 text-center mt-2">
            Step {step} of 3
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* STEP 1: Personal Information */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Full Name
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Last Name"
                    required
                  />
                  <Input
                    name="otherNames"
                    value={formData.otherNames}
                    onChange={handleChange}
                    placeholder="Other Names"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Date of Birth
                </label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  max={new Date().toISOString().split('T')[0]}
                  required
                  className="w-full h-[52px] px-4 text-[17px] bg-white rounded-[12px] border border-transparent outline-none shadow-[0_1px_2px_rgba(0,0,0,0.06)] focus:border-brand-primary transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Gender
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  required
                  className="w-full h-[52px] px-4 text-[17px] bg-white rounded-[12px] border border-transparent outline-none shadow-[0_1px_2px_rgba(0,0,0,0.06)] focus:border-brand-primary transition-colors"
                >
                  <option value={1}>Male</option>
                  <option value={2}>Female</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Place of Birth
                </label>
                <Input
                  type="text"
                  name="placeOfBirth"
                  value={formData.placeOfBirth}
                  onChange={handleChange}
                  placeholder="City / State"
                  required
                />
              </div>

              {/* Image upload */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Profile Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  required
                  className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand-primary file:text-white file:text-sm file:font-medium hover:file:opacity-90"
                />
                {imageFile && (
                  <p className="text-xs text-gray-400 mt-1">
                    Selected: {imageFile.name}
                  </p>
                )}
              </div>

              {/* Account Name */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Account Name
                </label>
                <Input
                  name="accountName"
                  value={formData.accountName}
                  onChange={handleChange}
                  placeholder="Full account name"
                  required
                />
              </div>

              {/* BVN */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  BVN
                </label>
                <Input
                  name="bvn"
                  value={formData.bvn}
                  onChange={handleChange}
                  placeholder="Bank Verification Number"
                  maxLength={11}
                  required
                />
              </div>

              {/* NIN */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  NIN
                </label>
                <Input
                  name="nin"
                  value={formData.nin}
                  onChange={handleChange}
                  placeholder="National Identity Number"
                  maxLength={11}
                  required
                />
                {formData.nin.replace(/\D/g, '').length >= 4 && (
                  <p className="text-xs text-gray-400 mt-1">
                    NIN User ID will be auto-generated
                  </p>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Contact & Address */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Contact Information
                </label>
                <Input
                  type="tel"
                  name="phoneNo"
                  value={formData.phoneNo}
                  onChange={handleChange}
                  placeholder="Phone Number"
                  required
                />
                <Input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Email Address"
                  required
                  className="mt-3"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Residential Address
                </label>
                <Input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Street, City, State"
                  required
                />
              </div>
            </div>
          )}

          {/* STEP 3: Next of Kin */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Next of Kin
                </label>
                <Input
                  type="text"
                  name="nextOfKinName"
                  value={formData.nextOfKinName}
                  onChange={handleChange}
                  placeholder="Full Name"
                  required
                />
                <Input
                  type="tel"
                  name="nextOfKinPhoneNo"
                  value={formData.nextOfKinPhoneNo}
                  onChange={handleChange}
                  placeholder="Phone Number"
                  required
                  className="mt-3"
                />
              </div>

              <div className="bg-blue-50 rounded-xl p-4 mt-4">
                <p className="text-sm text-gray-600">
                  By creating a wallet, you agree to our{' '}
                  <a href="#" className="text-brand-primary font-medium">
                    Terms & Conditions
                  </a>
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            {step > 1 ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  className="flex-1"
                >
                  Back
                </Button>
                {step === 3 ? (
                  <Button
                    type="submit"
                    disabled={isPending}
                    className="flex-1"
                    style={{ background: 'var(--brand-primary)' }}
                  >
                    {isPending ? <Spinner color="white" size="sm" /> : 'Create Wallet'}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={nextStep}
                    className="flex-1"
                    style={{ background: 'var(--brand-primary)' }}
                  >
                    Continue
                  </Button>
                )}
              </>
            ) : (
              <Button
                type="button"
                onClick={nextStep}
                className="flex-1"
                style={{ background: 'var(--brand-primary)' }}
              >
                Continue
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

// Helper function
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}