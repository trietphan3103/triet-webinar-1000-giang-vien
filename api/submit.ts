import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'crypto'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('84')) return cleaned
  if (cleaned.startsWith('0')) return '84' + cleaned.slice(1)
  return '84' + cleaned
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = req.body
  const name = body.name || body.hoten
  const phone = body.phone || body.sdt
  const { email, clinic_name, city, question, chuyenmon, eventId, fbc, fbp, userAgent } = body
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || ''

  if (!name || !phone || !email) {
    return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' })
  }

  const hashedEmail = sha256(email.trim().toLowerCase())
  const hashedPhone = sha256(normalizePhone(phone))

  try {
    // 1. DETEC API + 2. Meta CAPI — gửi đồng thời
    const [detectResult] = await Promise.allSettled([
      // DETEC API (blocking — lưu lead)
      fetch(`${process.env.KHA_API_URL}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.KHA_API_KEY!,
        },
        body: JSON.stringify({
          name, phone, email,
          clinic_name: clinic_name || chuyenmon || '',
          city: city || '',
          question: question || '',
          source: 'webinar-landing',
          submitted_at: new Date().toISOString(),
        }),
      }).then(async r => {
        if (!r.ok) throw new Error(await r.text())
        return r.json()
      }),

      // Meta CAPI (fire & forget — không block response)
      process.env.META_PIXEL_ID && process.env.META_ACCESS_TOKEN
        ? fetch(`https://graph.facebook.com/v19.0/${process.env.META_PIXEL_ID}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              data: [{
                event_name: 'WebinarFormSubmit',
                event_time: Math.floor(Date.now() / 1000),
                event_id: eventId,
                action_source: 'website',
                user_data: {
                  em: [hashedEmail],
                  ph: [hashedPhone],
                  client_ip_address: clientIp,
                  client_user_agent: userAgent,
                  fbc: fbc || undefined,
                  fbp: fbp || undefined,
                },
              }],
              access_token: process.env.META_ACCESS_TOKEN,
            }),
          })
        : Promise.resolve(),
    ])

    if (detectResult.status === 'rejected') {
      console.error('DETEC API error:', detectResult.reason)
      return res.status(500).json({ message: 'Lỗi khi lưu đăng ký, vui lòng thử lại.' })
    }

    return res.status(200).json({ success: true, message: 'Đăng ký thành công!' })
  } catch (err) {
    console.error('Submit error:', err)
    return res.status(500).json({ message: 'Lỗi server, vui lòng thử lại.' })
  }
}
