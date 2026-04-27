import { useState, useRef, useEffect } from 'react'
import { Upload, Plus, Trash2, Check, AlertCircle, Info } from 'lucide-react'
import { importApi, categoriesApi, accountsApi } from '../api'
import { Category, Account } from '../types'

type Step = 'upload' | 'map' | 'result'
type Tab = 'import' | 'guide' | 'rules' | 'history'

export default function Import() {
  const [tab, setTab] = useState<Tab>('import')
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [delimiter, setDelimiter] = useState(',')
  const [preview, setPreview] = useState<{ headers: string[]; rows: any[]; totalRows: number } | null>(null)
  const [columnMap, setColumnMap] = useState<Record<string, string>>({
    date: '', amount: '', amountCredit: '', amountDebit: '',
    description: '', currency: '', opposingAccount: '',
    category: '', tags: '',
  })
  const [amountMode, setAmountMode] = useState<'single' | 'two'>('single')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accountId, setAccountId] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    accountsApi.list().then(r => { setAccounts(r.data); if (r.data[0]) setAccountId(r.data[0].id.toString()) })
    categoriesApi.all().then(r => setCategories(r.data))
  }, [])

  const handleFileChange = async (f: File) => {
    setFile(f); setError(''); setLoading(true)
    try {
      const res = await importApi.preview(f, delimiter)
      setPreview(res.data)
      // Auto-detect columns by name
      const headers: string[] = res.data.headers
      const find = (...names: string[]) => headers.find(h => names.some(n => h.toLowerCase().includes(n.toLowerCase()))) || ''
      setColumnMap(m => ({
        ...m,
        date: find('date', 'datum'),
        description: find('description', 'omschrijving', 'memo', 'desc'),
        amount: find('amount', 'bedrag'),
        amountDebit: find('amount_debit', 'debit', 'af'),
        amountCredit: find('amount_credit', 'credit', 'bij'),
        opposingAccount: find('opposing_account', 'tegenrekening', 'counterparty'),
        currency: find('currency', 'valuta'),
        category: find('category', 'categorie'),
        tags: find('tags', 'tag', 'labels'),
      }))
      // Auto-detect two-column mode
      if (find('amount_debit', 'debit') && find('amount_credit', 'credit')) {
        setAmountMode('two')
      }
      setStep('map')
    } catch { setError('Failed to parse file') }
    finally { setLoading(false) }
  }

  const handleImport = async () => {
    if (!file || !accountId) return
    setLoading(true); setError('')
    try {
      const res = await importApi.execute(file, {
        accountId,
        columnMap: { ...columnMap, amountMode },
        delimiter,
      })
      setResult(res.data)
      setStep('result')
    } catch (e: any) {
      setError(e.response?.data?.error || 'Import failed')
    } finally { setLoading(false) }
  }

  const setMap = (key: string, val: string) => setColumnMap(m => ({ ...m, [key]: val }))

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white">CSV Import</h1>

      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit flex-wrap">
        {([
          { key: 'import', label: 'Import' },
          { key: 'guide', label: '📋 Format Guide' },
          { key: 'rules', label: 'Keyword Rules' },
          { key: 'history', label: 'History' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium ${tab === t.key ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'guide' && <FormatGuide />}

      {tab === 'import' && (
        <div className="space-y-6">
          {/* Steps */}
          <div className="flex items-center gap-2">
            {(['upload', 'map', 'result'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                  step === s ? 'bg-indigo-600 text-white' :
                  ['upload','map','result'].indexOf(step) > i ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-500'
                }`}>
                  {['upload','map','result'].indexOf(step) > i ? <Check className="w-4 h-4"/> : i+1}
                </div>
                <span className={`text-sm ${step === s ? 'text-white' : 'text-gray-500'}`}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </span>
                {i < 2 && <div className="w-8 h-px bg-gray-700"/>}
              </div>
            ))}
          </div>

          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div className="card space-y-4">
              <div className="flex items-start gap-3 p-3 bg-indigo-900/20 border border-indigo-800/40 rounded-lg">
                <Info className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5"/>
                <p className="text-sm text-indigo-300">
                  Supports CSV with single or two-column amounts, European number format, and auto-detection of columns.
                  See the <button onClick={() => setTab('guide')} className="underline hover:text-white">Format Guide</button>.
                </p>
              </div>
              <div
                className="border-2 border-dashed border-gray-700 rounded-xl p-12 text-center cursor-pointer hover:border-indigo-500 transition-colors"
                onClick={() => fileRef.current?.click()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileChange(f) }}
                onDragOver={e => e.preventDefault()}>
                <Upload className="w-12 h-12 text-gray-600 mx-auto mb-3"/>
                <p className="text-gray-400">Drop CSV file here or <span className="text-indigo-400">click to browse</span></p>
                <p className="text-sm text-gray-600 mt-1">Max 50MB</p>
                <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleFileChange(e.target.files[0]) }}/>
              </div>
              <div className="flex items-center gap-3">
                <label className="label mb-0 whitespace-nowrap">Column delimiter</label>
                <select className="select w-auto" value={delimiter} onChange={e => setDelimiter(e.target.value)}>
                  <option value=",">, (comma)</option>
                  <option value=";">; (semicolon)</option>
                  <option value="\t">Tab</option>
                </select>
              </div>
              {error && <p className="text-red-400 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4"/>{error}</p>}
              {loading && <p className="text-indigo-400 text-sm animate-pulse">Parsing file...</p>}
            </div>
          )}

          {/* STEP 2: Map */}
          {step === 'map' && preview && (
            <div className="space-y-4">
              <div className="card space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-white">Map Columns</h2>
                  <span className="text-sm text-gray-500">{preview.totalRows} rows · {preview.headers.length} columns detected</span>
                </div>

                {/* Account */}
                <div>
                  <label className="label">Account (this file belongs to)</label>
                  <select className="select" value={accountId} onChange={e => setAccountId(e.target.value)}>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>

                {/* Required fields */}
                <div className="border border-gray-700 rounded-lg p-4 space-y-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Required</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Date column</label>
                      <select className="select" value={columnMap.date} onChange={e => setMap('date', e.target.value)}>
                        <option value="">— select —</option>
                        {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Description column</label>
                      <select className="select" value={columnMap.description} onChange={e => setMap('description', e.target.value)}>
                        <option value="">— select —</option>
                        {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Amount mode */}
                  <div>
                    <label className="label">Amount format</label>
                    <div className="flex gap-3">
                      <button onClick={() => setAmountMode('single')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors flex-1 ${amountMode === 'single' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}>
                        Single column
                        <span className="block text-xs font-normal opacity-70 mt-0.5">one column with -/+ values</span>
                      </button>
                      <button onClick={() => setAmountMode('two')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors flex-1 ${amountMode === 'two' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}>
                        Two columns
                        <span className="block text-xs font-normal opacity-70 mt-0.5">separate debit / credit</span>
                      </button>
                    </div>
                  </div>

                  {amountMode === 'single' ? (
                    <div>
                      <label className="label">Amount column</label>
                      <select className="select" value={columnMap.amount} onChange={e => setMap('amount', e.target.value)}>
                        <option value="">— select —</option>
                        {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Debit column (expenses)</label>
                        <select className="select" value={columnMap.amountDebit} onChange={e => setMap('amountDebit', e.target.value)}>
                          <option value="">— select —</option>
                          {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label">Credit column (income)</label>
                        <select className="select" value={columnMap.amountCredit} onChange={e => setMap('amountCredit', e.target.value)}>
                          <option value="">— select —</option>
                          {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Optional fields */}
                <div className="border border-gray-700 rounded-lg p-4 space-y-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Optional</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Opposing account column</label>
                      <select className="select" value={columnMap.opposingAccount} onChange={e => setMap('opposingAccount', e.target.value)}>
                        <option value="">— none —</option>
                        {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <p className="text-xs text-gray-600 mt-1">Auto-detects Transfers</p>
                    </div>
                    <div>
                      <label className="label">Currency column</label>
                      <select className="select" value={columnMap.currency} onChange={e => setMap('currency', e.target.value)}>
                        <option value="">— none —</option>
                        {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Category column</label>
                      <select className="select" value={columnMap.category} onChange={e => setMap('category', e.target.value)}>
                        <option value="">— none —</option>
                        {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <p className="text-xs text-gray-600 mt-1">Must match category names in app</p>
                    </div>
                    <div>
                      <label className="label">Tags column</label>
                      <select className="select" value={columnMap.tags} onChange={e => setMap('tags', e.target.value)}>
                        <option value="">— none —</option>
                        {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <p className="text-xs text-gray-600 mt-1">Comma-separated tags per row</p>
                    </div>
                  </div>
                </div>

                {/* Auto-detected notice */}
                {Object.values(columnMap).some(v => v) && (
                  <div className="flex items-start gap-2 p-3 bg-green-900/20 border border-green-800/30 rounded-lg">
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5"/>
                    <p className="text-xs text-green-300">
                      Columns auto-detected from header names. Review and adjust if needed.
                    </p>
                  </div>
                )}
              </div>

              {/* Preview table */}
              <div className="card p-0 overflow-hidden">
                <div className="p-3 border-b border-gray-800 flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-400">Preview (first 20 rows)</p>
                  <p className="text-xs text-gray-600">{preview.headers.length} columns</p>
                </div>
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-900 sticky top-0">
                      <tr>
                        {preview.headers.map(h => (
                          <th key={h} className={`p-2 text-left border-b border-gray-800 whitespace-nowrap ${
                            Object.values(columnMap).includes(h) ? 'text-indigo-400' : 'text-gray-500'
                          }`}>
                            {h}
                            {Object.entries(columnMap).find(([,v]) => v === h)?.[0] && (
                              <span className="ml-1 text-indigo-600">✓</span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, i) => (
                        <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-900/30">
                          {preview.headers.map(h => (
                            <td key={h} className={`p-2 whitespace-nowrap ${
                              Object.values(columnMap).includes(h) ? 'text-gray-200' : 'text-gray-600'
                            }`}>{row[h] || '—'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-800/40 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0"/>
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => { setStep('upload'); setPreview(null); setFile(null) }} className="btn-secondary">Back</button>
                <button
                  onClick={handleImport}
                  disabled={loading || !columnMap.date || (amountMode === 'single' ? !columnMap.amount : !columnMap.amountDebit)}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                      Importing {preview.totalRows} rows...
                    </>
                  ) : `Import ${preview.totalRows} rows`}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Result */}
          {step === 'result' && result && (
            <div className="card space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-900/40 rounded-full flex items-center justify-center">
                  <Check className="w-6 h-6 text-green-400"/>
                </div>
                <div>
                  <h2 className="font-semibold text-white">Import Complete</h2>
                  <p className="text-sm text-gray-400">File: {file?.name}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Imported',      value: result.imported,          color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
                  { label: 'Transfers',     value: result.transfers || 0,    color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
                  { label: 'Skipped (dup)', value: result.skipped,           color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
                  { label: 'Need category', value: result.needsCategory,     color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
                ].map(s => (
                  <div key={s.label} className="rounded-lg p-3 text-center"
                    style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                    <p className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-xs mt-1 font-medium" style={{ color: '#374151' }}>{s.label}</p>
                  </div>
                ))}
              </div>
                ))}
              </div>

              {/* Import log */}
              {result.log && result.log.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Skip log ({result.log.length} entries)</p>
                  <div className="bg-gray-900 rounded-lg p-3 max-h-40 overflow-y-auto">
                    {result.log.map((entry: string, i: number) => (
                      <p key={i} className="text-xs text-gray-500 font-mono">{entry}</p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => { setStep('upload'); setFile(null); setPreview(null); setResult(null) }}
                  className="btn-secondary flex-1">Import Another File</button>
                <a href="/transactions" className="btn-primary flex-1 text-center">View Transactions →</a>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'rules' && <KeywordRulesView categories={categories}/>}
      {tab === 'history' && <ImportHistoryView/>}
    </div>
  )
}

// ── Format Guide ──────────────────────────────────────────────────────────────
function FormatGuide() {
  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <h2 className="font-semibold text-white">📋 CSV Format Guide</h2>
        <div className="space-y-4">
          <Section title="General">
            <Row label="File type" value=".csv or .txt"/>
            <Row label="Encoding" value="UTF-8 recommended"/>
            <Row label="First row" value="Must be column headers"/>
            <Row label="Delimiter" value="Comma (,) or Semicolon (;) — select at upload"/>
          </Section>
          <Section title="📅 Date formats — all supported">
            <div className="grid grid-cols-2 gap-2 mt-2">
              {['2026-01-15 (YYYY-MM-DD)','15.01.2026 (DD.MM.YYYY)','15/01/2026 (DD/MM/YYYY)','15-01-2026 (DD-MM-YYYY)'].map(f => (
                <div key={f} className="bg-gray-800/50 rounded px-3 py-2 text-xs text-indigo-300 font-mono">{f}</div>
              ))}
            </div>
          </Section>
          <Section title="💶 Amount formats — all supported">
            <div className="grid grid-cols-2 gap-2 mt-2">
              {['148,29 (European)','1 052,55 (space thousands)','1.052,55 (dot thousands)','148.29 (standard)','-148,29 (negative = expense)','+17,10 (positive = income)'].map(f => (
                <div key={f} className="bg-gray-800/50 rounded px-3 py-2 text-xs text-indigo-300 font-mono">{f}</div>
              ))}
            </div>
          </Section>
          <Section title="🏷️ Tags column format">
            <p className="text-sm text-gray-400 mt-1">
              Tags in the CSV should be comma-separated within the cell:
            </p>
            <div className="bg-gray-800/50 rounded px-3 py-2 text-xs text-indigo-300 font-mono mt-2">
              groceries, trip_france, business
            </div>
          </Section>
          <Section title="🔄 Transfer detection via opposing_account">
            <p className="text-sm text-gray-400 mt-1">
              If the opposing_account column value exactly matches one of your account names, the transaction is automatically created as a Transfer.
            </p>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
      {children}
    </div>
  )
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-gray-800/50 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm text-gray-200">{value}</span>
    </div>
  )
}

// ── Keyword Rules ─────────────────────────────────────────────────────────────
function KeywordRulesView({ categories }: { categories: Category[] }) {
  const [rules, setRules] = useState<any[]>([])
  const [keyword, setKeyword] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const load = () => importApi.keywordRules().then(r => setRules(r.data))
  useEffect(() => { load() }, [])
  const addRule = async () => {
    if (!keyword || !categoryId) return
    await importApi.createKeywordRule({ keyword, categoryId: +categoryId, priority: 0 })
    setKeyword(''); setCategoryId(''); load()
  }
  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h2 className="font-semibold text-white">Keyword Rules</h2>
        <p className="text-sm text-gray-400">Transactions matching the keyword are auto-categorized during import.</p>
        <div className="flex gap-3 flex-wrap">
          <input className="input flex-1 min-w-48" placeholder="e.g. Albert Heijn, NS , Netflix"
            value={keyword} onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addRule() }}/>
          <select className="select flex-1 min-w-48" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
            <option value="">Select category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <button onClick={addRule} disabled={!keyword || !categoryId} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4"/> Add
          </button>
        </div>
      </div>
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
            <th className="p-3 text-left">Keyword</th>
            <th className="p-3 text-left">Category</th>
            <th className="p-3 w-12"/>
          </tr></thead>
          <tbody>
            {rules.length === 0 ? (
              <tr><td colSpan={3} className="p-6 text-center text-gray-600">No keyword rules yet</td></tr>
            ) : rules.map(rule => (
              <tr key={rule.id} className="border-b border-gray-800/50 hover:bg-gray-900/30">
                <td className="p-3 font-mono text-indigo-300">{rule.keyword}</td>
                <td className="p-3 text-gray-300">{rule.category?.icon} {rule.category?.name}</td>
                <td className="p-3">
                  <button onClick={async () => { await importApi.deleteKeywordRule(rule.id); load() }}
                    className="text-gray-600 hover:text-red-400"><Trash2 className="w-4 h-4"/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Import History ────────────────────────────────────────────────────────────
function ImportHistoryView() {
  const [batches, setBatches] = useState<any[]>([])
  useEffect(() => { importApi.batches().then(r => setBatches(r.data)) }, [])
  return (
    <div className="card p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
          <th className="p-3 text-left">Date</th>
          <th className="p-3 text-left">File</th>
          <th className="p-3 text-right">Imported</th>
          <th className="p-3 text-right">Skipped</th>
          <th className="p-3 text-left">Status</th>
        </tr></thead>
        <tbody>
          {batches.length === 0 ? (
            <tr><td colSpan={5} className="p-6 text-center text-gray-600">No import history</td></tr>
          ) : batches.map(b => (
            <tr key={b.id} className="border-b border-gray-800/50">
              <td className="p-3 text-gray-400">{new Date(b.createdAt).toLocaleDateString()}</td>
              <td className="p-3 text-white">{b.filename}</td>
              <td className="p-3 text-right text-green-400">{b.importedRows}</td>
              <td className="p-3 text-right text-yellow-400">{b.skippedRows}</td>
              <td className="p-3">
                <span className={`text-xs px-2 py-0.5 rounded-full ${b.status === 'done' ? 'bg-green-900/40 text-green-400' : 'bg-yellow-900/40 text-yellow-400'}`}>
                  {b.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
