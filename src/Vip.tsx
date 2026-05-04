import { useState, useEffect, useRef } from 'react'

/* ── ENV vars ───────────────────────────────────────────────────────────── */
const ZALO_FREE_URL  = import.meta.env.VITE_ZALO_URL          || 'https://zalo.me/g/fwtjhqz5bkchcxuontjq'
const ZALO_VIP_URL   = import.meta.env.VITE_ZALO_VIP_URL      || 'https://zalo.me/g/a4cbjzoa8xjm4q8cfi5f'
const VIP_API_URL    = import.meta.env.VITE_VIP_CONFIRM_API   || ''   // sẽ fill sau
const BANK_CODE      = import.meta.env.VITE_BANK_CODE         || 'MB'
const BANK_ACCOUNT   = import.meta.env.VITE_BANK_ACCOUNT      || ''
const BANK_NAME      = import.meta.env.VITE_BANK_NAME         || 'TRAN NGUYEN TRIET'
const VIP_AMOUNT     = 499000
const VIP_PRICE_DISPLAY = '499.000đ'

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function makeOrderId() {
  return 'VIP' + Date.now().toString(36).toUpperCase().slice(-6)
}

function makeQrUrl(orderId: string) {
  if (!BANK_ACCOUNT) return ''
  const desc = encodeURIComponent(`VIPWB ${orderId}`)
  return `https://img.vietqr.io/image/${BANK_CODE}-${BANK_ACCOUNT}-compact2.jpg?amount=${VIP_AMOUNT}&addInfo=${desc}&accountName=${encodeURIComponent(BANK_NAME)}`
}

/* ── Countdown ─────────────────────────────────────────────────────────── */
function CountdownTimer() {
  const TARGET = new Date('2026-05-09T20:00:00+07:00')
  const [cd, setCd] = useState('--:--:--')
  useEffect(() => {
    const tick = () => {
      const diff = TARGET.getTime() - Date.now()
      if (diff <= 0) { setCd('ĐANG DIỄN RA'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCd(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="font-mono tabular-nums">{cd}</span>
}

/* ── Benefits list ───────────────────────────────────────────────────────── */
const BENEFITS = [
  {
    icon: <PlayIcon />,
    title: 'Record toàn bộ webinar',
    desc: 'Xem lại không giới hạn — bỏ lỡ ý nào, tua lại ngay.',
    hot: false,
  },
  {
    icon: <CalIcon />,
    title: 'Buổi hỏi đáp riêng 17/5',
    desc: 'Hỏi thẳng về case của anh chị — ngành gì, đang dạy gì, muốn làm gì. Triết trả lời thật.',
    hot: true,
  },
  {
    icon: <PhoneIcon />,
    title: 'Private call thẩm định 1:1',
    desc: '30 phút call riêng để review idea sản phẩm — biết rõ nên làm hay không nên làm.',
    hot: true,
  },
  {
    icon: <DocIcon />,
    title: 'Tài liệu độc quyền',
    desc: 'Template cấu trúc khoá học + checklist launch — bộ nội bộ MONA dùng để onboard case.',
    hot: false,
  },
  {
    icon: <GroupIcon />,
    title: 'Phòng chờ Zalo VIP riêng',
    desc: 'Triết chia sẻ thêm tài nguyên, trả lời câu hỏi nhanh và cập nhật trực tiếp.',
    hot: false,
  },
]

/* ── Main component ─────────────────────────────────────────────────────── */
export default function Vip() {
  const [orderId] = useState(makeOrderId)
  const [step, setStep] = useState<'offer' | 'qr' | 'confirming' | 'success' | 'error'>('offer')
  const [errMsg, setErrMsg] = useState('')
  const [user] = useState<{ hoten: string; sdt: string; email: string } | null>(() => {
    try { return JSON.parse(sessionStorage.getItem('vip_user') || 'null') } catch { return null }
  })

  const qrUrl = makeQrUrl(orderId)

  async function handleConfirm() {
    setStep('confirming')
    try {
      if (VIP_API_URL) {
        const res = await fetch(VIP_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            amount: VIP_AMOUNT,
            hoten:  user?.hoten  || '',
            sdt:    user?.sdt    || '',
            email:  user?.email  || '',
          }),
        })
        if (!res.ok) throw new Error(await res.text())
      }
      // Nếu chưa có API → vẫn cho vào (self-report)
      sessionStorage.removeItem('vip_user')
      setStep('success')
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Lỗi kết nối')
      setStep('error')
    }
  }

  return (
    <div className="min-h-screen" style={{ background: '#0C0C0F' }}>
      {/* Glow */}
      <div className="pointer-events-none fixed inset-0" style={{ background: 'radial-gradient(ellipse 70% 45% at 50% -5%, rgba(255,45,111,0.16) 0%, transparent 65%)' }} />

      <div className="relative max-w-xl mx-auto px-4 py-14 md:py-20">

        {/* Badge */}
        <div className="flex justify-center mb-8">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase text-accent border border-accent/40 rounded-full px-4 py-1.5" style={{ background: 'rgba(255,45,111,0.08)' }}>
            <StarIcon /> Dành riêng cho anh chị vừa đăng ký
          </span>
        </div>

        {step === 'success' ? (
          <SuccessState />
        ) : (
          <>
            {/* Headline */}
            <h1 className="text-paper text-center mb-3" style={{ fontSize: 'clamp(1.9rem, 4.5vw, 3rem)', fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', lineHeight: 1.15 }}>
              Nâng lên <span className="text-accent">VIP</span> —<br />được nhiều hơn, tốn ít hơn
            </h1>
            <p className="text-paper/55 text-center text-sm mb-9 leading-relaxed">
              Webinar miễn phí là nền. VIP là bước anh chị thực sự đi nhanh hơn người khác.
            </p>

            {/* Benefits */}
            <div className="space-y-2.5 mb-8">
              {BENEFITS.map((b, i) => (
                <div key={i} className="flex items-start gap-3.5 rounded-2xl px-4 py-3.5 transition-all"
                  style={{
                    background: b.hot ? 'rgba(255,45,111,0.09)' : 'rgba(255,255,255,0.04)',
                    border: b.hot ? '1px solid rgba(255,45,111,0.28)' : '1px solid rgba(255,255,255,0.07)',
                  }}>
                  <div className={`shrink-0 mt-0.5 ${b.hot ? 'text-accent' : 'text-paper/35'}`}>{b.icon}</div>
                  <div className="flex-1">
                    <div className="font-bold text-paper text-sm">{b.title}</div>
                    <div className="text-paper/50 text-xs leading-relaxed mt-0.5">{b.desc}</div>
                  </div>
                  {b.hot && <span className="shrink-0 self-center text-xs font-bold text-accent bg-accent/10 border border-accent/25 rounded-full px-2 py-0.5 ml-1">HOT</span>}
                </div>
              ))}
            </div>

            {/* Price + CTA */}
            <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <div className="flex items-end justify-between mb-4">
                <div>
                  <div className="text-paper/40 text-xs font-semibold uppercase tracking-wider mb-1">Học phí VIP</div>
                  <div className="text-accent font-black leading-none" style={{ fontSize: '2.4rem', fontFamily: "'Barlow Semi Condensed', sans-serif" }}>{VIP_PRICE_DISPLAY}</div>
                  <div className="text-paper/35 text-xs mt-1">Trả một lần · giữ mãi</div>
                </div>
                <div className="text-right">
                  <div className="text-paper/25 text-xs line-through mb-0.5">Webinar Free</div>
                  <div className="text-paper/50 text-xs font-semibold">+ 5 quyền lợi VIP</div>
                </div>
              </div>

              {step === 'offer' && (
                <button
                  onClick={() => setStep('qr')}
                  className="btn-cta w-full text-center text-paper rounded-xl py-4 text-lg transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer"
                  style={{ background: 'linear-gradient(135deg,#FF2D6F 0%,#D81557 100%)', boxShadow: '0 8px 32px rgba(255,45,111,0.3)' }}
                >
                  Tôi muốn nâng lên VIP →
                </button>
              )}

              {step === 'qr' && (
                <QrStep qrUrl={qrUrl} orderId={orderId} onConfirm={handleConfirm} />
              )}

              {step === 'confirming' && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <p className="text-paper/60 text-sm">Đang xác nhận...</p>
                </div>
              )}

              {step === 'error' && (
                <div className="text-center py-3">
                  <p className="text-red-400 text-sm mb-3">{errMsg || 'Có lỗi xảy ra'}</p>
                  <button onClick={() => setStep('qr')} className="text-accent text-sm underline cursor-pointer">Thử lại</button>
                </div>
              )}
            </div>

            {/* Countdown */}
            <div className="flex items-center gap-2 justify-center mb-7">
              <ClockIcon />
              <span className="text-paper/35 text-xs">Khai mạc còn <CountdownTimer /> · Offer VIP đóng trước giờ live</span>
            </div>

            {/* Skip */}
            <div className="text-center">
              <a href={ZALO_FREE_URL} target="_blank" rel="noopener noreferrer"
                className="text-paper/30 text-sm hover:text-paper/55 transition-colors underline underline-offset-4 decoration-paper/15">
                Không, cảm ơn — tôi xem miễn phí thôi →
              </a>
            </div>
          </>
        )}

        {/* Footer */}
        <p className="text-center text-paper/18 text-xs mt-12 leading-relaxed">
          Thông tin được bảo mật · Không chia sẻ bên thứ ba
        </p>
      </div>
    </div>
  )
}

/* ── QR Step ─────────────────────────────────────────────────────────────── */
function QrStep({ qrUrl, orderId, onConfirm }: { qrUrl: string; orderId: string; onConfirm: () => void }) {
  const [copied, setCopied] = useState(false)
  const desc = `VIPWB ${orderId}`

  function copyDesc() {
    navigator.clipboard.writeText(desc).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="space-y-4">
      {/* Instruction */}
      <div className="rounded-xl px-4 py-3 text-sm text-paper/70 leading-relaxed" style={{ background: 'rgba(255,45,111,0.07)', border: '1px solid rgba(255,45,111,0.2)' }}>
        <strong className="text-paper">Bước 1:</strong> Quét QR hoặc chuyển khoản theo thông tin bên dưới.<br />
        <strong className="text-paper">Bước 2:</strong> Bấm <em>"Tôi đã chuyển khoản"</em> — team sẽ duyệt và thêm vào nhóm VIP.
      </div>

      {/* QR + Transfer info */}
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        {/* QR */}
        <div className="shrink-0 w-40 h-40 rounded-2xl overflow-hidden bg-white flex items-center justify-center">
          {qrUrl ? (
            <img src={qrUrl} alt="QR chuyển khoản VIP" className="w-full h-full object-contain" />
          ) : (
            <div className="text-center p-3">
              <div className="text-gray-400 text-xs">QR sẽ hiện<br />sau khi cấu hình<br />ngân hàng</div>
            </div>
          )}
        </div>

        {/* Transfer details */}
        <div className="flex-1 space-y-2.5 text-sm w-full">
          <InfoRow label="Số tài khoản" value={BANK_ACCOUNT || '(chưa cấu hình)'} />
          <InfoRow label="Ngân hàng" value={BANK_CODE} />
          <InfoRow label="Chủ tài khoản" value={BANK_NAME} />
          <InfoRow label="Số tiền" value={`${VIP_AMOUNT.toLocaleString('vi-VN')}đ`} highlight />
          <div>
            <div className="text-paper/40 text-xs mb-1">Nội dung chuyển khoản</div>
            <button onClick={copyDesc} className="flex items-center gap-2 w-full text-left rounded-lg px-3 py-2 cursor-pointer transition-all" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <span className="text-paper font-mono font-bold flex-1">{desc}</span>
              <span className="text-xs text-paper/50 shrink-0">{copied ? '✓ Đã copy' : 'Copy'}</span>
            </button>
            <div className="text-paper/30 text-xs mt-1">⚠ Nhập đúng nội dung để team xác nhận nhanh</div>
          </div>
        </div>
      </div>

      {/* Confirm button */}
      <button
        onClick={onConfirm}
        className="btn-cta w-full text-center text-paper rounded-xl py-4 text-lg transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer mt-2"
        style={{ background: 'linear-gradient(135deg,#FF2D6F 0%,#D81557 100%)', boxShadow: '0 8px 24px rgba(255,45,111,0.3)' }}
      >
        Tôi đã chuyển khoản ✓
      </button>
    </div>
  )
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-paper/40 text-xs mb-0.5">{label}</div>
      <div className={`font-semibold ${highlight ? 'text-accent text-base' : 'text-paper text-sm'}`}>{value}</div>
    </div>
  )
}

/* ── Success State ────────────────────────────────────────────────────────── */
function SuccessState() {
  return (
    <div className="text-center py-4">
      <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: 'rgba(255,45,111,0.12)', border: '2px solid rgba(255,45,111,0.3)' }}>
        <svg className="w-10 h-10 text-accent" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 className="text-paper text-center mb-3" style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', lineHeight: 1.2 }}>
        Đã nhận — chờ xác nhận!
      </h2>
      <p className="text-paper/55 text-sm leading-relaxed mb-8 max-w-sm mx-auto">
        Team sẽ kiểm tra chuyển khoản và thêm anh chị vào nhóm VIP trong vòng <strong className="text-paper">15–30 phút</strong>.<br /><br />
        Trong lúc chờ, vào nhóm Zalo VIP để nhận tài liệu trước.
      </p>
      <a
        href={ZALO_VIP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-cta inline-flex items-center gap-2 text-paper rounded-xl px-8 py-4 text-lg transition-all hover:opacity-90"
        style={{ background: 'linear-gradient(135deg,#FF2D6F 0%,#D81557 100%)', boxShadow: '0 8px 32px rgba(255,45,111,0.35)' }}
      >
        Vào nhóm Zalo VIP →
      </a>
    </div>
  )
}

/* ── Icons ──────────────────────────────────────────────────────────────── */
function PlayIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
}
function CalIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
}
function PhoneIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
}
function DocIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
}
function GroupIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
}
function StarIcon() {
  return <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
}
function ClockIcon() {
  return <svg className="w-4 h-4 text-paper/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
}
