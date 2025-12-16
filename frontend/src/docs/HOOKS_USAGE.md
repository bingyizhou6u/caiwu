# Hooks 使用文档

## 概述

本文档介绍项目中使用的自定义 Hooks，包括业务 Hooks、表单 Hooks 和工具 Hooks。

## 业务 Hooks

### 数据查询 Hooks

#### useAccounts

获取账户列表。

```tsx
import { useAccounts } from '@/hooks'

function MyComponent() {
  const { data: accounts = [], isLoading } = useAccounts({
    activeOnly: true,
    currency: 'CNY',
    accountType: 'bank',
  })

  return (
    <Select>
      {accounts.map(acc => (
        <Option key={acc.id} value={acc.id}>{acc.name}</Option>
      ))}
    </Select>
  )
}
```

**参数**:
- `activeOnly?: boolean` - 是否只显示活跃账户
- `currency?: string` - 币种过滤
- `accountType?: string` - 账户类型过滤
- `search?: string` - 搜索关键词

**返回**:
- `data: Account[]` - 账户列表
- `isLoading: boolean` - 加载状态
- `error: Error | null` - 错误信息
- `refetch: () => void` - 重新获取数据

#### useEmployees

获取员工列表。

```tsx
const { data: employees = [], isLoading } = useEmployees({
  activeOnly: true,
  status: 'active',
  search: '张',
})
```

**参数**:
- `activeOnly?: boolean` - 是否只显示活跃员工
- `status?: string` - 员工状态
- `search?: string` - 搜索关键词

#### useFlows

获取现金流水列表。

```tsx
const { data: flows = [], isLoading, refetch } = useFlows({
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  type: 'income',
})
```

**特性**:
- 支持分页
- 支持过滤（日期范围、类型、账户等）
- 使用 `keepPreviousData` 优化分页体验

#### useBorrowings

获取借款列表。

```tsx
const { data: borrowings = [], isLoading } = useBorrowings({
  employeeId: '123',
  status: 'pending',
})
```

### 数据变更 Hooks

#### useCreateFlow

创建现金流水。

```tsx
import { useCreateFlow } from '@/hooks'
import { message } from 'antd'

function CreateFlowForm() {
  const { mutateAsync: createFlow, isPending } = useCreateFlow()

  const handleSubmit = async (values: FlowFormValues) => {
    try {
      await createFlow({
        ...values,
        amountCents: Math.round(values.amount * 100),
      })
      message.success('创建成功')
    } catch (error) {
      message.error('创建失败')
    }
  }

  return <Form onFinish={handleSubmit}>...</Form>
}
```

**特性**:
- 自动失效相关查询缓存
- 支持乐观更新（通过 `onMutate` 和 `onError`）

#### useUpdateFlow

更新现金流水。

```tsx
const { mutateAsync: updateFlow } = useUpdateFlow()

await updateFlow({
  id: '123',
  amountCents: 20000,
})
```

#### useDeleteFlow

删除现金流水。

```tsx
const { mutateAsync: deleteFlow } = useDeleteFlow()

await deleteFlow('123')
```

### 报表 Hooks

#### useARSummary

获取应收账款汇总报表。

```tsx
const { data: summary, isLoading } = useARSummary({
  asOf: '2024-01-31',
})
```

#### useExpenseDetail

获取支出明细报表。

```tsx
const { data: details, isLoading } = useExpenseDetail({
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  categoryId: '123',
})
```

## 表单 Hooks

### useZodForm

结合 Ant Design Form 和 Zod 验证。

```tsx
import { useZodForm } from '@/hooks'
import { z } from 'zod'

const flowSchema = z.object({
  amount: z.number().min(0.01),
  accountId: z.string().min(1),
  flowDate: z.string(),
})

function FlowForm() {
  const { form, validateWithZod } = useZodForm(flowSchema)

  const handleSubmit = async () => {
    try {
      const data = await validateWithZod()
      // data 已经通过 Zod 验证，类型安全
      await createFlow(data)
    } catch (error) {
      // 验证失败，错误已显示在表单中
      console.error('验证失败')
    }
  }

  return (
    <Form form={form} onFinish={handleSubmit}>
      <Form.Item name="amount" label="金额">
        <InputNumber />
      </Form.Item>
      <Button htmlType="submit">提交</Button>
    </Form>
  )
}
```

**特性**:
- 类型安全的表单验证
- 自动将 Zod 错误转换为 Ant Design Form 错误
- 支持嵌套字段验证

### useFormModal

管理表单模态框状态。

```tsx
import { useFormModal } from '@/hooks'

function EmployeeManagement() {
  const modal = useFormModal<Employee>()

  return (
    <>
      <Button onClick={modal.openCreate}>新建</Button>
      <Button onClick={() => modal.openEdit(employee)}>编辑</Button>

      <Modal
        open={modal.isOpen}
        onCancel={modal.close}
        title={modal.isCreate ? '新建员工' : '编辑员工'}
      >
        {modal.data && <EmployeeForm data={modal.data} />}
      </Modal>
    </>
  )
}
```

**返回**:
- `isOpen: boolean` - 模态框是否打开
- `mode: 'create' | 'edit' | 'view' | null` - 当前模式
- `data: T | null` - 编辑的数据
- `isCreate: boolean` - 是否为创建模式
- `isEdit: boolean` - 是否为编辑模式
- `isView: boolean` - 是否为查看模式
- `openCreate: () => void` - 打开创建模态框
- `openEdit: (data: T) => void` - 打开编辑模态框
- `openView: (data: T) => void` - 打开查看模态框
- `close: () => void` - 关闭模态框

### useTableActions

管理表格操作（编辑、删除等）。

```tsx
import { useTableActions } from '@/hooks'

function DataTable() {
  const actions = useTableActions<Employee>({
    onEdit: (record) => {
      console.log('编辑', record)
    },
    onDelete: async (record) => {
      await deleteEmployee(record.id)
    },
  })

  return (
    <Table
      columns={[
        ...columns,
        {
          title: '操作',
          render: (_, record) => actions.render(record),
        },
      ]}
    />
  )
}
```

## 工具 Hooks

### useApiQuery

通用 API 查询 Hook（基于 React Query）。

```tsx
import { useApiQuery } from '@/utils/useApiQuery'

function CustomComponent() {
  const { data, isLoading, error } = useApiQuery(
    ['custom-data', id],
    `/api/custom/${id}`,
    {
      enabled: !!id,
      staleTime: 5 * 60 * 1000, // 5分钟
      select: (data) => data.results, // 数据转换
    }
  )

  if (isLoading) return <Spin />
  if (error) return <div>错误: {error.message}</div>

  return <div>{data}</div>
}
```

**参数**:
- `key: any` - 查询键（用于缓存）
- `url: string` - API 地址
- `options?:` - 查询选项
  - `enabled?: boolean` - 是否启用查询
  - `staleTime?: number` - 数据过期时间（毫秒）
  - `gcTime?: number` - 缓存时间（毫秒）
  - `select?: (data: any) => any` - 数据转换函数
  - `placeholderData?: any` - 占位数据（用于分页优化）

### useApiMutation

通用 API 变更 Hook。

```tsx
import { useApiMutation } from '@/utils/useApiQuery'

function CreateForm() {
  const { mutateAsync, isPending } = useApiMutation()

  const handleSubmit = async (values: FormValues) => {
    await mutateAsync({
      url: '/api/items',
      method: 'POST',
      body: values,
    })
  }

  return <Form onFinish={handleSubmit}>...</Form>
}
```

**特性**:
- 自动失效相关查询缓存
- 支持乐观更新（通过 `onMutate` 和 `onError`）

## 最佳实践

### 1. 使用类型安全的 Hooks

```tsx
// ✅ 好的做法
const { data: employees } = useEmployees<Employee[]>()
employees.forEach(emp => {
  console.log(emp.name) // 类型安全
})

// ❌ 不好的做法
const { data } = useEmployees()
data.forEach((emp: any) => {
  console.log(emp.name) // 没有类型检查
})
```

### 2. 处理加载和错误状态

```tsx
const { data, isLoading, error } = useAccounts()

if (isLoading) return <Spin />
if (error) return <Alert message={error.message} type="error" />

return <Table dataSource={data} />
```

### 3. 使用 refetch 刷新数据

```tsx
const { data, refetch } = useFlows()

const handleRefresh = () => {
  refetch()
}

return (
  <>
    <Button onClick={handleRefresh}>刷新</Button>
    <Table dataSource={data} />
  </>
)
```

### 4. 优化查询性能

```tsx
// 使用 select 转换数据，避免不必要的重渲染
const { data: accountNames } = useAccounts({
  select: (accounts) => accounts.map(acc => acc.name),
})

// 使用 enabled 控制查询时机
const { data } = useAccountDetails(accountId, {
  enabled: !!accountId, // 只有 accountId 存在时才查询
})
```

### 5. 处理表单验证

```tsx
const { form, validateWithZod } = useZodForm(schema)

const handleSubmit = async () => {
  try {
    const data = await validateWithZod()
    // 数据已验证，类型安全
    await submit(data)
  } catch (error) {
    // 验证失败，错误已显示在表单中
    // 不需要手动处理
  }
}
```

## 常见问题

### Q: 如何刷新数据？

A: 使用 `refetch()` 方法：

```tsx
const { refetch } = useAccounts()
refetch()
```

### Q: 如何手动失效缓存？

A: 使用 `useQueryClient`：

```tsx
import { useQueryClient } from '@tanstack/react-query'

const queryClient = useQueryClient()
queryClient.invalidateQueries({ queryKey: ['accounts'] })
```

### Q: 如何实现乐观更新？

A: 使用 `onMutate` 和 `onError`：

```tsx
const { mutateAsync } = useCreateFlow()

mutateAsync(
  { amountCents: 100 },
  {
    onMutate: async (newData) => {
      // 取消正在进行的查询
      await queryClient.cancelQueries({ queryKey: ['flows'] })
      
      // 快照旧数据
      const previousData = queryClient.getQueryData(['flows'])
      
      // 乐观更新
      queryClient.setQueryData(['flows'], (old) => [...old, newData])
      
      return { previousData }
    },
    onError: (error, newData, context) => {
      // 回滚
      queryClient.setQueryData(['flows'], context.previousData)
    },
  }
)
```

### Q: 如何处理分页？

A: 使用 `keepPreviousData`：

```tsx
const { data, isLoading } = useFlows({
  page: 1,
  pageSize: 20,
  placeholderData: keepPreviousData, // 保持上一页数据，避免闪烁
})
```

