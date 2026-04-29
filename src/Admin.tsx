import { useState, useEffect } from 'react'

const TOKEN_KEY = 'triet_webinar_admin_token'
const API_BASE = import.meta.env.VITE_ADMIN_API_BASE || ''

interface Lead {
  id?: string
  hoten: string
  sdt: string
  email: string
  chuyenmon: string
  submitted_at?: string
}

export default function Admin() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '')
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const authHeaders = () => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  })

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      })
      if (res.ok) {
        const data = await res.json()
        localStorage.setItem(TOKEN_KEY, data.token)
        setToken(data.token)
      } else {
        setError('Sai username hoặc password')
      }
    } catch {
      setError('Không thể kết nối server')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!token) return
    setLoading(true)
    fetch(`${API_BASE}/admin/leads`, { headers: authHeaders() })
      .then(r => r.json())
      .then(data => setLeads(Array.isArray(data) ? data : data.leads || []))
      .catch(() => setError('Lỗi khi tải dữ liệu'))
      .finally(() => setLoading(false))
  }, [token])

  function exportCSV() {
    const headers = ['Họ tên', 'Số điện thoại', 'Email', 'Lĩnh vực', 'Thời gian']
    const rows = leads.map(l => [l.hoten, l.sdt, l.email, l.chuyenmon, l.submitted_at || ''])
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'leads-webinar-1000-giang-vien.csv'; a.click()
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-sm border border-gray-800">
          <h1 className="text-white font-black text-2xl mb-6 text-center">Admin</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="text" placeholder="Username" required
              value={loginForm.username}
              onChange={e => setLoginForm(f => ({ ...f, username: e.target.value }))}
              className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-700 focus:outline-none focus:border-pink-500"
            />
            <input
              type="password" placeholder="Password" required
              value={loginForm.password}
              onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
              className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-700 focus:outline-none focus:border-pink-500"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 rounded-lg transition">
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-black">Leads — Webinar 1000 Giảng Viên</h1>
          <div className="flex gap-3">
            <button onClick={exportCSV} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
              Export CSV
            </button>
            <button onClick={() => { localStorage.removeItem(TOKEN_KEY); setToken('') }}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
              Logout
            </button>
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 mb-4 px-4 py-3">
          <span className="text-gray-400 text-sm">Tổng đăng ký: </span>
          <span className="text-white font-bold text-lg">{leads.length}</span>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Đang tải...</div>
        ) : error ? (
          <div className="text-center py-20 text-red-400">{error}</div>
        ) : (
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">#</th>
                  <th className="text-left px-4 py-3">Họ tên</th>
                  <th className="text-left px-4 py-3">Số điện thoại</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Lĩnh vực</th>
                  <th className="text-left px-4 py-3">Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/50 transition">
                    <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold">{lead.hoten}</td>
                    <td className="px-4 py-3 text-gray-300">{lead.sdt}</td>
                    <td className="px-4 py-3 text-gray-300">{lead.email}</td>
                    <td className="px-4 py-3 text-gray-300">{lead.chuyenmon}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{lead.submitted_at || '—'}</td>
                  </tr>
                ))}
                {leads.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-500">Chưa có đăng ký nào</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
