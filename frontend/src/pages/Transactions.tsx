import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Filter, Trash2, Tag, ChevronLeft, ChevronRight, Link } from 'lucide-react'
import { transactionsApi, accountsApi, categoriesApi, exchangeApi } from '../api'
import { Transaction, Account, Category, TransactionType } from '../types'
import { formatDate, formatCurrency, formatEur, getTxTypeLabel, getTxTypeBadgeClass, CURRENCIES } from '../utils/format'
import Modal from '../components/Modal'

const TX_TYPES: TransactionType[] = ['EXPENSE','INCOME','TRANSFER','REFUND','COMPENSATION']
const PAGE_SIZE = 50

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<number[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editTx, setEditTx] = useState<Transaction | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const [filters, setFilters] = useState({
    search: '', type: '', accountId: '', categoryId: '',
    startDate: '', endDate: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { page, limit: PAGE_SIZE }
      if (filters.search) params.search = filters.search
      if (filters.type) params.type = filters.type
      if (filters.accountId) params.accountId = filters.accountId
      if (filters.categoryId) params.categoryId = filters.categoryId
      if (filters.startDate) params.startDate = filters.startDate
      if (filters.endDate) params.endDate = filters.endDate
      const res = await transactionsApi.list(params)
      setTransactions(res.data.transactions)
      setTotal(res.data.total)
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    accountsApi.list().then(r => setAccounts(r.data))
    categoriesApi.all().then(r => setCategories(r.data))
  }, [])

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this transaction?')) return
    await transactionsApi.delete(id)
    load()
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selected.length} transactions?`)) return
    await transactionsApi.bulkDelete(selected)
    setSelected([])
    load()
  }

  const toggleSelect = (id: number) => {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Transactions</h1>
          <p className="text-sm text-gray-500">{total} total</p>
        </div>
        <button onClick={() => { setEditTx(null); setShowModal(true) }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Transaction
        </button>
      </div>

      {/* Filters */}
      <div className="card space-y-3">
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-48 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              className="input pl-9"
              placeholder="Search by description, note..."
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            />
          </div>
          <select className="select w-auto" value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
            <option value="">All types</option>
            {TX_TYPES.map(t => <option key={t} value={t}>{getTxTypeLabel(t)}</option>)}
          </select>
          <select className="select w-auto" value={filters.accountId} onChange={e => setFilters(f => ({ ...f, accountId: e.target.value }))}>
            <option value="">All accounts</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select className="select w-auto" value={filters.categoryId} onChange={e => setFilters(f => ({ ...f, categoryId: e.target.value }))}>
            <option value="">All categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary flex items-center gap-2">
            <Filter className="w-4 h-4" /> Date
          </button>
        </div>
        {showFilters && (
          <div className="flex gap-3 flex-wrap">
            <div>
              <label className="label">From</label>
              <input type="date" className="input" value={filters.startDate} onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <label className="label">To</label>
              <input type="date" className="input" value={filters.endDate} onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} />
            </div>
            {/* Quick presets */}
            <div className="flex items-end gap-2">
              {[
                { label: 'This month', fn: () => { const n = new Date(); setFilters(f => ({ ...f, startDate: `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`, endDate: '' })) } },
                { label: 'Last 3mo', fn: () => { const n = new Date(); n.setMonth(n.getMonth()-3); setFilters(f => ({ ...f, startDate: n.toISOString().split('T')[0], endDate: '' })) } },
                { label: 'Clear', fn: () => setFilters(f => ({ ...f, startDate: '', endDate: '' })) },
              ].map(p => (
                <button key={p.label} onClick={p.fn} className="btn-secondary text-xs py-1.5">{p.label}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bulk actions */}
      {selected.length > 0 && (
        <div className="flex items-center gap-3 bg-indigo-900/30 border border-indigo-700 rounded-lg px-4 py-2">
          <span className="text-sm text-indigo-300">{selected.length} selected</span>
          <button onClick={handleBulkDelete} className="btn-danger text-sm py-1 flex items-center gap-1">
            <Trash2 className="w-3 h-3" /> Delete
          </button>
          <button onClick={() => setSelected([])} className="btn-secondary text-sm py-1">Clear</button>
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                <th className="p-3 w-8"><input type="checkbox" onChange={e => setSelected(e.target.checked ? transactions.map(t => t.id) : [])} className="accent-indigo-500" /></th>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-left">Account</th>
                <th className="p-3 text-left">Description</th>
                <th className="p-3 text-left">Category</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-right">EUR</th>
                <th className="p-3 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    {[...Array(9)].map((_, j) => (
                      <td key={j} className="p-3"><div className="h-4 bg-gray-800 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : transactions.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-gray-500">No transactions found</td></tr>
              ) : transactions.map(tx => (
                <tr
                  key={tx.id}
                  className="border-b border-gray-800/50 hover:bg-gray-900/50 cursor-pointer group"
                  onClick={() => { setEditTx(tx); setShowModal(true) }}
                >
                  <td className="p-3" onClick={e => { e.stopPropagation(); toggleSelect(tx.id) }}>
                    <input type="checkbox" checked={selected.includes(tx.id)} onChange={() => toggleSelect(tx.id)} className="accent-indigo-500" />
                  </td>
                  <td className="p-3 text-gray-400 whitespace-nowrap">{formatDate(tx.date)}</td>
                  <td className="p-3"><span className={getTxTypeBadgeClass(tx.type)}>{getTxTypeLabel(tx.type)}</span></td>
                  <td className="p-3 text-gray-300">{tx.account?.name}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      {tx.linkedTransactionId && <Link className="w-3 h-3 text-gray-500" />}
                      <span className="text-white truncate max-w-48">{tx.counterparty || tx.note || '—'}</span>
                    </div>
                    {tx.note && tx.counterparty && <p className="text-xs text-gray-500 truncate">{tx.note}</p>}
                  </td>
                  <td className="p-3">
                    {tx.category ? (
                      <span className="flex items-center gap-1 text-xs">
                        <span>{tx.category.icon}</span>
                        <span className="text-gray-400">{tx.category.name}</span>
                      </span>
                    ) : <span className="text-gray-600">—</span>}
                  </td>
                  <td className={`p-3 text-right font-medium whitespace-nowrap ${tx.type === 'INCOME' || tx.type === 'COMPENSATION' ? 'text-green-400' : tx.type === 'EXPENSE' ? 'text-red-400' : 'text-blue-400'}`}>
                    {tx.type === 'INCOME' || tx.type === 'COMPENSATION' ? '+' : tx.type === 'EXPENSE' ? '-' : ''}
                    {formatCurrency(tx.amount, tx.currency)}
                  </td>
                  <td className="p-3 text-right text-gray-500 text-xs whitespace-nowrap">
                    {tx.currency !== 'EUR' && tx.amountEur ? formatEur(tx.amountEur) : ''}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(tx.id) }}
                      className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <span className="text-sm text-gray-500">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary p-1.5">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-400 px-3 py-1.5">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary p-1.5">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <TransactionModal
          tx={editTx}
          accounts={accounts}
          categories={categories}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

function TransactionModal({ tx, accounts, categories, onClose, onSave }: {
  tx: Transaction | null
  accounts: Account[]
  categories: Category[]
  onClose: () => void
  onSave: () => void
}) {
  const isEdit = !!tx
  const [type, setType] = useState<TransactionType>(tx?.type || 'EXPENSE')
  const [date, setDate] = useState(tx ? tx.date.split('T')[0] : new Date().toISOString().split('T')[0])
  const [accountId, setAccountId] = useState(tx?.accountId?.toString() || (accounts[0]?.id?.toString() || ''))
  const [toAccountId, setToAccountId] = useState(tx?.toAccountId?.toString() || '')
  const [amount, setAmount] = useState(tx?.amount?.toString() || '')
  const [currency, setCurrency] = useState(tx?.currency || 'EUR')
  const [categoryId, setCategoryId] = useState(tx?.categoryId?.toString() || '')
  const [incomeSource, setIncomeSource] = useState(tx?.incomeSource || '')
  const [counterparty, setCounterparty] = useState(tx?.counterparty || '')
  const [note, setNote] = useState(tx?.note || '')
  const [exchangeRate, setExchangeRate] = useState(tx?.exchangeRate?.toString() || '')
  const [compensationSource, setCompensationSource] = useState(tx?.compensationSource || 'Other')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Auto-fetch exchange rate
  useEffect(() => {
    if (currency !== 'EUR' && !exchangeRate) {
      exchangeApi.getRate(currency, 'EUR').then(r => {
        setExchangeRate(r.data.rate.toString())
      }).catch(() => {})
    }
    if (currency === 'EUR') setExchangeRate('1')
  }, [currency])

  const handleSave = async () => {
    if (!amount || !accountId) { setError('Amount and account are required'); return }
    setSaving(true)
    setError('')
    try {
      const data: any = {
        type, date, accountId: +accountId, amount: parseFloat(amount), currency,
        exchangeRate: exchangeRate ? parseFloat(exchangeRate) : undefined,
        categoryId: categoryId ? +categoryId : undefined,
        incomeSource: incomeSource || undefined,
        counterparty: counterparty || undefined,
        note: note || undefined,
        compensationSource: type === 'COMPENSATION' ? compensationSource : undefined,
        toAccountId: type === 'TRANSFER' ? +toAccountId : undefined,
      }
      if (isEdit) await transactionsApi.update(tx!.id, data)
      else await transactionsApi.create(data)
      onSave()
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={isEdit ? 'Edit Transaction' : 'Add Transaction'} onClose={onClose}>
      <div className="space-y-4">
        {/* Type selector */}
        <div>
          <label className="label">Type</label>
          <div className="flex gap-2 flex-wrap">
            {TX_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${type === t ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              >
                {getTxTypeLabel(t)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Account</label>
            <select className="select" value={accountId} onChange={e => setAccountId(e.target.value)}>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>

        {type === 'TRANSFER' && (
          <div>
            <label className="label">To Account</label>
            <select className="select" value={toAccountId} onChange={e => setToAccountId(e.target.value)}>
              <option value="">Select account</option>
              {accounts.filter(a => a.id !== +accountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Amount</label>
            <input type="number" className="input" placeholder="0.00" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="label">Currency</label>
            <select className="select" value={currency} onChange={e => setCurrency(e.target.value)}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {currency !== 'EUR' && (
          <div>
            <label className="label">Exchange Rate (to EUR)</label>
            <input type="number" className="input" step="0.000001" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} />
          </div>
        )}

        {type === 'EXPENSE' && (
          <div>
            <label className="label">Category</label>
            <select className="select" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              <option value="">No category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
        )}

        {type === 'INCOME' && (
          <div>
            <label className="label">Income Source</label>
            <input className="input" placeholder="Salary, Freelance..." value={incomeSource} onChange={e => setIncomeSource(e.target.value)} />
          </div>
        )}

        {type === 'COMPENSATION' && (
          <div>
            <label className="label">Compensation Source</label>
            <select className="select" value={compensationSource} onChange={e => setCompensationSource(e.target.value)}>
              {['Tax', 'Energy', 'Cashback', 'Other'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="label">Description / Counterparty</label>
          <input className="input" placeholder="Merchant, person, store..." value={counterparty} onChange={e => setCounterparty(e.target.value)} />
        </div>

        <div>
          <label className="label">Note</label>
          <input className="input" placeholder="Optional note..." value={note} onChange={e => setNote(e.target.value)} />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Transaction'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
