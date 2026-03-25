import { create } from 'zustand'
import { authApi } from '../api'

interface AuthState {
  token: string | null
  user: { id: number; username: string; baseCurrency: string } | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  fetchMe: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  user: null,
  isLoading: false,

  login: async (username, password) => {
    set({ isLoading: true })
    const res = await authApi.login(username, password)
    const { token, user } = res.data
    localStorage.setItem('token', token)
    set({ token, user, isLoading: false })
  },

  logout: () => {
    localStorage.removeItem('token')
    set({ token: null, user: null })
  },

  fetchMe: async () => {
    try {
      const res = await authApi.me()
      set({ user: res.data })
    } catch {
      localStorage.removeItem('token')
      set({ token: null, user: null })
    }
  },
}))
