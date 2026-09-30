import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'motion/react'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import toast from 'react-hot-toast'

import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { PageHeader } from '@/components/layout/PageHeader'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { SelfieCapture } from '@/components/ui/SelfieCapture'
import { cn, formatDateToDDMMYYYY, generateTransactionRef } from '@/lib/utils'
import {
  walletService,
  type CreateWalletPayload,
  type Wallet,
} from '@/lib/services/wallet.service'

// ============================================
// TYPES & CONSTANTS
// ============================================
type Step = 0 | 1 | 2
const STEPS = ['Profile', 'NIN', 'BVN'] as const

// ============================================
// ERROR HELPERS (unchanged)
// ============================================
function extractApiError(error: any): string {
  const data = error?.response?.data ?? error?.data ?? error
  if (!data) return 'Something went wrong. Please try again.'

  if (data.errors && typeof data.errors === 'object') {
    const fieldMessages: string[] = []
    Object.entries(data.errors).forEach(([field, messages]) => {
      const label = field
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
      const list = Array.isArray(messages) ? messages : [messages]
      list.forEach((msg: any) => {
        fieldMessages.push(`${label}: ${msg}`)
      })
    })
    if (fieldMessages.length > 0) return fieldMessages.join('\n')
  }

  if (typeof data.message === 'string' && data.message.trim()) return data.message
  if (typeof data.error === 'string' && data.error.trim()) return data.error
  return 'Something went wrong. Please try again.'
}

// ============================================
// PROFILE STEP (unchanged)
// ============================================
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

const PROFILE_INITIAL_VALUES: ProfileFormValues = {
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

const SUB_STEP_FIELDS: Record<1 | 2 | 3, (keyof ProfileFormValues)[]> = {
  1: ['lastName', 'otherNames', 'dateOfBirth', 'gender', 'placeOfBirth', 'accountName', 'bvn', 'nin'],
  2: ['phoneNo', 'email', 'address'],
  3: ['nextOfKinName', 'nextOfKinPhoneNo'],
}

function ProfileStep({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient()
  const [subStep, setSubStep] = useState<1 | 2 | 3>(1)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [serverError, setServerError] = useState('')

  const { mutate, isPending } = useMutation({
    mutationFn: (data: CreateWalletPayload) => walletService.createWallet(data),
    onSuccess: (data) => {
      toast.success(data.message ?? 'Profile saved')
      queryClient.invalidateQueries({ queryKey: ['wallet'] })
      onDone()
    },
    onError: (error: any) => {
      const message = extractApiError(error)
      setServerError(message)
      toast.error(message)
    },
  })

  const formik = useFormik<ProfileFormValues>({
    initialValues: PROFILE_INITIAL_VALUES,
    validationSchema: profileSchema,
    validateOnChange: true,
    validateOnBlur: true,
    onSubmit: (values) => {
      setServerError('')

      if (!imageFile) {
        toast.error('Please capture your identity photo')
        setSubStep(1)
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

  const goNextSubStep = async () => {
    if (subStep === 1 && !imageFile) {
      toast.error('Please capture your identity photo to continue')
      return
    }
    const fields = SUB_STEP_FIELDS[subStep]
    const errors = await formik.validateForm()
    const stepErrors = fields.filter(f => errors[f])
    if (stepErrors.length > 0) {
      stepErrors.forEach(f => formik.setFieldTouched(f as string, true, false))
      toast.error('Please fill in all required fields correctly')
      return
    }
    setSubStep(prev => (prev + 1) as 1 | 2 | 3)
  }

  const goPrevSubStep = () => setSubStep(prev => (prev - 1) as 1 | 2 | 3)

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

  return (
    <form onSubmit={formik.handleSubmit} className="flex flex-col gap-5">
      <div className="text-center mb-2">
        <p className="text-[28px]">📋</p>
        <h2 className="text-[20px] font-bold text-gray-900 mt-2">
          Personal Information
        </h2>
        <p className="text-[14px] text-gray-500 mt-1">
          We need a few details to verify your identity.
        </p>
      </div>

      <div className="flex gap-1 mb-4">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              s <= subStep ? 'bg-brand-primary' : 'bg-gray-200'
            )}
          />
        ))}
      </div>

      {subStep === 1 && (
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
              name="dateOfBirth"
              value={formik.values.dateOfBirth}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              max={new Date().toISOString().split('T')[0]}
              className="w-full h-[52px] px-4 text-[17px] bg-white rounded-[12px] border border-transparent outline-none shadow-[0_1px_2px_rgba(0,0,0,0.06)] focus:border-brand-primary transition-colors"
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

      {subStep === 2 && (
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

      {subStep === 3 && (
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
              By continuing, you agree to our{' '}
              <a href="#" className="text-brand-primary font-medium">
                Terms &amp; Conditions
              </a>{' '}
              and consent to identity verification.
            </p>
          </div>
        </div>
      )}

      {serverError && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-ios-red text-[13px] whitespace-pre-line">
            {serverError}
          </p>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        {subStep > 1 && (
          <Button
            type="button"
            variant="outline"
            onClick={goPrevSubStep}
            className="flex-1"
          >
            Back
          </Button>
        )}
        {subStep < 3 ? (
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
            {isPending ? <Spinner color="white" size="sm" /> : 'Submit for Verification'}
          </Button>
        )}
      </div>
    </form>
  )
}

// ============================================
// NIN STEP (unchanged)
// ============================================
const ninSchema = Yup.object({
  nin: Yup.string()
    .matches(/^\d{11}$/, 'NIN must be exactly 11 digits')
    .required('NIN is required'),
})

function NinStep({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const [serverError, setServerError] = useState('')

  const formik = useFormik({
    initialValues: { nin: '' },
    validationSchema: ninSchema,
    onSubmit: async (values, { setSubmitting }) => {
      setServerError('')
      try {
        await api.post('/kyc/nin', values)
        onDone()
      } catch (error: any) {
        const message = extractApiError(error)
        setServerError(message)
        toast.error(message)
      } finally {
        setSubmitting(false)
      }
    },
  })

  return (
    <form onSubmit={formik.handleSubmit} className="flex flex-col gap-5">
      <div className="text-center mb-2">
        <p className="text-[28px]">🪪</p>
        <h2 className="text-[20px] font-bold text-gray-900 mt-2">
          National Identity Number
        </h2>
        <p className="text-[14px] text-gray-500 mt-1">
          Enter your 11-digit NIN for identity verification.
        </p>
      </div>

      <Input
        label="NIN"
        type="tel"
        inputMode="numeric"
        maxLength={11}
        placeholder="12345678901"
        name="nin"
        value={formik.values.nin}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        error={
          formik.touched.nin && formik.errors.nin ? formik.errors.nin : undefined
        }
      />

      {serverError && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-ios-red text-[13px] whitespace-pre-line">
            {serverError}
          </p>
        </div>
      )}

      <Button type="submit" fullWidth loading={formik.isSubmitting}>
        Verify NIN
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={onSkip}
        className="text-brand"
        fullWidth
      >
        Continue Later
      </Button>
      <p className="text-[12px] text-center text-gray-400">
        Demo: use any 11-digit number
      </p>
    </form>
  )
}

// ============================================
// BVN STEP (unchanged)
// ============================================
const bvnSchema = Yup.object({
  bvn: Yup.string()
    .matches(/^\d{11}$/, 'BVN must be exactly 11 digits')
    .required('BVN is required'),
  dob: Yup.string().required('Date of birth is required'),
  first_name: Yup.string().trim().required('First name is required'),
  last_name: Yup.string().trim().required('Last name is required'),
})

function BvnStep({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const [serverError, setServerError] = useState('')
  const [awaiting, setAwaiting] = useState(false)
  const [bvnData, setBvnData] = useState<any>(null)

  const formik = useFormik({
    initialValues: {
      bvn: '',
      dob: '',
      first_name: '',
      last_name: '',
    },
    validationSchema: bvnSchema,
    onSubmit: async (values, { setSubmitting }) => {
      setServerError('')
      setAwaiting(true)

      try {
        const res = await api.post('/kyc/bvn', {
          bvn: parseInt(values.bvn),
          first_name: values.first_name,
          last_name: values.last_name,
          dob: values.dob,
        })

        if (res.data.status === 'VERIFIED') {
          setBvnData(res.data.data)
          setAwaiting(false)
          onDone()
        } else if (res.data.status === 'PENDING') {
          if (res.data.consentUrl) {
            window.open(res.data.consentUrl, '_blank')
          }
          startPolling(values.bvn, values.first_name, values.last_name)
        } else {
          const message = extractApiError(res.data)
          setServerError(message)
          toast.error(message)
          setAwaiting(false)
        }
      } catch (error: any) {
        const message = extractApiError(error)
        setServerError(message)
        toast.error(message)
        setAwaiting(false)
      } finally {
        setSubmitting(false)
      }
    },
  })

  const startPolling = async (
    bvn: string,
    first_name: string,
    last_name: string,
    attempt = 0
  ) => {
    const delays = [10000, 240000, 600000, 1200000, 1500000]
    if (attempt >= delays.length) {
      setServerError('BVN verification timed out. Please try again.')
      setAwaiting(false)
      return
    }

    setTimeout(async () => {
      try {
        const res = await api.get('/kyc/status')
        const bvnStatus = res.data.verifications?.find(
          (v: any) => v.type === 'BVN_CONSENT' || v.type === 'BVN'
        )?.status

        if (bvnStatus === 'VERIFIED') {
          setBvnData(res.data.data)
          setAwaiting(false)
          onDone()
        } else if (bvnStatus === 'FAILED') {
          setServerError('BVN verification failed at NIBSS.')
          setAwaiting(false)
        } else {
          startPolling(bvn, first_name, last_name, attempt + 1)
        }
      } catch {
        startPolling(bvn, first_name, last_name, attempt + 1)
      }
    }, delays[attempt])
  }

  if (awaiting) {
    return (
      <div className="flex flex-col items-center gap-5 pt-8">
        <p className="text-[28px]">{bvnData ? '✅' : '⏳'}</p>
        <h2 className="text-[20px] font-bold text-gray-900 mt-2">
          {bvnData ? 'BVN Verified!' : 'Verifying BVN'}
        </h2>
        <p className="text-[14px] text-gray-500 mt-1 text-center px-4">
          {bvnData
            ? 'Your BVN has been successfully verified.'
            : 'Please wait while we verify your BVN...'}
        </p>

        {bvnData && (
          <div className="w-full bg-gray-50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-gray-700">BVN Details:</p>
            <div className="text-sm text-gray-600 space-y-1">
              <p>
                <span className="font-medium">Name:</span>{' '}
                {bvnData.applicant?.firstname} {bvnData.applicant?.lastname}
              </p>
              <p>
                <span className="font-medium">BVN:</span> {bvnData.bvn?.bvn}
              </p>
              <p>
                <span className="font-medium">Date of Birth:</span>{' '}
                {bvnData.bvn?.birthdate}
              </p>
              <p>
                <span className="font-medium">Gender:</span>{' '}
                {bvnData.bvn?.gender}
              </p>
              <p>
                <span className="font-medium">Phone:</span> {bvnData.bvn?.phone}
              </p>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-xs text-green-600 font-medium">
                ✓ Verification Status: {bvnData.status?.status}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 w-full mt-4">
          {bvnData ? (
            <Button onClick={onDone} className="w-full">
              Continue
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setAwaiting(false)}
                className="w-full"
              >
                Cancel &amp; Retry
              </Button>
              <Button
                variant="ghost"
                onClick={onSkip}
                className="text-brand w-full"
              >
                Continue Later
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={formik.handleSubmit} className="flex flex-col gap-5">
      <div className="text-center mb-2">
        <p className="text-[28px]">🏦</p>
        <h2 className="text-[20px] font-bold text-gray-900 mt-2">
          Bank Verification Number
        </h2>
        <p className="text-[14px] text-gray-500 mt-1">
          Enter your BVN and personal details for verification.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="First Name"
          type="text"
          placeholder="John"
          name="first_name"
          value={formik.values.first_name}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={
            formik.touched.first_name && formik.errors.first_name
              ? formik.errors.first_name
              : undefined
          }
        />
        <Input
          label="Last Name"
          type="text"
          placeholder="Doe"
          name="last_name"
          value={formik.values.last_name}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={
            formik.touched.last_name && formik.errors.last_name
              ? formik.errors.last_name
              : undefined
          }
        />
      </div>

      <Input
        label="Date of Birth"
        type="date"
        name="dob"
        value={formik.values.dob}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        error={
          formik.touched.dob && formik.errors.dob ? formik.errors.dob : undefined
        }
      />

      <Input
        label="BVN"
        type="tel"
        inputMode="numeric"
        maxLength={11}
        placeholder="95888168924"
        name="bvn"
        value={formik.values.bvn}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        error={
          formik.touched.bvn && formik.errors.bvn ? formik.errors.bvn : undefined
        }
      />

      {serverError && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-ios-red text-[13px] whitespace-pre-line">
            {serverError}
          </p>
        </div>
      )}

      <Button type="submit" fullWidth loading={formik.isSubmitting}>
        Verify BVN
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={onSkip}
        className="text-brand"
        fullWidth
      >
        Continue Later
      </Button>
      <p className="text-[12px] text-center text-gray-400">
        Demo: Use any 11-digit BVN number
      </p>
    </form>
  )
}

// ============================================
// MAIN STEPPER — UPDATED
// ============================================
export function KycStepper() {
  const navigate = useNavigate()
  const { setKycCompleted, setKycDeferred } = useAuthStore()

  const [unvalidatedSteps, setUnvalidatedSteps] = useState<Step[]>([0, 1, 2])
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [done, setDone] = useState(false)

  // ─────────────────────────────────────────────
  // 1. Fetch existing wallet — if it exists, we skip Profile
  // ─────────────────────────────────────────────
  const {
    data: wallet,
    isLoading: walletLoading,
    isError: walletError,
  } = useQuery<Wallet>({
    queryKey: ['wallet'],
    queryFn: () => walletService.getBalance(),
    staleTime: 30_000,
    retry: 1,
  })

  // ─────────────────────────────────────────────
  // 2. Fetch KYC status (NIN / BVN)
  // ─────────────────────────────────────────────
  const [kycStatus, setKycStatus] = useState<{
    // hasNin: boolean
    // hasBvn: boolean
  } | null>(null)
  const [kycLoading, setKycLoading] = useState(true)

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await api.get('/kyc/status')
        const verifications = res.data.verifications || []
        // const hasNin = verifications.some(
        //   (v: any) => v.type === 'NIN' && v.status === 'VERIFIED'
        // )
        // const hasBvn = verifications.some(
        //   (v: any) =>
        //     (v.type === 'BVN' || v.type === 'BVN_CONSENT') &&
        //     v.status === 'VERIFIED'
        // )
        // setKycStatus({ /* hasNin: false, */ hasBvn })
      } catch {
        // setKycStatus({ /* hasNin: false, */ hasBvn: false })
      } finally {
        setKycLoading(false)
      }
    }
    checkStatus()
  }, [])

  // ─────────────────────────────────────────────
  // 3. Build the step list once both queries resolve
  //    - If wallet exists → skip Profile (step 0)
  //    - If NIN verified → skip NIN (step 1)
  //    - If BVN verified → skip BVN (step 2)
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (walletLoading || kycLoading) return
    if (!kycStatus) return

    // Treat an existing wallet as the "profile" being done
    // walletError means no wallet was found (404 or similar)
    const hasProfile = !!wallet && !walletError

    const steps: Step[] = []
    if (!hasProfile) steps.push(0)
    // if (!kycStatus.hasNin) steps.push(1)
    // if (!kycStatus.hasBvn) steps.push(2)

    setUnvalidatedSteps(steps)
    setCurrentStepIndex(0)

    // If there are no remaining steps, jump straight to done
    if (steps.length === 0) {
      setDone(true)
      setKycCompleted(true)
      useAuthStore.getState().setKycDeferred(false)
      setTimeout(() => navigate('/home', { replace: true }), 1200)
    }
  }, [
    wallet,
    walletLoading,
    walletError,
    kycStatus,
    kycLoading,
    navigate,
    setKycCompleted,
  ])

  const handleNext = () => {
    if (currentStepIndex + 1 < unvalidatedSteps.length) {
      setCurrentStepIndex(curr => curr + 1)
    } else {
      setDone(true)
      setKycCompleted(true)
      useAuthStore.getState().setKycDeferred(false)
      setTimeout(() => navigate('/home', { replace: true }), 1800)
    }
  }

  const deferKyc = () => {
    setKycDeferred(true)
    navigate('/home')
  }

  const handleSkip = () => {
    deferKyc()
  }

  const goToStep = (stepIndex: number) => {
    const stepExists = unvalidatedSteps.includes(stepIndex as Step)
    if (stepExists) {
      setCurrentStepIndex(unvalidatedSteps.indexOf(stepIndex as Step))
    }
  }

  // ─────────────────────────────────────────────
  // Loading state — wait for BOTH queries
  // ─────────────────────────────────────────────
  if (walletLoading || kycLoading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-[#F2F2F7]">
        <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-brand animate-spin" />
      </div>
    )
  }

  if (done) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center gap-4 animate-scale-in">
        <CheckCircleIcon className="w-20 h-20 text-ios-green" />
        <h2 className="text-[24px] font-bold text-gray-900">Identity Verified!</h2>
        <p className="text-gray-500">Setting up your account…</p>
      </div>
    )
  }

  const step = unvalidatedSteps[currentStepIndex]

  return (
    <div className="flex flex-col h-[100dvh] bg-[#F2F2F7]">
      <PageHeader
        title="Verify Your Identity"
        onBack={
          currentStepIndex > 0
            ? () => setCurrentStepIndex(curr => curr - 1)
            : undefined
        }
      />

      {/* Progress Bar — only shows steps that are actually pending */}
      <div className="flex gap-2 px-4 pb-4 shrink-0">
        {STEPS.map((s, i) => {
          // Only render progress entries for steps that are still pending
          if (!unvalidatedSteps.includes(i as Step)) return null

          const isActive = i === step
          const isPassed = unvalidatedSteps.indexOf(i as Step) < currentStepIndex

          return (
            <div
              key={s}
              onClick={() => goToStep(i)}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 transition-all duration-200',
                'cursor-pointer hover:scale-105 group'
              )}
              title={`Go to ${s}`}
            >
              <div
                className={cn(
                  'h-1 w-full rounded-full transition-all duration-500',
                  isActive ? 'bg-brand' : isPassed ? 'bg-brand/60' : 'bg-gray-200',
                  !isActive && 'group-hover:bg-brand/40'
                )}
              />

              <div className="flex items-center gap-1.5">
                <span className="text-xs">
                  {s === 'Profile' && '📋'}
                  {s === 'NIN' && '🪪'}
                  {s === 'BVN' && '🏦'}
                </span>

                <span
                  className={cn(
                    'text-[11px] font-medium transition-colors',
                    isActive
                      ? 'text-brand font-semibold'
                      : isPassed
                        ? 'text-brand/70'
                        : 'text-gray-400',
                    !isActive && 'group-hover:text-brand/80'
                  )}
                >
                  {s}
                </span>

                {isPassed && (
                  <svg
                    className="w-3 h-3 text-brand/70"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.25 }}
          >
            {step === 0 && <ProfileStep onDone={handleNext} />}
            {step === 1 && <NinStep onDone={handleNext} onSkip={handleSkip} />}
            {step === 2 && <BvnStep onDone={handleNext} onSkip={handleSkip} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}