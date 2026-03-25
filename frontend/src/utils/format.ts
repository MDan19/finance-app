import { AccountType, TransactionType } from '../types'
import { format, parseISO } from 'date-fns'

export function formatEur(amount: number): string {
  return new Intl.NumberFormat('en-EU', { style: 'currency', currency: 'EUR' }).format(amount)
}

export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-EU', { style: 'currency', currency }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

export function formatDate(dateStr: string): string {
  try { return format(parseISO(dateStr), 'dd MMM yyyy') } catch { return dateStr }
}

export function formatDateShort(dateStr: string): string {
  try { return format(parseISO(dateStr), 'dd.MM.yy') } catch { return dateStr }
}

export function getAccountIcon(type: AccountType): string {
  const icons: Record<AccountType, string> = {
    BANK: '🏦', CASH: '💵', CREDIT_CARD: '💳',
    LOAN_CONSUMER: '💰', LOAN_AUTO: '🚗', MORTGAGE: '🏠',
    PERSONAL_DEBT: '👥', PERSONAL_CREDIT: '🤝',
  }
  return icons[type] || '💼'
}

export function getAccountTypeLabel(type: AccountType): string {
  const labels: Record<AccountType, string> = {
    BANK: 'Bank Account', CASH: 'Cash', CREDIT_CARD: 'Credit Card',
    LOAN_CONSUMER: 'Consumer Loan', LOAN_AUTO: 'Auto Loan', MORTGAGE: 'Mortgage',
    PERSONAL_DEBT: 'Personal Debt', PERSONAL_CREDIT: 'Personal Credit',
  }
  return labels[type] || type
}

export function getTxTypeLabel(type: TransactionType): string {
  const labels: Record<TransactionType, string> = {
    EXPENSE: 'Expense', INCOME: 'Income', TRANSFER: 'Transfer',
    REFUND: 'Refund', COMPENSATION: 'Compensation',
  }
  return labels[type] || type
}

export function getTxTypeBadgeClass(type: TransactionType): string {
  const classes: Record<TransactionType, string> = {
    EXPENSE: 'badge-expense', INCOME: 'badge-income', TRANSFER: 'badge-transfer',
    REFUND: 'badge-refund', COMPENSATION: 'badge-compensation',
  }
  return classes[type] || ''
}

export const CURRENCIES = ['EUR','USD','GBP','RUB','CHF','JPY','CNY','PLN','CZK','SEK','NOK','DKK','TRY','AED','CAD','AUD']

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'BANK', label: '🏦 Bank Account' },
  { value: 'CASH', label: '💵 Cash' },
  { value: 'CREDIT_CARD', label: '💳 Credit Card' },
  { value: 'LOAN_CONSUMER', label: '💰 Consumer Loan' },
  { value: 'LOAN_AUTO', label: '🚗 Auto Loan' },
  { value: 'MORTGAGE', label: '🏠 Mortgage' },
  { value: 'PERSONAL_DEBT', label: '👥 Personal Debt (I owe)' },
  { value: 'PERSONAL_CREDIT', label: '🤝 Personal Credit (Owed to me)' },
]

export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
