import { useEffect, useState, useRef } from 'react'
import { Plus, Trash2, Edit2, Check, X, ChevronDown, ChevronRight } from 'lucide-react'
import api from '../api'
import { MONTHS } from '../utils/format'

interface PlanItem {
  id: number
  name: string
  groupName: string
  paymentType: string
  categoryId?: number
  accountId?: number
  sortOrder: number
  color?: string
}

interface PlanBudget {
  itemId: number
  year: number
  month: number
  amount: number
}

interface FactMap {
  [itemId: number]: { [month: number]: number }
}

interface Props {
  accounts: any[]
  categories: any[]
}

const GROUP_COLORS: Record<string, string> = {
  'Mandatory': '#ef4444',
  'Loan/savings': '#f97316',
  'Entertainment': '#8b5cf6',
  'Other': '#6366f1',
}

const PAYMENT_TYPES = ['Monthly', 'Quarterly', 'Yearly', 'One-time']

export default function PlanFactTable({ accounts, categories }: Props) {
  const [year, setYear] = useState(new Date().getFullYear())
  const [years, setYears] = useState<number[]>([])
  const [items, setItems] = useState<PlanItem[]>([])
  const [plans, setPlans] = useState<PlanBudget[]>([])
  const [factMap, setFactMap] = useState<FactMap>({})
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  // Inline editing
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editingItem, setEditingItem] = useState<number | null>(null)
  const [editItemName, setEditItemName] = useState('')
  const [showAddItem, setShowAddItem] = useState(false)
  const [newItem, setNewItem] = useState({ name: '', groupName: 'Mandatory', paymentType: 'Monthly', categoryId: '', accountId: '' })

  const load = async () => {
    setLoading(true)
    try {
      const [dataRes, yearsRes] = await Promise.all([
        api.get('/planfact/items', { params: { year } }),
        api.get('/planfact/years'),
      ])
      setItems(dataRes.data.items)
      setPlans(dataRes.data.plans)
      setFactMap(dataRes.data.factMap || {})
      setYears(yearsRes.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [year])

  const getPlan = (itemId: number, month: number): number => {
    const p = plans.find(p => p.itemId === itemId && p.month === month)
    return p ? Number(p.amount) : 0
  }

  const getFact = (itemId: number, month: number): number => {
    return factMap[itemId]?.[month] || 0
  }

  const getRowTotal = (itemId: number, type: 'plan' | 'fact'): number => {
    let total = 0
    for (let m = 1; m <= 12; m++) {
      total += type === 'plan' ? getPlan(itemId, m) : getFact(itemId, m)
    }
    return total
  }

  const getGroupTotal = (groupName: string, type: 'plan' | 'fact', month?: number): number => {
    const groupItems = items.filter(i => i.groupName === groupName)
    return groupItems.reduce((sum, item) => {
      if (month) return sum + (type === 'plan' ? getPlan(item.id, month) : getFact(item.id, month))
      return sum + getRowTotal(item.id, type)
    }, 0)
  }

  const getTotalRow = (type: 'plan' | 'fact', month?: number): number => {
    return items.reduce((sum, item) => {
      if (month) return sum + (type === 'plan' ? getPlan(item.id, month) : getFact(item.id, month))
      return sum + getRowTotal(item.id, type)
    }, 0)
  }

  const savePlan = async (itemId: number, month: number, value: string) => {
    const amount = parseFloat(value) || 0
    await api.put(`/planfact/items/${itemId}/budget/${year}/${month}`, { amount })
    setEditingCell(null)
    load()
  }

  const saveItemName = async (itemId: number) => {
    if (!editItemName.trim()) { setEditingItem(null); return }
    await api.put(`/planfact/items/${itemId}`, { 
      ...items.find(i => i.id === itemId), 
      name: editItemName 
    })
    setEditingItem(null)
    load()
  }

  const deleteItem = async (itemId: number) => {
    if (!confirm('Delete this row?')) return
    await api.delete(`/planfact/items/${itemId}`)
    load()
  }

  const addItem = async () => {
    if (!newItem.name) return
    await api.post('/planfact/items', {
      ...newItem,
      categoryId: newItem.categoryId ? +newItem.categoryId : null,
      accountId: newItem.accountId ? +newItem.accountId : null,
    })
    setNewItem({ name: '', groupName: 'Mandatory', paymentType: 'Monthly', categoryId: '', accountId: '' })
    setShowAddItem(false)
    load()
  }

  const groups = [...new Set(items.map(i => i.groupName))]

  const fmt = (n: number) => n === 0 ? '' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtTotal = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  if (loading) return (
    <div className="card animate-pulse">
      <div className="h-6 w-48 bg-gray-800 rounded mb-4" />
      <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-gray-800 rounded" />)}</div>
    </div>
  )

  return (
    <div className="card p-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <h2 className="text-lg font-bold text-white">Plan / Fact</h2>
        <div className="flex items-center gap-3">
          {/* Year selector */}
          <div className="flex gap-1">
            {[year - 1, year, year + 1].map(y => (
              <button key={y} onClick={() => setYear(y)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${y === year ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
              >{y}</button>
            ))}
          </div>
          <button onClick={() => setShowAddItem(true)} className="btn-primary flex items-center gap-1 text-sm py-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Row
          </button>
        </div>
      </div>

      {/* Add item form */}
      {showAddItem && (
        <div className="p-3 border-b border-gray-800 bg-gray-900/50 flex flex-wrap gap-2 items-end">
          <div>
            <label className="label text-xs">Name</label>
            <input className="input text-sm py-1" value={newItem.name} onChange={e => setNewItem(n => ({ ...n, name: e.target.value }))} placeholder="Expense name" autoFocus />
          </div>
          <div>
            <label className="label text-xs">Group</label>
            <input className="input text-sm py-1 w-36" value={newItem.groupName} onChange={e => setNewItem(n => ({ ...n, groupName: e.target.value }))} placeholder="Mandatory" list="groups" />
            <datalist id="groups">{groups.map(g => <option key={g} value={g} />)}</datalist>
          </div>
          <div>
            <label className="label text-xs">Payment type</label>
            <select className="select text-sm py-1" value={newItem.paymentType} onChange={e => setNewItem(n => ({ ...n, paymentType: e.target.value }))}>
              {PAYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Link category (auto-fact)</label>
            <select className="select text-sm py-1" value={newItem.categoryId} onChange={e => setNewItem(n => ({ ...n, categoryId: e.target.value }))}>
              <option value="">None</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Link account (auto-fact)</label>
            <select className="select text-sm py-1" value={newItem.accountId} onChange={e => setNewItem(n => ({ ...n, accountId: e.target.value }))}>
              <option value="">None</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={addItem} className="btn-primary text-sm py-1">Add</button>
            <button onClick={() => setShowAddItem(false)} className="btn-secondary text-sm py-1">Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse" style={{ minWidth: '1400px' }}>
          <thead>
            <tr className="bg-gray-900 border-b border-gray-800">
              <th className="sticky left-0 z-20 bg-gray-900 p-2 text-left text-gray-400 font-medium w-48 border-r border-gray-800">Expense name</th>
              <th className="p-2 text-center text-gray-400 font-medium w-24 border-r border-gray-800">Payment type</th>
              {MONTHS.map((m, i) => (
                <th key={i} colSpan={2} className="p-2 text-center text-gray-400 font-medium border-r border-gray-800">
                  {m}
                </th>
              ))}
              <th colSpan={2} className="p-2 text-center text-gray-400 font-medium">TOTAL fact</th>
            </tr>
            <tr className="bg-gray-900/60 border-b border-gray-700">
              <th className="sticky left-0 z-20 bg-gray-900/60 border-r border-gray-800" />
              <th className="border-r border-gray-800" />
              {MONTHS.map((_, i) => (
                <>
                  <th key={`ph${i}`} className="p-1.5 text-center text-gray-500 font-normal border-gray-700" style={{ borderLeft: '1px solid #374151' }}>Plan</th>
                  <th key={`fh${i}`} className="p-1.5 text-center text-gray-500 font-normal border-r border-gray-800">Fact</th>
                </>
              ))}
              <th className="p-1.5 text-center text-gray-500 border-gray-700" style={{ borderLeft: '1px solid #374151' }}>Plan</th>
              <th className="p-1.5 text-center text-gray-500">Fact</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(groupName => {
              const groupItems = items.filter(i => i.groupName === groupName)
              const isCollapsed = collapsed[groupName]
              const groupColor = GROUP_COLORS[groupName] || '#6366f1'

              return (
                <>
                  {/* Group header row */}
                  <tr key={`g-${groupName}`} className="border-b border-gray-700 cursor-pointer hover:bg-gray-900/30"
                    onClick={() => setCollapsed(c => ({ ...c, [groupName]: !c[groupName] }))}>
                    <td className="sticky left-0 z-10 p-2 font-bold border-r border-gray-800"
                      style={{ backgroundColor: groupColor + '22', color: groupColor }}>
                      <div className="flex items-center gap-1">
                        {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {groupName}
                      </div>
                    </td>
                    <td className="p-2 border-r border-gray-800" style={{ backgroundColor: groupColor + '11' }} />
                    {MONTHS.map((_, mi) => {
                      const gPlan = getGroupTotal(groupName, 'plan', mi + 1)
                      const gFact = getGroupTotal(groupName, 'fact', mi + 1)
                      return (
                        <>
                          <td key={`gp${mi}`} className="p-1.5 text-center font-bold" style={{ backgroundColor: groupColor + '11', color: groupColor, borderLeft: '1px solid #374151' }}>
                            {fmt(gPlan)}
                          </td>
                          <td key={`gf${mi}`} className="p-1.5 text-center font-bold border-r border-gray-800" style={{ backgroundColor: groupColor + '11', color: gFact > gPlan && gPlan > 0 ? '#ef4444' : groupColor }}>
                            {fmt(gFact)}
                          </td>
                        </>
                      )
                    })}
                    <td className="p-1.5 text-center font-bold" style={{ color: groupColor, borderLeft: '1px solid #374151' }}>
                      {fmtTotal(getGroupTotal(groupName, 'plan'))}
                    </td>
                    <td className="p-1.5 text-center font-bold" style={{ color: getGroupTotal(groupName, 'fact') > getGroupTotal(groupName, 'plan') ? '#ef4444' : groupColor }}>
                      {fmtTotal(getGroupTotal(groupName, 'fact'))}
                    </td>
                  </tr>

                  {/* Item rows */}
                  {!isCollapsed && groupItems.map((item, idx) => (
                    <tr key={item.id} className="border-b border-gray-800/40 hover:bg-gray-900/20 group">
                      {/* Name cell */}
                      <td className="sticky left-0 z-10 bg-gray-950 group-hover:bg-gray-900/50 p-1.5 border-r border-gray-800">
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-500 w-4 text-center">{idx + 1}</span>
                          {editingItem === item.id ? (
                            <div className="flex items-center gap-1 flex-1">
                              <input className="input text-xs py-0.5 flex-1" value={editItemName}
                                onChange={e => setEditItemName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveItemName(item.id); if (e.key === 'Escape') setEditingItem(null) }}
                                autoFocus />
                              <button onClick={() => saveItemName(item.id)} className="text-green-400"><Check className="w-3 h-3" /></button>
                              <button onClick={() => setEditingItem(null)} className="text-gray-500"><X className="w-3 h-3" /></button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 flex-1 min-w-0">
                              <span className="text-white truncate flex-1">{item.name}</span>
                              {item.categoryId && <span className="text-indigo-400 text-xs" title="Linked to category">🔗</span>}
                              {item.accountId && <span className="text-blue-400 text-xs" title="Linked to account">🏦</span>}
                              <button onClick={() => { setEditingItem(item.id); setEditItemName(item.name) }}
                                className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-indigo-400 flex-shrink-0">
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button onClick={() => deleteItem(item.id)}
                                className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 flex-shrink-0">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      {/* Payment type */}
                      <td className="p-1.5 text-center text-gray-500 border-r border-gray-800">{item.paymentType}</td>
                      {/* Month cells */}
                      {MONTHS.map((_, mi) => {
                        const plan = getPlan(item.id, mi + 1)
                        const fact = getFact(item.id, mi + 1)
                        const cellKey = `${item.id}-${mi + 1}`
                        const over = fact > plan && plan > 0
                        return (
                          <>
                            {/* Plan cell — editable */}
                            <td key={`p${mi}`} className="p-0" style={{ borderLeft: '1px solid #374151' }}>
                              {editingCell === cellKey ? (
                                <input
                                  type="number"
                                  className="w-16 h-full bg-indigo-900/50 text-indigo-300 text-xs p-1.5 text-center outline-none border border-indigo-500 rounded-sm"
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onBlur={() => savePlan(item.id, mi + 1, editValue)}
                                  onKeyDown={e => { if (e.key === 'Enter') savePlan(item.id, mi + 1, editValue); if (e.key === 'Escape') setEditingCell(null) }}
                                  autoFocus
                                />
                              ) : (
                                <button
                                  className="w-full p-1.5 text-center text-gray-400 hover:text-white hover:bg-indigo-900/20 transition-colors"
                                  onClick={() => { setEditingCell(cellKey); setEditValue(plan > 0 ? plan.toString() : '') }}
                                  title="Click to edit plan"
                                >
                                  {plan > 0 ? fmt(plan) : <span className="text-gray-700">—</span>}
                                </button>
                              )}
                            </td>
                            {/* Fact cell — auto from transactions */}
                            <td key={`f${mi}`} className={`p-1.5 text-center border-r border-gray-800 ${
                              over ? 'text-red-400 bg-red-900/10' :
                              fact > 0 && plan > 0 ? 'text-green-400' :
                              fact > 0 ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                              {fact > 0 ? fmt(fact) : '—'}
                            </td>
                          </>
                        )
                      })}
                      {/* Row totals */}
                      <td className="p-1.5 text-center text-gray-400 font-medium" style={{ borderLeft: '1px solid #374151' }}>
                        {getRowTotal(item.id, 'plan') > 0 ? fmtTotal(getRowTotal(item.id, 'plan')) : '—'}
                      </td>
                      <td className={`p-1.5 text-center font-medium ${getRowTotal(item.id, 'fact') > getRowTotal(item.id, 'plan') && getRowTotal(item.id, 'plan') > 0 ? 'text-red-400' : getRowTotal(item.id, 'fact') > 0 ? 'text-green-400' : 'text-gray-700'}`}>
                        {getRowTotal(item.id, 'fact') > 0 ? fmtTotal(getRowTotal(item.id, 'fact')) : '—'}
                      </td>
                    </tr>
                  ))}
                </>
              )
            })}

            {/* Grand total row */}
            <tr className="border-t-2 border-gray-600 bg-gray-900/80 font-bold">
              <td className="sticky left-0 z-10 bg-gray-900 p-2 text-white border-r border-gray-800">In total required:</td>
              <td className="border-r border-gray-800" />
              {MONTHS.map((_, mi) => {
                const tPlan = getTotalRow('plan', mi + 1)
                const tFact = getTotalRow('fact', mi + 1)
                return (
                  <>
                    <td key={`tp${mi}`} className="p-1.5 text-center text-red-300 font-bold" style={{ borderLeft: '1px solid #374151' }}>{fmt(tPlan)}</td>
                    <td key={`tf${mi}`} className="p-1.5 text-center border-r border-gray-800" style={{ color: tFact > tPlan && tPlan > 0 ? '#f87171' : '#86efac' }}>{fmt(tFact)}</td>
                  </>
                )
              })}
              <td className="p-1.5 text-center text-red-300" style={{ borderLeft: '1px solid #374151' }}>{fmtTotal(getTotalRow('plan'))}</td>
              <td className="p-1.5 text-center text-green-300">{fmtTotal(getTotalRow('fact'))}</td>
            </tr>
          </tbody>
        </table>

        {items.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-gray-500 mb-2">No plan rows yet</p>
            <p className="text-sm text-gray-600">Click "Add Row" to create your first expense plan item</p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="p-3 border-t border-gray-800 flex gap-4 text-xs text-gray-500">
        <span>💡 Click any <span className="text-indigo-400">Plan</span> cell to edit budget</span>
        <span>🔗 = linked to category (auto-updates fact)</span>
        <span>🏦 = linked to account (auto-updates fact)</span>
        <span className="text-red-400">Red fact = over budget</span>
      </div>
    </div>
  )
}
