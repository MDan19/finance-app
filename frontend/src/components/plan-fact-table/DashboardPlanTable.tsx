import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit2, ChevronLeft, ChevronRight } from 'lucide-react'
import { categoriesApi } from '../../api'
import { Category } from '../../types'

const EXPENSE_GROUPS = ['Mandatory', 'Loan/savings', 'Entertainment, travel, hobbies, etc.', 'Other']
const PAYMENT_TYPES = ['Monthly', 'Quarterly', 'Annual', 'One-time']

interface PlanItem {
  id: number
  name: string
  groupName: string
  paymentType: string
  categoryId?: number
  keywordMatch?: string
  sortOrder: number
  isActive: boolean
}

interface PlanAmount {
  planItemId: number
  year: number
  month: number
  amount: number
}

const api = (path: string, opts?: RequestInit) =>
  fetch(`/api${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`,
      ...(opts?.headers || {}),
    },
  }).then(r => r.json())

// Get column header date: "20.01.2026" format
function getColDate(year: number, month: number): string {
  return `20.${String(month).padStart(2, '0')}.${year}`
}

function fmt(n: number): string {
  if (!n || n === 0) return ''
  return n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function DashboardPlanTable() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [items, setItems] = useState<PlanItem[]>([])
  const [amounts, setAmounts] = useState<PlanAmount[]>([])
  const [facts, setFacts] = useState<Record<number, Record<number, number>>>({})
  const [incomeFacts, setIncomeFacts] = useState<Record<string, Record<number, number>>>({})
  const [categories, setCategories] = useState<Category[]>([])
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [cellValue, setCellValue] = useState('')
  const [showAddItem, setShowAddItem] = useState(false)
  const [editItem, setEditItem] = useState<PlanItem | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [itemsData, amountsData, factsData, incomeData, catsData] = await Promise.all([
        api('/budget/plan-items'),
        api(`/budget/plan-amounts/${year}`),
        api(`/budget/plan-facts/${year}`),
        api(`/budget/income-facts/${year}`),
        categoriesApi.all().then(r => r.data),
      ])
      setItems(itemsData)
      setAmounts(amountsData)
      setFacts(factsData)
      setIncomeFacts(incomeData)
      setCategories(catsData)
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  useEffect(() => { load() }, [year])

  const getPlan = (itemId: number, month: number) => {
    const a = amounts.find(a => a.planItemId === itemId && a.month === month)
    return a ? Number(a.amount) : 0
  }

  const getFact = (itemId: number, month: number) => facts[itemId]?.[month] || 0
  const getIncomeFact = (source: string, month: number) => incomeFacts[source]?.[month] || 0

  const savePlan = async (itemId: number, month: number, value: string) => {
    const amount = parseFloat(value.replace(',', '.')) || 0
    await api(`/budget/plan-amounts/${itemId}/${year}/${month}`, {
      method: 'PUT', body: JSON.stringify({ amount }),
    })
    setEditingCell(null)
    load()
  }

  const deleteItem = async (id: number) => {
    if (!confirm('Delete this row?')) return
    await api(`/budget/plan-items/${id}`, { method: 'DELETE' })
    load()
  }

  const incomeSources = Object.keys(incomeFacts).sort()

  const allGroupNames = EXPENSE_GROUPS.filter(g => items.some(i => i.groupName === g))
  const extraGroups = [...new Set(items.map(i => i.groupName))].filter(g => !EXPENSE_GROUPS.includes(g))
  const allGroups = [...allGroupNames, ...extraGroups]

  const getGroupTotal = (groupName: string, month: number, type: 'plan' | 'fact') =>
    items.filter(i => i.groupName === groupName && i.isActive)
      .reduce((s, item) => s + (type === 'plan' ? getPlan(item.id, month) : getFact(item.id, month)), 0)

  const getItemTotal = (itemId: number, type: 'plan' | 'fact') =>
    Array.from({length: 12}, (_, i) => i + 1).reduce((s, m) => s + (type === 'plan' ? getPlan(itemId, m) : getFact(itemId, m)), 0)

  const getTotalExpense = (month: number, type: 'plan' | 'fact') =>
    items.filter(i => i.isActive).reduce((s, item) => s + (type === 'plan' ? getPlan(item.id, month) : getFact(item.id, month)), 0)

  const getTotalIncome = (month: number) =>
    incomeSources.reduce((s, src) => s + getIncomeFact(src, month), 0)

  // Visible months - show only months with data or all 12
  const months = Array.from({length: 12}, (_, i) => i + 1)

  // Row numbering
  let rowNum = 0

  if (loading) return (
    <div className="card animate-pulse h-32 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
      Loading plan table...
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Plan / Fact</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => setYear(y => y - 1)} className="p-1 hover:text-amber-700 transition-colors" style={{ color: 'var(--text-muted)' }}>
              <ChevronLeft className="w-4 h-4"/>
            </button>
            <span className="text-sm font-medium px-2" style={{ color: 'var(--text-primary)' }}>{year}</span>
            <button onClick={() => setYear(y => y + 1)} className="p-1 hover:text-amber-700 transition-colors" style={{ color: 'var(--text-muted)' }}>
              <ChevronRight className="w-4 h-4"/>
            </button>
          </div>
        </div>
        <button onClick={() => { setEditItem(null); setShowAddItem(true) }}
          className="btn-primary text-xs py-1.5 flex items-center gap-1">
          <Plus className="w-3 h-3"/> Add Row
        </button>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-x-auto" style={{ background: 'var(--bg-card)' }}>
        <table className="w-full text-xs border-collapse" style={{ width: '100%', minWidth: `${180 + 80 + months.length * 130 + 130}px` }}>
          <thead>
            {/* Month headers with dates */}
            <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
              <th className="p-2 text-left w-6" style={{ color: 'var(--text-muted)', position: 'sticky', left: 0, background: 'var(--bg-secondary)', zIndex: 10 }}>№</th>
              <th className="p-2 text-left min-w-[160px]" style={{ color: 'var(--text-muted)', position: 'sticky', left: 24, background: 'var(--bg-secondary)', zIndex: 10 }}>Expense name</th>
              <th className="p-2 text-left w-20" style={{ color: 'var(--text-muted)' }}>Payment type</th>
              {months.map(m => (
                <th key={m} colSpan={2} className="p-2 text-center" style={{ color: 'var(--text-muted)', borderLeft: '1px solid var(--border)' }}>
                  {getColDate(year, m)}
                </th>
              ))}
              <th colSpan={2} className="p-2 text-center" style={{ color: 'var(--text-muted)', borderLeft: '1px solid var(--border)', background: 'var(--bg-hover)' }}>
                TOTAL fact
              </th>
              <th className="p-1 w-8" style={{ background: 'var(--bg-secondary)' }}/>
            </tr>
            {/* Plan/Fact sub-headers */}
            <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
              <th style={{ position: 'sticky', left: 0, background: 'var(--bg-secondary)', zIndex: 10 }}/>
              <th style={{ position: 'sticky', left: 24, background: 'var(--bg-secondary)', zIndex: 10 }}/>
              <th/>
              {months.map(m => (
                <>
                  <th key={`p${m}`} className="p-1 text-center font-normal" style={{ color: 'var(--text-muted)', borderLeft: '1px solid var(--border)' }}>Plan</th>
                  <th key={`f${m}`} className="p-1 text-center font-normal" style={{ color: 'var(--text-muted)' }}>Fact</th>
                </>
              ))}
              <th className="p-1 text-center font-normal" style={{ color: 'var(--text-muted)', borderLeft: '1px solid var(--border)', background: 'var(--bg-hover)' }}>Plan</th>
              <th className="p-1 text-center font-normal" style={{ color: 'var(--text-muted)', background: 'var(--bg-hover)' }}>Fact</th>
              <th/>
            </tr>
          </thead>
          <tbody>
            {/* INCOME GROUP */}
            <tr style={{ background: 'rgba(34,197,94,0.08)', borderBottom: '1px solid var(--border)' }}>
              <td style={{ position: 'sticky', left: 0, background: 'rgba(34,197,94,0.08)', zIndex: 5, padding: '6px 8px' }}/>
              <td colSpan={2} style={{ position: 'sticky', left: 24, background: 'rgba(34,197,94,0.08)', zIndex: 5, padding: '6px 8px', fontWeight: 600, color: '#16a34a' }}>
                Income
              </td>
              {months.map(m => {
                const total = getTotalIncome(m)
                return (
                  <>
                    <td key={`igp${m}`} style={{ borderLeft: '1px solid var(--border)', padding: '4px 6px' }}/>
                    <td key={`igf${m}`} className="text-center" style={{ color: total > 0 ? '#16a34a' : 'var(--text-muted)', padding: '4px 6px', fontWeight: total > 0 ? 600 : 400 }}>
                      {fmt(total)}
                    </td>
                  </>
                )
              })}
              <td style={{ borderLeft: '1px solid var(--border)', background: 'var(--bg-hover)', padding: '4px 6px' }}/>
              <td className="text-center" style={{ background: 'var(--bg-hover)', padding: '4px 6px', color: '#16a34a', fontWeight: 600 }}>
                {fmt(months.reduce((s,m) => s + getTotalIncome(m), 0))}
              </td>
              <td/>
            </tr>

            {incomeSources.length === 0 ? (
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 5, padding: '4px 8px' }}/>
                <td colSpan={2} style={{ position: 'sticky', left: 24, background: 'var(--bg-card)', zIndex: 5, padding: '4px 8px', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                  — will appear after first income transaction —
                </td>
                {months.map(m => <><td key={`ie${m}a`} style={{ borderLeft: '1px solid var(--border)' }}/><td key={`ie${m}b`}/></>)}
                <td style={{ borderLeft: '1px solid var(--border)', background: 'var(--bg-hover)' }}/><td style={{ background: 'var(--bg-hover)' }}/><td/>
              </tr>
            ) : incomeSources.map(source => (
              <tr key={source} style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 5, padding: '4px 8px' }}/>
                <td colSpan={2} style={{ position: 'sticky', left: 24, background: 'var(--bg-card)', zIndex: 5, padding: '4px 8px', color: 'var(--text-secondary)' }}>
                  {source || 'Other income'}
                </td>
                {months.map(m => {
                  const fact = getIncomeFact(source, m)
                  return (
                    <>
                      <td key={`ip${m}`} style={{ borderLeft: '1px solid var(--border)' }}/>
                      <td key={`if${m}`} className="text-center" style={{ color: fact > 0 ? '#16a34a' : 'var(--text-muted)', padding: '4px 6px' }}>
                        {fmt(fact)}
                      </td>
                    </>
                  )
                })}
                <td style={{ borderLeft: '1px solid var(--border)', background: 'var(--bg-hover)' }}/>
                <td className="text-center" style={{ background: 'var(--bg-hover)', color: '#16a34a', padding: '4px 6px' }}>
                  {fmt(months.reduce((s,m) => s + getIncomeFact(source, m), 0))}
                </td>
                <td/>
              </tr>
            ))}

            {/* EXPENSE GROUPS */}
            {allGroups.map(groupName => {
              const groupItems = items.filter(i => i.groupName === groupName && i.isActive)
              if (groupItems.length === 0) return null
              return (
                <>
                  {/* Group header */}
                  <tr key={`g-${groupName}`} style={{ background: 'var(--bg-hover)', borderTop: '2px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                    <td style={{ position: 'sticky', left: 0, background: 'var(--bg-hover)', zIndex: 5, padding: '6px 8px' }}/>
                    <td colSpan={2} style={{ position: 'sticky', left: 24, background: 'var(--bg-hover)', zIndex: 5, padding: '6px 8px', fontWeight: 700, color: '#f97316' }}>
                      {groupName}
                    </td>
                    {months.map(m => {
                      const gp = getGroupTotal(groupName, m, 'plan')
                      const gf = getGroupTotal(groupName, m, 'fact')
                      return (
                        <>
                          <td key={`gp${m}`} className="text-center" style={{ borderLeft: '1px solid var(--border)', padding: '4px 6px', color: '#f97316', fontWeight: 600 }}>{fmt(gp)}</td>
                          <td key={`gf${m}`} className="text-center" style={{ padding: '4px 6px', color: gf > gp && gp > 0 ? '#ef4444' : gf > 0 ? '#16a34a' : 'var(--text-muted)', fontWeight: 600 }}>{fmt(gf)}</td>
                        </>
                      )
                    })}
                    <td className="text-center" style={{ borderLeft: '1px solid var(--border)', background: 'var(--bg-secondary)', padding: '4px 6px', color: '#f97316', fontWeight: 700 }}>
                      {fmt(months.reduce((s,m) => s + getGroupTotal(groupName, m, 'plan'), 0))}
                    </td>
                    <td className="text-center" style={{ background: 'var(--bg-secondary)', padding: '4px 6px', color: '#16a34a', fontWeight: 700 }}>
                      {fmt(months.reduce((s,m) => s + getGroupTotal(groupName, m, 'fact'), 0))}
                    </td>
                    <td style={{ background: 'var(--bg-hover)' }}/>
                  </tr>

                  {/* Item rows */}
                  {groupItems.map(item => {
                    rowNum++
                    const num = rowNum
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}
                        className="group"
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        {/* Row number */}
                        <td className="text-center" style={{ position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 5, padding: '4px 6px', color: 'var(--text-muted)', width: 24 }}>
                          {num}
                        </td>
                        {/* Name */}
                        <td style={{ position: 'sticky', left: 24, background: 'var(--bg-card)', zIndex: 5, padding: '4px 8px' }}>
                          <div className="flex items-center gap-1">
                            <span style={{ color: 'var(--text-primary)' }}>{item.name}</span>
                            {item.categoryId && <span style={{ color: '#7a5f2e', fontSize: 10 }}>●</span>}
                            {item.keywordMatch && <span title={`keywords: ${item.keywordMatch}`} style={{ fontSize: 10 }}>🔑</span>}
                          </div>
                        </td>
                        {/* Payment type */}
                        <td style={{ padding: '4px 6px', color: 'var(--text-muted)' }}>{item.paymentType}</td>

                        {/* Month cells */}
                        {months.map(m => {
                          const plan = getPlan(item.id, m)
                          const fact = getFact(item.id, m)
                          const key = `${item.id}-${m}`
                          const over = fact > plan && plan > 0
                          return (
                            <>
                              <td key={`p${m}`} style={{ padding: 0, borderLeft: '1px solid var(--border)' }}>
                                {editingCell === key ? (
                                  <input
                                    type="text"
                                    style={{ width: 72, background: 'rgba(122,95,46,0.15)', color: '#c9a05a', fontSize: 12, padding: '3px 6px', textAlign: 'center', outline: 'none', border: '1px solid #7a5f2e' }}
                                    value={cellValue}
                                    onChange={e => setCellValue(e.target.value)}
                                    onBlur={() => savePlan(item.id, m, cellValue)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') savePlan(item.id, m, cellValue)
                                      if (e.key === 'Escape') setEditingCell(null)
                                    }}
                                    autoFocus
                                  />
                                ) : (
                                  <button
                                    style={{ width: '100%', padding: '4px 6px', textAlign: 'center', color: plan > 0 ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer' }}
                                    onClick={() => { setEditingCell(key); setCellValue(plan > 0 ? plan.toString() : '') }}>
                                    {plan > 0 ? fmt(plan) : '—'}
                                  </button>
                                )}
                              </td>
                              <td key={`f${m}`} className="text-center" style={{ padding: '4px 6px', color: over ? '#ef4444' : fact > 0 ? '#16a34a' : 'var(--text-muted)', background: over ? 'rgba(239,68,68,0.06)' : 'transparent' }}>
                                {fact > 0 ? fmt(fact) : '—'}
                              </td>
                            </>
                          )
                        })}

                        {/* Totals */}
                        <td className="text-center" style={{ borderLeft: '1px solid var(--border)', background: 'var(--bg-hover)', padding: '4px 6px', color: 'var(--text-secondary)' }}>
                          {fmt(getItemTotal(item.id, 'plan')) || '—'}
                        </td>
                        <td className="text-center" style={{ background: 'var(--bg-hover)', padding: '4px 6px', color: getItemTotal(item.id, 'fact') > 0 ? '#16a34a' : 'var(--text-muted)' }}>
                          {fmt(getItemTotal(item.id, 'fact')) || '—'}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: 4 }}>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditItem(item); setShowAddItem(true) }} style={{ color: 'var(--text-muted)' }} className="hover:text-amber-700">
                              <Edit2 className="w-3 h-3"/>
                            </button>
                            <button onClick={() => deleteItem(item.id)} style={{ color: 'var(--text-muted)' }} className="hover:text-red-400">
                              <Trash2 className="w-3 h-3"/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </>
              )
            })}

            {/* TOTAL ROW */}
            <tr style={{ borderTop: '2px solid var(--border-light)', background: 'var(--bg-hover)' }}>
              <td style={{ position: 'sticky', left: 0, background: 'var(--bg-hover)', zIndex: 5, padding: '6px 8px' }}/>
              <td colSpan={2} style={{ position: 'sticky', left: 24, background: 'var(--bg-hover)', zIndex: 5, padding: '6px 8px', fontWeight: 700, color: '#ef4444' }}>
                In total required:
              </td>
              {months.map(m => {
                const tp = getTotalExpense(m, 'plan')
                const tf = getTotalExpense(m, 'fact')
                return (
                  <>
                    <td key={`tp${m}`} className="text-center" style={{ borderLeft: '1px solid var(--border)', padding: '6px', fontWeight: 700, color: '#ef4444' }}>{fmt(tp)}</td>
                    <td key={`tf${m}`} className="text-center" style={{ padding: '6px', fontWeight: 700, color: tf > tp && tp > 0 ? '#ef4444' : tf > 0 ? '#16a34a' : 'var(--text-muted)' }}>{fmt(tf)}</td>
                  </>
                )
              })}
              <td className="text-center" style={{ borderLeft: '1px solid var(--border)', background: 'var(--bg-secondary)', padding: '6px', fontWeight: 700, color: '#ef4444' }}>
                {fmt(months.reduce((s,m) => s + getTotalExpense(m, 'plan'), 0))}
              </td>
              <td className="text-center" style={{ background: 'var(--bg-secondary)', padding: '6px', fontWeight: 700, color: '#16a34a' }}>
                {fmt(months.reduce((s,m) => s + getTotalExpense(m, 'fact'), 0))}
              </td>
              <td/>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showAddItem && (
        <AddItemModal
          item={editItem}
          categories={categories}
          onClose={() => { setShowAddItem(false); setEditItem(null) }}
          onSave={() => { setShowAddItem(false); setEditItem(null); load() }}
        />
      )}
    </div>
  )
}

function AddItemModal({ item, categories, onClose, onSave }: {
  item: PlanItem | null; categories: Category[]; onClose: () => void; onSave: () => void
}) {
  const [name, setName] = useState(item?.name || '')
  const [groupName, setGroupName] = useState(item?.groupName || 'Mandatory')
  const [customGroup, setCustomGroup] = useState('')
  const [paymentType, setPaymentType] = useState(item?.paymentType || 'Monthly')
  const [categoryId, setCategoryId] = useState(item?.categoryId?.toString() || '')
  const [keywordMatch, setKeywordMatch] = useState(item?.keywordMatch || '')
  const [saving, setSaving] = useState(false)

  const allGroups = [...EXPENSE_GROUPS, '__custom__']

  const handleSave = async () => {
    if (!name) return
    setSaving(true)
    const finalGroup = groupName === '__custom__' ? customGroup : groupName
    const body = { name, groupName: finalGroup, paymentType, categoryId: categoryId ? +categoryId : null, keywordMatch: keywordMatch || null }
    const token = localStorage.getItem('token')
    const url = item ? `/api/budget/plan-items/${item.id}` : '/api/budget/plan-items'
    await fetch(url, { method: item ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
    setSaving(false); onSave()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}/>
      <div className="relative rounded-xl w-full max-w-md p-5 shadow-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{item ? 'Edit Row' : 'Add Row'}</h2>
        <div className="space-y-3">
          <div><label className="label">Name</label><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Mortgage, Groceries..." autoFocus/></div>
          <div>
            <label className="label">Group</label>
            <select className="select" value={groupName} onChange={e => setGroupName(e.target.value)}>
              {EXPENSE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              <option value="__custom__">+ New group...</option>
            </select>
            {groupName === '__custom__' && <input className="input mt-2" placeholder="Group name..." value={customGroup} onChange={e => setCustomGroup(e.target.value)}/>}
          </div>
          <div><label className="label">Payment Type</label>
            <select className="select" value={paymentType} onChange={e => setPaymentType(e.target.value)}>
              {PAYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div><label className="label">Link to Category (auto Fact)</label>
            <select className="select" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              <option value="">— none —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Keywords (comma-separated)</label>
            <input className="input" value={keywordMatch} onChange={e => setKeywordMatch(e.target.value)} placeholder="Albert Heijn, AH..."/>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Transactions matching these keywords count as Fact</p>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving || !name} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}
