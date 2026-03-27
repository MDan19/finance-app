import { useEffect, useState } from 'react'
import { Plus, Edit2, Power, TrendingUp, TrendingDown } from 'lucide-react'
import { accountsApi } from '../api'
import { Account, AccountType } from '../types'
import { formatCurrency, formatEur, getAccountIcon, getAccountTypeLabel, ACCOUNT_TYPES, CURRENCIES } from '../utils/format'
import Modal from '../components/Modal'

const ASSETS: AccountType[] = ['BANK', 'CASH', 'PERSONAL_CREDIT']
const LIABILITIES: AccountType[] = ['CREDIT_CARD', 'LOAN_CONSUMER', 'LOAN_AUTO', 'MORTGAGE', 'PERSONAL_DEBT']

const ASSET_GROUPS = [
  { label: '🏦 Bank Accounts & Cash', types: ['BANK', 'CASH'] as AccountType[] },
  { label: '🤝 Personal Credits (owed to me)', types: ['PERSONAL_CREDIT'] as AccountType[] },
]
const LIABILITY_GROUPS = [
  { label: '💳 Credit Cards', types: ['CREDIT_CARD'] as AccountType[] },
  { label: '🏠 Mortgage', types: ['MORTGAGE'] as AccountType[] },
  { label: '🚗 Auto Loan', types: ['LOAN_AUTO'] as AccountType[] },
  { label: '💰 Consumer / Personal Loans', types: ['LOAN_CONSUMER'] as AccountType[] },
  { label: '👥 Private Debts (borrowed from people)', types: ['PERSONAL_DEBT'] as AccountType[] },
]

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editAcc, setEditAcc] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const res = await accountsApi.list()
    setAccounts(res.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const toggleActive = async (acc: Account) => {
    await accountsApi.update(acc.id, { ...acc, isActive: !acc.isActive })
    load()
  }

  const active = accounts.filter(a => a.isActive)
  const inactive = accounts.filter(a => !a.isActive)

  // Totals
  const totalAssets = active
    .filter(a => ASSETS.includes(a.type))
    .reduce((sum, a) => {
      if (a.type === 'PERSONAL_CREDIT') return sum + Number(a.currentBalance ?? 0)
      return sum + Number(a.currentBalance ?? 0)
    }, 0)

  const totalLiabilities = active
    .filter(a => LIABILITIES.includes(a.type))
    .reduce((sum, a) => {
      if (a.type === 'CREDIT_CARD') return sum + Number(a.currentDebt ?? 0)
      if (['LOAN_CONSUMER','LOAN_AUTO','MORTGAGE'].includes(a.type)) return sum + Number(a.remainingAmount ?? 0)
      return sum + Number(a.currentBalance ?? 0)
    }, 0)

  const netWorth = totalAssets - totalLiabilities

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Accounts</h1>
        <button onClick={() => { setEditAcc(null); setShowModal(true) }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4"/> Add Account
        </button>
      </div>

      {/* Net Worth summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card border-green-800/40">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-400"/>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Total Assets</p>
          </div>
          <p className="text-2xl font-bold text-green-400">{formatEur(totalAssets)}</p>
        </div>
        <div className="card border-red-800/40">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-red-400"/>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Total Liabilities</p>
          </div>
          <p className="text-2xl font-bold text-red-400">{formatEur(totalLiabilities)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Net Worth</p>
          <p className={`text-2xl font-bold ${netWorth >= 0 ? 'text-white' : 'text-red-400'}`}>{formatEur(netWorth)}</p>
        </div>
      </div>

      {/* ASSETS */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-green-400 flex items-center gap-2">
          <TrendingUp className="w-5 h-5"/> Assets
        </h2>
        {ASSET_GROUPS.map(group => {
          const groupAccounts = active.filter(a => group.types.includes(a.type))
          if (groupAccounts.length === 0) return null
          return (
            <div key={group.label} className="space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider">{group.label}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupAccounts.map(acc => (
                  <AccountCard key={acc.id} account={acc}
                    onEdit={() => { setEditAcc(acc); setShowModal(true) }}
                    onToggle={() => toggleActive(acc)}/>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* LIABILITIES */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-red-400 flex items-center gap-2">
          <TrendingDown className="w-5 h-5"/> Liabilities
        </h2>
        {LIABILITY_GROUPS.map(group => {
          const groupAccounts = active.filter(a => group.types.includes(a.type))
          if (groupAccounts.length === 0) return null
          return (
            <div key={group.label} className="space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider">{group.label}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupAccounts.map(acc => (
                  <AccountCard key={acc.id} account={acc}
                    onEdit={() => { setEditAcc(acc); setShowModal(true) }}
                    onToggle={() => toggleActive(acc)}/>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Inactive accounts */}
      {inactive.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-600 uppercase tracking-wider">Inactive / Closed</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {inactive.map(acc => (
              <AccountCard key={acc.id} account={acc} inactive
                onEdit={() => { setEditAcc(acc); setShowModal(true) }}
                onToggle={() => toggleActive(acc)}/>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <AccountModal account={editAcc}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); load() }}/>
      )}
    </div>
  )
}

function AccountCard({ account, onEdit, onToggle, inactive }: {
  account: Account; onEdit: () => void; onToggle: () => void; inactive?: boolean
}) {
  const isLiability = LIABILITIES.includes(account.type)

  const getBalance = () => {
    if (account.type === 'CREDIT_CARD') return Number(account.currentDebt ?? 0)
    if (['LOAN_CONSUMER','LOAN_AUTO','MORTGAGE'].includes(account.type)) return Number(account.remainingAmount ?? 0)
    return Number(account.currentBalance ?? 0)
  }

  const balance = getBalance()

  return (
    <div className={`card hover:border-gray-700 transition-colors ${inactive ? 'opacity-50' : ''}`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white text-sm truncate">{account.name}</p>
          {account.institution && <p className="text-xs text-gray-500 truncate">{account.institution}</p>}
          <p className="text-xs text-gray-600">{getAccountTypeLabel(account.type)}</p>
        </div>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          <span className="text-xl">{getAccountIcon(account.type)}</span>
        </div>
      </div>

      {/* Main balance */}
      <p className={`text-xl font-bold ${isLiability ? 'text-red-400' : 'text-white'}`}>
        {formatCurrency(balance, account.currency)}
      </p>

      {/* Credit card extra info */}
      {account.type === 'CREDIT_CARD' && (
        <div className="mt-2 space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Limit: {formatCurrency(Number(account.creditLimit??0), account.currency)}</span>
            <span className="text-green-400">Avail: {formatCurrency(Number(account.creditLimit??0) - balance, account.currency)}</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, account.creditLimit ? (balance/Number(account.creditLimit))*100 : 0)}%`,
                backgroundColor: balance > Number(account.creditLimit??0)*0.8 ? '#ef4444' : '#6366f1'
              }}/>
          </div>
        </div>
      )}

      {/* Loan extra info */}
      {['LOAN_CONSUMER','LOAN_AUTO','MORTGAGE'].includes(account.type) && (
        <div className="mt-2 space-y-1 text-xs text-gray-500">
          {account.monthlyPayment && (
            <p>{formatCurrency(Number(account.monthlyPayment), account.currency)}/mo
              {account.interestRate && ` · ${Number(account.interestRate)}% p.a.`}
            </p>
          )}
          {account.endDate && (
            <p>Until {new Date(account.endDate).toLocaleDateString('en-GB', { month:'short', year:'numeric' })}</p>
          )}
          {account.originalAmount && (
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mt-1">
              <div className="h-full rounded-full bg-red-500/60"
                style={{ width: `${Math.min(100,(balance/Number(account.originalAmount))*100)}%` }}/>
            </div>
          )}
        </div>
      )}

      {/* Personal debt/credit */}
      {['PERSONAL_DEBT','PERSONAL_CREDIT'].includes(account.type) && account.counterpartyName && (
        <p className="text-xs text-gray-500 mt-2">
          {account.type === 'PERSONAL_DEBT' ? '→ owed to' : '← owed by'} <span className="text-gray-300">{account.counterpartyName}</span>
        </p>
      )}

      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-800">
        <button onClick={onEdit} className="flex-1 btn-secondary text-xs py-1.5 flex items-center justify-center gap-1">
          <Edit2 className="w-3 h-3"/> Edit
        </button>
        <button onClick={onToggle}
          className={`p-1.5 rounded-lg text-xs transition-colors ${inactive ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50' : 'bg-gray-800 text-gray-500 hover:text-yellow-400'}`}
          title={inactive ? 'Reactivate' : 'Deactivate'}>
          <Power className="w-3.5 h-3.5"/>
        </button>
      </div>
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
    notes: account?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const isLoan = ['LOAN_CONSUMER','LOAN_AUTO','MORTGAGE'].includes(form.type)
  const isCard = form.type === 'CREDIT_CARD'
  const isPersonal = ['PERSONAL_DEBT','PERSONAL_CREDIT'].includes(form.type)
  const isBank = ['BANK','CASH'].includes(form.type)

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
    setSaving(false); onSave()
  }

  return (
    <Modal title={account ? 'Edit Account' : 'Add Account'} onClose={onClose} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Account Name</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. ABN AMRO Checking"/>
          </div>
          <div><label className="label">Type</label>
            <select className="select" value={form.type} onChange={e => set('type', e.target.value)}>
              <optgroup label="── Assets ──">
                <option value="BANK">🏦 Bank Account</option>
                <option value="CASH">💵 Cash</option>
                <option value="PERSONAL_CREDIT">🤝 Personal Credit (I lent money)</option>
              </optgroup>
              <optgroup label="── Liabilities ──">
                <option value="CREDIT_CARD">💳 Credit Card</option>
                <option value="MORTGAGE">🏠 Mortgage</option>
                <option value="LOAN_AUTO">🚗 Auto Loan</option>
                <option value="LOAN_CONSUMER">💰 Consumer / Personal Loan</option>
                <option value="PERSONAL_DEBT">👥 Private Debt (I borrowed)</option>
              </optgroup>
            </select>
          </div>
          <div><label className="label">Currency</label>
            <select className="select" value={form.currency} onChange={e => set('currency', e.target.value)}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><label className="label">Institution / Bank</label>
            <input className="input" value={form.institution} onChange={e => set('institution', e.target.value)} placeholder="ABN AMRO, ING, Revolut..."/>
          </div>
        </div>

        {isBank && (
          <div><label className="label">Current Balance</label>
            <input type="number" className="input" step="0.01" value={form.currentBalance} onChange={e => set('currentBalance', e.target.value)}/>
          </div>
        )}

        {isCard && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Credit Limit</label>
              <input type="number" className="input" step="0.01" value={form.creditLimit} onChange={e => set('creditLimit', e.target.value)}/>
            </div>
            <div><label className="label">Current Debt</label>
              <input type="number" className="input" step="0.01" value={form.currentDebt} onChange={e => set('currentDebt', e.target.value)}/>
            </div>
          </div>
        )}

        {isLoan && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Original Amount</label>
              <input type="number" className="input" step="0.01" value={form.originalAmount} onChange={e => set('originalAmount', e.target.value)}/>
            </div>
            <div><label className="label">Remaining Amount</label>
              <input type="number" className="input" step="0.01" value={form.remainingAmount} onChange={e => set('remainingAmount', e.target.value)}/>
            </div>
            <div><label className="label">Monthly Payment</label>
              <input type="number" className="input" step="0.01" value={form.monthlyPayment} onChange={e => set('monthlyPayment', e.target.value)}/>
            </div>
            <div><label className="label">Interest Rate (%)</label>
              <input type="number" className="input" step="0.01" value={form.interestRate} onChange={e => set('interestRate', e.target.value)}/>
            </div>
            <div><label className="label">End Date</label>
              <input type="date" className="input" value={form.endDate} onChange={e => set('endDate', e.target.value)}/>
            </div>
          </div>
        )}

        {isPersonal && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Person Name</label>
              <input className="input" value={form.counterpartyName} onChange={e => set('counterpartyName', e.target.value)} placeholder="John Doe"/>
            </div>
            <div><label className="label">Amount</label>
              <input type="number" className="input" step="0.01" value={form.currentBalance} onChange={e => set('currentBalance', e.target.value)}/>
            </div>
          </div>
        )}

        <div><label className="label">Notes</label>
          <input className="input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes..."/>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.name} className="btn-primary flex-1">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
