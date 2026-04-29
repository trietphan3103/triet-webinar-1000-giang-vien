import { config } from 'dotenv'

const NODE_ENV = process.env.NODE_ENV || 'development'
config({ path: '.env' })
config({ path: `.env.${NODE_ENV}`,       override: true })
config({ path: '.env.local',             override: true })
config({ path: `.env.${NODE_ENV}.local`, override: true })

import express from 'express'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.json())

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function sha256(value: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('84')) return digits
  if (digits.startsWith('0'))  return '84' + digits.slice(1)
  return '84' + digits
}

// ─── POST /api/submit ─────────────────────────────────────────────────────────

app.post('/api/submit', async (req, res) => {
  try {
    const body = req.body
    const name  = body.name  || body.hoten
    const phone = body.phone || body.sdt
    const { email, clinic_name, city, question, chuyenmon, eventId, fbc, fbp, userAgent } = body

    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress || '0.0.0.0'
    const ua = userAgent || req.headers['user-agent'] || ''

    if (!name || !phone || !email) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' })
    }

    const [khaRes] = await Promise.all([
      // 1. Lưu lead vào KHA
      fetch(`${process.env.KHA_API_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.KHA_API_KEY! },
        body: JSON.stringify({
          name, phone, email,
          clinic_name: clinic_name || chuyenmon || '',
          city: city || '',
          question: question || '',
          source: 'webinar-landing',
          submitted_at: new Date().toISOString(),
        }),
      }),

      // 2. Gửi WebinarFormSubmit lên Meta CAPI (parallel)
      process.env.META_PIXEL_ID && process.env.META_ACCESS_TOKEN
        ? (async () => {
            const [hashedEmail, hashedPhone] = await Promise.all([
              sha256(email.trim().toLowerCase()),
              sha256(normalizePhone(phone)),
            ])
            const userData: Record<string, unknown> = {
              em: [hashedEmail], ph: [hashedPhone],
              client_ip_address: clientIp, client_user_agent: ua,
            }
            if (fbc) userData.fbc = fbc
            if (fbp) userData.fbp = fbp

            return fetch(
              `https://graph.facebook.com/v19.0/${process.env.META_PIXEL_ID}/events?access_token=${process.env.META_ACCESS_TOKEN}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: [{
                  event_name: 'WebinarFormSubmit',
                  event_time: Math.floor(Date.now() / 1000),
                  event_id: eventId || `webinar-submit-${Date.now()}`,
                  action_source: 'website',
                  event_source_url: process.env.APP_URL || '',
                  user_data: userData,
                }]}),
              }
            )
          })()
        : Promise.resolve(null),
    ])

    const data = await khaRes.json()
    res.status(khaRes.status).json(data)
  } catch (err) {
    console.error('[/api/submit]', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── GET /api/analytics/pixel ─────────────────────────────────────────────────

app.get('/api/analytics/pixel', async (req, res) => {
  const { META_ACCESS_TOKEN: token, META_PIXEL_ID: pixelId } = process.env
  if (!token) return res.status(400).json({ error: 'META_ACCESS_TOKEN not configured' })

  const days      = Number(req.query.days) || 7
  const fromParam = req.query.from as string | undefined
  const toParam   = req.query.to   as string | undefined
  const startTime = fromParam
    ? Math.floor(new Date(fromParam).getTime() / 1000)
    : Math.floor(Date.now() / 1000) - days * 86400
  const endTime = toParam
    ? Math.floor(new Date(toParam).getTime() / 1000) + 86400
    : undefined

  try {
    const base = `start_time=${startTime}${endTime ? `&end_time=${endTime}` : ''}&access_token=${token}`

    const [r, fsSourceRes] = await Promise.all([
      fetch(`https://graph.facebook.com/v19.0/${pixelId}/stats?${base}&aggregation=event`),
      fetch(`https://graph.facebook.com/v19.0/${pixelId}/stats?${base}&event=WebinarFormSubmit&aggregation=event_source`),
    ])

    const json = await r.json()
    if (!r.ok) return res.status(r.status).json(json)

    // SERVER count = deduplicated CAPI submissions
    let fsServer = 0
    if (fsSourceRes.ok) {
      const fsJson = await fsSourceRes.json()
      for (const h of fsJson.data ?? [])
        for (const e of h.data ?? [])
          if (e.value === 'SERVER') fsServer += e.count
    }

    // Dedup duplicate start_time buckets
    const seen = new Set<string>()
    const unique = (json.data ?? []).filter((h: any) =>
      !seen.has(h.start_time) && seen.add(h.start_time)
    )

    const dailyMap: Record<string, Record<string, number>> = {}
    const totals:   Record<string, number> = {}
    for (const hour of unique) {
      const day = hour.start_time.slice(0, 10)
      if (!dailyMap[day]) dailyMap[day] = {}
      for (const evt of hour.data ?? []) {
        dailyMap[day][evt.value] = (dailyMap[day][evt.value] ?? 0) + evt.count
        if (evt.value !== 'WebinarFormSubmit')
          totals[evt.value] = (totals[evt.value] ?? 0) + evt.count
      }
    }
    totals['WebinarFormSubmit'] = fsServer

    const hourMap: Record<number, Record<string, number>> = {}
    for (const hour of unique) {
      const h = (parseInt(hour.start_time.slice(11, 13), 10) + 7) % 24
      if (!hourMap[h]) hourMap[h] = {}
      for (const evt of hour.data ?? [])
        hourMap[h][evt.value] = (hourMap[h][evt.value] ?? 0) + evt.count
    }

    res.json({
      totals,
      daily:  Object.entries(dailyMap).sort().map(([date, evts]) => ({ date, ...evts })),
      hourly: Array.from({ length: 24 }, (_, h) => ({ hour: h, ...(hourMap[h] ?? {}) })),
      days,
    })
  } catch (err) {
    console.error('[/api/analytics/pixel]', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── GET /api/analytics/ads ───────────────────────────────────────────────────

app.get('/api/analytics/ads', async (req, res) => {
  const { META_ACCESS_TOKEN: token, META_AD_ACCOUNT_ID: adAccountId } = process.env
  if (!token) return res.status(400).json({ error: 'META_ACCESS_TOKEN not configured' })

  const days  = Number(req.query.days) || 7
  const since = (req.query.from as string) || new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  const until = (req.query.to   as string) || new Date().toISOString().slice(0, 10)

  try {
    const fields = [
      'ad_id','campaign_name','adset_name','ad_name',
      'impressions','reach','clicks','spend','cpm','cpc','ctr',
      'actions','cost_per_action_type',
    ].join(',')

    const timeRange = encodeURIComponent(JSON.stringify({ since, until }))
    const url = `https://graph.facebook.com/v19.0/${adAccountId}/insights?fields=${fields}&time_range=${timeRange}&level=ad&limit=50&access_token=${token}`
    const r = await fetch(url)
    const json = await r.json()
    if (!r.ok) return res.status(r.status).json(json)

    // Batch fetch post URLs từ creative
    const adIds = (json.data ?? []).map((d: any) => d.ad_id).filter(Boolean)
    const postUrlMap: Record<string, string> = {}
    if (adIds.length > 0) {
      try {
        const creativeRes = await fetch(
          `https://graph.facebook.com/v19.0/?ids=${adIds.join(',')}&fields=creative{effective_object_story_id}&access_token=${token}`
        )
        const creativeJson = await creativeRes.json()
        for (const [adId, adData] of Object.entries<any>(creativeJson)) {
          const storyId = adData?.creative?.effective_object_story_id
          if (storyId) {
            const [pageId, postId] = storyId.split('_')
            postUrlMap[adId] = `https://www.facebook.com/permalink.php?story_fbid=${postId}&id=${pageId}`
          }
        }
      } catch { /* bỏ qua nếu creative fetch lỗi */ }
    }

    const rows = (json.data ?? []).map((row: any) => {
      const actions: Record<string, number> = {}
      for (const a of row.actions ?? []) actions[a.action_type] = Number(a.value)
      const costPerAction: Record<string, number> = {}
      for (const a of row.cost_per_action_type ?? []) costPerAction[`cost_${a.action_type}`] = Number(a.value)
      return {
        ad_id: row.ad_id,
        post_url: postUrlMap[row.ad_id] || null,
        campaign_name: row.campaign_name,
        adset_name: row.adset_name,
        ad_name: row.ad_name,
        impressions: Number(row.impressions ?? 0),
        reach: Number(row.reach ?? 0),
        clicks: Number(row.clicks ?? 0),
        landing_page_views: actions['landing_page_view'] ?? 0,
        spend: Number(row.spend ?? 0),
        cpm: Number(row.cpm ?? 0),
        cpc: Number(row.cpc ?? 0),
        ctr: Number(row.ctr ?? 0),
        ...actions,
        ...costPerAction,
      }
    })

    // Campaign-level rollup
    const campaignMap: Record<string, typeof rows[0]> = {}
    for (const row of rows) {
      const key = row.campaign_name as string
      if (!campaignMap[key]) { campaignMap[key] = { ...row }; continue }
      const c = campaignMap[key]
      c.impressions += row.impressions
      c.reach       += row.reach
      c.clicks      += row.clicks
      c.landing_page_views = (c.landing_page_views ?? 0) + (row.landing_page_views ?? 0)
      c.spend       += row.spend
      for (const k of Object.keys(row)) {
        if (['impressions','reach','clicks','landing_page_views','spend','cpm','cpc','ctr','ad_id','post_url','campaign_name','adset_name','ad_name'].includes(k)) continue
        if (typeof (row as any)[k] === 'number')
          (c as any)[k] = ((c as any)[k] ?? 0) + (row as any)[k]
      }
      c.cpm = c.impressions > 0 ? c.spend / c.impressions * 1000 : 0
      c.cpc = c.clicks > 0      ? c.spend / c.clicks             : 0
      c.ctr = c.impressions > 0 ? c.clicks / c.impressions * 100 : 0
    }

    res.json({ ads: rows, campaigns: Object.values(campaignMap), since, until })
  } catch (err) {
    console.error('[/api/analytics/ads]', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── POST /api/broadcast ─────────────────────────────────────────────────────

app.post('/api/broadcast', async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const khaRes = await fetch(`${process.env.KHA_API_URL}/admin/email-broadcasts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'X-API-Key': process.env.KHA_API_KEY!,
      },
      body: JSON.stringify(req.body),
    })
    const data = await khaRes.json()
    res.status(khaRes.status).json(data)
  } catch (err) {
    console.error('[/api/broadcast]', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── Serve SPA ────────────────────────────────────────────────────────────────

const distDir = join(__dirname, 'dist')
app.use(express.static(distDir))
app.get('*', (_req, res) => res.sendFile(join(distDir, 'index.html')))

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 8080
createServer(app).listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
