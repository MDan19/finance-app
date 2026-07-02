import { useEffect, useState } from 'react'
import { ArrowUpRight, ArrowDownRight, Calendar, TrendingUp, TrendingDown } from 'lucide-react'
import { analyticsApi, accountsApi, scheduledApi } from '../api'
import { Account, ScheduledPayment } from '../types'
import { formatEur, formatCurrency, getAccountIcon, getAccountTypeLabel } from '../utils/format'
import DashboardPlanTable from '../components/plan-fact-table/DashboardPlanTable'

type DashTab = 'plan' | 'accounts'

const ASSETS = ['BANK', 'CASH', 'PERSONAL_CREDIT']
const LIABILITIES = ['CREDIT_CARD', 'LOAN_CONSUMER', 'LOAN_AUTO', 'MORTGAGE', 'PERSONAL_DEBT']

export default function Dashboard() {
  const [tab, setTab] = useState<DashTab>('plan')
  const [netWorth, setNetWorth] = useState<any>(null)
  const [thisMonth, setThisMonth] = useState<any>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [upcoming, setUpcoming] = useState<ScheduledPayment[]>([])
  const [buckets, setBuckets] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      analyticsApi.netWorth(),
      analyticsApi.thisMonth(),
      accountsApi.list(),
      scheduledApi.upcoming(14),
      analyticsApi.bucketCompliance(),
    ]).then(([nw, tm, acc, up, bk]) => {
      setNetWorth(nw.data)
      setThisMonth(tm.data)
      setAccounts(acc.data)
      setUpcoming(up.data)
      setBuckets(bk.data)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-24 rounded-xl" style={{ background: 'var(--bg-card)' }}/>
      <div className="h-64 rounded-xl" style={{ background: 'var(--bg-card)' }}/>
    </div>
  )

  const activeAccounts = accounts.filter(a => a.isActive)
  const assetAccounts = activeAccounts.filter(a => ASSETS.includes(a.type))
  const liabilityAccounts = activeAccounts.filter(a => LIABILITIES.includes(a.type))

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--brand)' }}>Dashboard</h1>
      </div>

      {/* Net Worth bar */}
      <div className="card">
        <div className="flex flex-wrap gap-6 items-center justify-between">
          <div>
            <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Net Worth</p>
            <p className={`text-4xl font-bold ${(netWorth?.netWorth ?? 0) >= 0 ? 'text-green-500' : 'text-red-400'}`}>
              {formatEur(netWorth?.netWorth ?? 0)}
            </p>
          </div>
          <div className="flex gap-8">
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Assets</p>
              <p className="text-xl font-semibold text-green-500">{formatEur(netWorth?.totalAssets ?? 0)}</p>
            </div>
            <div className="w-px" style={{ background: 'var(--border)' }}/>
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Liabilities</p>
              <p className="text-xl font-semibold text-red-400">{formatEur(netWorth?.totalLiabilities ?? 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar w-fit">
        <button onClick={() => setTab('plan')} className={`tab-btn${tab === 'plan' ? ' active' : ''}`}>
          📊 Plan / Fact
        </button>
        <button onClick={() => setTab('accounts')} className={`tab-btn${tab === 'accounts' ? ' active' : ''}`}>
          🏦 Accounts
        </button>
      </div>

      {/* TAB: Plan/Fact */}
      {tab === 'plan' && (
        <div className="space-y-5">
          <DashboardPlanTable />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* This Month */}
            <div className="card">
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                This Month
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4 text-green-500"/>
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Income</span>
                  </div>
                  <span className="text-green-500 font-medium">{formatEur(thisMonth?.income ?? 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <ArrowDownRight className="w-4 h-4 text-red-400"/>
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Expenses</span>
                  </div>
                  <span className="text-red-400 font-medium">{formatEur(thisMonth?.expense ?? 0)}</span>
                </div>
                <div className="pt-2 flex justify-between items-center" style={{ borderTop: '1px solid var(--border)' }}>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Balance</span>
                  <span className={`font-bold ${(thisMonth?.balance ?? 0) >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                    {formatEur(thisMonth?.balance ?? 0)}
                  </span>
                </div>
              </div>
              {thisMonth?.topCategories?.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Top Categories</p>
                  <div className="space-y-2">
                    {thisMonth.topCategories.map((tc: any) => (
                      <div key={tc.category?.id} className="flex items-center gap-2">
                        <span className="text-base">{tc.category?.icon}</span>
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-0.5">
                            <span style={{ color: 'var(--text-secondary)' }}>{tc.category?.name}</span>
                            <span style={{ color: 'var(--text-primary)' }}>{formatEur(tc.amount)}</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                            <div className="h-full rounded-full"
                              style={{ width: `${Math.min(100,(tc.amount/(thisMonth?.expense||1))*100)}%`, backgroundColor: tc.category?.color||'#6366f1' }}/>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Upcoming */}
            <div className="card">
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                <Calendar className="w-4 h-4"/> Upcoming (14 days)
              </h2>
              {upcoming.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No upcoming payments</p>
              ) : (
                <div className="space-y-2">
                  {upcoming.map(p => (
                    <div key={p.id} className="flex justify-between items-center py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>in {p.diffDays}d</p>
                      </div>
                      <span className="text-sm font-medium text-red-400">{formatCurrency(p.amount, p.currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Budget Rule */}
            {buckets?.buckets?.length > 0 && (
              <div className="card">
                <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                  Budget Rule
                </h2>
                <div className="space-y-3">
                  {buckets.buckets.map((bucket: any) => {
                    const pct = Math.min(100, bucket.percentUsed)
                    const color = pct < 80 ? '#22c55e' : pct < 100 ? '#f59e0b' : '#ef4444'
                    return (
                      <div key={bucket.id}>
                        <div className="flex justify-between text-xs mb-1">
                          <span style={{ color: 'var(--text-secondary)' }}>{bucket.name} ({Number(bucket.targetPercent)}%)</span>
                          <span style={{ color }}>{formatEur(bucket.spent)} / {formatEur(bucket.budgeted)}</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }}/>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: Accounts */}
      {tab === 'accounts' && (
        <div className="space-y-5">
          {/* Assets */}
          {assetAccounts.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-green-500 flex items-center gap-2">
                <TrendingUp className="w-4 h-4"/> Assets
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {assetAccounts.map(acc => <AccountCard key={acc.id} account={acc}/>)}
              </div>
            </div>
          )}

          {/* Liabilities */}
          {liabilityAccounts.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-red-400 flex items-center gap-2">
                <TrendingDown className="w-4 h-4"/> Liabilities
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {liabilityAccounts.map(acc => <AccountCard key={acc.id} account={acc}/>)}
              </div>
            </div>
          )}

          {accounts.length === 0 && (
            <div className="card text-center py-12">
              <p style={{ color: 'var(--text-muted)' }}>No accounts yet. Go to <a href="/accounts" className="text-indigo-500 underline">Accounts</a> to add your first account.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AccountCard({ account }: { account: Account }) {
  const isLiability = ['CREDIT_CARD','LOAN_CONSUMER','LOAN_AUTO','MORTGAGE','PERSONAL_DEBT'].includes(account.type)

  const getMainValue = () => {
    if (account.type === 'CREDIT_CARD') return Number(account.currentDebt ?? 0)
    if (['LOAN_CONSUMER','LOAN_AUTO','MORTGAGE'].includes(account.type)) return Number(account.remainingAmount ?? 0)
    return Number(account.currentBalance ?? 0)
  }

  const value = getMainValue()

  return (
    <div className="card-hover">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{account.name}</p>
          {account.institution && <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{account.institution}</p>}
        </div>
        <span className="text-xl ml-2">{getAccountIcon(account.type)}</span>
      </div>

      <p className={`text-xl font-bold ${isLiability ? 'text-red-400' : 'text-green-500'}`}>
        {formatCurrency(value, account.currency)}
      </p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{getAccountTypeLabel(account.type)}</p>

      {account.type === 'CREDIT_CARD' && account.creditLimit && (
        <div className="mt-2">
          <div className="flex justify-between text-xs mb-1">
            <span style={{ color: 'var(--text-muted)' }}>Used</span>
            <span style={{ color: 'var(--text-secondary)' }}>{formatCurrency(Number(account.creditLimit)-value, account.currency)} avail.</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
            <div className="h-full rounded-full"
              style={{ width: `${Math.min(100,(value/Number(account.creditLimit))*100)}%`, backgroundColor: value > Number(account.creditLimit)*0.8 ? '#ef4444' : '#6366f1' }}/>
          </div>
        </div>
      )}

      {['LOAN_CONSUMER','LOAN_AUTO','MORTGAGE'].includes(account.type) && account.monthlyPayment && (
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          {formatCurrency(Number(account.monthlyPayment), account.currency)}/mo
          {account.interestRate && ` · ${Number(account.interestRate)}%`}
        </p>
      )}

      {['PERSONAL_DEBT','PERSONAL_CREDIT'].includes(account.type) && account.counterpartyName && (
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          {account.type === 'PERSONAL_DEBT' ? '→' : '←'} {account.counterpartyName}
        </p>
      )}
    </div>
  )
}
