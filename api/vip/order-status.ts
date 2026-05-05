import type { VercelRequest, VercelResponse } from '@vercel/node'

let _adminToken = ''
let _adminTokenExpiry = 0

async function getAdminToken(): Promise<string> {
  if (_adminToken && Date.now() < _adminTokenExpiry) return _adminToken
  const res = await fetch('https://kha-webinar.mona.academy/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.KHA_ADMIN_USER || 'admin',
      password: process.env.KHA_ADMIN_PASS || '',
    }),
  })
  const data: any = await res.json()
  _adminToken = data.token || ''
  _adminTokenExpiry = Date.now() + 50 * 60 * 1000
  return _adminToken
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const code = req.query.code as string
  if (!code) return res.status(400).json({ error: 'Thiếu order code' })

  try {
    const token = await getAdminToken()
    const r = await fetch('https://kha-webinar.mona.academy/admin/orders', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const json: any = await r.json()
    const orders: any[] = Array.isArray(json) ? json : (json.data ?? [])
    const order = orders.find((o: any) => o.order_code === code)
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn' })
    return res.json({ status: order.status, confirmed: order.status === 'completed', order })
  } catch (err) {
    console.error('[/api/vip/order-status]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
