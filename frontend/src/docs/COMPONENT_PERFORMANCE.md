# 组件性能优化指南

## 概述

本文档说明如何使用 React 性能优化技术（React.memo, useMemo, useCallback）提升应用性能。

## 何时使用性能优化

### 使用 React.memo

当组件：
- 接收相同的 props 时渲染结果相同
- 渲染成本较高（复杂计算、大量 DOM）
- 父组件频繁重渲染但 props 很少变化

```tsx
// ✅ 好的用例：列表项组件
interface TodoItemProps {
  id: string
  title: string
  completed: boolean
  onToggle: (id: string) => void
}

export const TodoItem = React.memo(({ id, title, completed, onToggle }: TodoItemProps) => {
  return (
    <div>
      <input type="checkbox" checked={completed} onChange={() => onToggle(id)} />
      <span>{title}</span>
    </div>
  )
})
```

### 使用 useMemo

当需要：
- 缓存昂贵的计算结果
- 避免每次渲染都创建新对象/数组（作为 props 传递）
- 稳定引用（用于依赖数组）

```tsx
// ✅ 好的用例：过滤和转换数据
const filteredData = useMemo(() => {
  return largeArray
    .filter(item => item.status === 'active')
    .map(item => transformItem(item))
}, [largeArray])

// ✅ 好的用例：创建稳定的对象引用
const tableProps = useMemo(() => ({
  className: 'table-striped',
  scroll: { x: 1200 },
  pagination: { pageSize: 20 },
}), [])
```

### 使用 useCallback

当需要：
- 将函数作为 props 传递给 memo 组件
- 将函数作为依赖传递给其他 hooks
- 避免子组件不必要的重渲染

```tsx
// ✅ 好的用例：事件处理函数
const handleEdit = useCallback((id: string) => {
  setEditingId(id)
  openEdit()
}, [openEdit])

// ✅ 好的用例：传递给 memo 组件
const handleDelete = useCallback((id: string) => {
  deleteItem(id)
}, [deleteItem])
```

## 优化模式

### 1. 表格列定义

```tsx
// ✅ 使用 useMemo 缓存列定义
const columns = useMemo(() => [
  {
    title: '名称',
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    render: (status: string) => <Tag>{status}</Tag>,
  },
], [])
```

### 2. 数据转换

```tsx
// ✅ 使用 useMemo 缓存数据转换
const formattedData = useMemo(() => {
  return rawData.map(item => ({
    ...item,
    displayName: `${item.firstName} ${item.lastName}`,
    formattedAmount: formatAmount(item.amountCents),
  }))
}, [rawData])
```

### 3. 过滤和搜索

```tsx
// ✅ 使用 useMemo 缓存过滤结果
const filteredItems = useMemo(() => {
  if (!searchTerm) return items
  return items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  )
}, [items, searchTerm])
```

### 4. 事件处理函数

```tsx
// ✅ 使用 useCallback 缓存事件处理函数
const handleSubmit = useCallback(async () => {
  const values = await form.validateFields()
  await submitForm(values)
  form.resetFields()
}, [form, submitForm])

const handleDelete = useCallback((id: string) => {
  Modal.confirm({
    title: '确认删除',
    onOk: () => deleteItem(id),
  })
}, [deleteItem])
```

### 5. 表单字段选项

```tsx
// ✅ 使用 useMemo 缓存选项数据
const employeeOptions = useMemo(() => {
  return employees.map(emp => ({
    value: emp.id,
    label: `${emp.name} (${emp.departmentName})`,
  }))
}, [employees])
```

## 常见错误

### ❌ 过度优化

```tsx
// ❌ 不需要 memo 简单组件
const SimpleButton = React.memo(({ onClick, children }) => (
  <button onClick={onClick}>{children}</button>
))

// ✅ 简单组件不需要 memo
const SimpleButton = ({ onClick, children }) => (
  <button onClick={onClick}>{children}</button>
)
```

### ❌ 错误的依赖数组

```tsx
// ❌ 缺少依赖
const handleClick = useCallback(() => {
  console.log(count) // count 变化时函数不会更新
}, [])

// ✅ 包含所有依赖
const handleClick = useCallback(() => {
  console.log(count)
}, [count])
```

### ❌ 不必要的 useMemo

```tsx
// ❌ 简单计算不需要 useMemo
const total = useMemo(() => a + b, [a, b])

// ✅ 直接计算即可
const total = a + b
```

## 性能优化检查清单

### 组件级别
- [ ] 大型列表项使用 React.memo
- [ ] 表格列定义使用 useMemo
- [ ] 数据转换使用 useMemo
- [ ] 事件处理函数使用 useCallback

### 数据级别
- [ ] 过滤/搜索结果使用 useMemo
- [ ] 选项数据转换使用 useMemo
- [ ] 派生状态使用 useMemo

### 函数级别
- [ ] 传递给子组件的函数使用 useCallback
- [ ] 作为依赖的函数使用 useCallback
- [ ] 避免在渲染中创建新函数

## 性能分析工具

### React DevTools Profiler

1. 安装 React DevTools 浏览器扩展
2. 打开 Profiler 标签
3. 点击录制按钮
4. 执行操作
5. 停止录制，查看性能分析

### 性能指标

- **Render 时间**：组件渲染耗时
- **Commit 时间**：DOM 更新耗时
- **重渲染次数**：组件重渲染频率

## 最佳实践

1. **先测量，后优化**：使用 Profiler 找出性能瓶颈
2. **渐进式优化**：优先优化最影响性能的部分
3. **保持代码可读性**：不要为了优化而牺牲代码清晰度
4. **测试优化效果**：确保优化确实提升了性能
5. **文档化优化原因**：说明为什么需要优化

## 示例：优化表格组件

```tsx
// 优化前
export function DataTable({ data, columns, onEdit, onDelete }) {
  const filteredData = data.filter(item => item.active)
  
  return (
    <Table
      columns={columns}
      dataSource={filteredData}
      onRow={(record) => ({
        onClick: () => onEdit(record.id),
      })}
    />
  )
}

// 优化后
export function DataTable({ data, columns, onEdit, onDelete }) {
  // 缓存过滤结果
  const filteredData = useMemo(() => 
    data.filter(item => item.active),
    [data]
  )
  
  // 缓存列定义
  const memoizedColumns = useMemo(() => columns, [columns])
  
  // 缓存行点击处理
  const handleRowClick = useCallback((record) => ({
    onClick: () => onEdit(record.id),
  }), [onEdit])
  
  return (
    <Table
      columns={memoizedColumns}
      dataSource={filteredData}
      onRow={handleRowClick}
    />
  )
}
```

