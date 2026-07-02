import { useEffect, useState } from 'react'
import { Plus, Edit2, Power, TrendingUp, TrendingDown, ArrowLeftRight, Calendar } from 'lucide-react'
import { accountsApi, transactionsApi, scheduledApi, categoriesApi } from '../api'
import { Account, AccountType, Transaction, ScheduledPayment, Category } from '../types'
import { formatCurrency, formatEur, getAccountIcon, getAccountTypeLabel, CURRENCIES } from '../utils/format'
import { formatDate, getTxTypeLabel, getTxTypeBadgeClass } from '../utils/format'
import Modal from '../components/Modal'

type AccTab = 'overview' | 'transactions' | 'scheduled'

const ASSETS: AccountType[] = ['BANK', 'CASH', 'PERSONAL_CREDIT']
const LIABILITIES: AccountType[] = ['CREDIT_CARD', 'LOAN_CONSUMER', 'LOAN_AUTO', 'MORTGAGE', 'PERSONAL_DEBT']

const ASSET_GROUPS = [
  { label: '🏦 Bank Accounts & Cash', types: ['BANK', 'CASH'] as AccountType[] },
  { label: '🤝 Personal Credits', types: ['PERSONAL_CREDIT'] as AccountType[] },
]
const LIABILITY_GROUPS = [
  { label: '💳 Credit Cards', types: ['CREDIT_CARD'] as AccountType[] },
  { label: '🏠 Mortgage', types: ['MORTGAGE'] as AccountType[] },
  { label: '🚗 Auto Loan', types: ['LOAN_AUTO'] as AccountType[] },
  { label: '💰 Consumer / Personal Loans', types: ['LOAN_CONSUMER'] as AccountType[] },
  { label: '👥 Private Debts', types: ['PERSONAL_DEBT'] as AccountType[] },
]

export default function Accounts() {
  const [tab, setTab] = useState<AccTab>('overview')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showManage, setShowManage] = useState(false)
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
    if (!acc.isActive) {
      await accountsApi.update(acc.id, { ...acc, isActive: true })
    } else {
      await accountsApi.delete(acc.id)
    }
    load()
  }

  const active = accounts.filter(a => a.isActive)
  const inactive = accounts.filter(a => !a.isActive)

  const totalAssets = active.filter(a => ASSETS.includes(a.type)).reduce((sum, a) => sum + Number(a.currentBalance ?? 0), 0)
  const totalLiabilities = active.filter(a => LIABILITIES.includes(a.type)).reduce((sum, a) => {
    if (a.type === 'CREDIT_CARD') return sum + Number(a.currentDebt ?? 0)
    if (['LOAN_CONSUMER','LOAN_AUTO','MORTGAGE'].includes(a.type)) return sum + Number(a.remainingAmount ?? 0)
    return sum + Number(a.currentBalance ?? 0)
  }, 0)

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--brand)' }}>Accounts</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowManage(true)} className="btn-secondary">Manage</button>
          <button onClick={() => { setEditAcc(null); setShowModal(true) }} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4"/> Add Account
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar w-fit">
        <button onClick={() => setTab('overview')} className={`tab-btn${tab==='overview'?' active':''}`}>Overview</button>
        <button onClick={() => setTab('transactions')} className={`tab-btn${tab==='transactions'?' active':''}`}>
          <span className="flex items-center gap-1.5"><ArrowLeftRight className="w-3.5 h-3.5"/> Transactions</span>
        </button>
        <button onClick={() => setTab('scheduled')} className={`tab-btn${tab==='scheduled'?' active':''}`}>
          <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5"/> Scheduled</span>
        </button>
      </div>

      {/* OVERVIEW TAB */}
      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div className="card" style={{ borderColor: 'rgba(34,197,94,0.3)' }}>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-500"/>
                <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Total Assets</p>
              </div>
              <p className="text-2xl font-bold text-green-500">{formatEur(totalAssets)}</p>
            </div>
            <div className="card" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-red-400"/>
                <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Total Liabilities</p>
              </div>
              <p className="text-2xl font-bold text-red-400">{formatEur(totalLiabilities)}</p>
            </div>
            <div className="card">
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Net Worth</p>
              <p className={`text-2xl font-bold ${totalAssets-totalLiabilities >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                {formatEur(totalAssets - totalLiabilities)}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold text-green-500">Assets</h2>
            {ASSET_GROUPS.map(group => {
              const grp = active.filter(a => group.types.includes(a.type))
              if (!grp.length) return null
              return (
                <div key={group.label} className="space-y-2">
                  <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{group.label}</p>
                  <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                    {grp.map(acc => <AccCard key={acc.id} account={acc} onEdit={() => { setEditAcc(acc); setShowModal(true) }} onToggle={() => toggleActive(acc)}/>)}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold text-red-400">Liabilities</h2>
            {LIABILITY_GROUPS.map(group => {
              const grp = active.filter(a => group.types.includes(a.type))
              if (!grp.length) return null
              return (
                <div key={group.label} className="space-y-2">
                  <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{group.label}</p>
                  <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                    {grp.map(acc => <AccCard key={acc.id} account={acc} onEdit={() => { setEditAcc(acc); setShowModal(true) }} onToggle={() => toggleActive(acc)}/>)}
                  </div>
                </div>
              )
            })}
          </div>

          {inactive.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Inactive / Closed</p>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                {inactive.map(acc => <AccCard key={acc.id} account={acc} inactive onEdit={() => { setEditAcc(acc); setShowModal(true) }} onToggle={() => toggleActive(acc)}/>)}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'transactions' && <AccountTransactions accounts={active}/>}
      {tab === 'scheduled' && <AccountScheduled accounts={active}/>}

      {showModal && (
        <AccountModal account={editAcc}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); load() }}/>
      )}

      {showManage && (
        <ManageAccountsModal
          accounts={accounts}
          onClose={() => setShowManage(false)}
          onChanged={load}
        />
      )}
    </div>
  )
}

function ManageAccountsModal({ accounts, onClose, onChanged }: {
  accounts: Account[]; onClose: () => void; onChanged: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const handleDelete = async (acc: Account) => {
    if (!confirm(`Permanently delete "${acc.name}"? This cannot be undone.`)) return
    setDeletingId(acc.id); setError(null)
    try {
      await accountsApi.deletePermanent(acc.id)
      onChanged()
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to delete')
    }
    setDeletingId(null)
  }

  return (
    <Modal title="Manage Accounts" onClose={onClose} size="lg">
      <div className="space-y-2">
        {error && <p className="text-red-500 text-sm">{error}</p>}
        {accounts.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No accounts.</p>
        )}
        {accounts.map(acc => (
          <div key={acc.id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <div>
              <span style={{ color: 'var(--text-primary)' }}>{acc.name}</span>
              <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
                {getAccountTypeLabel(acc.type)} · {acc.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <button
              onClick={() => handleDelete(acc)}
              disabled={deletingId === acc.id}
              className="btn-danger text-xs py-1 px-2"
            >
              {deletingId === acc.id ? 'Deleting...' : 'Delete permanently'}
            </button>
          </div>
        ))}
      </div>
    </Modal>
  )
}

function AccCard({ account, onEdit, onToggle, inactive }: {
  account: Account; onEdit: () => void; onToggle: () => void; inactive?: boolean
}) {
  const isLiability = ['CREDIT_CARD','LOAN_CONSUMER','LOAN_AUTO','MORTGAGE','PERSONAL_DEBT'].includes(account.type)
  const getBalance = () => {
    if (account.type === 'CREDIT_CARD') return Number(account.currentDebt ?? 0)
    if (['LOAN_CONSUMER','LOAN_AUTO','MORTGAGE'].includes(account.type)) return Number(account.remainingAmount ?? 0)
    return Number(account.currentBalance ?? 0)
  }
  const balance = getBalance()

  return (
    <div className={`card-hover ${inactive ? 'opacity-50' : ''}`}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{account.name}</p>
          {account.institution && <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{account.institution}</p>}
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{getAccountTypeLabel(account.type)}</p>
        </div>
        <span className="text-xl">{getAccountIcon(account.type)}</span>
      </div>

      <p className={`text-xl font-bold ${isLiability ? 'text-red-400' : 'text-green-500'}`}>
        {formatCurrency(balance, account.currency)}
      </p>

      {account.type === 'CREDIT_CARD' && account.creditLimit && (
        <div className="mt-2">
          <div className="flex justify-between text-xs mb-1">
            <span style={{ color: 'var(--text-muted)' }}>Limit: {formatCurrency(Number(account.creditLimit), account.currency)}</span>
            <span className="text-green-500">Avail: {formatCurrency(Number(account.creditLimit)-balance, account.currency)}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
            <div className="h-full rounded-full" style={{ width: `${Math.min(100,account.creditLimit?(balance/Number(account.creditLimit))*100:0)}%`, backgroundColor: balance>Number(account.creditLimit??0)*0.8?'#ef4444':'#96773a' }}/>
          </div>
        </div>
      )}

      {['LOAN_CONSUMER','LOAN_AUTO','MORTGAGE'].includes(account.type) && account.monthlyPayment && (
        <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          {formatCurrency(Number(account.monthlyPayment), account.currency)}/mo{account.interestRate && ` · ${Number(account.interestRate)}%`}
          {account.originalAmount && (
            <div className="h-1.5 rounded-full overflow-hidden mt-1" style={{ background: 'var(--bg-hover)' }}>
              <div className="h-full rounded-full bg-red-500/60" style={{ width: `${Math.min(100,(balance/Number(account.originalAmount))*100)}%` }}/>
            </div>
          )}
        </div>
      )}

      {['PERSONAL_DEBT','PERSONAL_CREDIT'].includes(account.type) && account.counterpartyName && (
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          {account.type==='PERSONAL_DEBT'?'→ owed to':'← owed by'} <span style={{ color: 'var(--text-secondary)' }}>{account.counterpartyName}</span>
        </p>
      )}

      <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <button onClick={onEdit} className="btn-secondary text-xs py-1.5 flex-1 flex items-center justify-center gap-1">
          <Edit2 className="w-3 h-3"/> Edit
        </button>
        <button onClick={onToggle}
          className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors ${inactive ? 'bg-green-900/30 text-green-400' : 'text-yellow-500'}`}
          style={{ background: inactive ? undefined : 'var(--bg-hover)' }}
          title={inactive ? 'Reactivate' : 'Deactivate'}>
          <Power className="w-3.5 h-3.5"/>
        </button>
      </div>
    </div>
  )
}

function AccountTransactions({ accounts }: { accounts: Account[] }) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id?.toString() || '')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedAccountId) return
    setLoading(true)
    transactionsApi.list({ accountId: selectedAccountId, page, limit: 50 })
      .then(r => { setTransactions(r.data.transactions); setTotal(r.data.total) })
      .finally(() => setLoading(false))
  }, [selectedAccountId, page])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="label mb-0">Account</label>
        <select className="select w-auto" value={selectedAccountId} onChange={e => { setSelectedAccountId(e.target.value); setPage(1) }}>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{total} transactions</span>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-left">Description</th>
                <th className="p-3 text-left">Category</th>
                <th className="p-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_,i) => (
                  <tr key={i} className="table-row">
                    {[...Array(5)].map((_,j) => <td key={j} className="p-3"><div className="h-4 rounded animate-pulse" style={{ background: 'var(--bg-hover)' }}/></td>)}
                  </tr>
                ))
              ) : transactions.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>No transactions</td></tr>
              ) : transactions.map(tx => (
                <tr key={tx.id} className="table-row">
                  <td className="p-3" style={{ color: 'var(--text-secondary)' }}>{formatDate(tx.date)}</td>
                  <td className="p-3"><span className={getTxTypeBadgeClass(tx.type)}>{getTxTypeLabel(tx.type)}</span></td>
                  <td className="p-3 truncate max-w-xs" style={{ color: 'var(--text-primary)' }}>{tx.counterparty || tx.note || '—'}</td>
                  <td className="p-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {tx.category ? `${tx.category.icon} ${tx.category.name}` : '—'}
                  </td>
                  <td className={`p-3 text-right font-medium ${tx.type==='INCOME'?'text-green-500':tx.type==='EXPENSE'?'text-red-400':'text-blue-400'}`}>
                    {tx.type==='INCOME'?'+':tx.type==='EXPENSE'?'-':''}
                    {formatCurrency(tx.amount, tx.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > 50 && (
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{(page-1)*50+1}–{Math.min(page*50,total)} of {total}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1} className="btn-secondary px-3 py-1 text-xs">←</button>
              <button onClick={() => setPage(p=>p+1)} disabled={page*50>=total} className="btn-secondary px-3 py-1 text-xs">→</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AccountScheduled({ accounts }: { accounts: Account[] }) {
  const [payments, setPayments] = useState<ScheduledPayment[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editP, setEditP] = useState<ScheduledPayment | null>(null)

  const load = async () => {
    const [p, c] = await Promise.all([scheduledApi.list(), categoriesApi.all()])
    setPayments(p.data); setCategories(c.data)
  }
  useEffect(() => { load() }, [])

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Scheduled Payments</h2>
        <button onClick={() => { setEditP(null); setShowModal(true) }} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4"/> Add
        </button>
      </div>
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="table-header">
            <th className="p-3 text-left">Name</th>
            <th className="p-3 text-left">Account</th>
            <th className="p-3 text-left">Due Day</th>
            <th className="p-3 text-right">Amount</th>
            <th className="p-3 w-20"/>
          </tr></thead>
          <tbody>
            {payments.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center" style={{ color: 'var(--text-muted)' }}>No scheduled payments</td></tr>
            ) : payments.map(p => (
              <tr key={p.id} className="table-row">
                <td className="p-3" style={{ color: 'var(--text-primary)' }}>{p.name}</td>
                <td className="p-3" style={{ color: 'var(--text-secondary)' }}>{p.account?.name}</td>
                <td className="p-3" style={{ color: 'var(--text-muted)' }}>Day {p.dueDay}</td>
                <td className="p-3 text-right text-red-400">{formatCurrency(p.amount, p.currency)}</td>
                <td className="p-3 flex gap-2 justify-end">
                  <button onClick={() => { setEditP(p); setShowModal(true) }} className="text-indigo-400 hover:text-indigo-300"><Edit2 className="w-4 h-4"/></button>
                  <button onClick={async () => { await scheduledApi.delete(p.id); load() }} className="text-red-500 hover:text-red-400">🗑</button>
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
        <div><label className="label">Due Day</label><input type="number" min="1" max="31" className="input" value={dueDay} onChange={e => setDueDay(e.target.value)}/></div>
        <div><label className="label">Category</label>
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

function AccountModal({ account, onClose, onSave }: { account: Account | null; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    name: account?.name || '', type: account?.type || 'BANK', currency: account?.currency || 'EUR',
    institution: account?.institution || '', currentBalance: account?.currentBalance?.toString() || '0',
    creditLimit: account?.creditLimit?.toString() || '', currentDebt: account?.currentDebt?.toString() || '0',
    originalAmount: account?.originalAmount?.toString() || '', remainingAmount: account?.remainingAmount?.toString() || '',
    monthlyPayment: account?.monthlyPayment?.toString() || '', interestRate: account?.interestRate?.toString() || '',
    endDate: account?.endDate?.split('T')[0] || '', counterpartyName: account?.counterpartyName || '', notes: account?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const isLoan = ['LOAN_CONSUMER','LOAN_AUTO','MORTGAGE'].includes(form.type)
  const isCard = form.type === 'CREDIT_CARD'
  const isPersonal = ['PERSONAL_DEBT','PERSONAL_CREDIT'].includes(form.type)

  const handleSave = async () => {
    if (!form.name) return; setSaving(true)
    const data: any = { ...form, currentBalance: parseFloat(form.currentBalance)||0, creditLimit: form.creditLimit?parseFloat(form.creditLimit):undefined, currentDebt: form.currentDebt?parseFloat(form.currentDebt):undefined, originalAmount: form.originalAmount?parseFloat(form.originalAmount):undefined, remainingAmount: form.remainingAmount?parseFloat(form.remainingAmount):undefined, monthlyPayment: form.monthlyPayment?parseFloat(form.monthlyPayment):undefined, interestRate: form.interestRate?parseFloat(form.interestRate):undefined, endDate: form.endDate||undefined }
    if (account) await accountsApi.update(account.id, data)
    else await accountsApi.create(data)
    setSaving(false); onSave()
  }

  return (
    <Modal title={account ? 'Edit Account' : 'Add Account'} onClose={onClose} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Name</label><input className="input" value={form.name} onChange={e => set('name',e.target.value)} placeholder="ABN AMRO Checking"/></div>
          <div><label className="label">Type</label>
            <select className="select" value={form.type} onChange={e => set('type',e.target.value)}>
              <optgroup label="── Assets ──">
                <option value="BANK">🏦 Bank Account</option>
                <option value="CASH">💵 Cash</option>
                <option value="PERSONAL_CREDIT">🤝 Personal Credit (lent money)</option>
              </optgroup>
              <optgroup label="── Liabilities ──">
                <option value="CREDIT_CARD">💳 Credit Card</option>
                <option value="MORTGAGE">🏠 Mortgage</option>
                <option value="LOAN_AUTO">🚗 Auto Loan</option>
                <option value="LOAN_CONSUMER">💰 Consumer Loan</option>
                <option value="PERSONAL_DEBT">👥 Private Debt (borrowed)</option>
              </optgroup>
            </select>
          </div>
          <div><label className="label">Currency</label>
            <select className="select" value={form.currency} onChange={e => set('currency',e.target.value)}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><label className="label">Institution</label><input className="input" value={form.institution} onChange={e => set('institution',e.target.value)} placeholder="ABN AMRO, ING, Revolut..."/></div>
        </div>
        {!isLoan && !isCard && !isPersonal && <div><label className="label">Current Balance</label><input type="number" className="input" step="0.01" value={form.currentBalance} onChange={e => set('currentBalance',e.target.value)}/></div>}
        {isCard && <div className="grid grid-cols-2 gap-3"><div><label className="label">Credit Limit</label><input type="number" className="input" step="0.01" value={form.creditLimit} onChange={e => set('creditLimit',e.target.value)}/></div><div><label className="label">Current Debt</label><input type="number" className="input" step="0.01" value={form.currentDebt} onChange={e => set('currentDebt',e.target.value)}/></div></div>}
        {isLoan && <div className="grid grid-cols-2 gap-3"><div><label className="label">Original Amount</label><input type="number" className="input" step="0.01" value={form.originalAmount} onChange={e => set('originalAmount',e.target.value)}/></div><div><label className="label">Remaining Amount</label><input type="number" className="input" step="0.01" value={form.remainingAmount} onChange={e => set('remainingAmount',e.target.value)}/></div><div><label className="label">Monthly Payment</label><input type="number" className="input" step="0.01" value={form.monthlyPayment} onChange={e => set('monthlyPayment',e.target.value)}/></div><div><label className="label">Interest Rate (%)</label><input type="number" className="input" step="0.01" value={form.interestRate} onChange={e => set('interestRate',e.target.value)}/></div><div><label className="label">End Date</label><input type="date" className="input" value={form.endDate} onChange={e => set('endDate',e.target.value)}/></div></div>}
        {isPersonal && <div className="grid grid-cols-2 gap-3"><div><label className="label">Person Name</label><input className="input" value={form.counterpartyName} onChange={e => set('counterpartyName',e.target.value)} placeholder="John Doe"/></div><div><label className="label">Amount</label><input type="number" className="input" step="0.01" value={form.currentBalance} onChange={e => set('currentBalance',e.target.value)}/></div></div>}
        <div><label className="label">Notes</label><input className="input" value={form.notes} onChange={e => set('notes',e.target.value)} placeholder="Optional..."/></div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.name} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </Modal>
  )
}
