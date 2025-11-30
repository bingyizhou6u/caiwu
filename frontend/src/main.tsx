import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './pages/App'
import { attachAuthInterceptor } from './utils/authedFetch'
import 'antd/dist/reset.css'

attachAuthInterceptor()

// 配置 React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5分钟缓存
      gcTime: 10 * 60 * 1000, // 10分钟垃圾回收
      retry: 1, // 失败重试1次
      refetchOnWindowFocus: false, // 窗口聚焦时不自动刷新
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)


