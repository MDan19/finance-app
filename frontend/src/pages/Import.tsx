import { useState, useRef, useEffect } from 'react'
import { Upload, Plus, Trash2, Check, FileText, AlertCircle, Info } from 'lucide-react'
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
      setStep('map')
    } catch { setError('Failed to parse file') }
    finally { setLoading(false) }
  }

  const handleImport = async () => {
    if (!file || !accountId) return
    setLoading(true)
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
          {/* Step indicators */}
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

          {step === 'upload' && (
            <div className="card space-y-4">
              <div className="flex items-start gap-3 p-3 bg-indigo-900/20 border border-indigo-800/40 rounded-lg">
                <Info className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5"/>
                <p className="text-sm text-indigo-300">
                  Supports standard CSV and Firefly III export format.
                  See the <button onClick={() => setTab('guide')} className="underline hover:text-white">Format Guide</button> for details.
                </p>
              </div>

              <div
                className="border-2 border-dashed border-gray-700 rounded-xl p-12 text-center cursor-pointer hover:border-indigo-500 transition-colors"
                onClick={() => fileRef.current?.click()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileChange(f) }}
                onDragOver={e => e.preventDefault()}
              >
                <Upload className="w-12 h-12 text-gray-600 mx-auto mb-3"/>
                <p className="text-gray-400">Drop CSV file here or <span className="text-indigo-400">click to browse</span></p>
                <p className="text-sm text-gray-600 mt-1">Max 10MB</p>
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
              {loading && <p className="text-indigo-400 text-sm">Parsing file...</p>}
            </div>
          )}

          {step === 'map' && preview && (
            <div className="space-y-4">
              <div className="card space-y-4">
                <h2 className="font-semibold text-white">Map Columns</h2>
                <p className="text-sm text-gray-400">
                  File: <span className="text-white">{file?.name}</span> · {preview.totalRows} rows
                </p>

                <div>
                  <label className="label">Account (this file belongs to)</label>
                  <select className="select" value={accountId} onChange={e => setAccountId(e.target.value)}>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>

                {/* Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Date column</label>
                    <select className="select" value={columnMap.date} onChange={e => setColumnMap(m => ({ ...m, date: e.target.value }))}>
                      <option value="">— select —</option>
                      {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Description column</label>
                    <select className="select" value={columnMap.description} onChange={e => setColumnMap(m => ({ ...m, description: e.target.value }))}>
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
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${amountMode === 'single' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}>
                      Single column<br/>
                      <span className="text-xs font-normal opacity-70">-148.29 / +17.10</span>
                    </button>
                    <button onClick={() => setAmountMode('two')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${amountMode === 'two' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}>
                      Two columns<br/>
                      <span className="text-xs font-normal opacity-70">amount_debit / amount_credit</span>
                    </button>
                  </div>
                </div>

                {amountMode === 'single' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Amount column</label>
                      <select className="select" value={columnMap.amount} onChange={e => setColumnMap(m => ({ ...m, amount: e.target.value }))}>
                        <option value="">— select —</option>
                        {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Currency column (optional)</label>
                      <select className="select" value={columnMap.currency} onChange={e => setColumnMap(m => ({ ...m, currency: e.target.value }))}>
                        <option value="">— none —</option>
                        {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Debit column (expenses ↑)</label>
                      <select className="select" value={columnMap.amountDebit} onChange={e => setColumnMap(m => ({ ...m, amountDebit: e.target.value }))}>
                        <option value="">— select —</option>
                        {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Credit column (income ↓)</label>
                      <select className="select" value={columnMap.amountCredit} onChange={e => setColumnMap(m => ({ ...m, amountCredit: e.target.value }))}>
                        <option value="">— select —</option>
                        {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {/* Opposing account */}
                <div>
                  <label className="label">Opposing account column (optional — for auto Transfer detection)</label>
                  <select className="select" value={columnMap.opposingAccount} onChange={e => setColumnMap(m => ({ ...m, opposingAccount: e.target.value }))}>
                    <option value="">— none —</option>
                    {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <p className="text-xs text-gray-600 mt-1">
                    If this matches the name of one of your accounts, the transaction will be created as a Transfer
                  </p>
                </div>
              </div>

              {/* Preview table */}
              <div className="card p-0 overflow-hidden">
                <div className="p-3 border-b border-gray-800">
                  <p className="text-sm font-medium text-gray-400">Preview (first 20 rows)</p>
                </div>
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-900">
                      <tr>{preview.headers.map(h => <th key={h} className="p-2 text-left text-gray-500 border-b border-gray-800 whitespace-nowrap">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, i) => (
                        <tr key={i} className="border-b border-gray-800/50">
                          {preview.headers.map(h => <td key={h} className="p-2 text-gray-300 whitespace-nowrap">{row[h]}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {error && <p className="text-red-400 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4"/>{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => setStep('upload')} className="btn-secondary">Back</button>
                <button
                  onClick={handleImport}
                  disabled={loading || !columnMap.date || (!columnMap.amount && amountMode === 'single') || (!columnMap.amountDebit && amountMode === 'two')}
                  className="btn-primary flex-1"
                >
                  {loading ? 'Importing...' : `Import ${preview.totalRows} rows`}
                </button>
              </div>
            </div>
          )}

          {step === 'result' && result && (
            <div className="card space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-900/40 rounded-full flex items-center justify-center">
                  <Check className="w-6 h-6 text-green-400"/>
                </div>
                <div>
                  <h2 className="font-semibold text-white">Import Complete</h2>
                  <p className="text-sm text-gray-400">Your transactions have been imported</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Imported', value: result.imported, color: 'text-green-400', bg: 'bg-green-900/20 border-green-800/40' },
                  { label: 'Transfers', value: result.transfers || 0, color: 'text-blue-400', bg: 'bg-blue-900/20 border-blue-800/40' },
                  { label: 'Skipped (dup)', value: result.skipped, color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-800/40' },
                  { label: 'Need category', value: result.needsCategory, color: 'text-orange-400', bg: 'bg-orange-900/20 border-orange-800/40' },
                ].map(s => (
                  <div key={s.label} className={`border rounded-lg p-3 text-center ${s.bg}`}>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setStep('upload'); setFile(null); setPreview(null); setResult(null) }} className="btn-secondary flex-1">
                  Import Another
                </button>
                <a href="/transactions" className="btn-primary flex-1 text-center">View Transactions</a>
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

// ── Format Guide ─────────────────────────────────────────────────────────────

function FormatGuide() {
  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-400"/> CSV Format Requirements
        </h2>

        <div className="space-y-4">
          {/* General */}
          <Section title="General">
            <Row label="File type" value=".csv or .txt"/>
            <Row label="Encoding" value="UTF-8 (recommended) or Windows-1252"/>
            <Row label="Max size" value="10 MB"/>
            <Row label="First row" value="Must be column headers"/>
            <Row label="Delimiter" value="Comma (,) or Semicolon (;) or Tab — select at upload"/>
          </Section>

          {/* Dates */}
          <Section title="📅 Date formats — all supported">
            <div className="grid grid-cols-2 gap-2 mt-2">
              {[
                ['15.01.2026', '✅ DD.MM.YYYY (most common in NL/EU)'],
                ['2026-01-15', '✅ YYYY-MM-DD (ISO standard)'],
                ['15/01/2026', '✅ DD/MM/YYYY'],
                ['01/15/2026', '✅ MM/DD/YYYY (US format)'],
                ['15-01-2026', '✅ DD-MM-YYYY'],
                ['15 Jan 2026', '✅ DD Mon YYYY'],
              ].map(([fmt, desc]) => (
                <div key={fmt} className="flex items-center gap-2 bg-gray-800/50 rounded px-3 py-2">
                  <code className="text-indigo-300 text-xs font-mono w-28">{fmt}</code>
                  <span className="text-xs text-gray-400">{desc}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* Amounts */}
          <Section title="💶 Amount formats — all supported">
            <div className="grid grid-cols-2 gap-2 mt-2">
              {[
                ['148,29', 'European decimal comma'],
                ['1 052,55', 'Thousands space + decimal comma'],
                ['1.052,55', 'Thousands dot + decimal comma'],
                ['148.29', 'Standard decimal dot'],
                ['1,052.55', 'Thousands comma + decimal dot'],
                ['-148,29', 'Negative = expense (single column)'],
                ['+17,10', 'Positive = income (single column)'],
              ].map(([fmt, desc]) => (
                <div key={fmt} className="flex items-center gap-2 bg-gray-800/50 rounded px-3 py-2">
                  <code className="text-indigo-300 text-xs font-mono w-24">{fmt}</code>
                  <span className="text-xs text-gray-400">{desc}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* Two column amounts */}
          <Section title="📊 Two-column amount format (Firefly III / ABN AMRO style)">
            <p className="text-sm text-gray-400 mb-3">
              If your bank exports separate debit and credit columns, select <strong className="text-white">"Two columns"</strong> in the mapping step.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-800">
                    <th className="p-2 text-left text-gray-400 border border-gray-700">date</th>
                    <th className="p-2 text-left text-gray-400 border border-gray-700">assets_account</th>
                    <th className="p-2 text-left text-gray-400 border border-gray-700">opposing_account</th>
                    <th className="p-2 text-left text-gray-400 border border-gray-700">amount_credit</th>
                    <th className="p-2 text-left text-gray-400 border border-gray-700">amount_debit</th>
                    <th className="p-2 text-left text-gray-400 border border-gray-700">description</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['15.01.2026', 'ABN AMRO (EUR)', '', '', '148,29', 'Albert Heijn'],
                    ['04.02.2026', 'ABN AMRO (EUR)', '', '17,10', '', 'Refund'],
                    ['01.02.2026', 'ABN AMRO (EUR)', 'ABN AMRO - Loan', '', '740,66', 'Loan payment'],
                  ].map((row, i) => (
                    <tr key={i} className="border border-gray-700">
                      {row.map((cell, j) => <td key={j} className={`p-2 border border-gray-700 font-mono ${cell ? 'text-gray-300' : 'text-gray-700'}`}>{cell || '—'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 space-y-1 text-xs text-gray-400">
              <p>• <strong className="text-white">amount_debit</strong> = money going out (expense) → imported as Expense</p>
              <p>• <strong className="text-white">amount_credit</strong> = money coming in → imported as Income</p>
              <p>• <strong className="text-white">opposing_account</strong> = if it matches one of your account names → imported as Transfer</p>
            </div>
          </Section>

          {/* Opposing account / Transfer */}
          <Section title="🔄 Automatic Transfer detection">
            <p className="text-sm text-gray-400">
              If you map the <code className="text-indigo-300 bg-gray-800 px-1 rounded">opposing_account</code> column,
              the importer will check if that value matches any of your account names.
              If it matches — the transaction is automatically created as a <strong className="text-white">Transfer</strong> between the two accounts.
            </p>
            <div className="mt-3 p-3 bg-gray-800/50 rounded-lg text-xs space-y-1">
              <p className="text-gray-400">Example: opposing_account = <code className="text-yellow-300">"ABN AMRO - Personal Loan"</code></p>
              <p className="text-gray-400">You have an account named <code className="text-yellow-300">"ABN AMRO - Personal Loan"</code></p>
              <p className="text-green-400">→ Imported as Transfer from current account to that loan account ✅</p>
            </div>
          </Section>

          {/* Tips */}
          <Section title="💡 Tips">
            <ul className="space-y-2 text-sm text-gray-400">
              <li>• Duplicate transactions (same date + amount + description) are automatically skipped</li>
              <li>• Set up <strong className="text-white">Keyword Rules</strong> to auto-categorize — e.g. "Albert Heijn" → Groceries</li>
              <li>• You can import the same file multiple times safely — duplicates are detected</li>
              <li>• After import, use bulk re-categorize to fix uncategorized transactions</li>
              <li>• The <strong className="text-white">assets_account</strong> column is ignored — you select the account manually</li>
            </ul>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-800/50 last:border-0">
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
        <h2 className="font-semibold text-white">Add Keyword Rule</h2>
        <p className="text-sm text-gray-400">
          Transactions whose description contains the keyword will be auto-categorized during import.
        </p>
        <div className="flex gap-3 flex-wrap">
          <input className="input flex-1 min-w-48" placeholder="Keyword (e.g. Albert Heijn, NS , Netflix)" value={keyword} onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addRule() }}/>
          <select className="select flex-1 min-w-48" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
            <option value="">Select category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <button onClick={addRule} disabled={!keyword || !categoryId} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4"/> Add Rule
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
              <tr><td colSpan={3} className="p-6 text-center text-gray-600">No keyword rules yet. Add some to speed up categorization.</td></tr>
            ) : rules.map(rule => (
              <tr key={rule.id} className="border-b border-gray-800/50 hover:bg-gray-900/30">
                <td className="p-3 font-mono text-indigo-300">{rule.keyword}</td>
                <td className="p-3 text-gray-300">{rule.category?.icon} {rule.category?.name}</td>
                <td className="p-3">
                  <button onClick={async () => { await importApi.deleteKeywordRule(rule.id); load() }} className="text-gray-600 hover:text-red-400">
                    <Trash2 className="w-4 h-4"/>
                  </button>
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
          <th className="p-3 text-left">Account</th>
          <th className="p-3 text-right">Imported</th>
          <th className="p-3 text-right">Skipped</th>
        </tr></thead>
        <tbody>
          {batches.length === 0 ? (
            <tr><td colSpan={5} className="p-6 text-center text-gray-600">No import history</td></tr>
          ) : batches.map(b => (
            <tr key={b.id} className="border-b border-gray-800/50">
              <td className="p-3 text-gray-400">{new Date(b.createdAt).toLocaleDateString()}</td>
              <td className="p-3 text-white">{b.filename}</td>
              <td className="p-3 text-gray-300">{b.account?.name || '—'}</td>
              <td className="p-3 text-right text-green-400">{b.importedRows}</td>
              <td className="p-3 text-right text-yellow-400">{b.skippedRows}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
