# 前端重构指南

## 概述

本文档记录前端重构过程中的最佳实践、常见模式和注意事项，帮助开发者理解和维护重构后的代码。

## 重构原则

### 1. 类型安全优先

- ✅ 移除所有 `as any` 类型断言
- ✅ 为所有数据定义明确的类型
- ✅ 使用 TypeScript 的类型推断

```tsx
// ✅ 好的做法
const columns: DataTableColumn<Employee>[] = [
  { title: '姓名', dataIndex: 'name', key: 'name' },
]

// ❌ 不好的做法
const columns: any[] = [
  { title: '姓名', dataIndex: 'name', key: 'name' },
]
```

### 2. 统一使用 React Query

- ✅ 所有数据获取使用 React Query hooks
- ✅ 移除旧的 `load()` 函数调用
- ✅ 使用 `refetch()` 刷新数据

```tsx
// ✅ 好的做法
const { data, isLoading, refetch } = useEmployees()
<Button onClick={() => refetch()}>刷新</Button>

// ❌ 不好的做法
const [data, setData] = useState([])
const load = async () => {
  const result = await api.get('/employees')
  setData(result)
}
```

### 3. 提取通用组件

- ✅ 重复的表单字段提取为组件
- ✅ 重复的业务逻辑提取为工具函数
- ✅ 保持组件职责单一

```tsx
// ✅ 好的做法
<EmployeeSelect />
<AmountInput />
<CurrencySelect />

// ❌ 不好的做法
<Select>
  {employees.map(emp => (
    <Option key={emp.id} value={emp.id}>
      {emp.name} ({emp.departmentName})
    </Option>
  ))}
</Select>
```

### 4. 性能优化

- ✅ 使用 `useMemo` 缓存计算结果
- ✅ 使用 `useCallback` 缓存函数
- ✅ 使用 `React.memo` 优化组件渲染

```tsx
// ✅ 好的做法
const columns = useMemo(() => [
  { title: '姓名', dataIndex: 'name' },
], [])

const handleEdit = useCallback((record: Employee) => {
  openEdit(record)
}, [openEdit])

// ❌ 不好的做法
const columns = [
  { title: '姓名', dataIndex: 'name' },
]

const handleEdit = (record: Employee) => {
  openEdit(record)
}
```

## 重构模式

### 1. 类型安全改进模式

**问题**: 使用 `as any` 绕过类型检查

**解决方案**:
1. 定义明确的类型接口
2. 使用类型断言（`as Type`）替代 `as any`
3. 使用类型守卫函数

```tsx
// 重构前
const columns = [
  { title: '姓名', dataIndex: 'name', render: (v: any) => v },
]

// 重构后
interface Employee {
  id: string
  name: string
}

const columns: DataTableColumn<Employee>[] = [
  { title: '姓名', dataIndex: 'name', render: (v: string) => v },
]
```

### 2. 数据获取统一模式

**问题**: 混用 `load()` 函数和 React Query hooks

**解决方案**:
1. 移除所有 `load()` 函数调用
2. 统一使用 React Query hooks
3. 使用 `refetch()` 刷新数据

```tsx
// 重构前
const [data, setData] = useState([])
const load = async () => {
  const result = await api.get('/employees')
  setData(result)
}
useEffect(() => {
  load()
}, [])

// 重构后
const { data = [], refetch } = useEmployees()
```

### 3. 表单字段提取模式

**问题**: 重复的表单字段代码

**解决方案**:
1. 识别重复的表单字段
2. 提取为通用组件
3. 统一使用提取的组件

```tsx
// 重构前（多处重复）
<Form.Item name="employeeId">
  <Select>
    {employees.map(emp => (
      <Option key={emp.id} value={emp.id}>
        {emp.name} ({emp.departmentName})
      </Option>
    ))}
  </Select>
</Form.Item>

// 重构后
<Form.Item name="employeeId">
  <EmployeeSelect />
</Form.Item>
```

### 4. 业务逻辑提取模式

**问题**: 重复的业务逻辑代码

**解决方案**:
1. 识别重复的业务逻辑
2. 提取为工具函数
3. 统一使用工具函数

```tsx
// 重构前（多处重复）
const getStatusTag = (status: string) => {
  if (status === 'pending') return <Tag color="processing">待审批</Tag>
  if (status === 'approved') return <Tag color="success">已通过</Tag>
  return <Tag>{status}</Tag>
}

// 重构后
import { renderStatusTag } from '@/utils/status'
const statusTag = renderStatusTag(status, BORROWING_STATUS)
```

### 5. 组件拆分模式

**问题**: 组件过大（>500行）

**解决方案**:
1. 识别组件的职责
2. 按职责拆分为子组件
3. 使用组合模式组装

```tsx
// 重构前（1125行）
export function RentalManagement() {
  // 所有逻辑都在一个组件中
}

// 重构后
export function RentalManagement() {
  return (
    <>
      <RentalPropertyTable />
      <RentalPaymentTable />
      <DormitoryAllocationTable />
      <RentalPropertyForm />
      <RentalDetailModal />
    </>
  )
}
```

## 重构检查清单

### 类型安全
- [ ] 移除所有 `as any`
- [ ] 为所有数据定义类型
- [ ] 使用类型安全的组件 props

### 数据获取
- [ ] 移除所有 `load()` 函数调用
- [ ] 统一使用 React Query hooks
- [ ] 使用 `refetch()` 刷新数据

### 组件提取
- [ ] 提取重复的表单字段为组件
- [ ] 提取重复的业务逻辑为工具函数
- [ ] 拆分大型组件（>500行）

### 性能优化
- [ ] 使用 `useMemo` 缓存计算结果
- [ ] 使用 `useCallback` 缓存函数
- [ ] 使用 `React.memo` 优化组件渲染
- [ ] 使用 `keepPreviousData` 优化分页

### 代码质量
- [ ] 添加必要的注释
- [ ] 统一代码风格
- [ ] 添加单元测试
- [ ] 更新相关文档

## 常见问题

### Q: 如何判断是否需要重构？

A: 当出现以下情况时，考虑重构：
- 代码重复率 > 30%
- 组件行数 > 500
- 类型安全不足（大量 `as any`）
- 性能问题（频繁重渲染）

### Q: 重构时如何保持向后兼容？

A:
- 保持 API 接口不变
- 保持组件 props 不变
- 渐进式重构，不要一次性改动太大
- 充分测试

### Q: 如何确保重构不引入 bug？

A:
- 添加单元测试
- 添加集成测试
- 代码审查
- 逐步重构，每次只改一小部分

### Q: 重构后如何验证效果？

A:
- 代码行数减少
- 类型安全提升（`as any` 减少）
- 性能提升（渲染次数减少）
- 代码复用率提升

## 重构示例

### 示例 1: 类型安全改进

**重构前**:
```tsx
const columns = [
  {
    title: '状态',
    dataIndex: 'status',
    render: (v: any) => {
      if (v === 'pending') return <Tag>待审批</Tag>
      return <Tag>{v}</Tag>
    },
  },
]
```

**重构后**:
```tsx
interface Record {
  id: string
  status: 'pending' | 'approved' | 'rejected'
}

const columns: DataTableColumn<Record>[] = [
  {
    title: '状态',
    dataIndex: 'status',
    render: (status: Record['status']) => {
      return renderStatusTag(status, STATUS_MAP)
    },
  },
]
```

### 示例 2: 数据获取统一

**重构前**:
```tsx
const [employees, setEmployees] = useState([])
const loadEmployees = async () => {
  const result = await api.get('/employees')
  setEmployees(result)
}
useEffect(() => {
  loadEmployees()
}, [])
```

**重构后**:
```tsx
const { data: employees = [], refetch } = useEmployees()
```

### 示例 3: 表单字段提取

**重构前**:
```tsx
<Form.Item name="employeeId">
  <Select loading={loading}>
    {employees.map(emp => (
      <Option key={emp.id} value={emp.id}>
        {emp.name} ({emp.departmentName})
      </Option>
    ))}
  </Select>
</Form.Item>
```

**重构后**:
```tsx
<Form.Item name="employeeId">
  <EmployeeSelect />
</Form.Item>
```

## 相关文档

- [Hooks 使用文档](./HOOKS_USAGE.md)
- [组件库文档](./COMPONENT_LIBRARY.md)
- [React Query 优化指南](./REACT_QUERY_OPTIMIZATION.md)
- [组件性能优化指南](./COMPONENT_PERFORMANCE.md)
- [代码分割指南](./CODE_SPLITTING.md)
- [测试指南](./TESTING_GUIDE.md)

