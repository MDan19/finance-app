import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

// ── Auth ─────────────────────────────────────
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  me: () => api.get('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/auth/password', { currentPassword, newPassword }),
}

// ── Accounts ─────────────────────────────────
export const accountsApi = {
  list: () => api.get('/accounts'),
  get: (id: number) => api.get(`/accounts/${id}`),
  create: (data: any) => api.post('/accounts', data),
  update: (id: number, data: any) => api.put(`/accounts/${id}`, data),
  delete: (id: number) => api.delete(`/accounts/${id}`),
}

// ── Transactions ──────────────────────────────
export const transactionsApi = {
  list: (params?: any) => api.get('/transactions', { params }),
  get: (id: number) => api.get(`/transactions/${id}`),
  create: (data: any) => api.post('/transactions', data),
  update: (id: number, data: any) => api.put(`/transactions/${id}`, data),
  delete: (id: number) => api.delete(`/transactions/${id}`),
  bulkDelete: (ids: number[]) => api.post('/transactions/bulk-delete', { ids }),
  bulkCategorize: (ids: number[], categoryId: number) =>
    api.post('/transactions/bulk-categorize', { ids, categoryId }),
}

// ── Categories ────────────────────────────────
export const categoriesApi = {
  list: () => api.get('/categories'),
  all: () => api.get('/categories/all'),
  create: (data: any) => api.post('/categories', data),
  update: (id: number, data: any) => api.put(`/categories/${id}`, data),
  delete: (id: number) => api.delete(`/categories/${id}`),
}

// ── Budget ────────────────────────────────────
export const budgetApi = {
  plans: (params?: any) => api.get('/budget/plans', { params }),
  setPlan: (categoryId: number, year: number, month: number, amount: number) =>
    api.put(`/budget/plans/${categoryId}/${year}/${month}`, { amount }),
  annual: (year: number) => api.get('/budget/annual', { params: { year } }),
  buckets: () => api.get('/budget/buckets'),
  createBucket: (data: any) => api.post('/budget/buckets', data),
  updateBucket: (id: number, data: any) => api.put(`/budget/buckets/${id}`, data),
  deleteBucket: (id: number) => api.delete(`/budget/buckets/${id}`),
  monthlyIncome: (year?: number) => api.get('/budget/monthly-income', { params: { year } }),
  setMonthlyIncome: (year: number, month: number, amount: number) =>
    api.put(`/budget/monthly-income/${year}/${month}`, { amount }),
}

// ── Analytics ─────────────────────────────────
export const analyticsApi = {
  netWorth: () => api.get('/analytics/networth'),
  thisMonth: () => api.get('/analytics/this-month'),
  categoriesSpending: (params?: any) => api.get('/analytics/categories-spending', { params }),
  monthlyTrend: (params?: any) => api.get('/analytics/monthly-trend', { params }),
  bucketCompliance: () => api.get('/analytics/bucket-compliance'),
}

// ── Exchange ──────────────────────────────────
export const exchangeApi = {
  getRate: (from: string, to: string) => api.get('/exchange/rate', { params: { from, to } }),
  setManualRate: (from: string, to: string, rate: number) =>
    api.post('/exchange/rate/manual', { from, to, rate }),
}

// ── Import ────────────────────────────────────
export const importApi = {
  profiles: () => api.get('/import/profiles'),
  createProfile: (data: any) => api.post('/import/profiles', data),
  updateProfile: (id: number, data: any) => api.put(`/import/profiles/${id}`, data),
  deleteProfile: (id: number) => api.delete(`/import/profiles/${id}`),
  preview: (file: File, delimiter: string) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('delimiter', delimiter)
    return api.post('/import/preview', fd)
  },
  execute: (file: File, params: any) => {
    const fd = new FormData()
    fd.append('file', file)
    Object.entries(params).forEach(([k, v]) => fd.append(k, typeof v === 'string' ? v : JSON.stringify(v)))
    return api.post('/import/execute', fd)
  },
  keywordRules: () => api.get('/import/keyword-rules'),
  createKeywordRule: (data: any) => api.post('/import/keyword-rules', data),
  updateKeywordRule: (id: number, data: any) => api.put(`/import/keyword-rules/${id}`, data),
  deleteKeywordRule: (id: number) => api.delete(`/import/keyword-rules/${id}`),
  batches: () => api.get('/import/batches'),
}

// ── Scheduled ────────────────────────────────
export const scheduledApi = {
  list: () => api.get('/scheduled'),
  upcoming: (days?: number) => api.get('/scheduled/upcoming', { params: { days } }),
  create: (data: any) => api.post('/scheduled', data),
  update: (id: number, data: any) => api.put(`/scheduled/${id}`, data),
  delete: (id: number) => api.delete(`/scheduled/${id}`),
}

// ── Settings ──────────────────────────────────
export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data: any) => api.put('/settings', data),
  export: () => api.get('/settings/export', { responseType: 'blob' }),
}
