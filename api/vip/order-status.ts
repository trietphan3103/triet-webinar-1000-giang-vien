import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const code = req.query.code as string
  if (!code) return res.status(400).json({ error: 'Thiếu order code' })

  try {
    const r = await fetch(`https://kha-webinar.mona.academy/api/orders/${code}`, {
      headers: { 'X-API-Key': process.env.KHA_API_KEY! },
    })
    if (r.status === 404) return res.status(404).json({ error: 'Không tìm thấy đơn' })
    const order: any = await r.json()
    return res.json({ status: order.status, confirmed: order.status === 'completed', order })
  } catch (err) {
    console.error('[/api/vip/order-status]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
