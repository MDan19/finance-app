import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, ChevronRight, X } from 'lucide-react'
import { categoriesApi, analyticsApi, budgetApi } from '../api'
import { Category } from '../types'
import { formatEur, MONTHS } from '../utils/format'
import Modal from '../components/Modal'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts'

type Tab = 'summary' | 'charts' | 'annual'

export default function Categories() {
  const [tab, setTab] = useState<Tab>('summary')
  const [categories, setCategories] = useState<Category[]>([])
  const [spending, setSpending] = useState<any[]>([])
  const [showCatModal, setShowCatModal] = useState(false)
  const [editCat, setEditCat] = useState<Category | null>(null)
  const [selectedCat, setSelectedCat] = useState<any | null>(null)
  const [tagBreakdown, setTagBreakdown] = useState<any[]>([])
  const [tagLoading, setTagLoading] = useState(false)
  const [period, setPeriod] = useState(() => {
    const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`
  })

  const getEndDate = (ym: string) => {
    const [y,m] = ym.split('-').map(Number)
    return new Date(y,m,0).toISOString().split('T')[0]
  }

  const loadData = async () => {
    const [cats, sp] = await Promise.all([
      categoriesApi.all(),
      analyticsApi.categoriesSpending({ startDate: period+'-01', endDate: getEndDate(period) }),
    ])
    setCategories(cats.data)
    setSpending(sp.data)
  }

  useEffect(() => { loadData() }, [period])

  // Load tag breakdown when category is selected
  const handleCategoryClick = async (catData: any) => {
    if (catData.amount === 0) return
    setSelectedCat(catData)
    setTagLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(
        `/api/analytics/tag-breakdown?categoryId=${catData.category.id}&startDate=${period}-01&endDate=${getEndDate(period)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      setTagBreakdown(data)
    } catch (err) { setTagBreakdown([]) }
    setTagLoading(false)
  }

  const handleDeleteCat = async (id: number) => {
    if (!confirm('Deactivate this category?')) return
    await categoriesApi.delete(id); loadData()
  }

  const spendMap = Object.fromEntries(spending.map((s: any) => [s.category?.id, s.amount]))
  const totalSpend = spending.reduce((sum: number, s: any) => sum + s.amount, 0)

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--brand)' }}>Categories & Analytics</h1>
        <button onClick={() => { setEditCat(null); setShowCatModal(true) }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4"/> Add Category
        </button>
      </div>

      <div className="flex items-center gap-3">
        <label className="label mb-0">Period</label>
        <input type="month" className="input w-auto" value={period} onChange={e => setPeriod(e.target.value)}/>
        <span className="text-sm text-gray-500">Total: <span className="text-white font-medium">{formatEur(totalSpend)}</span></span>
      </div>

      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit">
        {(['summary','charts','annual'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${tab===t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t === 'annual' ? 'Annual Plan' : t}
          </button>
        ))}
      </div>

      {tab === 'summary' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Category list */}
          <div className="lg:col-span-2 card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="p-3 text-left">Category</th>
                  <th className="p-3 text-right">Spent</th>
                  <th className="p-3 text-right">% of total</th>
                  <th className="p-3 w-20"/>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-gray-500">No categories</td></tr>
                ) : categories.map((cat: Category) => {
                  const spent = spendMap[cat.id] || 0
                  const pct = totalSpend > 0 ? (spent/totalSpend)*100 : 0
                  const isSelected = selectedCat?.category?.id === cat.id
                  return (
                    <tr key={cat.id}
                      className={`border-b border-gray-800/50 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-900/20' : 'hover:bg-gray-900/30'}`}
                      onClick={() => handleCategoryClick({ category: cat, amount: spent })}>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }}/>
                          <span className="text-lg">{cat.icon}</span>
                          <span className="text-white">{cat.name}</span>
                          {spent > 0 && <ChevronRight className={`w-3 h-3 text-gray-600 transition-transform ${isSelected ? 'rotate-90' : ''}`}/>}
                        </div>
                      </td>
                      <td className="p-3 text-right font-medium text-white">{formatEur(spent)}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cat.color }}/>
                          </div>
                          <span className="text-gray-400 w-10 text-right">{pct.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2 justify-end" onClick={e => e.stopPropagation()}>
                          <button onClick={() => { setEditCat(cat); setShowCatModal(true) }} className="text-gray-600 hover:text-indigo-400"><Edit2 className="w-3.5 h-3.5"/></button>
                          <button onClick={() => handleDeleteCat(cat.id)} className="text-gray-600 hover:text-red-400"><Trash2 className="w-3.5 h-3.5"/></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Tag breakdown panel */}
          <div className="card">
            {!selectedCat ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mb-3">
                  <ChevronRight className="w-6 h-6 text-gray-600"/>
                </div>
                <p className="text-gray-500 text-sm">Click a category to see<br/>breakdown by tags</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white flex items-center gap-2">
                      <span className="text-xl">{selectedCat.category.icon}</span>
                      {selectedCat.category.name}
                    </h3>
                    <p className="text-sm text-gray-400">{formatEur(selectedCat.amount)} total</p>
                  </div>
                  <button onClick={() => { setSelectedCat(null); setTagBreakdown([]) }} className="text-gray-600 hover:text-white">
                    <X className="w-4 h-4"/>
                  </button>
                </div>

                {tagLoading ? (
                  <div className="space-y-2 animate-pulse">
                    {[1,2,3,4].map(i => <div key={i} className="h-8 bg-gray-800 rounded"/>)}
                  </div>
                ) : tagBreakdown.length === 0 ? (
                  <p className="text-gray-600 text-sm py-4 text-center">No tagged transactions in this period</p>
                ) : (
                  <div className="space-y-2">
                    {tagBreakdown.map((item: any) => {
                      const pct = selectedCat.amount > 0 ? (item.amount/selectedCat.amount)*100 : 0
                      return (
                        <div key={item.tag}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className={`font-mono ${item.tag === 'general' ? 'text-gray-500 italic' : 'text-indigo-300'}`}>
                              {item.tag === 'general' ? 'no tag' : `#${item.tag}`}
                            </span>
                            <span className="text-gray-300">{formatEur(item.amount)}</span>
                          </div>
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }}/>
                          </div>
                          <p className="text-right text-xs text-gray-600 mt-0.5">{pct.toFixed(0)}%</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'charts' && <ChartsView spending={spending}/>}
      {tab === 'annual' && <AnnualPlanView categories={categories}/>}

      {showCatModal && (
        <CategoryModal cat={editCat}
          onClose={() => setShowCatModal(false)}
          onSave={() => { setShowCatModal(false); loadData() }}/>
      )}
    </div>
  )
}

function ChartsView({ spending }: { spending: any[] }) {
  const data = spending.filter(s => s.category && s.amount > 0)
    .map(s => ({ name: `${s.category.icon} ${s.category.name}`, value: s.amount, color: s.category.color }))
    .sort((a,b) => b.value-a.value)
  if (data.length === 0) return <div className="card text-center py-12 text-gray-500">No spending data for this period</div>
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Spending by Category</h3>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" paddingAngle={2}>
              {data.map((entry,i) => <Cell key={i} fill={entry.color}/>)}
            </Pie>
            <Tooltip formatter={(v: number) => formatEur(v)}/>
            <Legend/>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="card">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Top Expenses</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.slice(0,8)} layout="vertical" margin={{ left: 100 }}>
            <XAxis type="number" tickFormatter={v => `€${v}`} tick={{ fill:'#9ca3af', fontSize:11 }}/>
            <YAxis type="category" dataKey="name" tick={{ fill:'#d1d5db', fontSize:11 }} width={100}/>
            <Tooltip formatter={(v: number) => formatEur(v)} contentStyle={{ backgroundColor:'#1f2937', border:'1px solid #374151' }}/>
            <Bar dataKey="value" radius={[0,4,4,0]}>
              {data.slice(0,8).map((entry,i) => <Cell key={i} fill={entry.color}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function AnnualPlanView({ categories }: { categories: Category[] }) {
  const [year, setYear] = useState(new Date().getFullYear())
  const [annualData, setAnnualData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')


  const load = async () => {
    setLoading(true)
    const res = await budgetApi.annual(year)
    setAnnualData(res.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [year])

  const getPlan = (catId: number, month: number) => {
    if (!annualData) return 0
    const plan = annualData.plans.find((p: any) => p.categoryId === catId && p.month === month)
    return plan ? Number(plan.amount) : 0
  }
  const getFact = (catId: number, month: number) => annualData?.facts?.[catId]?.[month] || 0

  const savePlan = async (catId: number, month: number) => {
    const amount = parseFloat(editValue) || 0
    await budgetApi.setPlan(catId, year, month, amount)
    setEditing(null); load()
  }

  if (loading) return <div className="card text-center py-8 text-gray-500 animate-pulse">Loading...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {[year-1,year,year+1].map(y => (
          <button key={y} onClick={() => setYear(y)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${y===year ? 'bg-indigo-600 text-white' : 'btn-secondary'}`}>{y}</button>
        ))}
      </div>
      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-900">
              <th className="p-2 text-left text-gray-400 sticky left-0 bg-gray-900 z-10 min-w-36 border-b border-gray-800">Category</th>
              {MONTHS.map((m,i) => <th key={i} colSpan={2} className="p-2 text-center text-gray-400 border-b border-l border-gray-800">{m}</th>)}
              <th className="p-2 text-center text-gray-400 border-b border-l border-gray-800" colSpan={2}>Total</th>
            </tr>
            <tr className="bg-gray-900/50">
              <th className="sticky left-0 bg-gray-900/50 border-b border-gray-800"/>
              {MONTHS.map((_,i) => (<>
                <th key={`p${i}`} className="p-1.5 text-gray-500 border-b border-l border-gray-800 text-center font-normal">Plan</th>
                <th key={`f${i}`} className="p-1.5 text-gray-500 border-b border-gray-800 text-center font-normal">Fact</th>
              </>))}
              <th className="p-1.5 text-gray-500 border-b border-l border-gray-800 text-center font-normal">Plan</th>
              <th className="p-1.5 text-gray-500 border-b border-gray-800 text-center font-normal">Fact</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => {
              const totalPlan = MONTHS.reduce((s,_,i) => s+getPlan(cat.id,i+1), 0)
              const totalFact = MONTHS.reduce((s,_,i) => s+getFact(cat.id,i+1), 0)
              return (
                <tr key={cat.id} className="border-b border-gray-800/50 hover:bg-gray-900/30">
                  <td className="p-2 sticky left-0 bg-gray-950 z-10 border-b border-gray-800">
                    <span>{cat.icon} {cat.name}</span>
                  </td>
                  {MONTHS.map((_,mi) => {
                    const plan = getPlan(cat.id, mi+1)
                    const fact = getFact(cat.id, mi+1)
                    const key = `${cat.id}-${mi+1}`
                    return (<>
                      <td key={`p${mi}`} className="p-0 border-l border-gray-800 text-center">
                        {editing === key ? (
                          <input type="number" className="w-16 bg-indigo-900/50 text-indigo-300 text-xs p-1 text-center outline-none"
                            value={editValue} onChange={e => setEditValue(e.target.value)}
                            onBlur={() => savePlan(cat.id,mi+1)}
                            onKeyDown={e => { if(e.key==='Enter') savePlan(cat.id,mi+1) }}
                            autoFocus/>
                        ) : (
                          <button className="w-full p-1.5 text-center text-gray-500 hover:text-indigo-400 hover:bg-indigo-900/20"
                            onClick={() => { setEditing(key); setEditValue(plan.toString()) }}>
                            {plan > 0 ? plan : <span className="text-gray-700">—</span>}
                          </button>
                        )}
                      </td>
                      <td key={`f${mi}`} className={`p-1.5 text-center ${fact > plan && plan > 0 ? 'text-red-400 bg-red-900/10' : fact > 0 ? 'text-green-400' : 'text-gray-700'}`}>
                        {fact > 0 ? Math.round(fact) : '—'}
                      </td>
                    </>)
                  })}
                  <td className="p-1.5 text-center border-l border-gray-700 text-gray-400 font-medium">{totalPlan > 0 ? Math.round(totalPlan) : '—'}</td>
                  <td className={`p-1.5 text-center font-medium ${totalFact > totalPlan && totalPlan > 0 ? 'text-red-400' : totalFact > 0 ? 'text-green-400' : 'text-gray-700'}`}>
                    {totalFact > 0 ? Math.round(totalFact) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const EMOJI_OPTIONS = ['🏠','🧹','💡','🚗','🍽️','📱','🏦','👨‍👩‍👧','✈️','⚕️','💆','💻','📋','📚','🛡️','🎁','💰','📈','🚌','📦','🎬','📂','🏋️','🛒','☕','🍺','🎓','💊','🎮','🐾']

function CategoryModal({ cat, onClose, onSave }: { cat: Category | null; onClose: () => void; onSave: () => void }) {
  const [name, setName] = useState(cat?.name || '')
  const [color, setColor] = useState(cat?.color || '#6366f1')
  const [icon, setIcon] = useState(cat?.icon || '📦')
  const [budgetGroup, setBudgetGroup] = useState(cat?.budgetGroup || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name) return
    setSaving(true)
    if (cat) await categoriesApi.update(cat.id, { name, color, icon, budgetGroup: budgetGroup || null })
    else await categoriesApi.create({ name, color, icon, budgetGroup: budgetGroup || null })
    setSaving(false); onSave()
  }

  return (
    <Modal title={cat ? 'Edit Category' : 'Add Category'} onClose={onClose} size="sm">
      <div className="space-y-4">
        <div><label className="label">Name</label><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Category name"/></div>
        <div>
          <label className="label">Icon</label>
          <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
            {EMOJI_OPTIONS.map(e => (
              <button key={e} onClick={() => setIcon(e)}
                className={`text-xl p-1.5 rounded-lg ${icon===e ? 'bg-indigo-600' : 'hover:bg-gray-800'}`}>{e}</button>
            ))}
          </div>
        </div>
        <div><label className="label">Color</label>
          <input type="color" className="h-9 w-full rounded-lg bg-transparent border border-gray-700 cursor-pointer" value={color} onChange={e => setColor(e.target.value)}/>
        </div>
        <div><label className="label">Budget Group</label>
          <select className="select" value={budgetGroup} onChange={e => setBudgetGroup(e.target.value)}>
            <option value="">— none —</option>
            <option value="needs">needs</option>
            <option value="wants">wants</option>
            <option value="savings">savings</option>
            <option value="income">income</option>
            <option value="other">other</option>
          </select>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving||!name} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </Modal>
  )
}
