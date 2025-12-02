import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UserInfo {
  username: string
  role: string
  permissions?: string[]
  [key: string]: any
}

interface AppState {
  // UI State
  collapsed: boolean
  toggleCollapsed: () => void
  setCollapsed: (collapsed: boolean) => void

  // Auth/User State
  userInfo: UserInfo | null
  token: string | null
  isAuthenticated: boolean
  setUserInfo: (user: UserInfo | null) => void
  setToken: (token: string | null) => void
  logout: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // UI State
      collapsed: false,
      toggleCollapsed: () => set((state) => ({ collapsed: !state.collapsed })),
      setCollapsed: (collapsed) => set({ collapsed }),

      // Auth/User State
      userInfo: null,
      token: null,
      isAuthenticated: false,
      setUserInfo: (userInfo) => set({ userInfo, isAuthenticated: !!userInfo }),
      setToken: (token) => set({ token }),
      logout: () => set({ userInfo: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'caiwu-app-storage',
      partialize: (state) => ({
        collapsed: state.collapsed,
        userInfo: state.userInfo,
        token: state.token,
        isAuthenticated: state.isAuthenticated
      }),
    }
  )
)
