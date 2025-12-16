# React Query 缓存优化指南

## 概述

本文档说明如何优化 React Query 的缓存配置，提高应用性能和用户体验。

## 缓存时间配置

### 使用 CACHE_TIME 常量

所有 hooks 应该使用 `CACHE_TIME` 常量而不是硬编码的时间值：

```tsx
import { CACHE_TIME } from '../../config/cache'

// ✅ 正确
staleTime: CACHE_TIME.MASTER_DATA

// ❌ 错误
staleTime: 60 * 60 * 1000
```

### 缓存时间分类

| 类型 | 时间 | 适用场景 |
|------|------|---------|
| `MASTER_DATA` | 1小时 | 币种、类别、部门、站点、配置等变化极少的数据 |
| `BUSINESS_DATA` | 30分钟 | 员工、供应商、账户等变化较少的数据 |
| `TRANSACTION_DATA` | 5分钟 | 流水、单据、审批等变化频繁的数据 |
| `REPORT_DATA` | 10分钟 | 各类报表数据 |
| `REALTIME` | 0 | 状态检查、实时监控等不允许延迟的数据 |

## 使用 select 优化性能

`select` 选项可以：
1. **转换数据格式**：在查询时转换数据，避免在组件中重复处理
2. **减少重渲染**：只返回需要的数据，避免不必要的组件更新
3. **计算派生数据**：在查询时计算派生数据

### 示例

```tsx
// ✅ 使用 select 转换数据
export function useAccounts() {
  return useApiQuery<SelectOption[]>(
    ['accounts'],
    api.accounts,
    {
      select: (data: any) => {
        const list = Array.isArray(data) ? data : data?.results || []
        return list
          .filter((a: any) => a.active === 1)
          .map((a: any) => ({
            value: a.id,
            label: `${a.name} [${a.currency}]`,
            currency: a.currency,
          }))
      },
      staleTime: CACHE_TIME.BUSINESS_DATA,
    }
  )
}
```

## 分页查询优化

### 使用 keepPreviousData

对于分页查询，使用 `keepPreviousData` 保持上一页数据，避免加载闪烁：

```tsx
export function useFlows(page: number = 1, pageSize: number = 20) {
  return useApiQuery<{ total: number, list: Flow[] }>(
    ['flows', page, pageSize],
    `${api.flows}?page=${page}&pageSize=${pageSize}`,
    {
      select: (data: any) => ({
        total: data.total ?? 0,
        list: data.results ?? [],
      }),
      staleTime: CACHE_TIME.TRANSACTION_DATA,
      keepPreviousData: true, // ✅ 保持上一页数据
    }
  )
}
```

## 乐观更新

乐观更新可以立即更新 UI，提升用户体验。

### 使用工具函数

```tsx
import { createOptimisticAdd, createOptimisticUpdate, createOptimisticDelete } from '../../utils/optimisticUpdates'

// 添加
const { mutateAsync } = useMutation({
  mutationFn: createTodo,
  onMutate: createOptimisticAdd(['todos'], (variables) => ({
    id: 'temp-id',
    ...variables,
    status: 'pending',
  })),
  onError: (err, variables, context) => {
    queryClient.setQueryData(['todos'], context.previousData)
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['todos'] })
  },
})

// 更新
const { mutateAsync } = useMutation({
  mutationFn: updateTodo,
  onMutate: createOptimisticUpdate(
    ['todos'],
    (variables) => variables.id,
    (oldItem, variables) => ({ ...oldItem, ...variables })
  ),
  onError: (err, variables, context) => {
    queryClient.setQueryData(['todos'], context.previousData)
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['todos'] })
  },
})

// 删除
const { mutateAsync } = useMutation({
  mutationFn: deleteTodo,
  onMutate: createOptimisticDelete(['todos'], (variables) => variables.id),
  onError: (err, variables, context) => {
    queryClient.setQueryData(['todos'], context.previousData)
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['todos'] })
  },
})
```

### 分页列表的乐观更新

```tsx
import { createOptimisticAddToPaginated } from '../../utils/optimisticUpdates'

const { mutateAsync } = useMutation({
  mutationFn: createFlow,
  onMutate: createOptimisticAddToPaginated(
    ['flows', page, pageSize],
    (variables) => ({
      id: 'temp-id',
      ...variables,
      status: 'pending',
    })
  ),
  onError: (err, variables, context) => {
    queryClient.setQueryData(['flows', page, pageSize], context.previousData)
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['flows'] })
  },
})
```

## 缓存失效策略

### 精确失效

只失效相关的查询，避免不必要的重新获取：

```tsx
// ✅ 精确失效
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['accounts'] })
}

// ❌ 过于宽泛
onSuccess: () => {
  queryClient.invalidateQueries() // 失效所有查询
}
```

### 相关查询失效

当创建或更新数据时，失效相关的查询：

```tsx
export function useCreateFlow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: any) => {
      await apiClient.post(api.flows, data)
    },
    onSuccess: () => {
      // ✅ 失效相关查询
      queryClient.invalidateQueries({ queryKey: ['flows'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] }) // 账户余额可能变化
    }
  })
}
```

## 查询键设计

### 原则

1. **层次化**：使用数组表示层次关系
2. **包含参数**：查询参数应该包含在键中
3. **一致性**：相同的数据使用相同的键结构

### 示例

```tsx
// ✅ 好的查询键设计
['accounts']                           // 所有账户
['accounts', { activeOnly: true }]    // 活跃账户
['flows', 1, 20]                       // 第1页，每页20条
['reports', 'ar', '2024-01', '2024-12'] // AR报表，日期范围

// ❌ 不好的查询键设计
['accounts', 'list']                   // 冗余
['flows', `page=${page}`]              // 字符串拼接，不结构化
```

## 性能优化检查清单

- [ ] 所有 hooks 使用 `CACHE_TIME` 常量
- [ ] 使用 `select` 转换数据格式
- [ ] 分页查询使用 `keepPreviousData`
- [ ] 关键操作实现乐观更新
- [ ] 精确的缓存失效策略
- [ ] 合理的查询键设计
- [ ] 避免不必要的查询（使用 `enabled` 选项）

## 常见问题

### Q: 什么时候应该使用乐观更新？

A: 对于用户操作频繁且成功率高的操作（如标记完成、切换状态），应该使用乐观更新。对于关键操作（如删除、支付），建议使用传统更新。

### Q: 如何调试缓存问题？

A: 使用 React Query DevTools：
```tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

<ReactQueryDevtools initialIsOpen={false} />
```

### Q: staleTime 和 gcTime 的区别？

A: 
- `staleTime`: 数据被认为是"新鲜"的时间，在此期间不会重新获取
- `gcTime` (原 cacheTime): 未使用的数据在缓存中保留的时间

