import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface FormData {
  name: string
  phone: string
  email: string
  clinic: string
  location: string
  question: string
}

type FormStatus = 'idle' | 'loading' | 'success' | 'error'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^(0|\+84|84)[35789]\d{8}$/

function getCookie(name: string): string {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : ''
}

function validate(data: FormData): Record<string, string> {
  const errs: Record<string, string> = {}
  if (!data.name.trim() || data.name.trim().length < 2) errs.name = 'Vui lòng nhập họ tên (tối thiểu 2 ký tự)'
  if (!PHONE_RE.test(data.phone.replace(/\s/g, ''))) errs.phone = 'Số điện thoại không hợp lệ'
  if (!EMAIL_RE.test(data.email)) errs.email = 'Email không hợp lệ'
  if (!data.clinic.trim() || data.clinic.trim().length < 2) errs.clinic = 'Vui lòng nhập tên phòng khám / cơ sở'
  if (!data.location.trim()) errs.location = 'Vui lòng nhập tỉnh / thành phố'
  return errs
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function FieldError({ message }: { message?: string }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="text-red-500 text-xs mt-1.5 ml-3 font-medium"
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function RegistrationForm() {
  const [formData, setFormData] = useState<FormData>({
    name: '', phone: '', email: '', clinic: '', location: '', question: '',
  })
  const [formStatus, setFormStatus] = useState<FormStatus>('idle')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')

  function set(field: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormData(prev => ({ ...prev, [field]: e.target.value }))
      if (fieldErrors[field]) setFieldErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate(formData)
    if (Object.keys(errs).length) { setFieldErrors(errs); return }

    setFormStatus('loading')
    setSubmitError('')

    const eventId = `lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const fbc = getCookie('_fbc')
    const fbp = getCookie('_fbp')

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          clinic_name: formData.clinic,
          city: formData.location,
          question: formData.question,
          eventId,
          fbc,
          fbp,
          userAgent: navigator.userAgent,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.message ?? 'Có lỗi xảy ra, vui lòng thử lại.')
      }

      // Browser pixel dedup — same eventId as CAPI
      if (typeof window !== 'undefined' && typeof (window as any).fbq === 'function') {
        ;(window as any).fbq('trackCustom', 'WebinarFormSubmit', {}, { eventID: eventId })
      }

      setFormStatus('success')
    } catch (err: any) {
      setFormStatus('error')
      setSubmitError(err?.message ?? 'Có lỗi xảy ra, vui lòng thử lại.')
    }
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (formStatus === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-5 sm:p-8 md:p-12 rounded-[24px] md:rounded-[40px] shadow-2xl shadow-[#1E3A8A]/10 border border-slate-100 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">Đăng ký thành công!</h3>
        <p className="text-slate-500 text-sm">Chúng tôi sẽ gửi thông tin chi tiết qua email và số điện thoại của bạn.</p>
      </motion.div>
    )
  }

  // ── Input class helpers ───────────────────────────────────────────────────
  const inputCls = (field: string) =>
    `w-full bg-slate-50 border rounded-full px-4 py-3 text-sm md:text-base text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20 transition-all ${
      fieldErrors[field] ? 'border-red-300 bg-red-50/30' : 'border-slate-100'
    }`

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="bg-white p-5 sm:p-8 md:p-12 rounded-[24px] md:rounded-[40px] shadow-2xl shadow-[#1E3A8A]/10 border border-slate-100"
    >
      <div className="space-y-3 md:space-y-5">

        {/* Row: name + phone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <input
              type="text" placeholder="Họ và tên *" required
              value={formData.name} onChange={set('name')}
              className={inputCls('name')}
            />
            <FieldError message={fieldErrors.name} />
          </div>
          <div>
            <input
              type="tel" placeholder="Số điện thoại *" required
              value={formData.phone} onChange={set('phone')}
              className={inputCls('phone')}
            />
            <FieldError message={fieldErrors.phone} />
          </div>
        </div>

        {/* Email */}
        <div>
          <input
            type="email" placeholder="Email *" required
            value={formData.email} onChange={set('email')}
            className={inputCls('email')}
          />
          <FieldError message={fieldErrors.email} />
        </div>

        {/* Clinic */}
        <div>
          <input
            type="text" placeholder="Tên phòng khám / cơ sở *" required
            value={formData.clinic} onChange={set('clinic')}
            className={inputCls('clinic')}
          />
          <FieldError message={fieldErrors.clinic} />
        </div>

        {/* Location */}
        <div>
          <input
            type="text" placeholder="Tỉnh / Thành phố *" required
            value={formData.location} onChange={set('location')}
            className={inputCls('location')}
          />
          <FieldError message={fieldErrors.location} />
        </div>

        {/* Question (optional) */}
        <div>
          <textarea
            placeholder="Câu hỏi cho diễn giả (không bắt buộc)"
            rows={3}
            value={formData.question} onChange={set('question')}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm md:text-base text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20 transition-all resize-none"
          />
        </div>

        {/* Submit error */}
        <AnimatePresence>
          {formStatus === 'error' && submitError && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-red-500 text-sm text-center font-medium"
            >
              {submitError}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Submit button */}
        <button
          type="submit"
          disabled={formStatus === 'loading'}
          className="w-full bg-[#1E3A8A] hover:bg-[#1E40AF] text-white font-bold py-3 md:py-4 rounded-full text-sm md:text-base transition-all shadow-lg shadow-[#1E3A8A]/20 mt-2 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {formStatus === 'loading' ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Đang xử lý...
            </>
          ) : (
            'Đăng ký tham gia webinar'
          )}
        </button>

      </div>
    </form>
  )
}
