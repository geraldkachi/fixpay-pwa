import { useState } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { XMarkIcon, ChevronLeftIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Input } from '@/components/ui/Input'
import { SelfieCapture } from '@/components/ui/SelfieCapture'
import { walletService, type CreateWalletPayload } from '@/lib/services/wallet.service'
import { cn, formatDateToDDMMYYYY, generateTransactionRef } from '@/lib/utils'
import toast from 'react-hot-toast'

interface CreateWalletModalProps {
  isOpen: boolean
  onClose: () => void
}

// ─── Validation schema (mirrors KycStepper's profileSchema) ─────────────
const profileSchema = Yup.object({
  lastName: Yup.string().trim().required('Last name is required'),
  otherNames: Yup.string().trim().required('Other names are required'),
  dateOfBirth: Yup.string().required('Date of birth is required'),
  gender: Yup.number().oneOf([1, 2]).required('Gender is required'),
  placeOfBirth: Yup.string().trim().required('Place of birth is required'),
  accountName: Yup.string().trim().required('Account name is required'),
  bvn: Yup.string()
    .matches(/^\d{11}$/, 'BVN must be exactly 11 digits')
    .required('BVN is required'),
  nin: Yup.string()
    .matches(/^\d{11}$/, 'NIN must be exactly 11 digits')
    .required('NIN is required'),
  phoneNo: Yup.string()
    .matches(/^\d{10,15}$/, 'Enter a valid phone number')
    .required('Phone number is required'),
  email: Yup.string().email('Enter a valid email').required('Email is required'),
  address: Yup.string().trim().required('Address is required'),
  nextOfKinName: Yup.string().trim().required('Next of kin name is required'),
  nextOfKinPhoneNo: Yup.string()
    .matches(/^\d{10,15}$/, 'Enter a valid phone number')
    .required('Next of kin phone is required'),
})

type ProfileFormValues = Yup.InferType<typeof profileSchema>

const INITIAL_VALUES: ProfileFormValues = {
  lastName: '',
  otherNames: '',
  dateOfBirth: '',
  gender: 1,
  placeOfBirth: '',
  accountName: '',
  bvn: '',
  nin: '',
  phoneNo: '',
  email: '',
  address: '',
  nextOfKinName: '',
  nextOfKinPhoneNo: '',
}

// Fields validated per sub-step (same shape as KycStepper)
const SUB_STEP_FIELDS: Record<1 | 2 | 3, (keyof ProfileFormValues)[]> = {
  1: ['lastName', 'otherNames', 'dateOfBirth', 'gender', 'placeOfBirth', 'accountName', 'bvn', 'nin'],
  2: ['phoneNo', 'email', 'address'],
  3: ['nextOfKinName', 'nextOfKinPhoneNo'],
}

export function CreateWalletModal({ isOpen, onClose }: CreateWalletModalProps) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: (data: CreateWalletPayload) => walletService.createWallet(data),
    onSuccess: (data: any) => {
      toast.success(data?.message ?? 'Wallet created successfully!')
      queryClient.invalidateQueries({ queryKey: ['wallet'] })
      resetAll()
      onClose()
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to create wallet'
      toast.error(msg)
    },
  })

  const formik = useFormik<ProfileFormValues>({
    initialValues: INITIAL_VALUES,
    validationSchema: profileSchema,
    validateOnChange: true,
    validateOnBlur: true,
    onSubmit: (values) => {
      if (!imageFile) {
        toast.error('Please capture your identity photo')
        setStep(1)
        return
      }

      const formattedDob = formatDateToDDMMYYYY(values.dateOfBirth)
      if (!formattedDob) {
        toast.error('Please enter a valid date of birth')
        return
      }

      const ninDigits = values.nin.replace(/\D/g, '')
      const derivedNinUserId = `NINUSR-${ninDigits.slice(-4)}`

      mutate({
        ...values,
        dateOfBirth: formattedDob,
        ninUserId: derivedNinUserId,
        transactionTrackingRef: generateTransactionRef(),
        image: imageFile,
      } as CreateWalletPayload)
    },
  })

  const resetAll = () => {
    formik.resetForm()
    setImageFile(null)
    setImagePreview(null)
    setStep(1)
  }

  const goNextSubStep = async () => {
    if (step === 1 && !imageFile) {
      toast.error('Please capture your identity photo to continue')
      return
    }
    const fields = SUB_STEP_FIELDS[step]
    const errors = await formik.validateForm()
    const stepErrors = fields.filter(f => errors[f])
    if (stepErrors.length > 0) {
      stepErrors.forEach(f => formik.setFieldTouched(f as string, true, false))
      toast.error('Please fill in all required fields correctly')
      return
    }
    setStep(prev => (prev + 1) as 1 | 2 | 3)
  }

  const goPrevSubStep = () => setStep(prev => (prev - 1) as 1 | 2 | 3)

  // Convenience binding
  const field = (name: keyof ProfileFormValues) => ({
    name,
    value: formik.values[name] as string | number,
    onChange: formik.handleChange,
    onBlur: formik.handleBlur,
    error:
      formik.touched[name] && formik.errors[name]
        ? (formik.errors[name] as string)
        : undefined,
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-t-3xl w-full max-w-md max-h-[92vh] overflow-y-auto animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                onClick={goPrevSubStep}
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
          <p className="text-xs text-gray-400 text-center mt-2">Step {step} of 3</p>
        </div>

        {/* Form */}
        <form onSubmit={formik.handleSubmit} className="p-5 space-y-5">
          {/* STEP 1: Personal Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Full Name
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Last Name" {...field('lastName')} />
                  <Input placeholder="Other Names" {...field('otherNames')} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Date of Birth
                </label>
                <input
                  type="date"
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full h-[52px] px-4 text-[17px] bg-white rounded-[12px] border border-transparent outline-none shadow-[0_1px_2px_rgba(0,0,0,0.06)] focus:border-brand-primary transition-colors"
                  {...{
                    name: 'dateOfBirth',
                    value: formik.values.dateOfBirth,
                    onChange: formik.handleChange,
                    onBlur: formik.handleBlur,
                  }}
                />
                {formik.touched.dateOfBirth && formik.errors.dateOfBirth && (
                  <p className="text-ios-red text-[13px]">{formik.errors.dateOfBirth}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Gender
                </label>
                <select
                  name="gender"
                  value={formik.values.gender}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
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
                <Input placeholder="City / State" {...field('placeOfBirth')} />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Account Name
                </label>
                <Input placeholder="Full account name" {...field('accountName')} />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  BVN
                </label>
                <Input
                  placeholder="Bank Verification Number"
                  maxLength={11}
                  inputMode="numeric"
                  {...field('bvn')}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  NIN
                </label>
                <Input
                  placeholder="National Identity Number"
                  maxLength={11}
                  inputMode="numeric"
                  {...field('nin')}
                />
                {formik.values.nin.replace(/\D/g, '').length >= 4 && (
                  <p className="text-xs text-gray-400 mt-1">
                    NIN User ID: NINUSR-{formik.values.nin.replace(/\D/g, '').slice(-4)}
                  </p>
                )}
              </div>

              {/* Camera instead of file input */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Identity Photo
                </label>
                <p className="text-xs text-gray-400">
                  Take a clear photo of your face for identity verification.
                </p>
                <SelfieCapture
                  onCapture={(file, previewUrl) => {
                    setImageFile(file)
                    setImagePreview(previewUrl)
                  }}
                  onClear={() => {
                    setImageFile(null)
                    setImagePreview(null)
                  }}
                  capturedPreview={imagePreview}
                />
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
                <Input type="tel" placeholder="Phone Number" {...field('phoneNo')} />
                <Input
                  type="email"
                  placeholder="Email Address"
                  className="mt-3"
                  {...field('email')}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Residential Address
                </label>
                <Input placeholder="Street, City, State" {...field('address')} />
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
                <Input placeholder="Full Name" {...field('nextOfKinName')} />
                <Input
                  type="tel"
                  placeholder="Phone Number"
                  className="mt-3"
                  {...field('nextOfKinPhoneNo')}
                />
              </div>

              <div className="bg-blue-50 rounded-xl p-4 mt-4">
                <p className="text-sm text-gray-600">
                  By creating a wallet, you agree to our{' '}
                  <a href="#" className="text-brand-primary font-medium">
                    Terms &amp; Conditions
                  </a>
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={goPrevSubStep}
                className="flex-1"
              >
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button
                type="button"
                onClick={goNextSubStep}
                className="flex-1"
                style={{ background: 'var(--brand-primary)' }}
              >
                Continue
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={isPending}
                className="flex-1"
                style={{ background: 'var(--brand-primary)' }}
              >
                {isPending ? <Spinner color="white" size="sm" /> : 'Create Wallet'}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}