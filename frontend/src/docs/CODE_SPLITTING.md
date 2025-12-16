# 代码分割优化指南

## 概述

代码分割（Code Splitting）是将代码拆分成多个较小的 bundle，按需加载，从而减少初始加载时间，提升应用性能。

## 当前实现

### 路由级别代码分割

所有页面组件都已使用 `React.lazy` 和动态导入：

```tsx
// router/index.tsx
const loaders: Record<string, () => Promise<any>> = {
  'finance/flows': () => import('../features/finance/pages/Flows').then(m => ({ default: m.Flows })),
  // ...
}

const Flows = lazy(loaders['finance/flows'])
```

### 路由预加载

菜单悬停时预加载路由组件：

```tsx
// MainLayout.tsx
<div
  onMouseEnter={() => {
    preloadRoute(routeKey)
  }}
>
  {item.label}
</div>
```

## 优化策略

### 1. 路由级别分割

✅ **已完成**：所有页面组件都使用 lazy loading

### 2. 组件级别分割

对于大型组件（>500行），可以进一步拆分：

```tsx
// 大型组件内部使用动态导入
const HeavyComponent = lazy(() => import('./HeavyComponent'))

function ParentComponent() {
  const [showHeavy, setShowHeavy] = useState(false)
  
  return (
    <>
      <Button onClick={() => setShowHeavy(true)}>加载重型组件</Button>
      {showHeavy && (
        <Suspense fallback={<Spin />}>
          <HeavyComponent />
        </Suspense>
      )}
    </>
  )
}
```

### 3. 第三方库分割

对于大型第三方库，可以按需导入：

```tsx
// ❌ 导入整个库
import * as AntdIcons from '@ant-design/icons'

// ✅ 按需导入
import { EditOutlined, DeleteOutlined } from '@ant-design/icons'
```

### 4. 工具函数分割

对于大型工具库，可以按功能分割：

```tsx
// ❌ 导入所有工具
import * as utils from './utils'

// ✅ 按需导入
import { formatAmount } from './utils/amount'
import { formatDate } from './utils/date'
```

## 预加载策略

### 1. 菜单悬停预加载

✅ **已实现**：在 `MainLayout` 中，菜单项悬停时预加载对应路由

### 2. 路由预加载函数

```tsx
// 预加载指定路由
preloadRoute('finance/flows')

// 预加载多个路由
['finance/flows', 'finance/ar', 'finance/ap'].forEach(preloadRoute)
```

### 3. 关键路由预加载

可以在应用启动时预加载关键路由：

```tsx
// main.tsx 或 App.tsx
useEffect(() => {
  // 预加载常用路由
  preloadRoute('dashboard')
  preloadRoute('my/center')
}, [])
```

## Webpack/Vite 配置

### Vite 自动代码分割

Vite 会自动进行代码分割：
- 每个动态导入的模块会生成独立的 chunk
- 共享依赖会被提取到 vendor chunk
- 路由级别的分割会自动处理

### 手动配置 chunk 分割

如果需要手动控制分割策略，可以在 `vite.config.ts` 中配置：

```ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'antd-vendor': ['antd'],
          'query-vendor': ['@tanstack/react-query'],
        }
      }
    }
  }
})
```

## 性能监控

### 使用 Chrome DevTools

1. 打开 Chrome DevTools
2. 切换到 Network 标签
3. 刷新页面
4. 查看加载的 chunk 文件
5. 分析每个 chunk 的大小和加载时间

### Bundle 分析

使用 `vite-bundle-visualizer` 分析 bundle：

```bash
npm install -D vite-bundle-visualizer
```

```ts
// vite.config.ts
import { visualizer } from 'vite-bundle-visualizer'

export default defineConfig({
  plugins: [
    visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
    })
  ]
})
```

## 最佳实践

### 1. 路由级别分割

✅ **推荐**：所有页面组件使用 lazy loading

### 2. 组件级别分割

✅ **推荐**：大型组件（>500行）或很少使用的组件使用动态导入

### 3. 第三方库

✅ **推荐**：按需导入，避免导入整个库

### 4. 预加载策略

✅ **推荐**：
- 菜单悬停时预加载（已实现）
- 关键路由在应用启动时预加载
- 避免过度预加载，只预加载用户可能访问的路由

### 5. Loading 状态

✅ **推荐**：所有 lazy 组件都应该有 Suspense fallback

```tsx
<Suspense fallback={<SkeletonLoading />}>
  <LazyComponent />
</Suspense>
```

## 检查清单

- [x] 所有页面组件使用 lazy loading
- [x] 所有 lazy 组件有 Suspense fallback
- [x] 菜单悬停预加载已实现
- [ ] 大型组件内部使用动态导入（可选）
- [ ] 第三方库按需导入
- [ ] Bundle 大小监控

## 常见问题

### Q: 为什么有些组件没有使用 lazy loading？

A: 登录页面等关键路径的组件可能直接导入以加快首次加载。但为了保持一致性，建议都使用 lazy loading。

### Q: 预加载会影响性能吗？

A: 适度的预加载（如菜单悬停）可以提升用户体验。但过度预加载会浪费带宽，应该只预加载用户可能访问的路由。

### Q: 如何知道代码分割是否有效？

A: 使用 Chrome DevTools 的 Network 标签查看加载的 chunk，或使用 bundle 分析工具查看 bundle 大小分布。

## 示例：优化大型组件

```tsx
// RentalManagement.tsx (1125行)
// 可以拆分为多个子组件，并使用动态导入

const RentalPropertyForm = lazy(() => import('./components/RentalPropertyForm'))
const RentalDetailModal = lazy(() => import('./components/RentalDetailModal'))
const RentalPaymentModal = lazy(() => import('./components/RentalPaymentModal'))

export function RentalManagement() {
  const [showForm, setShowForm] = useState(false)
  
  return (
    <>
      <Button onClick={() => setShowForm(true)}>新建</Button>
      {showForm && (
        <Suspense fallback={<Spin />}>
          <RentalPropertyForm />
        </Suspense>
      )}
    </>
  )
}
```

