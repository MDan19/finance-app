import { useState, useRef } from 'react'
import { Upload, Plus, Trash2, Check } from 'lucide-react'
import { importApi, categoriesApi } from '../api'
import { Category } from '../types'
import { useEffect } from 'react'
import { accountsApi } from '../api'
import { Account } from '../types'

type Step = 'upload' | 'map' | 'result'

export default function Import() {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [delimiter, setDelimiter] = useState(',')
  const [preview, setPreview] = useState<{ headers: string[]; rows: any[]; totalRows: number } | null>(null)
  const [columnMap, setColumnMap] = useState<Record<string, string>>({ date: '', amount: '', description: '', currency: '' })
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accountId, setAccountId] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'import' | 'rules' | 'history'>('import')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    accountsApi.list().then(r => { setAccounts(r.data); if (r.data[0]) setAccountId(r.data[0].id.toString()) })
    categoriesApi.all().then(r => setCategories(r.data))
  }, [])

  const handleFileChange = async (f: File) => {
    setFile(f)
    setError('')
    setLoading(true)
    try {
      const res = await importApi.preview(f, delimiter)
      setPreview(res.data)
      setStep('map')
    } catch {
      setError('Failed to parse file')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!file || !accountId) return
    setLoading(true)
    try {
      const res = await importApi.execute(file, {
        accountId,
        columnMap,
        delimiter,
      })
      setResult(res.data)
      setStep('result')
    } catch (e: any) {
      setError(e.response?.data?.error || 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white">CSV Import</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit">
        {(['import', 'rules', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize ${tab === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >{t === 'rules' ? 'Keyword Rules' : t}</button>
        ))}
      </div>

      {tab === 'import' && (
        <div className="space-y-6">
          {/* Step indicators */}
          <div className="flex items-center gap-3">
            {(['upload', 'map', 'result'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${step === s ? 'bg-indigo-600 text-white' : ['upload','map','result'].indexOf(step) > i ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-500'}`}>
                  {(['upload','map','result'].indexOf(step) > i) ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-sm ${step === s ? 'text-white' : 'text-gray-500'}`}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
                {i < 2 && <div className="w-8 h-px bg-gray-700" />}
              </div>
            ))}
          </div>

          {step === 'upload' && (
            <div className="card space-y-4">
              <h2 className="font-semibold text-white">Upload CSV File</h2>
              <div
                className="border-2 border-dashed border-gray-700 rounded-xl p-12 text-center cursor-pointer hover:border-indigo-500 transition-colors"
                onClick={() => fileRef.current?.click()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileChange(f) }}
                onDragOver={e => e.preventDefault()}
              >
                <Upload className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">Drop CSV file here or <span className="text-indigo-400">click to browse</span></p>
                <p className="text-sm text-gray-600 mt-1">Supports CSV files up to 10MB</p>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFileChange(e.target.files[0]) }} />
              </div>
              <div className="flex items-center gap-3">
                <label className="label mb-0 whitespace-nowrap">Delimiter</label>
                <select className="select w-auto" value={delimiter} onChange={e => setDelimiter(e.target.value)}>
                  <option value=",">, (comma)</option>
                  <option value=";">; (semicolon)</option>
                  <option value="\t">Tab</option>
                </select>
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              {loading && <p className="text-indigo-400 text-sm">Parsing file...</p>}
            </div>
          )}

          {step === 'map' && preview && (
            <div className="space-y-4">
              <div className="card space-y-4">
                <h2 className="font-semibold text-white">Map Columns</h2>
                <p className="text-sm text-gray-400">File: <span className="text-white">{file?.name}</span> · {preview.totalRows} rows detected</p>

                <div>
                  <label className="label">Account</label>
                  <select className="select" value={accountId} onChange={e => setAccountId(e.target.value)}>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {(['date', 'amount', 'description', 'currency'] as const).map(field => (
                    <div key={field}>
                      <label className="label capitalize">{field} column</label>
                      <select className="select" value={columnMap[field]} onChange={e => setColumnMap(m => ({ ...m, [field]: e.target.value }))}>
                        <option value="">— select —</option>
                        {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ))}
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
                      <tr>{preview.headers.map(h => <th key={h} className="p-2 text-left text-gray-500 border-b border-gray-800">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, i) => (
                        <tr key={i} className="border-b border-gray-800/50">
                          {preview.headers.map(h => <td key={h} className="p-2 text-gray-300">{row[h]}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => setStep('upload')} className="btn-secondary">Back</button>
                <button onClick={handleImport} disabled={loading || !columnMap.date || !columnMap.amount} className="btn-primary flex-1">
                  {loading ? 'Importing...' : `Import ${preview.totalRows} rows`}
                </button>
              </div>
            </div>
          )}

          {step === 'result' && result && (
            <div className="card space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-900/40 rounded-full flex items-center justify-center">
                  <Check className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-white">Import Complete</h2>
                  <p className="text-sm text-gray-400">Your transactions have been imported</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-900/20 border border-green-800/40 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-400">{result.imported}</p>
                  <p className="text-xs text-gray-500">Imported</p>
                </div>
                <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-400">{result.skipped}</p>
                  <p className="text-xs text-gray-500">Skipped (duplicates)</p>
                </div>
                <div className="bg-orange-900/20 border border-orange-800/40 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-orange-400">{result.needsCategory}</p>
                  <p className="text-xs text-gray-500">Need category</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setStep('upload'); setFile(null); setPreview(null); setResult(null) }} className="btn-secondary flex-1">Import Another</button>
                <a href="/transactions" className="btn-primary flex-1 text-center">View Transactions</a>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'rules' && <KeywordRulesView categories={categories} />}
      {tab === 'history' && <ImportHistoryView />}
    </div>
  )
}

function KeywordRulesView({ categories }: { categories: Category[] }) {
  const [rules, setRules] = useState<any[]>([])
  const [keyword, setKeyword] = useState('')
  const [categoryId, setCategoryId] = useState('')

  const load = () => importApi.keywordRules().then(r => setRules(r.data))
  useEffect(() => { load() }, [])

  const addRule = async () => {
    if (!keyword || !categoryId) return
    await importApi.createKeywordRule({ keyword, categoryId: +categoryId, priority: 0 })
    setKeyword(''); setCategoryId('')
    load()
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h2 className="font-semibold text-white">Add Keyword Rule</h2>
        <p className="text-sm text-gray-400">Transactions matching the keyword will be auto-categorized during import.</p>
        <div className="flex gap-3">
          <input className="input" placeholder="Keyword (e.g. Albert Heijn)" value={keyword} onChange={e => setKeyword(e.target.value)} />
          <select className="select" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
            <option value="">Category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <button onClick={addRule} className="btn-primary whitespace-nowrap flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
            <th className="p-3 text-left">Keyword</th>
            <th className="p-3 text-left">Category</th>
            <th className="p-3 w-12"></th>
          </tr></thead>
          <tbody>
            {rules.length === 0 ? (
              <tr><td colSpan={3} className="p-6 text-center text-gray-600">No keyword rules yet</td></tr>
            ) : rules.map(rule => (
              <tr key={rule.id} className="border-b border-gray-800/50">
                <td className="p-3 font-mono text-indigo-300">{rule.keyword}</td>
                <td className="p-3">{rule.category?.icon} {rule.category?.name}</td>
                <td className="p-3">
                  <button onClick={async () => { await importApi.deleteKeywordRule(rule.id); load() }} className="text-gray-600 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
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

function ImportHistoryView() {
  const [batches, setBatches] = useState<any[]>([])
  useEffect(() => { importApi.batches().then(r => setBatches(r.data)) }, [])

  return (
    <div className="card p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
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
              <td className="p-3 text-gray-300">{b.account?.name}</td>
              <td className="p-3 text-right text-green-400">{b.importedRows}</td>
              <td className="p-3 text-right text-yellow-400">{b.skippedRows}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
