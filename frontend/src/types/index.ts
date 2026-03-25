export type AccountType =
  | 'BANK' | 'CASH' | 'CREDIT_CARD'
  | 'LOAN_CONSUMER' | 'LOAN_AUTO' | 'MORTGAGE'
  | 'PERSONAL_DEBT' | 'PERSONAL_CREDIT'

export type TransactionType = 'EXPENSE' | 'INCOME' | 'TRANSFER' | 'REFUND' | 'COMPENSATION'

export interface Account {
  id: number
  name: string
  type: AccountType
  currency: string
  institution?: string
  openingDate?: string
  isActive: boolean
  notes?: string
  currentBalance: number
  creditLimit?: number
  currentDebt?: number
  originalAmount?: number
  remainingAmount?: number
  monthlyPayment?: number
  interestRate?: number
  endDate?: string
  startDate?: string
  counterpartyName?: string
  direction?: 'owe' | 'owed'
  createdAt: string
}

export interface Category {
  id: number
  name: string
  color: string
  icon: string
  parentId?: number
  budgetGroup?: string
  isActive: boolean
  sortOrder: number
  children?: Category[]
}

export interface Transaction {
  id: number
  type: TransactionType
  date: string
  accountId: number
  amount: number
  currency: string
  amountEur?: number
  exchangeRate?: number
  categoryId?: number
  incomeSource?: string
  counterparty?: string
  note?: string
  source: string
  linkedTransactionId?: number
  compensationSource?: string
  toAccountId?: number
  toAmount?: number
  toCurrency?: string
  account?: { id: number; name: string; currency: string; type: string }
  toAccount?: { id: number; name: string; currency: string }
  category?: Category
  linkedTransaction?: Partial<Transaction>
  createdAt: string
}

export interface BudgetPlan {
  id: number
  categoryId: number
  year: number
  month: number
  amount: number
  category?: Category
}

export interface BudgetBucket {
  id: number
  name: string
  targetPercent: number
  categories: number[]
  color: string
  sortOrder: number
}

export interface ScheduledPayment {
  id: number
  name: string
  accountId: number
  categoryId?: number
  amount: number
  currency: string
  dueDay: number
  isActive: boolean
  notes?: string
  account?: { id: number; name: string }
  category?: Category
  dueDate?: string
  diffDays?: number
}

export interface MonthlyIncome {
  id: number
  year: number
  month: number
  amount: number
  currency: string
}
