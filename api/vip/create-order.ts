import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { name, phone, email } = req.body
  if (!name || !phone || !email) return res.status(400).json({ error: 'Thiếu thông tin' })

  try {
    const khaRes = await fetch(`${process.env.KHA_API_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.KHA_API_KEY!,
      },
      body: JSON.stringify({ name, phone, email }),
    })
    const data = await khaRes.json()
    return res.status(khaRes.status).json(data)
  } catch (err) {
    console.error('[/api/vip/create-order]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
