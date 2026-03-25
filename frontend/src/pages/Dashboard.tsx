import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Wallet, AlertCircle, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { analyticsApi, accountsApi, scheduledApi } from '../api'
import { Account, ScheduledPayment } from '../types'
import { formatEur, formatCurrency, getAccountIcon, getAccountTypeLabel } from '../utils/format'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function Dashboard() {
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

  if (loading) return <LoadingSkeleton />

  const bankAccounts = accounts.filter(a => a.type === 'BANK' || a.type === 'CASH')
  const creditCards = accounts.filter(a => a.type === 'CREDIT_CARD')
  const loans = accounts.filter(a => ['LOAN_CONSUMER','LOAN_AUTO','MORTGAGE'].includes(a.type))
  const personalDebts = accounts.filter(a => a.type === 'PERSONAL_DEBT')
  const personalCredits = accounts.filter(a => a.type === 'PERSONAL_CREDIT')

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>

      {/* Net Worth Bar */}
      <div className="card">
        <div className="flex flex-wrap gap-6 items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">Net Worth</p>
            <p className={`text-4xl font-bold ${(netWorth?.netWorth ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatEur(netWorth?.netWorth ?? 0)}
            </p>
          </div>
          <div className="flex gap-8">
            <div>
              <p className="text-xs text-gray-500 mb-1">Assets</p>
              <p className="text-xl font-semibold text-green-400">{formatEur(netWorth?.totalAssets ?? 0)}</p>
            </div>
            <div className="w-px bg-gray-700" />
            <div>
              <p className="text-xs text-gray-500 mb-1">Liabilities</p>
              <p className="text-xl font-semibold text-red-400">{formatEur(netWorth?.totalLiabilities ?? 0)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Accounts */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-white">Accounts</h2>

          {/* Bank & Cash */}
          {bankAccounts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Bank & Cash</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {bankAccounts.map(acc => (
                  <AccountCard key={acc.id} account={acc} />
                ))}
              </div>
            </div>
          )}

          {/* Credit Cards */}
          {creditCards.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Credit Cards</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {creditCards.map(acc => (
                  <CreditCardCard key={acc.id} account={acc} />
                ))}
              </div>
            </div>
          )}

          {/* Loans & Mortgage */}
          {loans.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Loans & Mortgage</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {loans.map(acc => (
                  <LoanCard key={acc.id} account={acc} />
                ))}
              </div>
            </div>
          )}

          {/* Personal */}
          {(personalDebts.length > 0 || personalCredits.length > 0) && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Personal Debts & Credits</p>
              <div className="card space-y-2">
                {personalDebts.map(acc => (
                  <div key={acc.id} className="flex justify-between items-center py-1.5 border-b border-gray-800 last:border-0">
                    <div>
                      <p className="text-sm text-red-400">Owe to: {acc.counterpartyName}</p>
                      <p className="text-xs text-gray-500">{acc.institution || acc.name}</p>
                    </div>
                    <p className="text-sm font-medium text-red-400">{formatCurrency(acc.currentBalance, acc.currency)}</p>
                  </div>
                ))}
                {personalCredits.map(acc => (
                  <div key={acc.id} className="flex justify-between items-center py-1.5 border-b border-gray-800 last:border-0">
                    <div>
                      <p className="text-sm text-green-400">Lent to: {acc.counterpartyName}</p>
                      <p className="text-xs text-gray-500">{acc.institution || acc.name}</p>
                    </div>
                    <p className="text-sm font-medium text-green-400">{formatCurrency(acc.currentBalance, acc.currency)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {accounts.length === 0 && (
            <div className="card text-center py-12">
              <Wallet className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500">No accounts yet.</p>
              <p className="text-sm text-gray-600">Go to Settings → Accounts to add your first account.</p>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* This Month */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">This Month</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-gray-400">Income</span>
                </div>
                <span className="text-green-400 font-medium">{formatEur(thisMonth?.income ?? 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ArrowDownRight className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-gray-400">Expenses</span>
                </div>
                <span className="text-red-400 font-medium">{formatEur(thisMonth?.expense ?? 0)}</span>
              </div>
              <div className="border-t border-gray-800 pt-3 flex justify-between items-center">
                <span className="text-sm font-medium text-white">Balance</span>
                <span className={`font-bold ${(thisMonth?.balance ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatEur(thisMonth?.balance ?? 0)}
                </span>
              </div>
            </div>

            {/* Top categories mini chart */}
            {thisMonth?.topCategories?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-2">Top Categories</p>
                <div className="space-y-2">
                  {thisMonth.topCategories.map((tc: any) => (
                    <div key={tc.category?.id} className="flex items-center gap-2">
                      <span className="text-base">{tc.category?.icon}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-gray-400">{tc.category?.name}</span>
                          <span className="text-gray-300">{formatEur(tc.amount)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, (tc.amount / (thisMonth?.expense || 1)) * 100)}%`,
                              backgroundColor: tc.category?.color || '#6366f1'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Upcoming Payments */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Upcoming (14 days)
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-gray-600">No upcoming payments</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map(p => (
                  <div key={p.id} className="flex justify-between items-center py-1.5 border-b border-gray-800 last:border-0">
                    <div>
                      <p className="text-sm text-white">{p.name}</p>
                      <p className="text-xs text-gray-500">
                        {p.account?.name} · in {p.diffDays}d
                      </p>
                    </div>
                    <span className="text-sm font-medium text-red-400">
                      {formatCurrency(p.amount, p.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Budget Rule Compliance */}
          {buckets?.buckets?.length > 0 && (
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Budget Rule ({buckets.buckets.map((b: any) => Math.round(Number(b.targetPercent))).join('/')})
              </h2>
              <div className="space-y-3">
                {buckets.buckets.map((bucket: any) => {
                  const pct = Math.min(100, bucket.percentUsed)
                  const color = pct < 80 ? '#22c55e' : pct < 100 ? '#f59e0b' : '#ef4444'
                  return (
                    <div key={bucket.id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">{bucket.name} ({Number(bucket.targetPercent)}%)</span>
                        <span style={{ color }}>{formatEur(bucket.spent)} / {formatEur(bucket.budgeted)}</span>
                      </div>
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AccountCard({ account }: { account: Account }) {
  return (
    <div className="card hover:border-gray-700 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-medium text-white text-sm">{account.name}</p>
          {account.institution && <p className="text-xs text-gray-500">{account.institution}</p>}
        </div>
        <span className="text-xl">{getAccountIcon(account.type)}</span>
      </div>
      <p className="text-2xl font-bold text-white">
        {formatCurrency(account.currentBalance, account.currency)}
      </p>
      <p className="text-xs text-gray-500 mt-1">{account.currency} · {getAccountTypeLabel(account.type)}</p>
    </div>
  )
}

function CreditCardCard({ account }: { account: Account }) {
  const debt = Number(account.currentDebt ?? 0)
  const limit = Number(account.creditLimit ?? 0)
  const available = limit - debt
  const pct = limit > 0 ? (debt / limit) * 100 : 0

  return (
    <div className="card hover:border-gray-700 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-medium text-white text-sm">{account.name}</p>
          {account.institution && <p className="text-xs text-gray-500">{account.institution}</p>}
        </div>
        <span className="text-xl">💳</span>
      </div>
      <div className="flex gap-3 text-sm mb-2">
        <div>
          <p className="text-xs text-gray-500">Debt</p>
          <p className="text-red-400 font-medium">{formatCurrency(debt, account.currency)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Limit</p>
          <p className="text-gray-300">{formatCurrency(limit, account.currency)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Available</p>
          <p className="text-green-400 font-medium">{formatCurrency(available, account.currency)}</p>
        </div>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: pct > 80 ? '#ef4444' : '#6366f1' }}
        />
      </div>
    </div>
  )
}

function LoanCard({ account }: { account: Account }) {
  return (
    <div className="card hover:border-gray-700 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-medium text-white text-sm">{account.name}</p>
          {account.institution && <p className="text-xs text-gray-500">{account.institution}</p>}
        </div>
        <span className="text-xl">{getAccountIcon(account.type)}</span>
      </div>
      <p className="text-xl font-bold text-red-400">
        {formatCurrency(account.remainingAmount ?? 0, account.currency)}
      </p>
      <p className="text-xs text-gray-500">remaining principal</p>
      {account.monthlyPayment && (
        <p className="text-sm text-gray-400 mt-1">
          {formatCurrency(account.monthlyPayment, account.currency)}/mo
          {account.interestRate && ` · ${Number(account.interestRate)}% p.a.`}
        </p>
      )}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-pulse">
      <div className="h-8 w-40 bg-gray-800 rounded" />
      <div className="h-24 bg-gray-800 rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-28 bg-gray-800 rounded-xl" />)}
        </div>
        <div className="space-y-3">
          {[1,2].map(i => <div key={i} className="h-40 bg-gray-800 rounded-xl" />)}
        </div>
      </div>
    </div>
  )
}
