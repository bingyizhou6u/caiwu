import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UserInfo {
  id?: string
  email?: string
  name?: string
  username?: string
  role?: string
  permissions?: string[]
  position?: {
    name?: string
    level?: number
    functionRole?: string
    canManageSubordinates?: number
  }
  [key: string]: any
}

type ThemeMode = 'light' | 'dark'

interface AppState {
  // UI State
  collapsed: boolean
  toggleCollapsed: () => void
  setCollapsed: (collapsed: boolean) => void
  
  // Theme State
  themeMode: ThemeMode
  toggleTheme: () => void
  setThemeMode: (mode: ThemeMode) => void

  // Auth/User State
  userInfo: UserInfo | null
  token: string | null
  isAuthenticated: boolean
  setUserInfo: (user: UserInfo | null) => void
  setToken: (token: string | null) => void
  logout: () => void
  
  // Menu Favorites (最近访问)
  recentMenuKeys: string[]
  addRecentMenuKey: (key: string) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // UI State
      collapsed: false,
      toggleCollapsed: () => set((state) => ({ collapsed: !state.collapsed })),
      setCollapsed: (collapsed) => set({ collapsed }),
      
      // Theme State
      themeMode: 'light',
      toggleTheme: () => set((state) => ({ 
        themeMode: state.themeMode === 'light' ? 'dark' : 'light' 
      })),
      setThemeMode: (themeMode) => set({ themeMode }),

      // Auth/User State
      userInfo: null,
      token: null,
      isAuthenticated: false,
      setUserInfo: (userInfo) => set((state) => ({
        userInfo,
        isAuthenticated: !!(userInfo && state.token)
      })),
      setToken: (token) => set((state) => ({
        token,
        isAuthenticated: !!(token && state.userInfo)
      })),
      logout: () => set({ userInfo: null, token: null, isAuthenticated: false }),
      
      // Menu Favorites
      recentMenuKeys: [],
      addRecentMenuKey: (key: string) => set((state) => {
        const keys = state.recentMenuKeys.filter(k => k !== key)
        keys.unshift(key)
        return { recentMenuKeys: keys.slice(0, 6) } // 最多保存 6 个
      }),
    }),
    {
      name: 'caiwu-app-storage',
      partialize: (state) => ({
        collapsed: state.collapsed,
        themeMode: state.themeMode,
        userInfo: state.userInfo,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        recentMenuKeys: state.recentMenuKeys,
      }),
      onRehydrateStorage: () => (state) => {
        // After loading from localStorage, recompute isAuthenticated
        if (state) {
          state.isAuthenticated = !!(state.token && state.userInfo)
        }
      },
    }
  )
)
