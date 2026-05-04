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
const SESSION_MINUTES   = 10   // cycle length — resets automatically when done
const SESSION_KEY       = 'vip_offer_expiry'

/* ── Session countdown — tự reset mỗi 5 phút, F5 vẫn countdown tiếp ───── */
function makeExpiry() {
  const expiry = Date.now() + SESSION_MINUTES * 60 * 1000
  sessionStorage.setItem(SESSION_KEY, String(expiry))
  return expiry
}

function getSessionExpiry(): number {
  const stored = sessionStorage.getItem(SESSION_KEY)
  if (stored) {
    const val = parseInt(stored, 10)
    if (val > Date.now()) return val   // còn hạn — dùng tiếp
  }
  return makeExpiry()                  // hết hoặc chưa có — tạo mới
}

function useSessionCountdown() {
  const [expiry, setExpiry] = useState(getSessionExpiry)
  const [remaining, setRemaining] = useState(() => Math.max(0, expiry - Date.now()))

  useEffect(() => {
    const tick = () => {
      const r = Math.max(0, expiry - Date.now())
      setRemaining(r)
      if (r === 0) setExpiry(makeExpiry())  // auto-reset → vòng mới
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [expiry])

  const mm = String(Math.floor(remaining / 60000)).padStart(2, '0')
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')
  return { remaining, mm, ss, expired: false }  // không bao giờ expired
}

/* ── Sticky countdown bar — floating popper full-container ───────────────── */
function StickyBar({ onUpgrade }: { onUpgrade: () => void }) {
  const { mm, ss } = useSessionCountdown()
  return (
    <div style={{ position: 'fixed', bottom: '1rem', left: '50%', transform: 'translateX(-50%)', zIndex: 50, width: '100%', maxWidth: '48rem', padding: '0 1rem' }}>
      <div className="flex items-center justify-between gap-4 px-7 py-4 rounded-2xl w-full"
        style={{ background: 'rgb(255,255,255)', border: '1.5px solid rgba(0,0,0,0.1)', boxShadow: '0 20px 60px rgba(0,0,0,0.28), 0 4px 16px rgba(0,0,0,0.12)' }}>

        {/* Label */}
        <p className="font-black uppercase shrink-0"
          style={{ fontSize: 'clamp(0.75rem,1.8vw,1rem)', letterSpacing: '0.14em', fontFamily: "'Inter',sans-serif", lineHeight: 1.3, color: '#0E0E10', fontWeight: 900 }}>
          Nâng VIP<br />đóng trong
        </p>

        <div className="w-px self-stretch bg-ink/15 shrink-0" />

        {/* Digits — center */}
        <div className="flex items-end gap-2 flex-1 justify-center shrink-0">
          {[{ v: mm, label: 'Phút' }, { v: ss, label: 'Giây' }].map(({ v, label }, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="text-center">
                <div className="font-black tabular-nums leading-none text-ink"
                  style={{ fontSize: 'clamp(2.4rem,7vw,3.5rem)', fontFamily: "'Barlow Semi Condensed',sans-serif", letterSpacing: '-0.02em' }}>
                  {v}
                </div>
                <div className="font-bold uppercase text-accent tracking-widest" style={{ fontSize: '0.65rem' }}>{label}</div>
              </div>
              {i === 0 && (
                <div className="font-black text-ink/25 leading-none pb-6"
                  style={{ fontSize: 'clamp(2rem,6vw,3rem)', fontFamily: "'Barlow Semi Condensed',sans-serif" }}>
                  :
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="w-px self-stretch bg-ink/15 shrink-0" />

        {/* CTA */}
        <button
          onClick={onUpgrade}
          className="shrink-0 text-white rounded-xl cursor-pointer transition-all hover:opacity-90 active:scale-[0.97]"
          style={{ background: 'linear-gradient(135deg,#FF2D6F 0%,#D81557 100%)', boxShadow: '0 6px 24px rgba(255,45,111,0.5)', fontFamily: "'Barlow Semi Condensed',sans-serif", fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 'clamp(1rem,2.8vw,1.3rem)', padding: 'clamp(0.6rem,1.5vw,0.85rem) clamp(1.2rem,3vw,2rem)' }}>
          Nâng lên VIP →
        </button>
      </div>
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
  const TARGET = new Date('2026-05-16T20:00:00+07:00')
  const [cd, setCd] = useState('-- ngày --:--:--')
  useEffect(() => {
    const tick = () => {
      const diff = TARGET.getTime() - Date.now()
      if (diff <= 0) { setCd('ĐANG DIỄN RA'); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      const hh = String(h).padStart(2,'0')
      const mm = String(m).padStart(2,'0')
      const ss = String(s).padStart(2,'0')
      setCd(`${d} ngày ${hh} giờ ${mm} phút ${ss} giây`)
    }
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [])
  return <span className="font-mono tabular-nums text-accent font-bold">{cd}</span>
}

/* ── Benefits data ───────────────────────────────────────────────────────── */
const BENEFITS = [
  { num: '01', hot: false, value: '500.000đ', title: 'Record toàn bộ 2 tiếng webinar — xem lại không giới hạn', body: '' },
  { num: '02', hot: true,  value: '2.000.000đ', title: 'Buổi hỏi đáp riêng 17/5 — hỏi thẳng về case của anh chị', body: '' },
  { num: '03', hot: true,  value: '3.000.000đ', title: '1 buổi private call 1:1 — Triết thẩm định idea cho anh chị', body: '' },
  { num: '04', hot: false, value: '800.000đ', title: 'Tài liệu nội bộ MONA — không bán, không public', body: '' },
  { num: '05', hot: false, value: '700.000đ', title: 'Nhóm Zalo VIP — vào ngay, nhận tài liệu trước webinar', body: '' },
]

/* ── Benefits với inline emphasis + emoji (dùng trong UI) ───────────────── */
const BENEFITS_RICH = [
  {
    num: '01', hot: false, value: '500.000đ', emoji: '🎬',
    title: 'Record toàn bộ 2 tiếng webinar — xem lại không giới hạn',
    body: <>Sẽ có những đoạn anh chị muốn nghe lại — một con số, một framework, một câu Triết nói qua mà chưa kịp ghi. <strong>Record VIP cho phép xem lại bất cứ lúc nào, không hết hạn.</strong> Xem lần 1 để hiểu. Xem lần 2 để làm. Xem lần 3 để dạy lại cho đội nhóm.</>,
  },
  {
    num: '02', hot: true, value: '2.000.000đ', emoji: '💬',
    title: 'Buổi hỏi đáp riêng 17/5 — hỏi thẳng về case của anh chị',
    body: <>Đây không phải Q&A kiểu "hỏi chung, trả lời chung". Anh chị hỏi về <strong>đúng case của mình</strong> — đang dạy gì, kinh nghiệm gì, thị trường nào, mắc chỗ nào. Triết trả lời thật, <span className="underline underline-offset-2 decoration-accent/50">không né, không "tuỳ trường hợp".</span> Chỉ slot VIP mới có buổi này.</>,
  },
  {
    num: '03', hot: true, value: '3.000.000đ', emoji: '📞',
    title: '1 buổi private call 1:1 — Triết thẩm định idea cho anh chị',
    body: <>30 phút. Anh chị trình bày: tôi có kinh nghiệm X năm, muốn bán khóa Y, tệp đang có là Z. Triết sẽ nói thẳng: nên làm không, làm theo hướng nào, cái gì đang sai. <strong>Không có gói nào khác của MONA có điều này</strong> — kể cả gói trả tiền.</>,
  },
  {
    num: '04', hot: false, value: '800.000đ', emoji: '📁',
    title: 'Tài liệu nội bộ MONA — không bán, không public',
    body: <>Bộ template MONA đang dùng để onboard giảng viên mới: <strong>cấu trúc khoá học, checklist launch, bảng giá tham chiếu.</strong> Anh chị nhận file thẳng vào nhóm VIP — <span className="underline underline-offset-2 decoration-accent/50">dùng được ngay, không cần tự mò.</span></>,
  },
  {
    num: '05', hot: false, value: '700.000đ', emoji: '📲',
    title: 'Nhóm Zalo VIP — vào ngay, nhận tài liệu trước webinar',
    body: <>Sau khi thanh toán, anh chị vào nhóm VIP ngay. Triết share thêm tài nguyên và trả lời nhanh trước ngày 16/5. <strong>Không phải ngồi chờ như nhóm free.</strong> Và trong nhóm VIP — anh chị sẽ thấy ai đang làm thật, đang hỏi thật. Khác hẳn.</>,
  },
]

/* ── Inline CTA — same style as sticky bar ───────────────────────────────── */
function InlineCta({ onUpgrade, mm, ss, dark, flush }: { onUpgrade: () => void; mm: string; ss: string; dark: boolean; flush?: boolean }) {
  return (
    <div className={`max-w-3xl mx-auto pb-4 ${flush ? '' : 'px-4'}`}>
      <div className="flex items-center justify-between gap-4 px-6 py-4 rounded-2xl"
        style={dark
          ? { background: '#0C0C0F', border: '1.5px solid rgba(255,45,111,0.25)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', position: 'relative', zIndex: 1 }
          : { background: '#FFFFFF', border: '1px solid #E6E6EA', boxShadow: '0 4px 16px rgba(0,0,0,0.07)', position: 'relative', zIndex: 1 }
        }>
        {/* Label */}
        <p className="font-black uppercase shrink-0"
          style={{ fontSize: '0.75rem', letterSpacing: '0.14em', fontFamily: "'Inter',sans-serif", lineHeight: 1.3, color: dark ? '#FFFFFF' : '#0E0E10', fontWeight: 900 }}>
          Nâng VIP<br />đóng trong
        </p>
        <div className="w-px h-8 shrink-0" style={{ background: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)' }} />
        {/* Digits */}
        <div className="flex items-end gap-1.5 flex-1 justify-center shrink-0">
          {[{ v: mm, label: 'Phút' }, { v: ss, label: 'Giây' }].map(({ v, label }, i) => (
            <div key={i} className="flex items-end gap-1.5">
              <div className="text-center">
                <div className="font-black tabular-nums leading-none"
                  style={{ fontSize: 'clamp(1.8rem,5vw,2.6rem)', fontFamily: "'Barlow Semi Condensed',sans-serif", letterSpacing: '-0.02em', color: dark ? '#FFFFFF' : '#0E0E10' }}>
                  {v}
                </div>
                <div className="font-bold uppercase text-accent tracking-widest" style={{ fontSize: '0.58rem' }}>{label}</div>
              </div>
              {i === 0 && (
                <div className="font-black leading-none pb-5"
                  style={{ fontSize: 'clamp(1.6rem,4vw,2.2rem)', fontFamily: "'Barlow Semi Condensed',sans-serif", color: dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }}>
                  :
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="w-px h-8 shrink-0" style={{ background: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)' }} />
        {/* CTA */}
        <button onClick={onUpgrade}
          className="shrink-0 text-white rounded-xl cursor-pointer transition-all hover:opacity-90 active:scale-[0.97]"
          style={{ background: 'linear-gradient(135deg,#FF2D6F 0%,#D81557 100%)', boxShadow: '0 4px 16px rgba(255,45,111,0.4)', fontFamily: "'Barlow Semi Condensed',sans-serif", fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 'clamp(0.9rem,2.5vw,1.1rem)', padding: '0.6rem 1.4rem' }}>
          Nâng lên VIP →
        </button>
      </div>
    </div>
  )
}

/* ── Main ────────────────────────────────────────────────────────────────── */
export default function Vip() {
  const [orderId]  = useState(makeOrderId)
  const [step, setStep] = useState<'offer' | 'qr' | 'confirming' | 'success' | 'error'>('offer')
  const [errMsg, setErrMsg]   = useState('')
  const [user] = useState<{ hoten: string; sdt: string; email: string } | null>(() => {
    try { return JSON.parse(sessionStorage.getItem('vip_user') || 'null') } catch { return null }
  })
  const qrUrl = makeQrUrl(orderId)
  const { expired, mm, ss } = useSessionCountdown()

  const handleUpgradeClick = useCallback(() => {
    if (step === 'offer') setStep('qr')
    // Scroll to CTA block
    document.getElementById('vip-cta')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [step])

  async function handleConfirm() {
    setStep('confirming')
    if (VIP_API_URL) {
      try {
        const res = await fetch(VIP_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, amount: VIP_AMOUNT, hoten: user?.hoten || '', sdt: user?.sdt || '', email: user?.email || '' }),
        })
        if (!res.ok) console.error('VIP API:', await res.text())
      } catch (e) {
        console.error('VIP API error:', e)
      }
    }
    sessionStorage.removeItem('vip_user')
    setStep('success')
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Pink accent line — top (same as home) */}
      <div className="pointer-events-none fixed top-0 inset-x-0 h-px z-10" style={{ background: 'linear-gradient(90deg,transparent,#FF2D6F 30%,#FF2D6F 70%,transparent)' }} />
      {/* Light hatch overlay */}
      <div className="pointer-events-none fixed inset-0 deco-hatch-light" />

      {step !== 'success' && <StickyBar onUpgrade={handleUpgradeClick} />}

      {step === 'success' ? (
        <div className="relative max-w-3xl mx-auto px-4 py-14 md:py-20" style={{ paddingBottom: '6rem' }}>
          <SuccessState orderId={orderId} />
          <p className="text-center text-ink italic text-base mt-12">* Thông tin được bảo mật · Không chia sẻ bên thứ ba</p>
        </div>
      ) : (
        <>
          {/* ═══ WARNING BANNER ═══ */}
          <div className="w-full px-4 py-2.5 flex justify-center" style={{ background: '#0C0C0F' }}>
            <div className="flex items-center gap-2.5 px-6 py-2.5 rounded-md w-full max-w-3xl"
              style={{ border: '1.5px dashed rgba(220,38,38,0.7)', background: 'rgba(220,38,38,0.08)' }}>
              <span className="text-red-500 text-lg shrink-0">⚠</span>
              <p className="text-paper font-black tracking-widest uppercase text-center flex-1"
                style={{ fontSize: 'clamp(0.7rem,2.2vw,0.88rem)', fontFamily: "'Barlow Semi Condensed',sans-serif", letterSpacing: '0.12em' }}>
                Đừng thoát trang này hoặc bấm "Back"
              </p>
            </div>
          </div>

          {/* ═══ HERO — dark opener ═══ */}
          <div className="relative overflow-hidden" style={{ background: '#0C0C0F', borderBottom: '3px solid #FF2D6F' }}>
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle,rgba(255,45,111,0.08) 1px,transparent 1px)', backgroundSize: '28px 28px' }} />
            <div className="relative max-w-3xl mx-auto px-4 pt-10 pb-10 text-center">
              <p className="sect-label text-accent mb-3">Dành riêng cho anh chị vừa đăng ký</p>
              <h1 className="text-paper mb-3" style={{ fontSize: 'clamp(2.6rem,7vw,4rem)', lineHeight: 1.05, letterSpacing: '-0.01em' }}>
                Chúc mừng!{' '}
                <span className="text-accent">Anh chị đã đăng ký thành công.</span>
              </h1>
              <p className="text-paper mx-auto" style={{ maxWidth: '480px', fontSize: '1.125rem', lineHeight: 1.7 }}>
                Đọc hết trang này trước khi đóng — Triết cần nói thêm 1 điều cực kỳ quan trọng với anh chị.
              </p>
            </div>
          </div>

          {/* ═══ LETTER SECTION — 2 col ═══ */}
          <div className="max-w-3xl mx-auto px-4 pt-10 pb-2">
            <div className="flex flex-col sm:flex-row gap-8 items-start">

              {/* Copy — letter style */}
              <div className="flex-1 min-w-0">
                <div className="space-y-4" style={{ fontSize: '1.125rem', lineHeight: 1.85, color: '#0E0E10' }}>
                  <p>Đầu tiên, <strong>Triết thật lòng chúc mừng anh chị.</strong></p>
                  <p>
                    Anh chị vừa làm điều mà <strong>99% người không làm được</strong> —{' '}
                    họ dừng ở mức <em>"đang tính"</em> và{' '}
                    <span className="underline underline-offset-2 decoration-accent/60">không thực sự hành động.</span>
                  </p>
                  <p>Điều đó lớn hơn nhiều so với vẻ ngoài của nó.</p>
                  <p style={{ fontWeight: 700 }}>Anh chị đã quyết định đăng ký.</p>
                  <p style={{ fontWeight: 700 }}>Anh chị đã sẵn sàng.</p>
                  <p>Và đây là những gì vừa xảy ra:</p>
                  <ul className="space-y-3 pl-0">
                    {[
                      <>Anh chị vừa thoát khỏi <strong>"research mode"</strong> từ xem rất nhiều video lời khuyên, đọc sách selfhelp và chờ đợi cơ hội — sang người <span className="underline underline-offset-2 decoration-accent/60">thực sự sẵn sàng bắt đầu.</span></>,
                      <>Anh chị sẽ nhận được <strong>công thức đầy đủ</strong> mà MONA dùng để đưa hơn 487 giảng viên từ <em>zero</em> lên doanh thu thật — <strong>không giữ lại gì.</strong></>,
                      <>Và anh chị đang ở đúng nơi, đúng thời điểm — để <span className="text-accent font-semibold">không chỉ nghe, mà còn làm được.</span></>,
                    ].map((item, i) => (
                      <li key={i} className="flex gap-3 items-start">
                        <span className="shrink-0 mt-1 text-accent text-base">✓</span>
                        <span style={{ fontSize: '1.125rem', color: '#0E0E10', lineHeight: 1.75 }}>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Photo — sticky on desktop */}
              <div className="sm:w-48 shrink-0 sm:sticky sm:top-6">
                <div className="rounded-2xl overflow-hidden shadow-md border border-line">
                  <img src="assets/triet-mona.jpg" alt="Triết — Growth Manager MONA Media" className="w-full object-cover object-top" style={{ aspectRatio: '3/4' }} loading="lazy" />
                </div>
                <p className="text-ink text-sm text-center mt-2 font-medium italic">* Triết — Growth Manager<br />MONA Group</p>
              </div>
            </div>
          </div>

          {/* ═══ TRANSITION CALLOUT ═══ */}
          <div className="max-w-3xl mx-auto px-4 py-8">
            <div className="rounded-2xl overflow-hidden shadow-md" style={{ background: '#FFFFFF', border: '1px solid #E6E6EA', position: 'relative', zIndex: 1 }}>
              <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg,#FF2D6F,#D81557)' }} />
              <div className="px-8 py-8">
                <p className="text-accent font-bold uppercase tracking-widest mb-4" style={{ fontSize: '0.72rem', letterSpacing: '0.18em' }}>Và đây là sự thật</p>
                <h2 className="text-ink mb-5" style={{ fontFamily: "'Barlow Semi Condensed',sans-serif", fontWeight: 800, fontSize: 'clamp(1.8rem,4.5vw,2.8rem)', lineHeight: 1.1, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
                  Nghe webinar thôi<br />chưa đủ để anh chị thắng chắc
                </h2>
                <p className="text-ink" style={{ fontSize: '1.05rem', lineHeight: 1.8, maxWidth: '520px' }}>
                  Hầu hết nghe xong — và không làm gì. Không phải vì họ lười. Mà vì <strong>không ai giúp họ bắt đầu từ đúng điểm,</strong> với <strong>đúng cách tiếp cận,</strong> cho đúng tệp khách hàng của họ.
                </p>
              </div>
            </div>
          </div>

          {/* ═══ MID-PAGE INLINE CTA #1 ═══ */}
          {!expired && <InlineCta onUpgrade={handleUpgradeClick} mm={mm} ss={ss} dark={false} />}

          {/* ═══ DARK STATS STRIP — 5 số ═══ */}
          <div className="relative overflow-hidden" style={{ background: '#0C0C0F' }}>
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
            <div className="relative max-w-3xl mx-auto px-4 py-8">
              <p className="sect-label text-accent text-center mb-5">Không phải hứa hẹn — là kết quả thật</p>
              <div className="flex divide-x divide-white/10">
                {[
                  { n: '582',      label: 'Tổng case',        accent: false },
                  { n: '487',      label: 'Case win có tên',  accent: true  },
                  { n: '84%',      label: 'Tỉ lệ thắng',     accent: false },
                  { n: '1000',     label: 'E-learning KPI 2026', accent: false },
                  { n: '2 tiếng', label: 'Không giấu bài',  accent: true  },
                ].map((s) => (
                  <div key={s.n} className="flex-1 min-w-0 px-2 py-2 text-center">
                    <div className={`font-black leading-none tabular-nums ${s.accent ? 'text-accent' : 'text-paper'}`}
                      style={{ fontSize: 'clamp(1.1rem,3.5vw,2.2rem)', fontFamily: "'Barlow Semi Condensed',sans-serif", fontStyle: 'italic' }}>
                      {s.n}
                    </div>
                    <div className="text-paper font-semibold uppercase tracking-wider mt-1 whitespace-nowrap"
                      style={{ fontSize: 'clamp(0.55rem,1.1vw,0.72rem)' }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ═══ DASHBOARD GALLERY — Số liệu thật ═══ */}
          {(() => {
            const row1 = [
              'Screenshot at Apr 29 15-02-19.png','Screenshot at Apr 29 15-02-40.png',
              'Screenshot at Apr 29 15-03-22.png','Screenshot at Apr 29 15-03-31.png',
              'Screenshot at Apr 29 15-03-45.png','Screenshot at Apr 29 15-03-54.png',
              'Screenshot at Apr 29 15-04-04.png','Screenshot at Apr 29 15-04-12.png',
              'Screenshot at Apr 29 15-04-32.png','Screenshot at Apr 29 15-04-46.png',
              'Screenshot at Apr 29 15-04-57.png','Screenshot at Apr 29 15-05-12.png',
            ]
            const row2 = [
              'Screenshot at Apr 29 15-05-22.png','Screenshot at Apr 29 15-05-31.png',
              'Screenshot at Apr 29 15-05-43.png','Screenshot at Apr 29 15-05-50.png',
              'Screenshot at Apr 29 15-05-58.png','Screenshot at Apr 29 15-06-16.png',
              'Screenshot at Apr 29 15-06-27.png','Screenshot at Apr 29 15-06-34.png',
              'Screenshot at Apr 29 15-06-41.png','Screenshot at Apr 29 15-06-57.png',
              'Screenshot at Apr 29 15-07-09.png',
            ]
            const Card = ({ f }: { f: string }) => (
              <div className="rounded-xl overflow-hidden shrink-0 shadow-sm" style={{ width: '320px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <img src={`assets/${f}`} alt="" loading="lazy" className="w-full h-full object-cover object-top" style={{ aspectRatio: '16/9', display: 'block' }} />
              </div>
            )
            return (
              <div className="relative overflow-hidden py-10" style={{ background: '#0C0C0F' }}>
                <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.035) 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
                <div className="relative max-w-3xl mx-auto px-4">
                  <div className="mb-7">
                    <div className="sect-label text-accent mb-3">Số liệu lấy trực tiếp từ hệ thống GMV của MONA E-Learning · realtime</div>
                    <p className="text-paper" style={{ fontFamily: "'Barlow Semi Condensed',sans-serif", fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', fontSize: 'clamp(2rem,4vw,2.8rem)', lineHeight: 1.15, letterSpacing: '-0.01em' }}>
                      Số liệu thật. Win thật.<br />Chia sẻ hết — không giấu diếm
                    </p>
                  </div>
                  <div className="proof-row mb-3">
                    <div className="proof-track ltr" style={{ '--spd': '50s' } as React.CSSProperties}>
                      {[...row1, ...row1].map((f, i) => <Card key={i} f={f} />)}
                    </div>
                  </div>
                  <div className="proof-row">
                    <div className="proof-track rtl" style={{ '--spd': '55s' } as React.CSSProperties}>
                      {[...row2, ...row2].map((f, i) => <Card key={i} f={f} />)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ═══ BENEFITS + PROOF — cream bg ═══ */}
          <div className="max-w-3xl mx-auto px-4 py-8">

            {/* Section label */}
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-1" style={{ background: 'rgba(255,45,111,0.1)', border: '1px solid rgba(255,45,111,0.25)' }}>
                <span className="text-accent font-black uppercase" style={{ fontFamily: "'Inter',sans-serif", fontSize: '0.72rem', letterSpacing: '0.2em' }}>Anh chị nhận được</span>
              </div>
            </div>

            {/* Benefits */}
            <div className="space-y-3 mb-8">
              {BENEFITS_RICH.map((b) => (
                <div key={b.num} className="rounded-2xl overflow-hidden"
                  style={b.hot
                    ? { background: '#0C0C0F', border: '1.5px solid #FF2D6F', boxShadow: '0 4px 24px rgba(255,45,111,0.18)' }
                    : { background: '#FFFFFF', border: '1px solid #E6E6EA', boxShadow: '0 4px 16px rgba(0,0,0,0.07)' }
                  }>
                  <div className="px-6 py-5">
                    {/* Top row: num + emoji + badge + value */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-black tabular-nums shrink-0"
                          style={{ fontFamily: "'Barlow Semi Condensed',sans-serif", fontStyle: 'italic', fontSize: '1.1rem', color: b.hot ? 'rgba(255,45,111,0.7)' : 'rgba(14,14,16,0.25)' }}>
                          {b.num}
                        </span>
                        <span className="text-2xl leading-none">{b.emoji}</span>
                        {b.hot && (
                          <span className="font-black uppercase tracking-wider text-white"
                            style={{ background: '#FF2D6F', borderRadius: '4px', padding: '2px 8px', fontSize: '0.6rem', letterSpacing: '0.15em' }}>
                            Quan trọng
                          </span>
                        )}
                      </div>
                      <span className="tabular-nums font-bold shrink-0"
                        style={{ fontSize: '1rem', color: b.hot ? 'rgba(255,255,255,0.7)' : 'rgba(14,14,16,0.55)', textDecoration: 'line-through', fontFamily: "'Barlow Semi Condensed',sans-serif", letterSpacing: '-0.01em' }}>
                        {b.value}
                      </span>
                    </div>
                    {/* Title */}
                    <p className="font-bold mb-2" style={{ fontSize: '1.05rem', lineHeight: 1.4, color: b.hot ? '#FFFFFF' : '#0E0E10' }}>
                      {b.title}
                    </p>
                    {/* Body */}
                    <p style={{ fontSize: '1.125rem', lineHeight: 1.75, color: b.hot ? '#FFFFFF' : '#0E0E10' }}>
                      {b.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Proof images ── */}
            <div className="mb-8" />

            {/* ── MID-PAGE INLINE CTA #2 ── */}
            {!expired && (
              <div className="mb-2">
                <InlineCta onUpgrade={handleUpgradeClick} mm={mm} ss={ss} dark={true} flush />
              </div>
            )}

            {/* ── Value stack summary ── */}
            <div className="bg-paper rounded-2xl overflow-hidden mb-6" style={{ border: '1px solid #E6E6EA', boxShadow: '0 4px 16px rgba(0,0,0,0.07)' }}>
              <div className="px-6 py-5">
              <div className="space-y-2.5 mb-4">
                {BENEFITS.map((b) => (
                  <div key={b.num} className="flex items-center justify-between gap-4" style={{ fontSize: '1rem' }}>
                    <span className="text-ink font-medium">#{b.num} — {b.title.split('—')[0].trim()}</span>
                    <span className="text-ink/60 tabular-nums shrink-0 font-semibold line-through">{b.value}</span>
                  </div>
                ))}
              </div>
              <div className="h-px bg-line mb-4" />
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-ink/60 font-semibold mb-0.5" style={{ fontSize: '0.85rem' }}>Tổng giá trị</div>
                  <div className="text-ink/50 font-bold tabular-nums line-through" style={{ fontSize: '1.3rem' }}>7.000.000đ</div>
                </div>
                <div className="text-right">
                  <div className="text-ink/60 font-semibold mb-0.5" style={{ fontSize: '0.85rem' }}>Anh chị trả</div>
                  <div className="text-accent font-black leading-none tabular-nums" style={{ fontSize: '2.2rem', fontFamily: "'Barlow Semi Condensed',sans-serif" }}>{VIP_PRICE_DISPLAY}</div>
                </div>
              </div>
              <p className="text-ink/60 mt-3 text-center italic" style={{ fontSize: '0.95rem' }}>* Trả một lần · không phí ẩn · quyền lợi giữ mãi</p>
              </div>
            </div>

            {/* ── Triết nói thẳng — callout format ── */}
            <div className="mb-8 rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E6E6EA', boxShadow: '0 4px 16px rgba(0,0,0,0.07)' }}>
              <div className="px-6 py-4 border-b border-line" style={{ background: '#0C0C0F' }}>
                <p className="text-paper font-bold" style={{ fontSize: '0.95rem' }}>Triết nói thẳng —</p>
              </div>
              <div className="px-6 py-6 space-y-4" style={{ background: '#FFFFFF', fontSize: '1.125rem', lineHeight: 1.8 }}>
                <p className="text-ink">
                  Triết không giỏi bán hàng kiểu <em>"đây là cơ hội duy nhất trong đời"</em>. Anh chị đủ thông minh để biết điều đó.
                </p>
                <p className="text-ink">
                  <strong>499k — bằng một bữa ăn nhóm 4 người</strong> — để đổi lấy 1 buổi thẩm định 1:1 mà{' '}
                  <span className="underline underline-offset-2 decoration-accent/60">các giảng viên trả 3 triệu vẫn không chắc được xếp lịch.</span>
                </p>
                <p className="text-ink">
                  Nếu content webinar không áp dụng được — Triết không muốn anh chị trả. Nhưng nếu anh chị nghiêm túc trong 3–6 tháng tới — đây là khoảng cách giữa{' '}
                  <em>"đang nghĩ"</em> và <strong className="text-accent">đang làm.</strong>
                </p>
                <div className="rounded-xl px-4 py-3 mt-2" style={{ background: '#0C0C0F', border: '1.5px solid #FF2D6F', boxShadow: '0 4px 20px rgba(255,45,111,0.2)' }}>
                  <p className="text-paper font-semibold" style={{ fontSize: '1.125rem', lineHeight: 1.7 }}>
                    Buổi Q&A 17/5 và call 1:1 chỉ dành cho VIP đợt này — không mở thêm, không phải vì khan hiếm giả, mà vì lịch của Triết chỉ có vậy.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ DARK CTA SECTION ═══ */}
          <div className="relative overflow-hidden" style={{ background: '#0C0C0F' }}>
            {/* Top pink line */}
            <div className="absolute top-0 inset-x-0 h-px pointer-events-none" style={{ background: 'linear-gradient(90deg,transparent,#FF2D6F 30%,#FF2D6F 70%,transparent)' }} />
            {/* Glow */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%,rgba(255,45,111,0.22) 0%,transparent 65%)' }} />
            {/* Dots */}
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle,rgba(255,45,111,0.10) 1px,transparent 1px)', backgroundSize: '28px 28px' }} />

            <div id="vip-cta" className="relative max-w-3xl mx-auto px-4 pt-10 pb-8" style={{ paddingBottom: '7rem' }}>
              <p className="text-center text-paper font-semibold mb-2" style={{ fontSize: '1.125rem' }}>Xác nhận nâng VIP — anh chị trả</p>
              <div className="text-center mb-6">
                <div className="text-accent font-black leading-none tabular-nums" style={{ fontSize: 'clamp(2.8rem,9vw,4.2rem)', fontFamily: "'Barlow Semi Condensed',sans-serif", fontStyle: 'italic' }}>{VIP_PRICE_DISPLAY}</div>
                <div className="text-paper/70 mt-2" style={{ fontSize: '1rem' }}>một lần duy nhất · giữ mãi toàn bộ quyền lợi</div>
              </div>

              {step === 'offer' && !expired && (
                <>
                  <button
                    onClick={() => setStep('qr')}
                    className="btn-cta w-full text-center text-paper rounded-xl py-4 text-lg transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer mb-3"
                    style={{ background: 'linear-gradient(135deg,#FF2D6F 0%,#D81557 100%)', boxShadow: '0 8px 32px rgba(255,45,111,0.4)' }}
                  >
                    Tôi muốn nâng lên VIP — 499k →
                  </button>
                  <p className="text-paper/80 text-center leading-relaxed" style={{ fontSize: '1rem' }}>
                    Bấm → hệ thống tự tạo QR · chuyển khoản → bấm xác nhận · hệ thống tự động cấp quyền VIP ngay lập tức.
                  </p>
                </>
              )}
              {step === 'offer' && expired && (
                <div className="text-center py-3 space-y-2">
                  <p className="text-paper/50 text-sm">Offer VIP đã hết hạn trong phiên này.</p>
                  <a href={ZALO_FREE_URL} target="_blank" rel="noopener noreferrer" className="inline-block text-accent text-sm underline underline-offset-2">
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

              {/* Urgency */}
              <div className="rounded-xl px-4 py-3 mt-5 mb-5 flex items-start gap-3" style={{ background: 'rgba(255,45,111,0.08)', border: '1px solid rgba(255,45,111,0.2)' }}>
                <ClockIcon />
                <div className="leading-relaxed" style={{ fontSize: '1rem' }}>
                  <span className="text-paper">Offer VIP trong phiên này hết sau </span>
                  <span className="text-accent font-black tabular-nums" style={{ fontFamily: "'Barlow Semi Condensed',sans-serif", fontSize: '1.1rem' }}>{mm}:{ss}</span>
                  <span className="text-paper"> — sau đó sẽ không còn offer này nữa.</span>
                </div>
              </div>

              {/* Skip */}
              <div className="text-center">
                <a href={ZALO_FREE_URL} target="_blank" rel="noopener noreferrer"
                  className="text-paper/75 hover:text-paper transition-colors underline underline-offset-4 decoration-paper/30 hover:decoration-paper/60"
                  style={{ fontSize: '1rem' }}>
                  Không, cảm ơn Triết — tôi xem free thôi, không cần thêm hỗ trợ →
                </a>
              </div>

              <p className="text-center text-paper/50 italic mt-10" style={{ fontSize: '0.85rem' }}>* Thông tin được bảo mật · Không chia sẻ bên thứ ba</p>
            </div>
          </div>
        </>
      )}
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
      <div className="rounded-xl px-5 py-4 leading-relaxed space-y-2" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', fontSize: '1.05rem' }}>
        <p className="text-paper"><strong>Bước 1</strong> — Quét QR hoặc chuyển khoản theo thông tin bên dưới.</p>
        <p className="text-paper"><strong>Bước 2</strong> — Bấm <span className="text-accent font-bold">"Tôi đã chuyển khoản"</span> — hệ thống tự động cấp quyền VIP trong 15–30 phút.</p>
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
            <div className="text-paper/70 font-semibold mb-1" style={{ fontSize: '0.85rem' }}>Nội dung chuyển khoản</div>
            <button onClick={copyDesc} className="flex items-center gap-2 w-full text-left rounded-lg px-3 py-2.5 cursor-pointer transition-all hover:border-white/30" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <span className="text-paper font-mono font-bold flex-1" style={{ fontSize: '1rem' }}>{desc}</span>
              <span className="text-paper/75 shrink-0 font-semibold" style={{ fontSize: '0.9rem' }}>{copied ? '✓ Đã copy' : 'Bấm để copy'}</span>
            </button>
            <p className="text-paper/65 italic mt-1" style={{ fontSize: '0.9rem' }}>* Nhập đúng nội dung để hệ thống xác nhận nhanh</p>
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
    <div className="flex items-center justify-between gap-4 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <span className="text-paper/60 font-medium shrink-0" style={{ fontSize: '0.9rem' }}>{label}</span>
      <span className={`font-bold text-right ${highlight ? 'text-accent' : placeholder ? 'text-paper/40 italic' : 'text-paper'}`}
        style={{ fontSize: highlight ? '1.1rem' : '1rem' }}>
        {placeholder ? `[ ${value} ]` : value}
      </span>
    </div>
  )
}

/* ── Success ─────────────────────────────────────────────────────────────── */
function SuccessState({ orderId }: { orderId: string }) {
  const [checking, setChecking] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [notYet, setNotYet] = useState(false)

  async function checkOrder() {
    setChecking(true)
    setNotYet(false)
    try {
      const base = VIP_API_URL.replace('/confirm', '')
      const res = await fetch(`${base}/check?orderId=${orderId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.confirmed) { setConfirmed(true); return }
      }
    } catch {}
    setNotYet(true)
    setChecking(false)
  }

  return (
    <div className="text-center py-8">
      <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(255,45,111,0.1)', border: '2px solid rgba(255,45,111,0.28)' }}>
        <svg className="w-10 h-10 text-accent" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 className="text-ink text-center mb-5" style={{ fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', fontSize: 'clamp(1.8rem, 4.5vw, 2.8rem)', lineHeight: 1.15 }}>
        Đã nhận —<br />chờ xác nhận!
      </h2>
      <p className="text-ink font-semibold leading-relaxed mb-2 max-w-sm mx-auto" style={{ fontSize: '1.125rem' }}>
        Hệ thống sẽ kiểm tra chuyển khoản và cấp quyền VIP trong vòng <strong>15–30 phút</strong>.
      </p>
      <p className="text-ink/70 leading-relaxed mb-8 max-w-sm mx-auto" style={{ fontSize: '1rem' }}>
        Link tham gia nhóm VIP sẽ được gửi qua email sau khi đơn hàng được xác nhận.
      </p>

      {!confirmed ? (
        <div className="space-y-3">
          <button
            onClick={checkOrder}
            disabled={checking}
            className="btn-cta inline-flex items-center gap-2 text-paper rounded-xl px-8 py-4 transition-all hover:opacity-90 cursor-pointer disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg,#FF2D6F 0%,#D81557 100%)', boxShadow: '0 8px 32px rgba(255,45,111,0.35)', fontSize: '1.1rem' }}
          >
            {checking ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Đang kiểm tra...</>
            ) : 'Kiểm tra trạng thái đơn hàng →'}
          </button>
          {notYet && (
            <p className="text-ink/60 italic" style={{ fontSize: '0.95rem' }}>
              * Đơn chưa được xác nhận — vui lòng thử lại sau ít phút.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-accent font-bold" style={{ fontSize: '1.125rem' }}>✓ Đơn hàng đã được xác nhận!</p>
          <a
            href={ZALO_VIP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-cta inline-flex items-center gap-2 text-paper rounded-xl px-8 py-4 transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,#FF2D6F 0%,#D81557 100%)', boxShadow: '0 8px 32px rgba(255,45,111,0.35)', fontSize: '1.1rem' }}
          >
            Vào nhóm Zalo VIP →
          </a>
        </div>
      )}
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
