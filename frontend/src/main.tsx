import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { router } from './router'
import 'antd/dist/reset.css'
import './index.css'

import { getTheme } from './config/theme'
import { useAppStore } from './store/useAppStore'

import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { QueryClient } from '@tanstack/react-query'

// 配置 React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000, // 垃圾回收时间延长到24小时，配合持久化
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// 配置持久化存储
const persister = createSyncStoragePersister({
  storage: window.localStorage,
})

import { ErrorBoundary } from './components/ErrorBoundary'

// App 组件 - 响应主题变化
function App() {
  const themeMode = useAppStore((state) => state.themeMode)
  
  // 同步主题到 document，便于 CSS 变量使用
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode)
  }, [themeMode])
  
  return (
    <ConfigProvider
      locale={zhCN}
      theme={getTheme(themeMode)}
    >
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, maxAge: 24 * 60 * 60 * 1000 }}
      >
        <ErrorBoundary>
          <RouterProvider router={router} />
        </ErrorBoundary>
      </PersistQueryClientProvider>
    </ConfigProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// 注册 Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}
