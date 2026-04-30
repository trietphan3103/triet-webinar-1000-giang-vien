import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { days = '7', from, to } = req.query as Record<string, string>
    const sinceDate = from || new Date(Date.now() - parseInt(days) * 86400000).toISOString().split('T')[0]
    const untilDate = to || new Date().toISOString().split('T')[0]
    const sinceTs = Math.floor(new Date(sinceDate).getTime() / 1000)
    const untilTs = Math.floor(new Date(untilDate).getTime() / 1000) + 86400

    const baseUrl = `https://graph.facebook.com/v19.0/${process.env.META_PIXEL_ID}/stats`
    const token = process.env.META_ACCESS_TOKEN!

    // Fetch all events + WebinarFormSubmit server-only for dedup
    const [allRes, fsServerRes] = await Promise.all([
      fetch(`${baseUrl}?${new URLSearchParams({ access_token: token, aggregation: 'event', start_time: String(sinceTs), end_time: String(untilTs) })}`),
      fetch(`${baseUrl}?${new URLSearchParams({ access_token: token, event: 'WebinarFormSubmit', aggregation: 'event_source', start_time: String(sinceTs), end_time: String(untilTs) })}`),
    ])
    const allData = await allRes.json()
    const fsData  = await fsServerRes.json()

    // SERVER-only WebinarFormSubmit count (deduplicated)
    const fsServerCount = (fsData.data || [])
      .filter((h: { event_source: string }) => h.event_source === 'SERVER')
      .reduce((s: number, h: { count: number }) => s + (h.count || 0), 0)

    // Dedup buckets by start_time per event
    const seenByEvent = new Map<string, Set<string>>()
    const items: Array<{ event: string; start_time: string; count: number }> = allData.data || []

    const totals: Record<string, number> = {}
    const dailyMap = new Map<string, Record<string, number>>()
    const hourlyMap = new Map<number, Record<string, number>>()

    for (const item of items) {
      const eventName = item.event || 'Unknown'
      if (!seenByEvent.has(eventName)) seenByEvent.set(eventName, new Set())
      const seen = seenByEvent.get(eventName)!
      if (seen.has(item.start_time)) continue
      seen.add(item.start_time)

      const count = item.count || 0

      // Totals — override WebinarFormSubmit with server-only count later
      if (eventName !== 'WebinarFormSubmit') {
        totals[eventName] = (totals[eventName] || 0) + count
      }

      // UTC+7 date
      const utc7 = new Date(new Date(item.start_time).getTime() + 7 * 3600000)
      const localDate = utc7.toISOString().split('T')[0]
      if (!dailyMap.has(localDate)) dailyMap.set(localDate, {})
      const day = dailyMap.get(localDate)!
      if (eventName !== 'WebinarFormSubmit') day[eventName] = (day[eventName] || 0) + count

      // UTC+7 hour
      const hour = utc7.getUTCHours()
      if (!hourlyMap.has(hour)) hourlyMap.set(hour, {})
      const h = hourlyMap.get(hour)!
      if (eventName !== 'WebinarFormSubmit') h[eventName] = (h[eventName] || 0) + count
    }

    // Inject deduplicated WebinarFormSubmit (server-only)
    totals['WebinarFormSubmit'] = fsServerCount

    const daily = Array.from(dailyMap.entries())
      .map(([date, events]) => ({ date, ...events }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const hourly = Array.from({ length: 24 }, (_, i) => ({ hour: i, ...(hourlyMap.get(i) || {}) }))

    res.json({ totals, daily, hourly, days: parseInt(days), since: sinceDate, until: untilDate })
  } catch (err) {
    console.error('Pixel analytics error:', err)
    res.status(500).json({ error: 'Failed to fetch pixel analytics' })
  }
}
