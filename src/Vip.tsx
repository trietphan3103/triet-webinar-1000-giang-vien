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
    value: '500.000đ',
    title: 'Record toàn bộ 2 tiếng webinar — xem lại không giới hạn',
    body: 'Sẽ có những đoạn anh chị muốn nghe lại — một con số, một framework, một câu Triết nói qua mà anh chị chưa kịp ghi. Record VIP cho phép xem lại bất cứ lúc nào, không hết hạn. Xem lần 1 để hiểu. Xem lần 2 để làm. Xem lần 3 để dạy lại cho đội nhóm.',
  },
  {
    num: '02',
    hot: true,
    value: '2.000.000đ',
    title: 'Buổi hỏi đáp riêng 17/5 — hỏi thẳng về case của anh chị',
    body: 'Ngày 17/5, Triết mở buổi riêng cho nhóm VIP. Đây không phải Q&A kiểu "hỏi chung, trả lời chung". Anh chị hỏi về đúng case của mình — đang dạy gì, kinh nghiệm gì, thị trường nào, mắc chỗ nào. Triết trả lời thật, không né, không kiểu "tuỳ trường hợp". Chỉ slot VIP mới có buổi này.',
  },
  {
    num: '03',
    hot: true,
    value: '3.000.000đ',
    title: '1 buổi private call 1:1 — Triết thẩm định idea cho anh chị',
    body: '30 phút. Anh chị trình bày: tôi có kinh nghiệm X năm, tôi muốn bán khóa Y, tệp tôi đang có là Z. Triết sẽ nói thẳng: nên làm không, làm theo hướng nào, cái gì đang sai trong cách anh chị đang nghĩ. Không có gói nào khác của MONA có điều này — kể cả gói trả tiền.',
  },
  {
    num: '04',
    hot: false,
    value: '800.000đ',
    title: 'Tài liệu nội bộ MONA — không bán, không public',
    body: 'Bộ template MONA đang dùng để onboard giảng viên mới: cấu trúc khoá học theo từng chủ đề, checklist từng bước launch sản phẩm điện tử, bảng giá tham chiếu theo tệp. Anh chị nhận file thẳng vào nhóm VIP — dùng được ngay, không cần tự mò.',
  },
  {
    num: '05',
    hot: false,
    value: '700.000đ',
    title: 'Nhóm Zalo VIP — vào ngay, nhận tài liệu trước webinar',
    body: 'Sau khi thanh toán xong, anh chị vào nhóm VIP. Triết sẽ share thêm tài nguyên, trả lời câu hỏi nhanh và cập nhật trực tiếp trước ngày 9/5. Không phải ngồi chờ như nhóm free. Và trong nhóm VIP — anh chị sẽ thấy ai đang làm thật, đang hỏi thật. Khác hẳn.',
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
    <div className="min-h-screen bg-cream">
      {/* Pink accent line — top (same as home) */}
      <div className="pointer-events-none fixed top-0 inset-x-0 h-px z-10" style={{ background: 'linear-gradient(90deg,transparent,#FF2D6F 30%,#FF2D6F 70%,transparent)' }} />
      {/* Light hatch overlay */}
      <div className="pointer-events-none fixed inset-0 deco-hatch-light" />

      <StickyBar onUpgrade={handleUpgradeClick} expired={expired} />

      {step === 'success' ? (
        <div className="relative max-w-2xl mx-auto px-4 py-14 md:py-20" style={{ paddingBottom: '6rem' }}>
          <SuccessState />
          <p className="text-center text-ink/30 text-xs mt-12">Thông tin được bảo mật · Không chia sẻ bên thứ ba</p>
        </div>
      ) : (
        <>
          {/* ═══ HERO — cream bg ═══ */}
          <div className="max-w-2xl mx-auto px-4 pt-12 pb-8">

            {/* Badge */}
            <div className="flex justify-center mb-6">
              <span className="inline-flex items-center gap-2 sect-label text-accent border border-accent/30 rounded-full px-4 py-1.5 bg-paper shadow-sm">
                <StarIcon /> Dành riêng cho anh chị vừa đăng ký
              </span>
            </div>

            {/* Congrats */}
            <div className="bg-paper rounded-2xl px-6 py-5 mb-7 border-l-4 border-accent shadow-sm">
              <p className="sect-label text-accent mb-2">Chúc mừng — Anh/chị đã đăng ký</p>
              <p className="text-ink/70 text-sm leading-relaxed">
                Phần lớn người thấy webinar này — rồi đóng tab. Anh chị đã điền form. Đó là bước đầu tiên, và nó quan trọng hơn mọi người nghĩ.
              </p>
            </div>

            {/* Headline */}
            <h1 className="text-ink text-center mb-6" style={{ fontSize: 'clamp(2rem,5vw,3.2rem)', lineHeight: 1.1 }}>
              Nâng lên <span className="text-accent">VIP</span> —<br />
              lợi thế không công bằng<br />cho người nghiêm túc
            </h1>

            {/* Lead-in */}
            <div className="space-y-4 mb-8">
              <p className="text-ink/80">
                Webinar ngày 9/5 — Triết sẽ chia sẻ toàn bộ công thức xây sản phẩm điện tử của MONA. Không giữ lại gì. Người xem free cũng nhận được điều đó.
              </p>
              <p className="text-ink font-semibold">
                Nghe xong — 80% người sẽ không làm. Không phải vì lười. Mà vì họ không có ai ngồi lại và nói:{' '}
                <em className="text-accent not-italic">"Cụ thể anh chị nên bắt đầu từ đây, theo cách này, với tệp đó."</em>
              </p>
              <p className="text-ink/80">
                VIP không phải một cái badge. VIP là Triết ngồi lại với anh chị — để đảm bảo anh chị không chỉ hiểu mà còn bắt tay làm được.
              </p>
            </div>
          </div>

          {/* ═══ DARK STATS STRIP — same as home ═══ */}
          <div className="relative overflow-hidden" style={{ background: '#0C0C0F' }}>
            {/* subtle grid */}
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
            <div className="relative max-w-2xl mx-auto px-4 py-8">
              <p className="sect-label text-accent text-center mb-5">Không phải hứa hẹn — là kết quả thật</p>
              <div className="grid grid-cols-3 divide-x divide-white/10">
                {[
                  { n: '487', label: 'Case win có tên' },
                  { n: '84%', label: 'Tỉ lệ thắng', accent: true },
                  { n: '1 tỷ+', label: 'Doanh thu ghi nhận' },
                ].map((s) => (
                  <div key={s.n} className="px-4 py-2 text-center">
                    <div className={`font-black leading-none tabular-nums ${s.accent ? 'text-accent' : 'text-paper'}`}
                      style={{ fontSize: 'clamp(1.8rem,5vw,2.8rem)', fontFamily: "'Barlow Semi Condensed',sans-serif", fontStyle: 'italic' }}>
                      {s.n}
                    </div>
                    <div className="text-paper/50 text-xs font-semibold uppercase tracking-wider mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ═══ BENEFITS + PROOF — cream bg ═══ */}
          <div className="max-w-2xl mx-auto px-4 py-8">

            {/* Section label */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-line" />
              <span className="sect-label text-ink/40 shrink-0">Anh chị nhận được</span>
              <div className="flex-1 h-px bg-line" />
            </div>

            {/* Benefits — white cards */}
            <div className="space-y-3 mb-8">
              {BENEFITS.map((b) => (
                <div key={b.num}
                  className={`bg-paper rounded-2xl px-5 py-5 flex gap-4 shadow-sm transition-shadow hover:shadow-md ${b.hot ? 'border-l-4 border-accent' : 'border border-line'}`}>
                  <div className="shrink-0 pt-0.5">
                    <span className="font-black text-xs" style={{ fontFamily: "'Barlow Semi Condensed',sans-serif", color: b.hot ? '#FF2D6F' : 'rgba(14,14,16,0.2)', letterSpacing: '0.05em' }}>{b.num}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-ink text-sm leading-snug">{b.title}</span>
                        {b.hot && <span className="text-xs font-bold text-accent bg-accent/8 border border-accent/20 rounded-full px-2 py-0.5 shrink-0">Quan trọng</span>}
                      </div>
                      <span className="text-ink/35 text-xs font-semibold shrink-0 tabular-nums line-through">Trị giá {b.value}</span>
                    </div>
                    <p className="text-ink/60 text-sm leading-relaxed">{b.body}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Proof images ── */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-line" />
                <span className="sect-label text-ink/40 shrink-0">Bằng chứng thật — từ hệ sinh thái MONA</span>
                <div className="flex-1 h-px bg-line" />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-paper rounded-xl overflow-hidden shadow-sm border border-line">
                  <div style={{ aspectRatio: '16/9', overflow: 'hidden' }}>
                    <img src="assets/case-study-youtube.png" alt="Dashboard doanh thu tự động MONA — trăm mấy triệu/tháng đều đều 8 tháng" className="w-full h-full object-cover object-top" loading="lazy" />
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-xs font-semibold text-ink leading-snug">Dashboard tự động 8 tháng</p>
                    <p className="text-xs text-ink/50 mt-0.5">Trăm mấy triệu/tháng · tổng 1 tỷ</p>
                  </div>
                </div>
                <div className="bg-paper rounded-xl overflow-hidden shadow-sm border border-line">
                  <div style={{ aspectRatio: '16/9', overflow: 'hidden' }}>
                    <img src="assets/bao-cao-elearning-2.png" alt="Báo cáo e-learning — tháng 3 x3, tháng 4 x4 doanh số" className="w-full h-full object-cover object-top" loading="lazy" />
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-xs font-semibold text-ink leading-snug">Tháng 3 ×3 · Tháng 4 ×4 doanh số</p>
                    <p className="text-xs text-ink/50 mt-0.5">Báo cáo nội bộ MONA</p>
                  </div>
                </div>
              </div>
              <p className="text-ink/45 text-xs text-center leading-relaxed">
                Đây là những gì xảy ra khi anh chị làm đúng hướng, có người đồng hành. Không phải may mắn — là hệ thống.
              </p>
            </div>

            {/* ── Value stack summary ── */}
            <div className="bg-paper rounded-2xl px-6 py-5 mb-6 shadow-sm border border-line">
              <div className="space-y-2 mb-4">
                {BENEFITS.map((b) => (
                  <div key={b.num} className="flex items-center justify-between text-sm">
                    <span className="text-ink/60">#{b.num} — {b.title.split('—')[0].trim()}</span>
                    <span className="text-ink/40 tabular-nums shrink-0">{b.value}</span>
                  </div>
                ))}
              </div>
              <div className="h-px bg-line mb-4" />
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-ink/40 text-xs mb-0.5">Tổng giá trị</div>
                  <div className="text-ink/35 font-bold text-lg tabular-nums line-through">7.000.000đ</div>
                </div>
                <div className="text-right">
                  <div className="text-ink/40 text-xs mb-0.5">Anh chị trả</div>
                  <div className="text-accent font-black leading-none tabular-nums" style={{ fontSize: '2rem', fontFamily: "'Barlow Semi Condensed',sans-serif" }}>{VIP_PRICE_DISPLAY}</div>
                </div>
              </div>
              <p className="text-ink/30 text-xs mt-3 text-center">Trả một lần · không phí ẩn · quyền lợi giữ mãi</p>
            </div>

            {/* ── Triết nói thật — with photo ── */}
            <div className="bg-paper rounded-2xl overflow-hidden shadow-sm border border-line mb-8">
              <div className="flex flex-col sm:flex-row gap-0">
                {/* Photo */}
                <div className="sm:w-36 shrink-0">
                  <img src="assets/triet-mona.jpg" alt="Triết — Growth Manager MONA Media" className="w-full h-44 sm:h-full object-cover object-top" loading="lazy" />
                </div>
                {/* Copy */}
                <div className="flex-1 px-5 py-5 border-l-4 border-accent">
                  <p className="sect-label text-accent mb-3">Triết nói thật —</p>
                  <div className="space-y-3 text-sm text-ink/70 leading-relaxed">
                    <p>Triết không giỏi bán hàng kiểu "đây là cơ hội duy nhất trong đời". Anh chị đủ thông minh để biết điều đó.</p>
                    <p><span className="text-ink font-semibold">499k — bằng một bữa ăn nhóm 4 người</span> — để đổi lấy 1 buổi thẩm định 1:1 mà các giảng viên trả 3 triệu vẫn không chắc được xếp lịch.</p>
                    <p>Nếu content webinar không áp dụng được — Triết không muốn anh chị trả. Nhưng nếu anh chị nghiêm túc với sản phẩm điện tử trong 3–6 tháng tới — đây là khoảng cách giữa <em>"đang nghĩ"</em> và <em>"đang làm"</em>.</p>
                    <p className="text-ink/45">Buổi Q&A 17/5 và call 1:1 chỉ dành cho VIP đợt này — không mở thêm, không phải vì khan hiếm giả, mà vì lịch của Triết chỉ có vậy.</p>
                  </div>
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

            <div id="vip-cta" className="relative max-w-2xl mx-auto px-4 pt-10 pb-8" style={{ paddingBottom: '7rem' }}>
              <p className="text-center text-paper/50 text-sm mb-2">Xác nhận nâng VIP — anh chị trả</p>
              <div className="text-center mb-6">
                <div className="text-accent font-black leading-none tabular-nums" style={{ fontSize: 'clamp(2.8rem,9vw,4.2rem)', fontFamily: "'Barlow Semi Condensed',sans-serif", fontStyle: 'italic' }}>{VIP_PRICE_DISPLAY}</div>
                <div className="text-paper/35 text-xs mt-2">một lần duy nhất · giữ mãi toàn bộ quyền lợi</div>
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
                  <p className="text-paper/30 text-xs text-center leading-relaxed">
                    Bấm để xem QR chuyển khoản. Sau khi chuyển xong → bấm xác nhận. Team duyệt trong 15–30 phút và thêm anh chị vào nhóm VIP ngay.
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
                <div className="text-sm leading-relaxed">
                  <span className="text-paper/65">Offer VIP đóng trước giờ khai mạc 9/5/2026 lúc 20:00 — còn </span>
                  <CountdownTimer />
                  <span className="text-paper/65">. Sau đó — không có cách nào nâng lên VIP. Q&A 17/5 và call 1:1 cũng đóng luôn.</span>
                </div>
              </div>

              {/* Skip */}
              <div className="text-center">
                <a href={ZALO_FREE_URL} target="_blank" rel="noopener noreferrer"
                  className="text-paper/25 text-xs hover:text-paper/45 transition-colors">
                  Không, cảm ơn Triết — tôi xem free thôi, không cần thêm hỗ trợ →
                </a>
              </div>

              <p className="text-center text-paper/18 text-xs mt-10">Thông tin được bảo mật · Không chia sẻ bên thứ ba</p>
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
