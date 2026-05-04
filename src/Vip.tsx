import { useState, useEffect, useCallback } from 'react'

/* ── ENV vars ───────────────────────────────────────────────────────────── */
const ZALO_FREE_URL     = import.meta.env.VITE_ZALO_URL          || 'https://zalo.me/g/fwtjhqz5bkchcxuontjq'
const ZALO_VIP_URL      = import.meta.env.VITE_ZALO_VIP_URL      || 'https://zalo.me/g/a4cbjzoa8xjm4q8cfi5f'
const VIP_API_URL       = import.meta.env.VITE_VIP_CONFIRM_API   || ''
const BANK_CODE         = import.meta.env.VITE_BANK_CODE         || 'MB'
const BANK_ACCOUNT      = import.meta.env.VITE_BANK_ACCOUNT      || '0123456789'
const BANK_NAME         = import.meta.env.VITE_BANK_NAME         || 'TRAN NGUYEN TRIET'
const VIP_AMOUNT        = 499000
const VIP_PRICE_DISPLAY = '499.000đ'
const SESSION_MINUTES   = 15   // offer expires after N minutes

/* ── Session countdown (15 phút từ lần đầu vào trang) ───────────────────── */
function getSessionExpiry(): number {
  const KEY = 'vip_offer_expiry'
  const stored = sessionStorage.getItem(KEY)
  if (stored) return parseInt(stored, 10)
  const expiry = Date.now() + SESSION_MINUTES * 60 * 1000
  sessionStorage.setItem(KEY, String(expiry))
  return expiry
}

function useSessionCountdown() {
  const [expiry] = useState(getSessionExpiry)
  const [remaining, setRemaining] = useState(() => Math.max(0, expiry - Date.now()))

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, expiry - Date.now()))
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [expiry])

  const mm = String(Math.floor(remaining / 60000)).padStart(2, '0')
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')
  return { remaining, mm, ss, expired: remaining === 0 }
}

/* ── Sticky countdown bar ────────────────────────────────────────────────── */
function StickyBar({ onUpgrade, expired }: { onUpgrade: () => void; expired: boolean }) {
  const { mm, ss } = useSessionCountdown()
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-3 px-4 py-3 md:px-8"
      style={{ background: 'linear-gradient(135deg,#1a0a10 0%,#0C0C0F 100%)', borderTop: '1px solid rgba(255,45,111,0.3)', boxShadow: '0 -8px 32px rgba(0,0,0,0.6)' }}
    >
      {/* Label + timer */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-paper/50 text-xs font-bold tracking-widest uppercase hidden sm:block shrink-0">
          {expired ? 'Offer đã đóng' : 'Nâng VIP đóng trong'}
        </span>
        <span className="text-paper/50 text-xs font-bold tracking-widest uppercase sm:hidden shrink-0">
          {expired ? 'Đã đóng' : 'Còn'}
        </span>
        {!expired && (
          <div className="flex items-end gap-1">
            <div className="text-center">
              <div className="text-paper font-black tabular-nums leading-none" style={{ fontSize: 'clamp(1.4rem,4vw,2rem)', fontFamily: "'Barlow Semi Condensed',sans-serif" }}>{mm}</div>
              <div className="text-accent text-[10px] font-bold uppercase tracking-wider">Phút</div>
            </div>
            <div className="text-paper font-black leading-none mb-1" style={{ fontSize: 'clamp(1.2rem,3.5vw,1.8rem)', fontFamily: "'Barlow Semi Condensed',sans-serif" }}>:</div>
            <div className="text-center">
              <div className="text-paper font-black tabular-nums leading-none" style={{ fontSize: 'clamp(1.4rem,4vw,2rem)', fontFamily: "'Barlow Semi Condensed',sans-serif" }}>{ss}</div>
              <div className="text-accent text-[10px] font-bold uppercase tracking-wider">Giây</div>
            </div>
          </div>
        )}
        {expired && (
          <span className="text-accent font-bold text-sm">Offer VIP không còn khả dụng</span>
        )}
      </div>

      {/* CTA */}
      {!expired && (
        <button
          onClick={onUpgrade}
          className="btn-cta shrink-0 text-paper rounded-lg px-4 py-2.5 text-sm md:text-base transition-all hover:opacity-90 active:scale-[0.97] cursor-pointer whitespace-nowrap"
          style={{ background: 'linear-gradient(135deg,#FF2D6F 0%,#D81557 100%)', boxShadow: '0 4px 20px rgba(255,45,111,0.4)' }}
        >
          Nâng lên VIP →
        </button>
      )}
      {expired && (
        <a href={ZALO_FREE_URL} target="_blank" rel="noopener noreferrer"
          className="shrink-0 text-paper/50 text-xs underline underline-offset-2">
          Vào nhóm free →
        </a>
      )}
    </div>
  )
}

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
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [])
  return <span className="font-mono tabular-nums text-accent font-bold">{cd}</span>
}

/* ── Benefits data ───────────────────────────────────────────────────────── */
const BENEFITS = [
  {
    num: '01',
    hot: false,
    title: 'Record toàn bộ 2 tiếng webinar',
    body: 'Xem lại không giới hạn. Nghe bỏ lỡ ý nào — tua lại ngay. Không lo đến muộn hay mất tập trung vì con cái, công việc.',
  },
  {
    num: '02',
    hot: true,
    title: 'Buổi hỏi đáp riêng 17/5 — hỏi gì cũng được',
    body: 'Ngày 17/5, Triết mở buổi riêng cho nhóm VIP. Anh chị hỏi thẳng về case của mình — đang dạy gì, muốn làm gì, đang mắc ở đâu. Triết trả lời thật, không trả lời kiểu "tuỳ trường hợp". Đây không phải Q&A chung. Là buổi Triết ngồi với anh chị.',
  },
  {
    num: '03',
    hot: true,
    title: '1 buổi private call thẩm định 1:1',
    body: '30 phút. Anh chị trình bày idea — Triết nói thẳng nên làm hay không nên làm, và tại sao. Không có gói nào khác của MONA có điều này.',
  },
  {
    num: '04',
    hot: false,
    title: 'Tài liệu nội bộ độc quyền',
    body: 'Bộ template MONA dùng để onboard case thực tế: cấu trúc khoá học, checklist launch sản phẩm điện tử. Không bán riêng, không public.',
  },
  {
    num: '05',
    hot: false,
    title: 'Phòng chờ Zalo VIP — vào ngay sau khi thanh toán',
    body: 'Triết sẽ share thêm tài nguyên, trả lời câu hỏi nhanh và cập nhật trực tiếp trước ngày 9/5. Anh chị không phải ngồi chờ như nhóm free.',
  },
]

/* ── Main ────────────────────────────────────────────────────────────────── */
export default function Vip() {
  const [orderId]  = useState(makeOrderId)
  const [step, setStep] = useState<'offer' | 'qr' | 'confirming' | 'success' | 'error'>('offer')
  const [errMsg, setErrMsg]   = useState('')
  const [user] = useState<{ hoten: string; sdt: string; email: string } | null>(() => {
    try { return JSON.parse(sessionStorage.getItem('vip_user') || 'null') } catch { return null }
  })
  const qrUrl = makeQrUrl(orderId)
  const { expired } = useSessionCountdown()

  const handleUpgradeClick = useCallback(() => {
    if (step === 'offer') setStep('qr')
    // Scroll to CTA block
    document.getElementById('vip-cta')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [step])

  async function handleConfirm() {
    setStep('confirming')
    try {
      if (VIP_API_URL) {
        const res = await fetch(VIP_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, amount: VIP_AMOUNT, hoten: user?.hoten || '', sdt: user?.sdt || '', email: user?.email || '' }),
        })
        if (!res.ok) throw new Error(await res.text())
      }
      sessionStorage.removeItem('vip_user')
      setStep('success')
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Lỗi kết nối')
      setStep('error')
    }
  }

  return (
    <div className="min-h-screen" style={{ background: '#0C0C0F' }}>
      {/* bg glow */}
      <div className="pointer-events-none fixed inset-0" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -5%, rgba(255,45,111,0.15) 0%, transparent 65%)' }} />

      <StickyBar onUpgrade={handleUpgradeClick} expired={expired} />
    <div className="relative max-w-2xl mx-auto px-4 py-14 md:py-20" style={{ paddingBottom: '6rem' }}>

        {step === 'success' ? <SuccessState /> : (
          <>
            {/* ── Badge ── */}
            <div className="flex justify-center mb-8">
              <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-accent border border-accent/40 rounded-full px-4 py-1.5" style={{ background: 'rgba(255,45,111,0.08)' }}>
                <StarIcon /> Dành riêng cho anh chị vừa đăng ký
              </span>
            </div>

            {/* ── Headline ── */}
            <h1 className="text-paper text-center mb-4" style={{ fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', fontSize: 'clamp(2rem, 5vw, 3.2rem)', lineHeight: 1.1 }}>
              Nâng lên <span className="text-accent">VIP</span> —<br />
              lợi thế không công bằng<br />cho người nghiêm túc
            </h1>

            {/* ── Opening copy ── */}
            <div className="max-w-lg mx-auto mb-10 space-y-3">
              <p className="text-paper/70 text-center text-base leading-relaxed">
                Anh chị vừa đăng ký. Đó là bước đầu tiên — và phần lớn người dừng lại ở đó.
              </p>
              <p className="text-paper text-center text-base leading-relaxed font-medium">
                Nâng VIP là anh chị đang nói với chính mình:{' '}
                <em className="text-accent not-italic">"Tôi không đến để nghe cho biết. Tôi đến để làm thật."</em>
              </p>
            </div>

            {/* ── Benefits ── */}
            <div className="space-y-3 mb-10">
              {BENEFITS.map((b) => (
                <div key={b.num}
                  className="rounded-2xl px-5 py-4 flex gap-4"
                  style={{
                    background: b.hot ? 'rgba(255,45,111,0.08)' : 'rgba(255,255,255,0.04)',
                    border: b.hot ? '1px solid rgba(255,45,111,0.28)' : '1px solid rgba(255,255,255,0.07)',
                  }}>
                  {/* Number */}
                  <div className="shrink-0 pt-0.5">
                    <span className="font-black text-xs" style={{ fontFamily: "'Barlow Semi Condensed', sans-serif", color: b.hot ? '#FF2D6F' : 'rgba(255,255,255,0.18)', letterSpacing: '0.05em' }}>{b.num}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-paper text-sm leading-snug">{b.title}</span>
                      {b.hot && <span className="text-xs font-bold text-accent bg-accent/10 border border-accent/25 rounded-full px-2 py-0.5 shrink-0">Quan trọng</span>}
                    </div>
                    <p className="text-paper/52 text-sm leading-relaxed">{b.body}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Price + CTA block ── */}
            <div id="vip-cta" className="rounded-2xl p-6 md:p-8 mb-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <div className="flex items-end justify-between mb-5">
                <div>
                  <div className="text-paper/40 text-xs font-semibold uppercase tracking-wider mb-1">Học phí VIP</div>
                  <div className="text-accent font-black leading-none" style={{ fontSize: '2.6rem', fontFamily: "'Barlow Semi Condensed', sans-serif" }}>{VIP_PRICE_DISPLAY}</div>
                  <div className="text-paper/35 text-xs mt-1.5">Trả một lần · giữ mãi</div>
                </div>
                <div className="text-right text-paper/40 text-xs space-y-1">
                  <div className="line-through">Webinar Free</div>
                  <div className="font-semibold text-paper/55">+ 5 quyền lợi VIP</div>
                </div>
              </div>

              {step === 'offer' && !expired && (
                <>
                  <button
                    onClick={() => setStep('qr')}
                    className="btn-cta w-full text-center text-paper rounded-xl py-4 text-lg transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer mb-3"
                    style={{ background: 'linear-gradient(135deg,#FF2D6F 0%,#D81557 100%)', boxShadow: '0 8px 32px rgba(255,45,111,0.3)' }}
                  >
                    Tôi muốn nâng lên VIP →
                  </button>
                  <p className="text-paper/30 text-xs text-center">
                    Bấm vào để xem thông tin chuyển khoản. Sau khi chuyển, bấm xác nhận — team duyệt trong 15–30 phút.
                  </p>
                </>
              )}

              {step === 'offer' && expired && (
                <div className="text-center py-3 space-y-2">
                  <p className="text-paper/50 text-sm">Offer VIP đã hết hạn.</p>
                  <a href={ZALO_FREE_URL} target="_blank" rel="noopener noreferrer"
                    className="inline-block text-accent text-sm underline underline-offset-2">
                    Vào nhóm Zalo miễn phí →
                  </a>
                </div>
              )}

              {step === 'qr' && <QrStep qrUrl={qrUrl} orderId={orderId} onConfirm={handleConfirm} />}

              {step === 'confirming' && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <p className="text-paper/55 text-sm">Đang xác nhận...</p>
                </div>
              )}

              {step === 'error' && (
                <div className="text-center py-3 space-y-2">
                  <p className="text-red-400 text-sm">{errMsg || 'Có lỗi xảy ra'}</p>
                  <button onClick={() => setStep('qr')} className="text-accent text-sm underline cursor-pointer">Thử lại</button>
                </div>
              )}
            </div>

            {/* ── Urgency ── */}
            <div className="rounded-xl px-4 py-3 mb-7 flex items-start gap-3" style={{ background: 'rgba(255,45,111,0.06)', border: '1px solid rgba(255,45,111,0.18)' }}>
              <ClockIcon />
              <div className="text-sm leading-relaxed">
                <span className="text-paper/70">Offer VIP đóng trước giờ khai mạc webinar 9/5/2026 lúc 20:00 — còn </span>
                <CountdownTimer />
                <span className="text-paper/70">. Sau đó không có cách nào nâng lên VIP. Buổi 17/5 cũng không mở thêm slot.</span>
              </div>
            </div>

            {/* ── Skip ── */}
            <div className="text-center">
              <a
                href={ZALO_FREE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-paper/28 text-sm hover:text-paper/50 transition-colors"
              >
                Không, cảm ơn Triết — tôi xem free thôi, không cần thêm hỗ trợ →
              </a>
            </div>
          </>
        )}

        <p className="text-center text-paper/18 text-xs mt-12">Thông tin được bảo mật · Không chia sẻ bên thứ ba</p>
      </div>
    </div>
  )
}

/* ── QR Step ─────────────────────────────────────────────────────────────── */
function QrStep({ qrUrl, orderId, onConfirm }: { qrUrl: string; orderId: string; onConfirm: () => void }) {
  const [copied, setCopied] = useState(false)
  const desc = `VIPWB ${orderId}`

  function copyDesc() {
    navigator.clipboard.writeText(desc).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl px-4 py-3 text-sm text-paper/65 leading-relaxed" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <strong className="text-paper">Bước 1</strong> — Quét QR hoặc chuyển khoản theo thông tin bên dưới.<br />
        <strong className="text-paper">Bước 2</strong> — Bấm <span className="text-accent font-semibold">"Tôi đã chuyển khoản"</span> — team duyệt và thêm vào nhóm VIP trong 15–30 phút.
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center">
        {/* QR */}
        <div className="shrink-0 w-44 h-44 rounded-2xl overflow-hidden bg-white flex items-center justify-center shadow-lg">
          {qrUrl ? (
            <img src={qrUrl} alt="QR chuyển khoản VIP" className="w-full h-full object-contain" />
          ) : (
            <div className="text-center p-3 text-gray-300 text-xs leading-relaxed font-medium">[ QR sẽ hiện<br />sau khi cấu hình ]</div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 space-y-3 w-full">
          <InfoRow label="Ngân hàng" value={BANK_CODE} placeholder={!import.meta.env.VITE_BANK_CODE} />
          <InfoRow label="Số tài khoản" value={BANK_ACCOUNT} placeholder={!import.meta.env.VITE_BANK_ACCOUNT} />
          <InfoRow label="Chủ tài khoản" value={BANK_NAME} placeholder={!import.meta.env.VITE_BANK_NAME} />
          <InfoRow label="Số tiền" value={`${VIP_AMOUNT.toLocaleString('vi-VN')}đ`} highlight />
          <div>
            <div className="text-paper/40 text-xs mb-1">Nội dung chuyển khoản</div>
            <button onClick={copyDesc} className="flex items-center gap-2 w-full text-left rounded-lg px-3 py-2.5 cursor-pointer transition-all hover:border-white/20" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.11)' }}>
              <span className="text-paper font-mono font-bold flex-1 text-sm">{desc}</span>
              <span className="text-xs text-paper/45 shrink-0 font-medium">{copied ? '✓ Đã copy' : 'Bấm để copy'}</span>
            </button>
            <p className="text-paper/30 text-xs mt-1">⚠ Nhập đúng nội dung để team xác nhận nhanh</p>
          </div>
        </div>
      </div>

      <button
        onClick={onConfirm}
        className="btn-cta w-full text-center text-paper rounded-xl py-4 text-lg transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer"
        style={{ background: 'linear-gradient(135deg,#FF2D6F 0%,#D81557 100%)', boxShadow: '0 8px 24px rgba(255,45,111,0.28)' }}
      >
        Tôi đã chuyển khoản ✓
      </button>
    </div>
  )
}

function InfoRow({ label, value, highlight, placeholder }: { label: string; value: string; highlight?: boolean; placeholder?: boolean }) {
  return (
    <div>
      <div className="text-paper/38 text-xs mb-0.5">{label}</div>
      <div className={`font-semibold ${highlight ? 'text-accent text-lg' : placeholder ? 'text-paper/35 text-sm italic' : 'text-paper text-sm'}`}>
        {placeholder ? `[ ${value} ]` : value}
      </div>
    </div>
  )
}

/* ── Success ─────────────────────────────────────────────────────────────── */
function SuccessState() {
  return (
    <div className="text-center py-8">
      <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(255,45,111,0.1)', border: '2px solid rgba(255,45,111,0.28)' }}>
        <svg className="w-10 h-10 text-accent" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 className="text-paper text-center mb-4" style={{ fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', fontSize: 'clamp(1.8rem, 4.5vw, 2.8rem)', lineHeight: 1.15 }}>
        Đã nhận —<br />chờ xác nhận!
      </h2>
      <p className="text-paper/55 text-sm leading-relaxed mb-2 max-w-sm mx-auto">
        Team sẽ kiểm tra chuyển khoản và thêm anh chị vào nhóm VIP trong vòng <strong className="text-paper">15–30 phút</strong>.
      </p>
      <p className="text-paper/55 text-sm leading-relaxed mb-8 max-w-sm mx-auto">
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

/* ── Icons ─────────────────────────────────────────────────────────────── */
function StarIcon() {
  return <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
}
function ClockIcon() {
  return <svg className="w-4 h-4 text-accent/60 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
}
