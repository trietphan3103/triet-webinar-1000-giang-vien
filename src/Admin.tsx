import { useState, useEffect, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import Link from '@tiptap/extension-link'

// ─── Config ──────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_KHA_API_URL || 'https://kha-webinar.mona.academy'
const TOKEN_KEY = 'kha_admin_token'

// ─── Auth utils ──────────────────────────────────────────────────────────────
const getToken  = () => localStorage.getItem(TOKEN_KEY) || ''
const setToken  = (t: string) => localStorage.setItem(TOKEN_KEY, t)
const clearToken = () => localStorage.removeItem(TOKEN_KEY)

// ─── Types ────────────────────────────────────────────────────────────────────
interface User {
  id: number; name: string; email: string; phone: string
  city: string; clinic_name: string
  created_at?: string; updated_at?: string
}
interface SubmitLog {
  id: number; name: string; email: string; phone: string
  city: string; clinic_name: string; submitted_at: string
}
type Tab = 'users' | 'submit-logs' | 'analytics' | 'email-templates'

interface EmailTemplate {
  id: number; name: string; subject: string; body: string; is_active: boolean
  created_at?: string; updated_at?: string
}

// ─── API wrapper ─────────────────────────────────────────────────────────────
async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
      ...opts.headers,
    },
  })
  if (res.status === 401 || res.status === 403) {
    clearToken(); window.location.reload()
    throw new Error('Phiên đăng nhập hết hạn')
  }
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`)
  return data
}

// ─── Export helpers ───────────────────────────────────────────────────────────
function exportCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const escape = (v: unknown) => {
    const s = String(v ?? '')
    return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = '﻿' + [headers, ...data.map(r => headers.map(h => escape(r[h])))].map(r => r.join(',')).join('\n')
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
    download: filename,
  })
  a.click(); URL.revokeObjectURL(a.href)
}
function exportXLSX(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Data')
  XLSX.writeFile(wb, filename)
}

// ─── Shared components ────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

function ExportDropdown({ onCSV, onXLSX }: { onCSV: () => void; onXLSX: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-500 transition">
        ↓ Export
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
          <button onClick={() => { onCSV(); setOpen(false) }}
            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
            📄 CSV
          </button>
          <button onClick={() => { onXLSX(); setOpen(false) }}
            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100">
            📊 XLSX
          </button>
        </div>
      )}
    </div>
  )
}

function inputCls(err?: string) {
  return `w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition ${
    err ? 'border-red-300 bg-red-50/30 focus:ring-red-200' : 'border-slate-200 focus:ring-blue-100 focus:border-blue-400'
  }`
}

// ─── Users Tab ────────────────────────────────────────────────────────────────
function UserFormFields({ form, onChange, errors }: {
  form: Partial<User>; onChange: (f: Partial<User>) => void; errors: Record<string, string>
}) {
  const set = (k: keyof User) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...form, [k]: e.target.value })
  return (
    <div className="space-y-4">
      {([['name','Họ và tên'],['email','Email'],['phone','Số điện thoại'],['clinic_name','Khóa học / Chuyên môn']] as [keyof User, string][]).map(([k, label]) => (
        <div key={k}>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
          <input value={String(form[k] ?? '')} onChange={set(k)} className={inputCls(errors[k])} />
          {errors[k] && <p className="text-red-500 text-xs mt-1">{errors[k]}</p>}
        </div>
      ))}
    </div>
  )
}

function UsersTab() {
  const [data, setData] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<'create' | { edit: User } | null>(null)
  const [form, setForm] = useState<Partial<User>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  const toast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3000) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api<{ data: User[] } | User[]>('/admin/users')
      setData(Array.isArray(r) ? r : (r as { data: User[] }).data ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = data.filter(u => !search ? true :
    ['name','email','phone','city','clinic_name'].some(k => (u as unknown as Record<string, unknown>)[k]?.toString().toLowerCase().includes(search.toLowerCase())))

  function validateForm(f: Partial<User>) {
    const e: Record<string, string> = {}
    if (!f.name?.trim()) e.name = 'Bắt buộc'
    if (!f.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'Email không hợp lệ'
    if (!f.phone?.trim()) e.phone = 'Bắt buộc'
    if (!f.clinic_name?.trim()) e.clinic_name = 'Bắt buộc'
    return e
  }

  async function handleSave() {
    const e = validateForm(form); setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true)
    try {
      if (modal === 'create') {
        await api('/admin/users', { method: 'POST', body: JSON.stringify(form) })
        toast('Tạo thành công')
      } else if (modal && typeof modal === 'object') {
        await api(`/admin/users/${modal.edit.id}`, { method: 'PUT', body: JSON.stringify(form) })
        toast('Cập nhật thành công')
      }
      setModal(null); load()
    } catch (err: unknown) {
      toast((err as Error).message)
    } finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    if (!confirm('Xác nhận xóa?')) return
    try {
      await api(`/admin/users/${id}`, { method: 'DELETE' })
      toast('Đã xóa'); load()
    } catch (err: unknown) { toast((err as Error).message) }
  }

  const flat = filtered.map(u => ({ ID: u.id, 'Họ tên': u.name, Email: u.email, 'SĐT': u.phone, 'Khóa học': u.clinic_name, 'Ngày tạo': u.created_at ?? '' })) as Record<string, unknown>[]

  return (
    <div>
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg">{toastMsg}</div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên, email, SĐT..."
          className="flex-1 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100" />
        <div className="flex gap-2 shrink-0">
          <button onClick={() => { setForm({}); setErrors({}); setModal('create') }}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
            + Thêm
          </button>
          <ExportDropdown onCSV={() => exportCSV(flat, 'users.csv')} onXLSX={() => exportXLSX(flat, 'users.xlsx')} />
        </div>
      </div>

      <div className="text-xs text-slate-400 mb-3">Hiển thị {filtered.length} / {data.length} học viên</div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Đang tải...</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['#','Họ tên','Email','SĐT','Khóa học','Ngày tạo',''].map(c => (
                    <th key={c} className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3 text-slate-400 text-xs">{u.id}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3 text-slate-600">{u.phone}</td>
                    <td className="px-4 py-3 text-slate-600">{u.clinic_name}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString('vi-VN') : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => { setForm({ ...u }); setErrors({}); setModal({ edit: u }) }}
                          className="text-blue-600 hover:text-blue-800 text-xs font-semibold">Sửa</button>
                        <button onClick={() => handleDelete(u.id)}
                          className="text-red-500 hover:text-red-700 text-xs font-semibold">Xóa</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filtered.length && <tr><td colSpan={8} className="text-center py-12 text-slate-400">Chưa có dữ liệu</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(u => (
              <div key={u.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-slate-900">{u.name}</p>
                    <p className="text-xs text-slate-400">#{u.id}</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => { setForm({ ...u }); setErrors({}); setModal({ edit: u }) }} className="text-blue-600 text-xs font-semibold">Sửa</button>
                    <button onClick={() => handleDelete(u.id)} className="text-red-500 text-xs font-semibold">Xóa</button>
                  </div>
                </div>
                <div className="space-y-1 text-sm text-slate-600">
                  <p>{u.email}</p><p>{u.phone}</p><p>{u.clinic_name}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal */}
      {modal && (
        <Modal title={modal === 'create' ? 'Thêm học viên' : 'Sửa học viên'} onClose={() => setModal(null)}>
          <UserFormFields form={form} onChange={setForm} errors={errors} />
          <div className="flex gap-3 mt-6">
            <button onClick={() => setModal(null)} className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-50">Hủy</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-500 disabled:opacity-60 transition">
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Submit Logs Tab ──────────────────────────────────────────────────────────
function SubmitLogsTab() {
  const [data, setData] = useState<SubmitLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [toastMsg, setToastMsg] = useState('')

  const toast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3000) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api<{ data: SubmitLog[] } | SubmitLog[]>('/admin/submit-logs')
      setData(Array.isArray(r) ? r : (r as { data: SubmitLog[] }).data ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = data.filter(l => !search ? true :
    ['name','email','phone','city','clinic_name'].some(k => (l as unknown as Record<string, unknown>)[k]?.toString().toLowerCase().includes(search.toLowerCase())))

  async function handleDelete(id: number) {
    if (!confirm('Xác nhận xóa log này?')) return
    try { await api(`/admin/submit-logs/${id}`, { method: 'DELETE' }); toast('Đã xóa'); load() }
    catch (err: unknown) { toast((err as Error).message) }
  }

  const flat = filtered.map(l => ({ ID: l.id, 'Họ tên': l.name, Email: l.email, 'SĐT': l.phone, 'Khóa học': l.clinic_name, 'Thời gian': l.submitted_at })) as Record<string, unknown>[]

  return (
    <div>
      {toastMsg && <div className="fixed top-4 right-4 z-50 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg">{toastMsg}</div>}

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên, email, SĐT..."
          className="flex-1 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100" />
        <ExportDropdown onCSV={() => exportCSV(flat, 'submit-logs.csv')} onXLSX={() => exportXLSX(flat, 'submit-logs.xlsx')} />
      </div>

      <div className="text-xs text-slate-400 mb-3">Hiển thị {filtered.length} / {data.length} lượt đăng ký</div>

      {loading ? <div className="text-center py-16 text-slate-400">Đang tải...</div> : (
        <>
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['#','Họ tên','Email','SĐT','Khóa học','Thời gian',''].map(c => (
                    <th key={c} className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => (
                  <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3 text-slate-400 text-xs">{l.id}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{l.name}</td>
                    <td className="px-4 py-3 text-slate-600">{l.email}</td>
                    <td className="px-4 py-3 text-slate-600">{l.phone}</td>
                    <td className="px-4 py-3 text-slate-600">{l.clinic_name}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{new Date(l.submitted_at).toLocaleString('vi-VN')}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(l.id)} className="text-red-500 hover:text-red-700 text-xs font-semibold">Xóa</button>
                    </td>
                  </tr>
                ))}
                {!filtered.length && <tr><td colSpan={8} className="text-center py-12 text-slate-400">Chưa có dữ liệu</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="md:hidden space-y-3">
            {filtered.map(l => (
              <div key={l.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between mb-1">
                  <p className="font-semibold text-slate-900">{l.name}</p>
                  <button onClick={() => handleDelete(l.id)} className="text-red-500 text-xs font-semibold">Xóa</button>
                </div>
                <div className="space-y-1 text-sm text-slate-600">
                  <p>{l.email} · {l.phone}</p>
                  <p>{l.clinic_name}</p>
                  <p className="text-xs text-slate-400">{new Date(l.submitted_at).toLocaleString('vi-VN')}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Email Templates Tab ──────────────────────────────────────────────────────
type TemplateModal = null | 'create' | { edit: EmailTemplate } | { broadcast: EmailTemplate }

const VARS = [
  { label: '{{name}}', value: '{{name}}' },
  { label: '{{email}}', value: '{{email}}' },
  { label: '{{phone}}', value: '{{phone}}' },
]

function RichEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [showSource, setShowSource] = useState(false)
  const [sourceVal, setSourceVal] = useState(value)
  const [varOpen, setVarOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const varRef = useRef<HTMLDivElement>(null)
  const linkRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Link.configure({ openOnClick: false }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  useEffect(() => {
    if (!editor) return
    const cur = editor.getHTML()
    if (cur !== value) editor.commands.setContent(value, false as any)
  }, [value, editor])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (varRef.current && !varRef.current.contains(e.target as Node)) setVarOpen(false)
      if (linkRef.current && !linkRef.current.contains(e.target as Node)) setLinkOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function insertVar(v: string) {
    editor?.commands.insertContent(v)
    setVarOpen(false)
  }

  function applySource() {
    onChange(sourceVal)
    editor?.commands.setContent(sourceVal, false as any)
    setShowSource(false)
  }

  function ToolBtn({ onClick, active, title, children }: { onClick: () => void; active?: boolean; title?: string; children: React.ReactNode }) {
    return (
      <button type="button" onClick={onClick} title={title}
        className={`w-7 h-7 flex items-center justify-center rounded text-sm transition cursor-pointer ${active ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}>
        {children}
      </button>
    )
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400 transition">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-slate-50 border-b border-slate-200">
        <ToolBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} title="Bold">
          <strong>B</strong>
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} title="Italic">
          <em>I</em>
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive('underline')} title="Underline">
          <span className="underline">U</span>
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleStrike().run()} active={editor?.isActive('strike')} title="Strikethrough">
          <span className="line-through">S</span>
        </ToolBtn>

        <div className="w-px h-4 bg-slate-300 mx-1" />

        <ToolBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} title="Bullet list">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} title="Ordered list">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10H3M8 18H3l2.5-3H3"/></svg>
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive('blockquote')} title="Quote">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
        </ToolBtn>

        <div className="w-px h-4 bg-slate-300 mx-1" />

        <div className="relative" ref={linkRef}>
          <ToolBtn onClick={() => { setLinkUrl(editor?.getAttributes('link').href || ''); setLinkOpen(v => !v) }} active={editor?.isActive('link')} title="Link">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
          </ToolBtn>
          {linkOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 p-2 flex gap-2 min-w-[260px]">
              <input autoFocus value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { if (linkUrl) editor?.chain().focus().setLink({ href: linkUrl }).run(); else editor?.chain().focus().unsetLink().run(); setLinkOpen(false) } }}
                placeholder="https://..." className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400" />
              <button type="button" onClick={() => { if (linkUrl) editor?.chain().focus().setLink({ href: linkUrl }).run(); else editor?.chain().focus().unsetLink().run(); setLinkOpen(false) }}
                className="px-2 py-1 bg-blue-600 text-white text-xs rounded cursor-pointer hover:bg-blue-700">OK</button>
              {editor?.isActive('link') && (
                <button type="button" onClick={() => { editor?.chain().focus().unsetLink().run(); setLinkOpen(false) }}
                  className="px-2 py-1 bg-red-50 text-red-600 text-xs rounded cursor-pointer hover:bg-red-100">Xóa</button>
              )}
            </div>
          )}
        </div>

        <div className="w-px h-4 bg-slate-300 mx-1" />

        <ToolBtn onClick={() => editor?.chain().focus().undo().run()} title="Undo">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().redo().run()} title="Redo">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"/></svg>
        </ToolBtn>

        <div className="w-px h-4 bg-slate-300 mx-1" />

        {/* Variable inserter */}
        <div className="relative" ref={varRef}>
          <button type="button" onClick={() => setVarOpen(v => !v)}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-violet-50 text-violet-700 hover:bg-violet-100 transition cursor-pointer border border-violet-200">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
            Thêm biến
          </button>
          {varOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden min-w-max">
              {VARS.map(v => (
                <button key={v.value} type="button" onClick={() => insertVar(v.value)}
                  className="w-full text-left px-3 py-2 text-sm font-mono text-slate-700 hover:bg-violet-50 hover:text-violet-700 transition">
                  {v.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ml-auto">
          <ToolBtn onClick={() => { setSourceVal(editor?.getHTML() ?? ''); setShowSource(v => !v) }} active={showSource} title="HTML source">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
          </ToolBtn>
        </div>
      </div>

      {/* Editor / Source */}
      {showSource ? (
        <div className="flex flex-col">
          <textarea value={sourceVal} onChange={e => setSourceVal(e.target.value)} rows={12}
            className="w-full px-3 py-3 text-xs font-mono text-slate-700 resize-y focus:outline-none" />
          <div className="flex justify-end gap-2 px-3 py-2 bg-slate-50 border-t border-slate-200">
            <button type="button" onClick={() => setShowSource(false)} className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer">Hủy</button>
            <button type="button" onClick={applySource} className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer">Áp dụng</button>
          </div>
        </div>
      ) : (
        <EditorContent editor={editor}
          className="max-w-none min-h-[380px] px-4 py-3 focus:outline-none
            [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[360px]
            [&_.ProseMirror]:text-sm [&_.ProseMirror]:text-slate-800 [&_.ProseMirror]:leading-relaxed [&_.ProseMirror]:font-sans
            [&_.ProseMirror_p]:my-2
            [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5 [&_.ProseMirror_ul]:my-2 [&_.ProseMirror_ul_li]:my-0.5
            [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5 [&_.ProseMirror_ol]:my-2 [&_.ProseMirror_ol_li]:my-0.5
            [&_.ProseMirror_strong]:font-bold
            [&_.ProseMirror_em]:italic
            [&_.ProseMirror_a]:text-blue-600 [&_.ProseMirror_a]:underline [&_.ProseMirror_a]:cursor-pointer
            [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-slate-300 [&_.ProseMirror_blockquote]:pl-3 [&_.ProseMirror_blockquote]:text-slate-500 [&_.ProseMirror_blockquote]:italic" />
      )}
    </div>
  )
}

function TemplateForm({ form, onChange }: { form: Partial<EmailTemplate>; onChange: (f: Partial<EmailTemplate>) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Tên template <span className="text-red-400">*</span></label>
          <input value={form.name ?? ''} onChange={e => onChange({ ...form, name: e.target.value })}
            placeholder="Email 1 - Chào mừng"
            className="w-full border border-slate-200 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Tiêu đề email (Subject) <span className="text-red-400">*</span></label>
        <input value={form.subject ?? ''} onChange={e => onChange({ ...form, subject: e.target.value })}
          placeholder="Chào {{name}}, đây là thông tin quan trọng..."
          className="w-full border border-slate-200 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Nội dung email <span className="text-red-400">*</span></label>
        <RichEditor value={form.body ?? ''} onChange={body => onChange({ ...form, body })} />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.is_active ?? true} onChange={e => onChange({ ...form, is_active: e.target.checked })}
          className="w-4 h-4 rounded accent-blue-600" />
        <span className="text-sm text-slate-600">Kích hoạt template này</span>
      </label>
    </div>
  )
}

function BroadcastModal({ template, onClose, toast }: { template: EmailTemplate; onClose: () => void; toast: (m: string) => void }) {
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [result, setResult] = useState<{ sent?: number; failed?: number; message?: string } | null>(null)

  useEffect(() => {
    api<{ data: User[] } | User[]>('/admin/users').then(r => {
      const users = Array.isArray(r) ? r : (r as { data: User[] }).data ?? []
      setRecipientCount(users.length)
    }).catch(() => setRecipientCount(null))
  }, [])

  async function handleSend() {
    if (!confirm(`Xác nhận gửi email đến ${recipientCount ?? 'tất cả'} học viên?`)) return
    setSending(true)
    try {
      const data = await api<{ sent?: number; failed?: number; message?: string }>('/api/broadcast', {
        method: 'POST',
        body: JSON.stringify({ template_id: template.id }),
      })
      setResult(data)
      setSent(true)
      toast(`Đã gửi thành công${data.sent != null ? ` (${data.sent} email)` : ''}`)
    } catch (e: unknown) {
      toast((e as Error).message)
    } finally { setSending(false) }
  }

  return (
    <Modal title="Gửi email broadcast" onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-slate-50 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Template:</span>
            <span className="font-semibold text-slate-800">{template.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Subject:</span>
            <span className="font-semibold text-slate-800 truncate max-w-[200px]">{template.subject}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Người nhận:</span>
            <span className={`font-bold ${recipientCount !== null ? 'text-blue-600' : 'text-slate-400'}`}>
              {recipientCount !== null ? `${recipientCount} học viên` : 'Đang tải...'}
            </span>
          </div>
        </div>

        {!template.is_active && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg px-3 py-2">
            Template này đang tắt (Inactive). Vẫn có thể gửi thủ công.
          </div>
        )}

        {sent && result && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-3 py-2.5">
            {result.message || `Gửi thành công!`}
            {result.sent != null && <span className="ml-1">({result.sent} email đã gửi{result.failed ? `, ${result.failed} lỗi` : ''})</span>}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-50">
            {sent ? 'Đóng' : 'Hủy'}
          </button>
          {!sent && (
            <button onClick={handleSend} disabled={sending || recipientCount === 0}
              className="flex-1 bg-violet-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-violet-500 disabled:opacity-60 transition flex items-center justify-center gap-2">
              {sending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  Đang gửi...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  Gửi broadcast
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

function EmailTemplatesTab() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<TemplateModal>(null)
  const [form, setForm] = useState<Partial<EmailTemplate>>({})
  const [saving, setSaving] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  const toast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 4000) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api<{ data: EmailTemplate[] } | EmailTemplate[]>('/admin/email-templates')
      setTemplates(Array.isArray(r) ? r : (r as { data: EmailTemplate[] }).data ?? [])
    } catch (e: unknown) { toast((e as Error).message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() { setForm({ name: '', subject: '', body: '', is_active: true }); setModal('create') }
  function openEdit(t: EmailTemplate) { setForm({ name: t.name, subject: t.subject, body: t.body, is_active: t.is_active }); setModal({ edit: t }) }

  async function handleSave() {
    setSaving(true)
    try {
      if (modal === 'create') {
        await api('/admin/email-templates', { method: 'POST', body: JSON.stringify(form) })
        toast('Tạo template thành công')
      } else if (modal && typeof modal === 'object' && 'edit' in modal) {
        await api(`/admin/email-templates/${modal.edit.id}`, { method: 'PUT', body: JSON.stringify(form) })
        toast('Đã lưu template')
      }
      setModal(null); load()
    } catch (e: unknown) { toast((e as Error).message) }
    finally { setSaving(false) }
  }

  const isEditModal = modal && typeof modal === 'object' && 'edit' in modal
  const isBroadcastModal = modal && typeof modal === 'object' && 'broadcast' in modal

  if (loading) return <div className="text-center py-16 text-slate-400">Đang tải...</div>

  return (
    <div>
      {toastMsg && <div className="fixed top-4 right-4 z-50 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg">{toastMsg}</div>}

      <div className="flex justify-end mb-5">
        <button onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
          Tạo template
        </button>
      </div>

      <div className="grid gap-4">
        {!templates.length && <p className="text-center py-12 text-slate-400">Chưa có template nào</p>}
        {templates.map(t => (
          <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${t.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {t.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-xs text-slate-400">#{t.id}</span>
                </div>
                <p className="font-semibold text-slate-900 truncate">{t.name}</p>
                <p className="text-sm text-slate-500 mt-0.5">Subject: <span className="text-slate-700">{t.subject}</span></p>
                <p className="text-xs text-slate-400 mt-1">Cập nhật: {t.updated_at ? new Date(t.updated_at).toLocaleString('vi-VN') : '—'}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setModal({ broadcast: t })}
                  className="text-violet-600 hover:text-violet-800 text-sm font-semibold px-3 py-1.5 border border-violet-200 rounded-lg hover:bg-violet-50 transition flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  Gửi
                </button>
                <button onClick={() => openEdit(t)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-semibold px-3 py-1.5 border border-blue-200 rounded-lg hover:bg-blue-50 transition">
                  Sửa
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(modal === 'create' || isEditModal) && (
        <Modal
          title={modal === 'create' ? 'Tạo template mới' : `Sửa: ${(modal as { edit: EmailTemplate }).edit.name}`}
          onClose={() => setModal(null)}>
          <TemplateForm form={form} onChange={setForm} />
          <div className="flex gap-3 mt-6">
            <button onClick={() => setModal(null)} className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-50">Hủy</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-500 disabled:opacity-60 transition">
              {saving ? 'Đang lưu...' : modal === 'create' ? 'Tạo mới' : 'Lưu'}
            </button>
          </div>
        </Modal>
      )}

      {isBroadcastModal && (
        <BroadcastModal
          template={(modal as { broadcast: EmailTemplate }).broadcast}
          onClose={() => setModal(null)}
          toast={toast} />
      )}
    </div>
  )
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────
interface PixelTotals { WebinarPageView?: number; WebinarFormSubmit?: number; WebinarViewContentScroll25?: number; WebinarViewContentScroll50?: number; WebinarViewContentScroll75?: number; WebinarViewContentScroll90?: number; WebinarTimeOnSite30s?: number; WebinarTimeOnSite60s?: number; WebinarTimeOnSite120s?: number; [key: string]: number | undefined }
interface DailyRow { date: string; [key: string]: number | string }
interface PixelData { totals: PixelTotals; daily: DailyRow[]; hourly?: { hour: number; [key: string]: number }[]; days?: number }
interface AdRow { ad_id: string; post_url?: string; campaign_name: string; adset_name?: string; ad_name?: string; impressions: number; reach?: number; clicks: number; landing_page_views?: number; spend: number; cpm: number; cpc: number; ctr: number; actions?: Record<string, number> }
interface AdsData { ads: AdRow[]; campaigns?: AdRow[]; since: string; until: string }

function KpiCard({ label, value, sub, color, bar, barColor }: { label: string; value: string | number; sub?: string; color?: string; bar?: number; barColor?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <p className={`text-3xl font-black ${color || 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      {bar !== undefined && (
        <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor || 'bg-blue-500'}`} style={{ width: `${Math.min(bar, 100)}%` }} />
        </div>
      )}
    </div>
  )
}

function FunnelBar({ label, value, max, color, pct }: { label: string; value: number; max: number; color: string; pct: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-44 text-xs text-slate-500 shrink-0 text-right">{label}</div>
      <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
      </div>
      <div className="w-20 text-xs font-semibold text-slate-700 shrink-0">{value.toLocaleString()} <span className="text-slate-400">({pct}%)</span></div>
    </div>
  )
}

function DiagnosisPanel({ cvr, engagePct, scroll25Pct, scroll90Pct }: { cvr: number; engagePct: number; scroll25Pct: number; scroll90Pct: number }) {
  const items = [
    cvr >= 8 ? `✓ CVR ${cvr.toFixed(1)}% — tốt` : cvr >= 4 ? `⚠ CVR ${cvr.toFixed(1)}% — trung bình` : `✗ CVR ${cvr.toFixed(1)}% — thấp, cần review offer/form`,
    engagePct >= 40 ? `✓ Engagement ${engagePct}% — tốt` : engagePct >= 20 ? `⚠ Bounce rate cao, hero chưa hấp dẫn` : `✗ Traffic không đúng đối tượng`,
    scroll25Pct >= 30 ? `✓ Phần đầu giữ chân được (scroll 25%: ${scroll25Pct}%)` : `⚠ User không cuộn xuống (scroll 25%: ${scroll25Pct}%)`,
    scroll90Pct >= 15 ? `✓ Content thuyết phục (scroll 90%: ${scroll90Pct}%)` : `⚠ Social proof ít người đọc (scroll 90%: ${scroll90Pct}%)`,
  ]
  const colors = (s: string) => s.startsWith('✓') ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : s.startsWith('⚠') ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200'
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="font-bold text-slate-800 mb-3 text-sm uppercase tracking-wider">Chẩn đoán tự động</h3>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className={`text-sm px-3 py-2 rounded-lg border ${colors(item)}`}>{item}</div>
        ))}
      </div>
    </div>
  )
}

function AnalyticsTab() {
  const [pixelData, setPixelData] = useState<PixelData | null>(null)
  const [adsData, setAdsData] = useState<AdsData | null>(null)
  const [adsError, setAdsError] = useState<string>('')
  const [dbLeads, setDbLeads] = useState<number | null>(null)
  const [days, setDays] = useState(7)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (d: number, f: string, t: string) => {
    setLoading(true)
    const params = f || t ? `from=${f}&to=${t}` : `days=${d}`
    const sinceDate = f || new Date(Date.now() - d * 86400000).toISOString().slice(0, 10)
    const untilDate = t || new Date().toISOString().slice(0, 10)
    try {
      const [pixelRes, adsRes, logsRes] = await Promise.all([
        fetch(`/api/analytics/pixel?${params}`),
        fetch(`/api/analytics/ads?${params}`),
        fetch(`${API_BASE}/admin/submit-logs`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ])
      if (pixelRes.ok) setPixelData(await pixelRes.json())
      const adsJson = await adsRes.json()
      if (adsRes.ok && !adsJson.error) { setAdsData(adsJson); setAdsError('') }
      else { setAdsData(null); setAdsError(adsJson?.error?.message || adsJson?.error || JSON.stringify(adsJson)) }
      if (logsRes.ok) {
        const r = await logsRes.json()
        const logs: SubmitLog[] = Array.isArray(r) ? r : r.data ?? []
        const sinceTs = new Date(sinceDate).getTime()
        const untilTs = new Date(untilDate).getTime() + 86400000
        setDbLeads(logs.filter(l => { const ts = new Date(l.submitted_at).getTime(); return ts >= sinceTs && ts < untilTs }).length)
      }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(days, from, to) }, [load, days, from, to])

  const totals = pixelData?.totals || {}
  const totalPV = totals.WebinarPageView || 0
  const leads = dbLeads ?? totals.WebinarFormSubmit ?? 0
  const cvr = totalPV > 0 ? (leads / totalPV) * 100 : 0
  const engagePct = totalPV > 0 ? Math.round(((totals.WebinarTimeOnSite30s || 0) / totalPV) * 100) : 0

  const cvrColor = cvr >= 8 ? 'text-emerald-600' : cvr >= 4 ? 'text-amber-500' : 'text-red-500'

  // Daily chart
  const daily = pixelData?.daily || []
  const maxPV = Math.max(...daily.map(d => (d.WebinarPageView as number) || 0), 1)

  // Ads
  const campaigns = adsData?.campaigns || adsData?.ads || []
  const getConv = (row: AdRow) => {
    if (!row.actions) return 0
    for (const k of ['offsite_conversion.fb_pixel_custom', 'lead', 'onsite_conversion.lead_grouped']) {
      const v = row.actions[k]; if (typeof v === 'number' && v > 0) return v
    }
    return 0
  }

  function pct(n: number, total: number) { return total > 0 ? Math.round((n / total) * 100) : 0 }

  return (
    <div className="space-y-6">
      {/* Date filter */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap gap-2 items-center">
        {([
          { label: 'Hôm nay', d: 1 },
          { label: '7 ngày', d: 7 },
          { label: '14 ngày', d: 14 },
          { label: '30 ngày', d: 30 },
          { label: 'Tháng này', d: -1 },
        ] as { label: string; d: number }[]).map(({ label, d }) => {
          const isThisMonth = d === -1
          const active = isThisMonth
            ? (from === new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10) && !days)
            : (days === d && !from && !to)
          return (
            <button key={label} onClick={() => {
              if (isThisMonth) {
                const now = new Date()
                setFrom(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10))
                setTo(now.toISOString().slice(0, 10))
                setDays(0)
              } else {
                setDays(d); setFrom(''); setTo('')
              }
            }}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition cursor-pointer ${active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
              {label}
            </button>
          )
        })}
        <div className="w-px h-5 bg-slate-200 mx-1 shrink-0" />
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          <input type="date" value={from} onChange={e => { setFrom(e.target.value); setDays(0) }}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 cursor-pointer" />
          <span className="text-slate-400 text-sm shrink-0">—</span>
          <input type="date" value={to} onChange={e => { setTo(e.target.value); setDays(0) }}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 cursor-pointer" />
        </div>
        {loading && <span className="text-xs text-slate-400 ml-auto">Đang tải...</span>}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Sessions" value={totalPV.toLocaleString()} sub={`${days || 'custom'} ngày`} />
        <KpiCard label="Leads (DB)" value={leads.toLocaleString()} sub={dbLeads !== null ? 'từ DB thực' : 'pixel'} />
        <KpiCard label="CVR thực" value={`${cvr.toFixed(1)}%`} color={cvrColor} sub="DB leads / PageView"
          bar={Math.min(cvr * 5, 100)} barColor={cvr >= 8 ? 'bg-emerald-500' : cvr >= 4 ? 'bg-amber-400' : 'bg-red-400'} />
        <KpiCard label="Engaged 30s+" value={`${engagePct}%`}
          color={engagePct >= 40 ? 'text-emerald-600' : engagePct >= 20 ? 'text-amber-500' : 'text-red-500'}
          sub={`${(totals.WebinarTimeOnSite30s || 0).toLocaleString()} người`}
          bar={engagePct} barColor={engagePct >= 40 ? 'bg-emerald-400' : engagePct >= 20 ? 'bg-amber-400' : 'bg-red-400'} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Engagement Funnel */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wider">Engagement Funnel</h3>
          <div className="space-y-2.5">
            <FunnelBar label="PageView" value={totalPV} max={totalPV} color="bg-slate-400" pct={100} />
            <FunnelBar label="Scroll 25%" value={totals.WebinarViewContentScroll25||0} max={totalPV} color="bg-blue-400" pct={pct(totals.WebinarViewContentScroll25||0, totalPV)} />
            <FunnelBar label="Scroll 50%" value={totals.WebinarViewContentScroll50||0} max={totalPV} color="bg-blue-500" pct={pct(totals.WebinarViewContentScroll50||0, totalPV)} />
            <FunnelBar label="Scroll 75%" value={totals.WebinarViewContentScroll75||0} max={totalPV} color="bg-indigo-500" pct={pct(totals.WebinarViewContentScroll75||0, totalPV)} />
            <FunnelBar label="Scroll 90%" value={totals.WebinarViewContentScroll90||0} max={totalPV} color="bg-violet-500" pct={pct(totals.WebinarViewContentScroll90||0, totalPV)} />
            <div className="border-t border-slate-100 pt-2" />
            <FunnelBar label="Time 30s+" value={totals.WebinarTimeOnSite30s||0} max={totalPV} color="bg-amber-400" pct={pct(totals.WebinarTimeOnSite30s||0, totalPV)} />
            <FunnelBar label="Time 60s+" value={totals.WebinarTimeOnSite60s||0} max={totalPV} color="bg-orange-400" pct={pct(totals.WebinarTimeOnSite60s||0, totalPV)} />
            <FunnelBar label="Time 120s+" value={totals.WebinarTimeOnSite120s||0} max={totalPV} color="bg-red-400" pct={pct(totals.WebinarTimeOnSite120s||0, totalPV)} />
            <div className="border-t border-slate-100 pt-2" />
            <FunnelBar label="Leads thực (DB)" value={leads} max={totalPV} color="bg-emerald-500" pct={pct(leads, totalPV)} />
          </div>
        </div>

        <DiagnosisPanel cvr={cvr} engagePct={engagePct}
          scroll25Pct={pct(totals.WebinarViewContentScroll25||0, totalPV)}
          scroll90Pct={pct(totals.WebinarViewContentScroll90||0, totalPV)} />
      </div>

      {/* Daily Bar Chart */}
      {daily.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wider">Theo ngày</h3>
          <div className="flex items-end gap-1.5 h-40 overflow-x-auto pb-2">
            {daily.map(d => {
              const pv = (d.WebinarPageView as number) || 0
              const lead = (d.WebinarFormSubmit as number) || 0
              const barH = maxPV > 0 ? (pv / maxPV) * 100 : 0
              const leadH = pv > 0 ? (lead / pv) * 100 : 0
              const dayCvr = pv > 0 ? Math.round((lead / pv) * 100) : 0
              return (
                <div key={d.date} className="flex flex-col items-center gap-1 min-w-[32px] flex-1 group relative">
                  <div className="text-[9px] font-bold text-slate-500">{dayCvr > 0 ? `${dayCvr}%` : ''}</div>
                  <div className="w-full flex flex-col justify-end rounded overflow-hidden" style={{ height: '80px', background: '#f1f5f9' }}>
                    <div style={{ height: `${barH}%` }} className="w-full flex flex-col justify-end">
                      <div style={{ height: `${leadH}%` }} className="w-full bg-blue-600/80 rounded-t" />
                      <div style={{ height: `${100 - leadH}%` }} className="w-full bg-slate-300" />
                    </div>
                  </div>
                  <div className="text-[9px] text-slate-400 rotate-45 origin-left">{d.date.slice(5)}</div>
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 bg-slate-800 text-white text-xs rounded-lg px-2.5 py-2 opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10 shadow-lg">
                    <div className="font-semibold">{d.date}</div>
                    <div>Views: {pv}</div>
                    <div>Leads: {lead}</div>
                    <div>CVR: {dayCvr}%</div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex gap-4 mt-3">
            <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-3 h-3 rounded-sm bg-blue-600/80 inline-block" /> Leads</span>
            <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-3 h-3 rounded-sm bg-slate-300 inline-block" /> Sessions</span>
          </div>
        </div>
      )}

      {/* Hourly CVR Chart */}
      {pixelData?.hourly && pixelData.hourly.some(h => (h.WebinarPageView || 0) > 0) && (() => {
        const hourly = pixelData.hourly!
        const maxHPV = Math.max(...hourly.map(h => h.WebinarPageView || 0), 1)
        return (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-bold text-slate-800 text-sm mb-0.5">CVR theo giờ trong ngày</h3>
            <p className="text-xs text-slate-400 mb-4">Thanh = volume · Màu đậm = CVR cao · Vàng = peak chuyển đổi</p>
            <div className="flex items-end gap-0.5 h-32 overflow-x-auto pb-1">
              {hourly.map(h => {
                const pv = h.WebinarPageView || 0
                const lead = h.WebinarFormSubmit || 0
                const barH = maxHPV > 0 ? (pv / maxHPV) * 100 : 0
                const hCvr = pv > 0 ? (lead / pv) * 100 : 0
                const isPeak = hCvr >= 15
                return (
                  <div key={h.hour} className="flex flex-col items-center min-w-[28px] flex-1 group relative">
                    <div className="w-full flex flex-col justify-end rounded overflow-hidden" style={{ height: '90px' }}>
                      <div className="w-full rounded-t transition-all"
                        style={{
                          height: `${barH}%`,
                          background: isPeak ? '#f59e0b' : hCvr >= 8 ? '#6366f1' : '#cbd5e1',
                          opacity: pv > 0 ? 1 : 0.3,
                        }} />
                    </div>
                    {[0, 6, 12, 18].includes(h.hour) && (
                      <div className="text-[9px] text-slate-400 mt-1">{h.hour}h</div>
                    )}
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 bg-slate-800 text-white text-xs rounded-lg px-2.5 py-2 opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10 shadow-lg left-1/2 -translate-x-1/2">
                      <div className="font-semibold">{h.hour}:00</div>
                      <div>Views: {pv}</div>
                      <div>Leads: {lead}</div>
                      {hCvr > 0 && <div>CVR: {hCvr.toFixed(1)}%</div>}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-3 h-3 rounded-sm bg-slate-300 inline-block" /> Volume</span>
              <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" /> CVR cao</span>
              <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" /> Peak ≥15%</span>
            </div>
          </div>
        )
      })()}

      {/* Traffic Source */}
      {(() => {
        const totalAdsLpv = campaigns.reduce((s, c) => s + (c.landing_page_views || 0), 0)
        const totalAdsSpend = campaigns.reduce((s, c) => s + (c.spend || 0), 0)
        const totalImp = campaigns.reduce((s, c) => s + (c.impressions || 0), 0)
        const fbViews = Math.min(totalAdsLpv, totalPV)
        const organicViews = Math.max(totalPV - fbViews, 0)
        const fbPct = totalPV > 0 ? Math.round((fbViews / totalPV) * 100) : 0
        const organicPct = 100 - fbPct

        // Peak lead day
        const peakDay = daily.reduce((best, d) => {
          const lead = (d.WebinarFormSubmit as number) || 0
          return lead > ((best.WebinarFormSubmit as number) || 0) ? d : best
        }, daily[0] || { date: '', WebinarFormSubmit: 0 })
        const peakDayLeads = (peakDay?.WebinarFormSubmit as number) || 0
        const peakDayPV = (peakDay?.WebinarPageView as number) || 0
        const peakDayIsOrganic = campaigns.length === 0 || totalAdsLpv === 0

        // Auto insight
        const insights: string[] = []
        if (organicPct > 0) insights.push(`${organicPct}% traffic đến từ organic — share link, Zalo, group FB.`)
        if (totalAdsSpend > 0 && cvr >= 4) insights.push(`Ads CVR tốt (${cvr.toFixed(1)}%).`)
        else if (totalAdsSpend === 0 && totalPV > 0) insights.push(`Chưa có ads spend — toàn bộ traffic organic.`)
        if (peakDayLeads > 0 && peakDayIsOrganic) insights.push(`Peak lead ngày ${peakDay?.date?.slice(5)} hoàn toàn không có ads.`)
        else if (peakDayLeads > 0 && peakDayPV > 0) insights.push(`Peak lead ngày ${peakDay?.date?.slice(5)}: ${peakDayLeads} leads (CVR ${Math.round(peakDayLeads/peakDayPV*100)}%).`)

        return (
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm mb-0.5">Nguồn traffic</h3>
              <p className="text-xs text-slate-400">Ước tính từ Ads Manager vs tổng PageView từ Pixel</p>
            </div>
            <div className="space-y-3">
              {/* Organic */}
              <div>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-sm font-medium text-slate-700">Organic / Word-of-mouth</span>
                  <span className="text-sm font-semibold text-emerald-600">{organicPct}% · {organicViews.toLocaleString()} views</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${organicPct}%` }} />
                </div>
              </div>
              {/* FB Ads */}
              <div>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-sm font-medium text-slate-700">Facebook Ads</span>
                  <span className="text-sm font-semibold text-blue-600">{fbPct}% · {fbViews.toLocaleString()} views</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${fbPct}%` }} />
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Ads spend: <span className="font-medium text-slate-600">{totalAdsSpend > 0 ? totalAdsSpend.toLocaleString('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }) : '0đ'}</span>
                  <span className="mx-2">·</span>
                  Impressions: <span className="font-medium text-slate-600">{totalImp.toLocaleString()}</span>
                </div>
              </div>
            </div>
            {insights.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                <span className="font-semibold">Insight: </span>{insights.join(' ')}
              </div>
            )}
            {campaigns.length === 0 && (
              <div className="text-xs text-center space-y-1">
                <p className="text-slate-500 font-medium">Không có dữ liệu Ads</p>
                {adsError
                  ? <p className="text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2 text-left break-all">{adsError}</p>
                  : <p className="text-slate-400">Token cần quyền <code className="bg-slate-100 px-1 rounded">ads_read</code></p>
                }
              </div>
            )}
          </div>
        )
      })()}

      {/* Ads Table */}
      {campaigns.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Hiệu quả quảng cáo</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Campaign','Reach','Impressions','CTR(link)','LPV','CPM','Spend','Conv.','CVR','CPL'].map(c => (
                    <th key={c} className="text-left px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, i) => {
                  const conv = getConv(c)
                  const lpv = c.landing_page_views || 0
                  const adsCvr = lpv > 0 && conv > 0 ? (conv / lpv) * 100 : 0
                  const cpl = conv > 0 ? c.spend / conv : 0
                  const ctrColor = c.ctr >= 2 ? 'text-emerald-600 font-bold' : c.ctr >= 1 ? 'text-amber-500 font-semibold' : 'text-red-500'
                  const cvrColor = adsCvr >= 15 ? 'text-emerald-600 font-bold' : adsCvr >= 8 ? 'text-amber-500 font-semibold' : 'text-slate-500'
                  return (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                      <td className="px-3 py-2.5 max-w-[180px]">
                        {c.post_url ? (
                          <a href={c.post_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">{c.campaign_name}</a>
                        ) : (
                          <span className="font-medium text-slate-800">{c.campaign_name}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{(c.reach||0).toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-slate-600">{c.impressions.toLocaleString()}</td>
                      <td className={`px-3 py-2.5 ${ctrColor}`}>{c.ctr?.toFixed(2)}%</td>
                      <td className="px-3 py-2.5 text-slate-600">{lpv.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-slate-600">{c.cpm?.toFixed(0)}đ</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-800">{c.spend?.toLocaleString('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })}</td>
                      <td className="px-3 py-2.5 text-slate-700 font-semibold">{conv > 0 ? conv : '—'}</td>
                      <td className={`px-3 py-2.5 ${cvrColor}`}>{adsCvr > 0 ? `${adsCvr.toFixed(1)}%` : '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600">{cpl > 0 ? cpl.toLocaleString('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

const REMEMBER_KEY = 'kha_admin_remember'

// ─── Login ─────────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }: { onLogin: () => void }) {
  const saved = localStorage.getItem(REMEMBER_KEY)
  const [form, setForm] = useState({ username: saved ? JSON.parse(saved).username : '', password: saved ? JSON.parse(saved).password : '' })
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(!!saved)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/admin/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (res.ok && data.token) {
        if (remember) localStorage.setItem(REMEMBER_KEY, JSON.stringify({ username: form.username, password: form.password }))
        else localStorage.removeItem(REMEMBER_KEY)
        setToken(data.token); onLogin()
      } else setError(data.error || data.message || 'Sai thông tin đăng nhập')
    } catch { setError('Không thể kết nối server') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm border border-slate-200">
        <h1 className="text-slate-900 font-black text-2xl mb-1 text-center">Admin Panel</h1>
        <p className="text-slate-400 text-sm text-center mb-7">KHA Webinar</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" placeholder="Username" required value={form.username}
            onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
            className="w-full border border-slate-200 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400" />
          <div className="relative">
            <input type={showPw ? 'text' : 'password'} placeholder="Password" required value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full border border-slate-200 px-4 py-3 pr-11 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400" />
            <button type="button" onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer">
              {showPw ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
              )}
            </button>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
              className="w-4 h-4 rounded accent-blue-600 cursor-pointer" />
            <span className="text-sm text-slate-500">Ghi nhớ đăng nhập</span>
          </label>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition">
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ onLogout }: { onLogout: () => void }) {
  const getTabFromHash = (): Tab => {
    const h = window.location.hash.slice(1) as Tab
    return (['users', 'submit-logs', 'analytics', 'email-templates'] as Tab[]).includes(h) ? h : 'users'
  }
  const [tab, setTab] = useState<Tab>(getTabFromHash)

  const switchTab = (t: Tab) => { setTab(t); window.location.hash = t === 'users' ? '' : t }

  useEffect(() => {
    const onHash = () => setTab(getTabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const tabLabels: Record<Tab, string> = { users: 'Học viên', 'submit-logs': 'Lịch sử đăng ký', analytics: 'Analytics', 'email-templates': 'Email Templates' }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <nav className="flex gap-1 overflow-x-auto">
            {(['users', 'submit-logs', 'analytics', 'email-templates'] as Tab[]).map(t => (
              <button key={t} onClick={() => switchTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${tab === t ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                {tabLabels[t]}
              </button>
            ))}
          </nav>
          <button onClick={onLogout} className="text-sm text-slate-400 hover:text-red-500 transition ml-4 shrink-0">Đăng xuất</button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {tab === 'users' ? <UsersTab /> : tab === 'submit-logs' ? <SubmitLogsTab /> : tab === 'analytics' ? <AnalyticsTab /> : <EmailTemplatesTab />}
      </main>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function Admin() {
  const [authed, setAuthed] = useState(!!getToken())
  const handleLogout = () => { clearToken(); setAuthed(false) }
  if (!authed) return <LoginPage onLogin={() => setAuthed(true)} />
  return <Dashboard onLogout={handleLogout} />
}
