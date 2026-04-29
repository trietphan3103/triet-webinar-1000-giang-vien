import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'crypto'
import * as fs from 'fs'

// Load .env files
const loadEnvFiles = () => {
  const nodeEnv = process.env.NODE_ENV || 'development'
  const envFiles = ['.env', `.env.${nodeEnv}`, '.env.local', `.env.${nodeEnv}.local`]
  for (const file of envFiles) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf-8')
      for (const line of content.split('\n')) {
        const match = line.match(/^([^#=]+)=(.*)$/)
        if (match) {
          const key = match[1].trim()
          const val = match[2].trim().replace(/^["']|["']$/g, '')
          if (!process.env[key]) process.env[key] = val
        }
      }
    }
  }
}
loadEnvFiles()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 8080
const distDir = path.join(__dirname, 'dist')

app.use(express.json())
app.use(express.static(distDir))

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('84')) return cleaned
  if (cleaned.startsWith('0')) return '84' + cleaned.slice(1)
  return '84' + cleaned
}

// POST /api/submit
app.post('/api/submit', async (req, res) => {
  try {
    const { hoten, sdt, email, chuyenmon, eventId, fbc, fbp, userAgent } = req.body
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim()
      || req.headers['x-real-ip'] as string
      || req.socket.remoteAddress || ''

    if (!hoten || !sdt || !email) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' })
    }

    const hashedEmail = sha256(email.trim().toLowerCase())
    const hashedPhone = sha256(normalizePhone(sdt))

    // 1. Webhook
    if (process.env.WEBHOOK_URL) {
      await fetch(process.env.WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hoten, sdt, email, chuyenmon,
          source: 'webinar-1000-giang-vien',
          submitted_at: new Date().toISOString(),
        }),
      })
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

    res.status(200).json({ success: true, message: 'Đăng ký thành công!' })
  } catch (err) {
    console.error('Submit error:', err)
    res.status(500).json({ error: 'Lỗi server, vui lòng thử lại' })
  }
})

// GET /api/analytics/pixel
app.get('/api/analytics/pixel', async (req, res) => {
  try {
    const { days = '7', from, to } = req.query as Record<string, string>
    const sinceDate = from || new Date(Date.now() - parseInt(days) * 86400000).toISOString().split('T')[0]
    const untilDate = to || new Date().toISOString().split('T')[0]

    const baseUrl = `https://graph.facebook.com/v19.0/${process.env.META_PIXEL_ID}/stats`
    const params = new URLSearchParams({
      access_token: process.env.META_ACCESS_TOKEN!,
      aggregation: 'event',
      since: sinceDate,
      until: untilDate,
    })

    const allEvents = await fetch(`${baseUrl}?${params}`).then(r => r.json())

    const dailyMap = new Map<string, Record<string, number>>()
    const totals: Record<string, number> = {}

    for (const item of allEvents.data || []) {
      const date = new Date(item.start_time)
      const localDate = new Date(date.getTime() + 7 * 3600000).toISOString().split('T')[0]
      if (!dailyMap.has(localDate)) dailyMap.set(localDate, {})
      const day = dailyMap.get(localDate)!
      const eventName = item.event || 'Unknown'
      day[eventName] = (day[eventName] || 0) + (item.count || 0)
      totals[eventName] = (totals[eventName] || 0) + (item.count || 0)
    }

    const daily = Array.from(dailyMap.entries())
      .map(([date, events]) => ({ date, ...events }))
      .sort((a, b) => a.date.localeCompare(b.date))

    res.json({ totals, daily, since: sinceDate, until: untilDate })
  } catch (err) {
    console.error('Pixel analytics error:', err)
    res.status(500).json({ error: 'Failed to fetch pixel analytics' })
  }
})

// GET /api/analytics/ads
app.get('/api/analytics/ads', async (req, res) => {
  try {
    const { days = '7', from, to } = req.query as Record<string, string>
    const sinceDate = from || new Date(Date.now() - parseInt(days) * 86400000).toISOString().split('T')[0]
    const untilDate = to || new Date().toISOString().split('T')[0]

    const fields = 'ad_id,ad_name,campaign_name,impressions,clicks,spend,cpm,cpc,ctr,actions'
    const url = `https://graph.facebook.com/v19.0/${process.env.META_AD_ACCOUNT_ID}/insights`
    const params = new URLSearchParams({
      access_token: process.env.META_ACCESS_TOKEN!,
      fields,
      time_range: JSON.stringify({ since: sinceDate, until: untilDate }),
      level: 'ad',
      limit: '100',
    })

    const adsData = await fetch(`${url}?${params}`).then(r => r.json())
    const ads = (adsData.data || []).map((ad: Record<string, unknown>) => {
      const actions: Record<string, number> = {}
      for (const a of (ad.actions as Array<{action_type:string,value:string}>) || [])
        actions[a.action_type] = parseInt(a.value)
      return { ...ad, actions }
    })

    res.json({ ads, since: sinceDate, until: untilDate })
  } catch (err) {
    console.error('Ads analytics error:', err)
    res.status(500).json({ error: 'Failed to fetch ads analytics' })
  }
})

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'))
})

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
