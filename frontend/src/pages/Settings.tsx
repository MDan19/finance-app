import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit2, Download, Save } from 'lucide-react'
import { settingsApi, accountsApi, authApi, scheduledApi, categoriesApi } from '../api'
import { Account, ScheduledPayment, Category } from '../types'
import { ACCOUNT_TYPES, CURRENCIES, getAccountTypeLabel, formatCurrency } from '../utils/format'
import Modal from '../components/Modal'
import { useAuthStore } from '../store/auth'

type Tab = 'general' | 'accounts' | 'scheduled' | 'data'

export default function Settings() {
  const [tab, setTab] = useState<Tab>('general')

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit flex-wrap">
        {(['general', 'accounts', 'scheduled', 'data'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize ${tab === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >{t}</button>
        ))}
      </div>

      {tab === 'general' && <GeneralSettings />}
      {tab === 'accounts' && <AccountsSettings />}
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
    } catch {
      setPwMsg('Error: current password incorrect')
    }
    setTimeout(() => setPwMsg(''), 3000)
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <h2 className="font-semibold text-white">Display Settings</h2>
        <div>
          <label className="label">Base Currency (all totals shown in this currency)</label>
          <select className="select w-auto" value={baseCurrency} onChange={e => setBaseCurrency(e.target.value)}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={saveCurrency} className="btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" /> Save Settings
          </button>
          {settingsMsg && <span className="text-green-400 text-sm">{settingsMsg}</span>}
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold text-white">Change Password</h2>
        <div>
          <label className="label">Current Password</label>
          <input type="password" className="input" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
        </div>
        <div>
          <label className="label">New Password</label>
          <input type="password" className="input" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={changePassword} className="btn-primary">Change Password</button>
          {pwMsg && <span className={pwMsg.includes('Error') ? 'text-red-400' : 'text-green-400'} >{pwMsg}</span>}
        </div>
      </div>
    </div>
  )
}

function AccountsSettings() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editAcc, setEditAcc] = useState<Account | null>(null)

  const load = () => accountsApi.list().then(r => setAccounts(r.data))
  useEffect(() => { load() }, [])

  const handleDelete = async (id: number) => {
    if (!confirm('Deactivate this account?')) return
    await accountsApi.delete(id)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-white">Accounts</h2>
        <button onClick={() => { setEditAcc(null); setShowModal(true) }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Account
        </button>
      </div>
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
            <th className="p-3 text-left">Name</th>
            <th className="p-3 text-left">Type</th>
            <th className="p-3 text-left">Institution</th>
            <th className="p-3 text-right">Balance</th>
            <th className="p-3 w-20"></th>
          </tr></thead>
          <tbody>
            {accounts.map(acc => (
              <tr key={acc.id} className="border-b border-gray-800/50 hover:bg-gray-900/30">
                <td className="p-3 font-medium text-white">{acc.name}</td>
                <td className="p-3 text-gray-400">{getAccountTypeLabel(acc.type)}</td>
                <td className="p-3 text-gray-500">{acc.institution || '—'}</td>
                <td className="p-3 text-right text-white">{formatCurrency(acc.currentBalance, acc.currency)}</td>
                <td className="p-3 flex gap-2 justify-end">
                  <button onClick={() => { setEditAcc(acc); setShowModal(true) }} className="text-gray-600 hover:text-indigo-400"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(acc.id)} className="text-gray-600 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && <AccountModal account={editAcc} onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load() }} />}
    </div>
  )
}

function AccountModal({ account, onClose, onSave }: { account: Account | null; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    name: account?.name || '',
    type: account?.type || 'BANK',
    currency: account?.currency || 'EUR',
    institution: account?.institution || '',
    currentBalance: account?.currentBalance?.toString() || '0',
    creditLimit: account?.creditLimit?.toString() || '',
    currentDebt: account?.currentDebt?.toString() || '0',
    originalAmount: account?.originalAmount?.toString() || '',
    remainingAmount: account?.remainingAmount?.toString() || '',
    monthlyPayment: account?.monthlyPayment?.toString() || '',
    interestRate: account?.interestRate?.toString() || '',
    endDate: account?.endDate?.split('T')[0] || '',
    counterpartyName: account?.counterpartyName || '',
    direction: account?.direction || 'owe',
    notes: account?.notes || '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name) return
    setSaving(true)
    const data: any = {
      ...form,
      currentBalance: parseFloat(form.currentBalance) || 0,
      creditLimit: form.creditLimit ? parseFloat(form.creditLimit) : undefined,
      currentDebt: form.currentDebt ? parseFloat(form.currentDebt) : undefined,
      originalAmount: form.originalAmount ? parseFloat(form.originalAmount) : undefined,
      remainingAmount: form.remainingAmount ? parseFloat(form.remainingAmount) : undefined,
      monthlyPayment: form.monthlyPayment ? parseFloat(form.monthlyPayment) : undefined,
      interestRate: form.interestRate ? parseFloat(form.interestRate) : undefined,
      endDate: form.endDate || undefined,
    }
    if (account) await accountsApi.update(account.id, data)
    else await accountsApi.create(data)
    setSaving(false)
    onSave()
  }

  const isLoan = ['LOAN_CONSUMER','LOAN_AUTO','MORTGAGE'].includes(form.type)
  const isCard = form.type === 'CREDIT_CARD'
  const isPersonal = ['PERSONAL_DEBT','PERSONAL_CREDIT'].includes(form.type)

  return (
    <Modal title={account ? 'Edit Account' : 'Add Account'} onClose={onClose} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Name</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Account name" />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="select" value={form.type} onChange={e => set('type', e.target.value)}>
              {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Currency</label>
            <select className="select" value={form.currency} onChange={e => set('currency', e.target.value)}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Institution / Bank</label>
            <input className="input" value={form.institution} onChange={e => set('institution', e.target.value)} placeholder="ING, Rabobank..." />
          </div>
        </div>

        {!isLoan && !isCard && !isPersonal && (
          <div>
            <label className="label">Current Balance</label>
            <input type="number" className="input" step="0.01" value={form.currentBalance} onChange={e => set('currentBalance', e.target.value)} />
          </div>
        )}

        {isCard && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Credit Limit</label>
              <input type="number" className="input" step="0.01" value={form.creditLimit} onChange={e => set('creditLimit', e.target.value)} />
            </div>
            <div>
              <label className="label">Current Debt</label>
              <input type="number" className="input" step="0.01" value={form.currentDebt} onChange={e => set('currentDebt', e.target.value)} />
            </div>
          </div>
        )}

        {isLoan && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Original Amount</label>
              <input type="number" className="input" step="0.01" value={form.originalAmount} onChange={e => set('originalAmount', e.target.value)} />
            </div>
            <div>
              <label className="label">Remaining Amount</label>
              <input type="number" className="input" step="0.01" value={form.remainingAmount} onChange={e => set('remainingAmount', e.target.value)} />
            </div>
            <div>
              <label className="label">Monthly Payment</label>
              <input type="number" className="input" step="0.01" value={form.monthlyPayment} onChange={e => set('monthlyPayment', e.target.value)} />
            </div>
            <div>
              <label className="label">Interest Rate (%)</label>
              <input type="number" className="input" step="0.01" value={form.interestRate} onChange={e => set('interestRate', e.target.value)} />
            </div>
            <div>
              <label className="label">End Date</label>
              <input type="date" className="input" value={form.endDate} onChange={e => set('endDate', e.target.value)} />
            </div>
          </div>
        )}

        {isPersonal && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Person Name</label>
              <input className="input" value={form.counterpartyName} onChange={e => set('counterpartyName', e.target.value)} placeholder="John Doe" />
            </div>
            <div>
              <label className="label">Amount</label>
              <input type="number" className="input" step="0.01" value={form.currentBalance} onChange={e => set('currentBalance', e.target.value)} />
            </div>
          </div>
        )}

        <div>
          <label className="label">Notes</label>
          <input className="input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes..." />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.name} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </Modal>
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
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
            <th className="p-3 text-left">Name</th>
            <th className="p-3 text-left">Account</th>
            <th className="p-3 text-left">Due Day</th>
            <th className="p-3 text-right">Amount</th>
            <th className="p-3 w-20"></th>
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
                  <button onClick={() => { setEditP(p); setShowModal(true) }} className="text-gray-600 hover:text-indigo-400"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={async () => { await scheduledApi.delete(p.id); load() }} className="text-gray-600 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && (
        <ScheduledModal payment={editP} accounts={accounts} categories={categories}
          onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load() }}
        />
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
  const [notes, setNotes] = useState(payment?.notes || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name || !amount || !accountId) return
    setSaving(true)
    const data = { name, accountId: +accountId, categoryId: categoryId ? +categoryId : undefined, amount: parseFloat(amount), currency, dueDay: +dueDay, notes }
    if (payment) await scheduledApi.update(payment.id, data)
    else await scheduledApi.create(data)
    setSaving(false)
    onSave()
  }

  return (
    <Modal title={payment ? 'Edit Scheduled Payment' : 'Add Scheduled Payment'} onClose={onClose} size="sm">
      <div className="space-y-3">
        <div><label className="label">Name</label><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Rent, Netflix..." /></div>
        <div><label className="label">Account</label>
          <select className="select" value={accountId} onChange={e => setAccountId(e.target.value)}>
            {accounts.map((a: Account) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Amount</label><input type="number" className="input" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></div>
          <div><label className="label">Currency</label>
            <select className="select" value={currency} onChange={e => setCurrency(e.target.value)}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div><label className="label">Due Day of Month</label><input type="number" min="1" max="31" className="input" value={dueDay} onChange={e => setDueDay(e.target.value)} /></div>
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
    a.href = url
    a.download = `finance-export-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h2 className="font-semibold text-white">Export Data</h2>
        <p className="text-sm text-gray-400">Download all your data as a JSON backup file.</p>
        <button onClick={handleExport} className="btn-secondary flex items-center gap-2">
          <Download className="w-4 h-4" /> Export All Data
        </button>
      </div>
      <div className="card space-y-3 border-red-900/40">
        <h2 className="font-semibold text-red-400">Danger Zone</h2>
        <p className="text-sm text-gray-400">These actions are irreversible. Be careful.</p>
        <button
          onClick={() => { if (confirm('This will delete ALL transactions. Are you absolutely sure?')) alert('Not implemented in demo') }}
          className="btn-danger"
        >Reset All Transactions</button>
      </div>
    </div>
  )
}
