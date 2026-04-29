import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'crypto'

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('84')) return cleaned
  if (cleaned.startsWith('0')) return '84' + cleaned.slice(1)
  return '84' + cleaned
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { hoten, sdt, email, chuyenmon, eventId, fbc, fbp, userAgent } = req.body
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || ''

  if (!hoten || !sdt || !email) {
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' })
  }

  const hashedEmail = sha256(email.trim().toLowerCase())
  const hashedPhone = sha256(normalizePhone(sdt))

  try {
    // 1. Gửi đến KHA Webinar API
    const apiRes = await fetch(`${process.env.CLIENT_API_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.CLIENT_API_KEY!,
      },
      body: JSON.stringify({
        name: hoten,
        phone: sdt,
        email: email,
        clinic_name: chuyenmon,  // map chuyenmon → clinic_name
        city: '',
        question: '',
      }),
    })

    if (!apiRes.ok) {
      const err = await apiRes.text()
      console.error('API error:', err)
      return res.status(500).json({ error: 'Lỗi khi lưu đăng ký' })
    }

    // 2. Meta CAPI (fire & forget)
    if (process.env.META_PIXEL_ID && process.env.META_ACCESS_TOKEN) {
      fetch(`https://graph.facebook.com/v19.0/${process.env.META_PIXEL_ID}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [{
            event_name: 'Lead',
            event_time: Math.floor(Date.now() / 1000),
            event_id: eventId,
            action_source: 'website',
            user_data: {
              em: [hashedEmail],
              ph: [hashedPhone],
              client_ip_address: clientIp,
              client_user_agent: userAgent,
              fbc, fbp,
            },
          }],
          access_token: process.env.META_ACCESS_TOKEN,
        }),
      }).catch(console.error)
    }

    return res.status(200).json({ success: true, message: 'Đăng ký thành công!' })
  } catch (err) {
    console.error('Submit error:', err)
    return res.status(500).json({ error: 'Lỗi server, vui lòng thử lại' })
  }
}
