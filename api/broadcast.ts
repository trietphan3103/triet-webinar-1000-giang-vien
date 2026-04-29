import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
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
    console.error('Broadcast error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
