import React, { useEffect, useState } from 'react'

const api = {
  async me() {
    const res = await fetch('/api/auth/me', { credentials: 'include' })
    if (res.ok) return res.json()
    return null
  },
  async register(data) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },
  async login(data) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },
  async logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
  },
  async listTasks() {
    const res = await fetch('/api/tasks', { credentials: 'include' })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },
  async createTask(title, emailHint) {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Email': emailHint || ''
      },
      body: JSON.stringify({ title }),
      credentials: 'include'
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },
  async markDone(id, emailHint) {
    const res = await fetch(`/api/tasks/${id}/done`, {
      method: 'PATCH',
      headers: { 'X-User-Email': emailHint || '' },
      credentials: 'include'
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },
  async reactivate(id, emailHint) {
    const res = await fetch(`/api/tasks/${id}/reactivate`, {
      method: 'PATCH',
      headers: { 'X-User-Email': emailHint || '' },
      credentials: 'include'
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },
  async remove(id) {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE', credentials: 'include' })
  }
}

export default function App() {
  const [user, setUser] = useState(null)
  const [emailHint, setEmailHint] = useState('') // used for notifications
  const [authMode, setAuthMode] = useState('login')
  const [form, setForm] = useState({ email: '', name: '', password: '' })
  const [tasks, setTasks] = useState([])
  const [newTitle, setNewTitle] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.me().then(u => {
      if (u) {
        setUser(u)
        setEmailHint(u.email)
        refresh()
      }
    })
  }, [])

  async function refresh() {
    try {
      const t = await api.listTasks()
      setTasks(t)
    } catch (e) {
      setError('Failed to load tasks')
    }
  }

  async function handleAuth(e) {
    e.preventDefault()
    setError('')
    try {
      if (authMode === 'register') {
        await api.register(form)
      }
      const u = await api.login({ email: form.email, password: form.password })
      setUser(u)
      setEmailHint(u.email)
      refresh()
    } catch (e) {
      setError('Auth failed')
    }
  }

  async function logout() {
    await api.logout()
    setUser(null)
    setTasks([])
  }

  async function addTask(e) {
    e.preventDefault()
    if (!newTitle.trim()) return
    await api.createTask(newTitle.trim(), emailHint)
    setNewTitle('')
    refresh()
  }

  async function done(id) {
    await api.markDone(id, emailHint)
    refresh()
  }

  async function reactivate(id) {
    await api.reactivate(id, emailHint)
    refresh()
  }

  async function remove(id) {
    await api.remove(id)
    refresh()
  }

  return (
    <div style={{ maxWidth: 720, margin: '40px auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>TaskStack</h1>
      <p style={{ color: '#666' }}>A tiny task manager to learn DevOps, Docker, and Kubernetes.</p>

      {!user ? (
        <form onSubmit={handleAuth} style={{ border: '1px solid #ddd', padding: 16, borderRadius: 8 }}>
          <div style={{ marginBottom: 8 }}>
            <label>Email</label><br/>
            <input value={form.email} onChange={e=>setForm({...form, email:e.target.value})} required style={{ width: '100%', padding: 8 }}/>
          </div>
          {authMode === 'register' && (
            <div style={{ marginBottom: 8 }}>
              <label>Name</label><br/>
              <input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} required style={{ width: '100%', padding: 8 }}/>
            </div>
          )}
          <div style={{ marginBottom: 8 }}>
            <label>Password</label><br/>
            <input type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} required style={{ width: '100%', padding: 8 }}/>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="submit">{authMode === 'register' ? 'Register & Login' : 'Login'}</button>
            <button type="button" onClick={()=>setAuthMode(authMode==='login'?'register':'login')}>
              {authMode === 'login' ? 'Create account' : 'Have an account? Login'}
            </button>
          </div>
          {error && <p style={{ color: 'crimson' }}>{error}</p>}
        </form>
      ) : (
        <div style={{ border: '1px solid #ddd', padding: 16, borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <strong>Signed in as:</strong> {user.name} <small style={{ color: '#666' }}>({user.email})</small>
            </div>
            <button onClick={logout}>Logout</button>
          </div>

          <hr/>

          <form onSubmit={addTask} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input placeholder="New task title..." value={newTitle} onChange={e=>setNewTitle(e.target.value)} style={{ flex: 1, padding: 8 }}/>
            <button type="submit">Add</button>
          </form>

          <ul style={{ listStyle: 'none', padding: 0 }}>
            {tasks.map(t => (
              <li key={t.id} style={{ border: '1px solid #eee', padding: 12, borderRadius: 6, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div><strong>{t.title}</strong></div>
                  <small style={{ color: t.status === 'done' ? 'green' : '#666' }}>Status: {t.status}</small>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {t.status === 'open' ? (
                    <button onClick={()=>done(t.id)}>Mark done</button>
                  ) : (
                    <button onClick={()=>reactivate(t.id)}>Reactivate</button>
                  )}
                  <button onClick={()=>remove(t.id)} style={{ color: 'crimson' }}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <footer style={{ marginTop: 24, color: '#777' }}>
        <small>Tips: Use <code>docker compose up</code> for local; see README for Kubernetes steps.</small>
      </footer>
    </div>
  )
}
