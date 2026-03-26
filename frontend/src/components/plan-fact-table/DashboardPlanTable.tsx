import { useEffect, useState, useRef } from 'react'
import { Plus, Trash2, Edit2, Check, X, ChevronLeft, ChevronRight, Settings } from 'lucide-react'
import { budgetApi, categoriesApi } from '../../api'
import { Category } from '../../types'

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const GROUPS = ['Mandatory', 'Loan/savings', 'Entertainment, travel, hobbies, etc.', 'Other']
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

export default function DashboardPlanTable() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [items, setItems] = useState<PlanItem[]>([])
  const [amounts, setAmounts] = useState<PlanAmount[]>([])
  const [facts, setFacts] = useState<Record<number, Record<number, number>>>({})
  const [categories, setCategories] = useState<Category[]>([])
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [cellValue, setCellValue] = useState('')
  const [showAddItem, setShowAddItem] = useState(false)
  const [editItem, setEditItem] = useState<PlanItem | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [itemsRes, amountsRes, factsRes, catsRes] = await Promise.all([
        fetch('/api/budget/plan-items', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then(r => r.json()),
        fetch(`/api/budget/plan-amounts/${year}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then(r => r.json()),
        fetch(`/api/budget/plan-facts/${year}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then(r => r.json()),
        categoriesApi.all().then(r => r.data),
      ])
      setItems(itemsRes)
      setAmounts(amountsRes)
      setFacts(factsRes)
      setCategories(catsRes)
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [year])

  const getPlan = (itemId: number, month: number) => {
    const a = amounts.find(a => a.planItemId === itemId && a.month === month)
    return a ? Number(a.amount) : 0
  }

  const getFact = (itemId: number, month: number) => {
    return facts[itemId]?.[month] || 0
  }

  const savePlan = async (itemId: number, month: number, value: string) => {
    const amount = parseFloat(value) || 0
    await fetch(`/api/budget/plan-amounts/${itemId}/${year}/${month}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ amount }),
    })
    setEditingCell(null)
    load()
  }

  const deleteItem = async (id: number) => {
    if (!confirm('Delete this row?')) return
    await fetch(`/api/budget/plan-items/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
    load()
  }

  // Group items by groupName
  const groups = GROUPS.filter(g => items.some(i => i.groupName === g))
  const otherGroups = [...new Set(items.map(i => i.groupName))].filter(g => !GROUPS.includes(g))
  const allGroups = [...groups, ...otherGroups]

  const getGroupTotal = (groupName: string, month: number, type: 'plan' | 'fact') => {
    return items
      .filter(i => i.groupName === groupName && i.isActive)
      .reduce((sum, item) => sum + (type === 'plan' ? getPlan(item.id, month) : getFact(item.id, month)), 0)
  }

  const getTotalForItem = (itemId: number, type: 'plan' | 'fact') => {
    return MONTHS_SHORT.reduce((sum, _, i) => sum + (type === 'plan' ? getPlan(itemId, i + 1) : getFact(itemId, i + 1)), 0)
  }

  const getTotalAll = (month: number, type: 'plan' | 'fact') => {
    return items.filter(i => i.isActive).reduce((sum, item) => sum + (type === 'plan' ? getPlan(item.id, month) : getFact(item.id, month)), 0)
  }

  if (loading) return <div className="card animate-pulse h-48 flex items-center justify-center text-gray-600">Loading plan table...</div>

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">Plan / Fact</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => setYear(y => y - 1)} className="p-1 text-gray-500 hover:text-white">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-white px-2">{year}</span>
            <button onClick={() => setYear(y => y + 1)} className="p-1 text-gray-500 hover:text-white">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <button onClick={() => { setEditItem(null); setShowAddItem(true) }}
          className="btn-primary text-xs py-1.5 flex items-center gap-1">
          <Plus className="w-3 h-3" /> Add Row
        </button>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[1200px]">
          <thead>
            <tr className="bg-gray-900 border-b border-gray-700">
              <th className="p-2 text-left text-gray-400 sticky left-0 bg-gray-900 z-10 min-w-[160px]">Expense name</th>
              <th className="p-2 text-left text-gray-400 min-w-[80px]">Type</th>
              {MONTHS_SHORT.map((m, i) => (
                <th key={i} colSpan={2} className="p-2 text-center text-gray-400 border-l border-gray-700">{m}</th>
              ))}
              <th colSpan={2} className="p-2 text-center text-gray-400 border-l border-gray-700 bg-gray-800">Total</th>
              <th className="p-2 w-8 bg-gray-900" />
            </tr>
            <tr className="bg-gray-900/80 border-b border-gray-700">
              <th className="sticky left-0 bg-gray-900/80 z-10" />
              <th />
              {MONTHS_SHORT.map((_, i) => (
                <>
                  <th key={`ph${i}`} className="p-1 text-center text-gray-500 border-l border-gray-700 font-normal">Plan</th>
                  <th key={`fh${i}`} className="p-1 text-center text-gray-500 font-normal">Fact</th>
                </>
              ))}
              <th className="p-1 text-center text-gray-500 border-l border-gray-700 bg-gray-800 font-normal">Plan</th>
              <th className="p-1 text-center text-gray-500 bg-gray-800 font-normal">Fact</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {allGroups.map(groupName => {
              const groupItems = items.filter(i => i.groupName === groupName && i.isActive)
              if (groupItems.length === 0) return null
              return (
                <>
                  {/* Group header row */}
                  <tr key={`group-${groupName}`} className="bg-gray-800/60">
                    <td className="p-2 font-semibold text-orange-400 sticky left-0 bg-gray-800/60 z-10" colSpan={2}>
                      {groupName}
                    </td>
                    {MONTHS_SHORT.map((_, mi) => {
                      const gPlan = getGroupTotal(groupName, mi + 1, 'plan')
                      const gFact = getGroupTotal(groupName, mi + 1, 'fact')
                      return (
                        <>
                          <td key={`gp${mi}`} className="p-1.5 text-center text-orange-300 font-medium border-l border-gray-700">
                            {gPlan > 0 ? gPlan.toFixed(2) : ''}
                          </td>
                          <td key={`gf${mi}`} className={`p-1.5 text-center font-medium ${gFact > gPlan && gPlan > 0 ? 'text-red-400' : gFact > 0 ? 'text-green-400' : ''}`}>
                            {gFact > 0 ? gFact.toFixed(2) : ''}
                          </td>
                        </>
                      )
                    })}
                    <td className="p-1.5 text-center text-orange-300 font-medium border-l border-gray-700 bg-gray-800">
                      {MONTHS_SHORT.reduce((s, _, i) => s + getGroupTotal(groupName, i + 1, 'plan'), 0).toFixed(2)}
                    </td>
                    <td className="p-1.5 text-center font-medium text-green-400 bg-gray-800">
                      {MONTHS_SHORT.reduce((s, _, i) => s + getGroupTotal(groupName, i + 1, 'fact'), 0).toFixed(2)}
                    </td>
                    <td />
                  </tr>

                  {/* Item rows */}
                  {groupItems.map((item, idx) => (
                    <tr key={item.id} className="border-b border-gray-800/40 hover:bg-gray-900/30 group">
                      <td className="p-1.5 sticky left-0 bg-gray-950 z-10">
                        <div className="flex items-center gap-1">
                          <span className="text-gray-300 truncate max-w-[140px]">{item.name}</span>
                          {item.categoryId && (
                            <span className="text-indigo-500 text-xs">●</span>
                          )}
                        </div>
                      </td>
                      <td className="p-1.5 text-gray-500">{item.paymentType}</td>

                      {MONTHS_SHORT.map((_, mi) => {
                        const plan = getPlan(item.id, mi + 1)
                        const fact = getFact(item.id, mi + 1)
                        const cellKey = `${item.id}-${mi + 1}`
                        const over = fact > plan && plan > 0
                        return (
                          <>
                            <td key={`p${mi}`} className="p-0 border-l border-gray-800">
                              {editingCell === cellKey ? (
                                <input
                                  type="number"
                                  className="w-16 bg-indigo-900/60 text-indigo-200 text-xs p-1 text-center outline-none border border-indigo-500"
                                  value={cellValue}
                                  onChange={e => setCellValue(e.target.value)}
                                  onBlur={() => savePlan(item.id, mi + 1, cellValue)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') savePlan(item.id, mi + 1, cellValue)
                                    if (e.key === 'Escape') setEditingCell(null)
                                  }}
                                  autoFocus
                                />
                              ) : (
                                <button
                                  className="w-full p-1.5 text-center text-gray-400 hover:bg-indigo-900/20 hover:text-indigo-300 transition-colors"
                                  onClick={() => { setEditingCell(cellKey); setCellValue(plan > 0 ? plan.toString() : '') }}
                                >
                                  {plan > 0 ? plan.toFixed(2) : <span className="text-gray-700">—</span>}
                                </button>
                              )}
                            </td>
                            <td key={`f${mi}`} className={`p-1.5 text-center ${over ? 'text-red-400 bg-red-900/10' : fact > 0 ? 'text-green-400' : 'text-gray-700'}`}>
                              {fact > 0 ? fact.toFixed(2) : '—'}
                            </td>
                          </>
                        )
                      })}

                      <td className="p-1.5 text-center text-gray-400 border-l border-gray-700 bg-gray-900">
                        {getTotalForItem(item.id, 'plan') > 0 ? getTotalForItem(item.id, 'plan').toFixed(2) : '—'}
                      </td>
                      <td className={`p-1.5 text-center bg-gray-900 ${getTotalForItem(item.id, 'fact') > 0 ? 'text-green-400' : 'text-gray-700'}`}>
                        {getTotalForItem(item.id, 'fact') > 0 ? getTotalForItem(item.id, 'fact').toFixed(2) : '—'}
                      </td>
                      <td className="p-1">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditItem(item); setShowAddItem(true) }} className="text-gray-600 hover:text-indigo-400">
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button onClick={() => deleteItem(item.id)} className="text-gray-600 hover:text-red-400">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              )
            })}

            {/* Total row */}
            <tr className="border-t-2 border-gray-600 bg-gray-800/40">
              <td className="p-2 font-bold text-white sticky left-0 bg-gray-800/40 z-10" colSpan={2}>In total required:</td>
              {MONTHS_SHORT.map((_, mi) => {
                const tp = getTotalAll(mi + 1, 'plan')
                const tf = getTotalAll(mi + 1, 'fact')
                return (
                  <>
                    <td key={`tp${mi}`} className="p-1.5 text-center font-bold text-red-400 border-l border-gray-700">{tp > 0 ? tp.toFixed(2) : ''}</td>
                    <td key={`tf${mi}`} className={`p-1.5 text-center font-bold ${tf > tp && tp > 0 ? 'text-red-400' : tf > 0 ? 'text-green-400' : ''}`}>{tf > 0 ? tf.toFixed(2) : ''}</td>
                  </>
                )
              })}
              <td className="p-1.5 text-center font-bold text-red-400 border-l border-gray-700 bg-gray-800">
                {MONTHS_SHORT.reduce((s, _, i) => s + getTotalAll(i + 1, 'plan'), 0).toFixed(2)}
              </td>
              <td className="p-1.5 text-center font-bold text-green-400 bg-gray-800">
                {MONTHS_SHORT.reduce((s, _, i) => s + getTotalAll(i + 1, 'fact'), 0).toFixed(2)}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Add/Edit Item Modal */}
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
  item: PlanItem | null
  categories: Category[]
  onClose: () => void
  onSave: () => void
}) {
  const [name, setName] = useState(item?.name || '')
  const [groupName, setGroupName] = useState(item?.groupName || 'Mandatory')
  const [paymentType, setPaymentType] = useState(item?.paymentType || 'Monthly')
  const [categoryId, setCategoryId] = useState(item?.categoryId?.toString() || '')
  const [keywordMatch, setKeywordMatch] = useState(item?.keywordMatch || '')
  const [customGroup, setCustomGroup] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name) return
    setSaving(true)
    const finalGroup = groupName === '__custom__' ? customGroup : groupName
    const body = {
      name, groupName: finalGroup, paymentType,
      categoryId: categoryId ? +categoryId : null,
      keywordMatch: keywordMatch || null,
    }
    const token = localStorage.getItem('token')
    if (item) {
      await fetch(`/api/budget/plan-items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
    } else {
      await fetch('/api/budget/plan-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
    }
    setSaving(false)
    onSave()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-5 shadow-2xl">
        <h2 className="text-lg font-semibold text-white mb-4">{item ? 'Edit Row' : 'Add Row'}</h2>
        <div className="space-y-3">
          <div>
            <label className="label">Expense Name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Mortgage, Groceries..." autoFocus />
          </div>
          <div>
            <label className="label">Group</label>
            <select className="select" value={groupName} onChange={e => setGroupName(e.target.value)}>
              {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              <option value="__custom__">+ New group...</option>
            </select>
            {groupName === '__custom__' && (
              <input className="input mt-2" placeholder="Group name..." value={customGroup} onChange={e => setCustomGroup(e.target.value)} />
            )}
          </div>
          <div>
            <label className="label">Payment Type</label>
            <select className="select" value={paymentType} onChange={e => setPaymentType(e.target.value)}>
              {PAYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Link to Category (for auto Fact)</label>
            <select className="select" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              <option value="">— no category —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Keywords (comma-separated, for auto Fact)</label>
            <input className="input" value={keywordMatch} onChange={e => setKeywordMatch(e.target.value)}
              placeholder="e.g. Albert Heijn, AH, Supermarket" />
            <p className="text-xs text-gray-600 mt-1">Transactions matching these keywords will count as Fact for this row</p>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving || !name} className="btn-primary flex-1">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
