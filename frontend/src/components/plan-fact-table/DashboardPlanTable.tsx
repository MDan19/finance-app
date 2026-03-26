import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit2, ChevronLeft, ChevronRight } from 'lucide-react'
import { categoriesApi } from '../../api'
import { Category } from '../../types'

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
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
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}`, ...(opts?.headers || {}) },
  }).then(r => r.json())

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

  // Income sources from facts
  const incomeSources = Object.keys(incomeFacts).sort()

  // Expense groups
  const allGroupNames = EXPENSE_GROUPS.filter(g => items.some(i => i.groupName === g))
  const extraGroups = [...new Set(items.map(i => i.groupName))].filter(g => !EXPENSE_GROUPS.includes(g))
  const allGroups = [...allGroupNames, ...extraGroups]

  const getGroupTotal = (groupName: string, month: number, type: 'plan' | 'fact') =>
    items.filter(i => i.groupName === groupName && i.isActive)
      .reduce((s, item) => s + (type === 'plan' ? getPlan(item.id, month) : getFact(item.id, month)), 0)

  const getItemTotal = (itemId: number, type: 'plan' | 'fact') =>
    MONTHS_SHORT.reduce((s, _, i) => s + (type === 'plan' ? getPlan(itemId, i+1) : getFact(itemId, i+1)), 0)

  const getTotalExpense = (month: number, type: 'plan' | 'fact') =>
    items.filter(i => i.isActive).reduce((s, item) => s + (type === 'plan' ? getPlan(item.id, month) : getFact(item.id, month)), 0)

  const getTotalIncome = (month: number) =>
    incomeSources.reduce((s, src) => s + getIncomeFact(src, month), 0)

  const fmt = (n: number) => n > 0 ? n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''

  if (loading) return <div className="card animate-pulse h-32 flex items-center justify-center text-gray-600">Loading plan table...</div>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">Plan / Fact</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => setYear(y => y-1)} className="p-1 text-gray-500 hover:text-white"><ChevronLeft className="w-4 h-4"/></button>
            <span className="text-sm font-medium text-white px-2">{year}</span>
            <button onClick={() => setYear(y => y+1)} className="p-1 text-gray-500 hover:text-white"><ChevronRight className="w-4 h-4"/></button>
          </div>
        </div>
        <button onClick={() => { setEditItem(null); setShowAddItem(true) }} className="btn-primary text-xs py-1.5 flex items-center gap-1">
          <Plus className="w-3 h-3"/> Add Row
        </button>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[1400px]">
          <thead>
            <tr className="bg-gray-900 border-b border-gray-700">
              <th className="p-2 text-left text-gray-400 sticky left-0 bg-gray-900 z-10 min-w-[180px]">Item</th>
              <th className="p-2 text-left text-gray-400 min-w-[80px]">Type</th>
              {MONTHS_SHORT.map((m, i) => (
                <th key={i} colSpan={2} className="p-2 text-center text-gray-400 border-l border-gray-700">{m}</th>
              ))}
              <th colSpan={2} className="p-2 text-center text-gray-400 border-l border-gray-700 bg-gray-800">Total</th>
              <th className="p-2 w-8 bg-gray-900"/>
            </tr>
            <tr className="bg-gray-900/80 border-b border-gray-700">
              <th className="sticky left-0 bg-gray-900/80 z-10"/>
              <th/>
              {MONTHS_SHORT.map((_, i) => (
                <>
                  <th key={`ph${i}`} className="p-1 text-center text-gray-600 border-l border-gray-700 font-normal">Plan</th>
                  <th key={`fh${i}`} className="p-1 text-center text-gray-600 font-normal">Fact</th>
                </>
              ))}
              <th className="p-1 text-center text-gray-600 border-l border-gray-700 bg-gray-800 font-normal">Plan</th>
              <th className="p-1 text-center text-gray-600 bg-gray-800 font-normal">Fact</th>
              <th/>
            </tr>
          </thead>
          <tbody>

            {/* ── INCOME GROUP (auto, no plan) ─────────────────────────── */}
            <tr className="bg-green-900/20 border-b border-gray-700">
              <td className="p-2 font-semibold text-green-400 sticky left-0 bg-green-900/20 z-10" colSpan={2}>
                Income
              </td>
              {MONTHS_SHORT.map((_, mi) => {
                const total = getTotalIncome(mi+1)
                return (
                  <>
                    <td key={`igp${mi}`} className="p-1.5 border-l border-gray-700"/>
                    <td key={`igf${mi}`} className="p-1.5 text-center font-medium text-green-400">{fmt(total)}</td>
                  </>
                )
              })}
              <td className="p-1.5 border-l border-gray-700 bg-gray-800"/>
              <td className="p-1.5 text-center font-medium text-green-400 bg-gray-800">
                {fmt(MONTHS_SHORT.reduce((s,_,i) => s + getTotalIncome(i+1), 0))}
              </td>
              <td/>
            </tr>

            {/* Income source rows */}
            {incomeSources.length === 0 ? (
              <tr className="border-b border-gray-800/30">
                <td className="p-2 text-gray-600 italic sticky left-0 bg-gray-950 z-10" colSpan={2}>
                  — will appear after first income transaction —
                </td>
                {MONTHS_SHORT.map((_, i) => <><td key={`ie${i}a`} className="border-l border-gray-800"/><td key={`ie${i}b`}/></>)}
                <td className="border-l border-gray-700 bg-gray-900"/><td className="bg-gray-900"/><td/>
              </tr>
            ) : incomeSources.map(source => (
              <tr key={source} className="border-b border-gray-800/30 hover:bg-gray-900/20">
                <td className="p-1.5 pl-4 text-gray-300 sticky left-0 bg-gray-950 z-10">{source || 'Other income'}</td>
                <td className="p-1.5 text-gray-500">auto</td>
                {MONTHS_SHORT.map((_, mi) => {
                  const fact = getIncomeFact(source, mi+1)
                  return (
                    <>
                      <td key={`ip${mi}`} className="border-l border-gray-800"/>
                      <td key={`if${mi}`} className={`p-1.5 text-center ${fact > 0 ? 'text-green-400' : 'text-gray-700'}`}>{fmt(fact)}</td>
                    </>
                  )
                })}
                <td className="border-l border-gray-700 bg-gray-900"/>
                <td className={`p-1.5 text-center bg-gray-900 ${MONTHS_SHORT.reduce((s,_,i)=>s+getIncomeFact(source,i+1),0) > 0 ? 'text-green-400' : 'text-gray-700'}`}>
                  {fmt(MONTHS_SHORT.reduce((s,_,i) => s+getIncomeFact(source,i+1), 0))}
                </td>
                <td/>
              </tr>
            ))}

            {/* ── EXPENSE GROUPS ───────────────────────────────────────── */}
            {allGroups.map(groupName => {
              const groupItems = items.filter(i => i.groupName === groupName && i.isActive)
              if (groupItems.length === 0) return null
              return (
                <>
                  {/* Group header */}
                  <tr key={`g-${groupName}`} className="bg-gray-800/60 border-t border-gray-700">
                    <td className="p-2 font-semibold text-orange-400 sticky left-0 bg-gray-800/60 z-10" colSpan={2}>{groupName}</td>
                    {MONTHS_SHORT.map((_, mi) => {
                      const gp = getGroupTotal(groupName, mi+1, 'plan')
                      const gf = getGroupTotal(groupName, mi+1, 'fact')
                      return (
                        <>
                          <td key={`gp${mi}`} className="p-1.5 text-center text-orange-300 font-medium border-l border-gray-700">{fmt(gp)}</td>
                          <td key={`gf${mi}`} className={`p-1.5 text-center font-medium ${gf > gp && gp > 0 ? 'text-red-400' : gf > 0 ? 'text-green-300' : ''}`}>{fmt(gf)}</td>
                        </>
                      )
                    })}
                    <td className="p-1.5 text-center text-orange-300 font-medium border-l border-gray-700 bg-gray-800">
                      {fmt(MONTHS_SHORT.reduce((s,_,i) => s+getGroupTotal(groupName,i+1,'plan'), 0))}
                    </td>
                    <td className="p-1.5 text-center font-medium text-green-300 bg-gray-800">
                      {fmt(MONTHS_SHORT.reduce((s,_,i) => s+getGroupTotal(groupName,i+1,'fact'), 0))}
                    </td>
                    <td/>
                  </tr>

                  {/* Item rows */}
                  {groupItems.map(item => (
                    <tr key={item.id} className="border-b border-gray-800/40 hover:bg-gray-900/30 group">
                      <td className="p-1.5 sticky left-0 bg-gray-950 z-10">
                        <div className="flex items-center gap-1 pl-2">
                          <span className="text-gray-300 truncate max-w-[150px]">{item.name}</span>
                          {item.categoryId && <span className="text-indigo-500 text-xs" title="linked to category">●</span>}
                          {item.keywordMatch && <span className="text-yellow-600 text-xs" title={`keywords: ${item.keywordMatch}`}>🔑</span>}
                        </div>
                      </td>
                      <td className="p-1.5 text-gray-600">{item.paymentType}</td>

                      {MONTHS_SHORT.map((_, mi) => {
                        const plan = getPlan(item.id, mi+1)
                        const fact = getFact(item.id, mi+1)
                        const key = `${item.id}-${mi+1}`
                        return (
                          <>
                            <td key={`p${mi}`} className="p-0 border-l border-gray-800">
                              {editingCell === key ? (
                                <input
                                  type="text"
                                  className="w-16 bg-indigo-900/60 text-indigo-200 text-xs p-1 text-center outline-none border border-indigo-500"
                                  value={cellValue}
                                  onChange={e => setCellValue(e.target.value)}
                                  onBlur={() => savePlan(item.id, mi+1, cellValue)}
                                  onKeyDown={e => { if (e.key==='Enter') savePlan(item.id, mi+1, cellValue); if (e.key==='Escape') setEditingCell(null) }}
                                  autoFocus
                                />
                              ) : (
                                <button
                                  className="w-full p-1.5 text-center text-gray-500 hover:bg-indigo-900/20 hover:text-indigo-300"
                                  onClick={() => { setEditingCell(key); setCellValue(plan > 0 ? plan.toString() : '') }}
                                >
                                  {plan > 0 ? <span className="text-gray-400">{fmt(plan)}</span> : <span className="text-gray-800">—</span>}
                                </button>
                              )}
                            </td>
                            <td key={`f${mi}`} className={`p-1.5 text-center ${fact > plan && plan > 0 ? 'text-red-400 bg-red-900/10' : fact > 0 ? 'text-green-400' : 'text-gray-800'}`}>
                              {fmt(fact) || '—'}
                            </td>
                          </>
                        )
                      })}

                      <td className="p-1.5 text-center text-gray-500 border-l border-gray-700 bg-gray-900">{fmt(getItemTotal(item.id,'plan')) || '—'}</td>
                      <td className={`p-1.5 text-center bg-gray-900 ${getItemTotal(item.id,'fact') > 0 ? 'text-green-400' : 'text-gray-700'}`}>{fmt(getItemTotal(item.id,'fact')) || '—'}</td>
                      <td className="p-1">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditItem(item); setShowAddItem(true) }} className="text-gray-600 hover:text-indigo-400"><Edit2 className="w-3 h-3"/></button>
                          <button onClick={() => deleteItem(item.id)} className="text-gray-600 hover:text-red-400"><Trash2 className="w-3 h-3"/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              )
            })}

            {/* ── TOTAL ROW ────────────────────────────────────────────── */}
            <tr className="border-t-2 border-gray-600 bg-gray-800/40">
              <td className="p-2 font-bold text-white sticky left-0 bg-gray-800/40 z-10" colSpan={2}>In total required:</td>
              {MONTHS_SHORT.map((_, mi) => {
                const tp = getTotalExpense(mi+1,'plan')
                const tf = getTotalExpense(mi+1,'fact')
                const inc = getTotalIncome(mi+1)
                return (
                  <>
                    <td key={`tp${mi}`} className="p-1.5 text-center font-bold text-red-400 border-l border-gray-700">{fmt(tp)}</td>
                    <td key={`tf${mi}`} className={`p-1.5 text-center font-bold ${tf > tp && tp > 0 ? 'text-red-400' : tf > 0 ? 'text-orange-300' : ''}`}>{fmt(tf)}</td>
                  </>
                )
              })}
              <td className="p-1.5 text-center font-bold text-red-400 border-l border-gray-700 bg-gray-800">
                {fmt(MONTHS_SHORT.reduce((s,_,i)=>s+getTotalExpense(i+1,'plan'),0))}
              </td>
              <td className="p-1.5 text-center font-bold text-orange-300 bg-gray-800">
                {fmt(MONTHS_SHORT.reduce((s,_,i)=>s+getTotalExpense(i+1,'fact'),0))}
              </td>
              <td/>
            </tr>

          </tbody>
        </table>
      </div>

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

const GROUPS_FOR_SELECT = ['Mandatory', 'Loan/savings', 'Entertainment, travel, hobbies, etc.', 'Other']

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

  const handleSave = async () => {
    if (!name) return
    setSaving(true)
    const finalGroup = groupName === '__custom__' ? customGroup : groupName
    const body = { name, groupName: finalGroup, paymentType, categoryId: categoryId ? +categoryId : null, keywordMatch: keywordMatch || null }
    const token = localStorage.getItem('token')
    const url = item ? `/api/budget/plan-items/${item.id}` : '/api/budget/plan-items'
    await fetch(url, { method: item ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
    setSaving(false)
    onSave()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose}/>
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-5 shadow-2xl">
        <h2 className="text-lg font-semibold text-white mb-4">{item ? 'Edit Row' : 'Add Row'}</h2>
        <div className="space-y-3">
          <div><label className="label">Name</label><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Mortgage, Groceries..." autoFocus/></div>
          <div>
            <label className="label">Group</label>
            <select className="select" value={groupName} onChange={e => setGroupName(e.target.value)}>
              {GROUPS_FOR_SELECT.map(g => <option key={g} value={g}>{g}</option>)}
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
            <label className="label">Keywords for auto-match (comma separated)</label>
            <input className="input" value={keywordMatch} onChange={e => setKeywordMatch(e.target.value)} placeholder="Albert Heijn, AH, supermarket"/>
            <p className="text-xs text-gray-600 mt-1">Transactions with these keywords count as Fact</p>
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
