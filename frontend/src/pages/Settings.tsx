import { useEffect, useState } from 'react'
import { Download, Save, Sun, Moon, Monitor } from 'lucide-react'
import { settingsApi, authApi, accountsApi } from '../api'
import { Account } from '../types'
import { CURRENCIES } from '../utils/format'
import { useAuthStore } from '../store/auth'
import { setTheme, getTheme } from '../utils/theme'

type Theme = 'dark' | 'light' | 'system'
type Tab = 'general' | 'transactions' | 'data'

export default function Settings() {
  const [tab, setTab] = useState<Tab>('general')
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Settings</h1>
      <div className="tab-bar w-fit">
        {([
          { key: 'general', label: 'General' },
          { key: 'transactions', label: 'Transactions' },
          { key: 'data', label: 'Data' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`tab-btn${tab===t.key?' active':''}`}>{t.label}</button>
        ))}
      </div>
      {tab === 'general' && <GeneralSettings/>}
      {tab === 'transactions' && <TransactionsSettings/>}
      {tab === 'data' && <DataSettings/>}
    </div>
  )
}

function GeneralSettings() {
  const { user, fetchMe } = useAuthStore()
  const [baseCurrency, setBaseCurrency] = useState(user?.baseCurrency || 'EUR')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [settingsMsg, setSettingsMsg] = useState('')
  const [theme, setThemeState] = useState<Theme>(getTheme())

  const handleTheme = (t: Theme) => {
    setThemeState(t)
    setTheme(t)
  }

  const saveCurrency = async () => {
    await settingsApi.update({ baseCurrency })
    await fetchMe()
    setSettingsMsg('Saved!')
    setTimeout(() => setSettingsMsg(''), 2000)
  }

  const changePassword = async () => {
    try {
      await authApi.changePassword(currentPassword, newPassword)
      setPwMsg('Password changed!')
      setCurrentPassword(''); setNewPassword('')
    } catch { setPwMsg('Error: current password incorrect') }
    setTimeout(() => setPwMsg(''), 3000)
  }

  return (
    <div className="space-y-5">
      {/* Theme */}
      <div className="card space-y-4">
        <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Appearance</h2>
        <div>
          <label className="label">Theme</label>
          <div className="flex gap-3">
            {([
              { key: 'light', label: 'Light', icon: Sun },
              { key: 'dark', label: 'Dark', icon: Moon },
              { key: 'system', label: 'System', icon: Monitor },
            ] as { key: Theme; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => handleTheme(key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors flex-1 justify-center ${
                  theme === key ? 'bg-indigo-600 border-indigo-500 text-white' : 'btn-secondary'
                }`}>
                <Icon className="w-4 h-4"/> {label}
              </button>
            ))}
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            System automatically switches between light and dark based on your OS preference.
          </p>
        </div>
      </div>

      {/* Currency */}
      <div className="card space-y-4">
        <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Display Settings</h2>
        <div>
          <label className="label">Base Currency (all totals shown in this currency)</label>
          <select className="select w-auto" value={baseCurrency} onChange={e => setBaseCurrency(e.target.value)}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={saveCurrency} className="btn-primary flex items-center gap-2">
            <Save className="w-4 h-4"/> Save
          </button>
          {settingsMsg && <span className="text-green-500 text-sm">{settingsMsg}</span>}
        </div>
      </div>

      {/* Password */}
      <div className="card space-y-4">
        <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Change Password</h2>
        <div><label className="label">Current Password</label><input type="password" className="input" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}/></div>
        <div><label className="label">New Password</label><input type="password" className="input" value={newPassword} onChange={e => setNewPassword(e.target.value)}/></div>
        <div className="flex items-center gap-3">
          <button onClick={changePassword} className="btn-primary">Change Password</button>
          {pwMsg && <span className={`text-sm ${pwMsg.includes('Error') ? 'text-red-400' : 'text-green-500'}`}>{pwMsg}</span>}
        </div>
      </div>
    </div>
  )
}

function TransactionsSettings() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [batchId, setBatchId] = useState('')
  const [batches, setBatches] = useState<any[]>([])
  const [preview, setPreview] = useState<{ count: number } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    accountsApi.list().then(r => setAccounts(r.data))
    // Load import batches
    fetch('/api/import/batches', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(r => r.json()).then(setBatches)
  }, [])

  const previewDelete = async () => {
    const params = new URLSearchParams()
    if (selectedAccountId) params.append('accountId', selectedAccountId)
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)
    if (batchId) params.append('importBatchId', batchId)

    const res = await fetch(`/api/transactions/count?${params}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    const data = await res.json()
    setPreview(data)
  }

  const executeDelete = async () => {
    if (!preview || preview.count === 0) return
    if (!confirm(`Delete ${preview.count} transactions? This cannot be undone.`)) return
    setDeleting(true)
    const params = new URLSearchParams()
    if (selectedAccountId) params.append('accountId', selectedAccountId)
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)
    if (batchId) params.append('importBatchId', batchId)

    await fetch(`/api/transactions/bulk-delete-filtered?${params}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    setMsg(`Deleted ${preview.count} transactions`)
    setPreview(null)
    setDeleting(false)
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div className="space-y-5">
      <div className="card space-y-4">
        <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Delete Transactions</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Filter transactions to delete. You can combine multiple filters. Preview first to see how many will be affected.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">By Account (optional)</label>
            <select className="select" value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}>
              <option value="">All accounts</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">By Import Batch (optional)</label>
            <select className="select" value={batchId} onChange={e => setBatchId(e.target.value)}>
              <option value="">All batches</option>
              {batches.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.filename} — {new Date(b.createdAt).toLocaleDateString()} ({b.importedRows} rows)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Date From (optional)</label>
            <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)}/>
          </div>
          <div>
            <label className="label">Date To (optional)</label>
            <input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)}/>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={previewDelete} className="btn-secondary">Preview</button>
          {preview !== null && (
            <>
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                Found: <strong className={preview.count > 0 ? 'text-red-400' : 'text-green-500'}>{preview.count} transactions</strong>
              </span>
              {preview.count > 0 && (
                <button onClick={executeDelete} disabled={deleting} className="btn-danger">
                  {deleting ? 'Deleting...' : `Delete ${preview.count} transactions`}
                </button>
              )}
            </>
          )}
          {msg && <span className="text-green-500 text-sm">{msg}</span>}
        </div>
      </div>
    </div>
  )
}

function DataSettings() {
  const handleExport = async () => {
    const res = await settingsApi.export()
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url; a.download = `myfinance-export-${new Date().toISOString().split('T')[0]}.json`
    a.click(); URL.revokeObjectURL(url)
  }
  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Export Data</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Download all your data as a JSON backup file.</p>
        <button onClick={handleExport} className="btn-secondary flex items-center gap-2">
          <Download className="w-4 h-4"/> Export All Data
        </button>
      </div>
    </div>
  )
}
