import { useEffect, useState } from 'react'
import { Download, Save } from 'lucide-react'
import { settingsApi, authApi, scheduledApi, categoriesApi, accountsApi } from '../api'
import { ScheduledPayment, Category, Account } from '../types'
import { CURRENCIES, formatCurrency } from '../utils/format'
import Modal from '../components/Modal'
import { useAuthStore } from '../store/auth'
import { Plus, Edit2, Trash2 } from 'lucide-react'

type Tab = 'general' | 'scheduled' | 'data'

export default function Settings() {
  const [tab, setTab] = useState<Tab>('general')

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit">
        {([
          { key: 'general', label: 'General' },
          { key: 'scheduled', label: 'Scheduled Payments' },
          { key: 'data', label: 'Data' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium ${tab === t.key ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && <GeneralSettings />}
      {tab === 'scheduled' && <ScheduledSettings />}
      {tab === 'data' && <DataSettings />}
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
    <div className="space-y-6">
      <div className="card space-y-4">
        <h2 className="font-semibold text-white">Display Settings</h2>
        <div>
          <label className="label">Base Currency</label>
          <select className="select w-auto" value={baseCurrency} onChange={e => setBaseCurrency(e.target.value)}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={saveCurrency} className="btn-primary flex items-center gap-2">
            <Save className="w-4 h-4"/> Save
          </button>
          {settingsMsg && <span className="text-green-400 text-sm">{settingsMsg}</span>}
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold text-white">Change Password</h2>
        <div><label className="label">Current Password</label>
          <input type="password" className="input" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}/>
        </div>
        <div><label className="label">New Password</label>
          <input type="password" className="input" value={newPassword} onChange={e => setNewPassword(e.target.value)}/>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={changePassword} className="btn-primary">Change Password</button>
          {pwMsg && <span className={pwMsg.includes('Error') ? 'text-red-400' : 'text-green-400'}>{pwMsg}</span>}
        </div>
      </div>
    </div>
  )
}

function ScheduledSettings() {
  const [payments, setPayments] = useState<ScheduledPayment[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editP, setEditP] = useState<ScheduledPayment | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  const load = async () => {
    const [p, a, c] = await Promise.all([scheduledApi.list(), accountsApi.list(), categoriesApi.all()])
    setPayments(p.data); setAccounts(a.data); setCategories(c.data)
  }
  useEffect(() => { load() }, [])

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-white">Scheduled Payments</h2>
        <button onClick={() => { setEditP(null); setShowModal(true) }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4"/> Add
        </button>
      </div>
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
            <th className="p-3 text-left">Name</th>
            <th className="p-3 text-left">Account</th>
            <th className="p-3 text-left">Due Day</th>
            <th className="p-3 text-right">Amount</th>
            <th className="p-3 w-20"/>
          </tr></thead>
          <tbody>
            {payments.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-gray-600">No scheduled payments</td></tr>
            ) : payments.map(p => (
              <tr key={p.id} className="border-b border-gray-800/50">
                <td className="p-3 text-white">{p.name}</td>
                <td className="p-3 text-gray-400">{p.account?.name}</td>
                <td className="p-3 text-gray-400">Day {p.dueDay}</td>
                <td className="p-3 text-right text-red-400">{formatCurrency(p.amount, p.currency)}</td>
                <td className="p-3 flex gap-2 justify-end">
                  <button onClick={() => { setEditP(p); setShowModal(true) }} className="text-gray-600 hover:text-indigo-400"><Edit2 className="w-4 h-4"/></button>
                  <button onClick={async () => { await scheduledApi.delete(p.id); load() }} className="text-gray-600 hover:text-red-400"><Trash2 className="w-4 h-4"/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && (
        <ScheduledModal payment={editP} accounts={accounts} categories={categories}
          onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load() }}/>
      )}
    </div>
  )
}

function ScheduledModal({ payment, accounts, categories, onClose, onSave }: any) {
  const [name, setName] = useState(payment?.name || '')
  const [accountId, setAccountId] = useState(payment?.accountId?.toString() || accounts[0]?.id?.toString() || '')
  const [categoryId, setCategoryId] = useState(payment?.categoryId?.toString() || '')
  const [amount, setAmount] = useState(payment?.amount?.toString() || '')
  const [currency, setCurrency] = useState(payment?.currency || 'EUR')
  const [dueDay, setDueDay] = useState(payment?.dueDay?.toString() || '1')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name || !amount || !accountId) return
    setSaving(true)
    const data = { name, accountId: +accountId, categoryId: categoryId ? +categoryId : undefined, amount: parseFloat(amount), currency, dueDay: +dueDay }
    if (payment) await scheduledApi.update(payment.id, data)
    else await scheduledApi.create(data)
    setSaving(false); onSave()
  }

  return (
    <Modal title={payment ? 'Edit Payment' : 'Add Scheduled Payment'} onClose={onClose} size="sm">
      <div className="space-y-3">
        <div><label className="label">Name</label><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Rent, Netflix..."/></div>
        <div><label className="label">Account</label>
          <select className="select" value={accountId} onChange={e => setAccountId(e.target.value)}>
            {accounts.map((a: Account) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Amount</label><input type="number" className="input" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}/></div>
          <div><label className="label">Currency</label>
            <select className="select" value={currency} onChange={e => setCurrency(e.target.value)}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div><label className="label">Due Day of Month</label>
          <input type="number" min="1" max="31" className="input" value={dueDay} onChange={e => setDueDay(e.target.value)}/>
        </div>
        <div><label className="label">Category (optional)</label>
          <select className="select" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
            <option value="">None</option>
            {categories.map((c: Category) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving || !name || !amount} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </Modal>
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
        <h2 className="font-semibold text-white">Export Data</h2>
        <p className="text-sm text-gray-400">Download all your data as a JSON backup file.</p>
        <button onClick={handleExport} className="btn-secondary flex items-center gap-2">
          <Download className="w-4 h-4"/> Export All Data
        </button>
      </div>
    </div>
  )
}
