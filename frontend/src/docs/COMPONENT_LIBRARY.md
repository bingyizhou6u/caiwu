# 组件库文档

## 概述

本文档介绍项目中可复用的组件，包括表单组件、表格组件和通用组件。

## 表单组件

### EmployeeSelect

员工选择器组件。

```tsx
import { EmployeeSelect } from '@/components/form'

<Form.Item name="employeeId" label="员工">
  <EmployeeSelect
    activeOnly={true}
    showDepartment={true}
    placeholder="请选择员工"
  />
</Form.Item>
```

**Props**:
- `activeOnly?: boolean` - 是否只显示活跃员工（默认: `true`）
- `showDepartment?: boolean` - 是否显示部门信息（默认: `true`）
- `formatLabel?: (employee) => string` - 自定义格式化标签
- 继承所有 `Select` 组件的 props

**特性**:
- 自动加载员工数据
- 支持搜索
- 显示部门信息（可选）

### AmountInput

金额输入组件。

```tsx
import { AmountInput } from '@/components/form'

<Form.Item name="amount" label="金额">
  <AmountInput
    precision={2}
    allowNegative={false}
    currency="CNY"
    placeholder="请输入金额"
  />
</Form.Item>
```

**Props**:
- `precision?: number` - 精度（小数位数，默认: `2`）
- `allowNegative?: boolean` - 是否允许负数（默认: `false`）
- `currency?: string` - 币种显示（仅用于显示）
- 继承所有 `InputNumber` 组件的 props

**特性**:
- 统一的金额格式
- 自动处理精度
- 支持币种显示

### CurrencySelect

币种选择器组件。

```tsx
import { CurrencySelect } from '@/components/form'

<Form.Item name="currency" label="币种">
  <CurrencySelect
    activeOnly={true}
    showCodeOnly={false}
  />
</Form.Item>
```

**Props**:
- `activeOnly?: boolean` - 是否只显示活跃币种（默认: `true`）
- `showCodeOnly?: boolean` - 是否只显示代码（默认: `false`）
- 继承所有 `Select` 组件的 props

### AccountSelect

账户选择器组件。

```tsx
import { AccountSelect } from '@/components/form'

<Form.Item name="accountId" label="账户">
  <AccountSelect
    activeOnly={true}
    currencyFilter="CNY"
    accountTypeFilter="bank"
  />
</Form.Item>
```

**Props**:
- `activeOnly?: boolean` - 是否只显示活跃账户（默认: `true`）
- `currencyFilter?: string` - 币种过滤
- `accountTypeFilter?: string` - 账户类型过滤
- 继承所有 `Select` 组件的 props

### DepartmentSelect

部门选择器组件。

```tsx
import { DepartmentSelect } from '@/components/form'

<Form.Item name="departmentId" label="部门">
  <DepartmentSelect activeOnly={true} />
</Form.Item>
```

**Props**:
- `activeOnly?: boolean` - 是否只显示活跃部门（默认: `true`）
- 继承所有 `Select` 组件的 props

### VendorSelect

供应商选择器组件。

```tsx
import { VendorSelect } from '@/components/form'

<Form.Item name="vendorId" label="供应商">
  <VendorSelect activeOnly={true} />
</Form.Item>
```

**Props**:
- `activeOnly?: boolean` - 是否只显示活跃供应商（默认: `true`）
- 继承所有 `Select` 组件的 props

## 表格组件

### DataTable

通用数据表格组件。

```tsx
import { DataTable, type DataTableColumn } from '@/components/common/DataTable'

const columns: DataTableColumn<Employee>[] = [
  { title: '姓名', dataIndex: 'name', key: 'name' },
  { title: '部门', dataIndex: 'departmentName', key: 'departmentName' },
]

function EmployeeTable() {
  const { data: employees = [], isLoading } = useEmployees()

  return (
    <DataTable<Employee>
      columns={columns}
      data={employees}
      loading={isLoading}
      rowKey="id"
      pagination={{
        current: 1,
        pageSize: 20,
        total: 100,
        onChange: (page, pageSize) => {
          // 处理分页
        },
      }}
      onEdit={(record) => {
        // 处理编辑
      }}
      onDelete={(record) => {
        // 处理删除
      }}
    />
  )
}
```

**Props**:
- `columns: DataTableColumn<T>[]` - 列定义
- `data: T[]` - 数据源
- `loading?: boolean` - 加载状态
- `pagination?:` - 分页配置
  - `current?: number` - 当前页
  - `pageSize?: number` - 每页条数
  - `total?: number` - 总条数
  - `onChange?: (page, pageSize) => void` - 分页变化回调
- `onEdit?: (record: T) => void` - 编辑回调
- `onDelete?: (record: T) => void` - 删除回调
- `onRefresh?: () => void` - 刷新回调
- `rowKey?: string | ((record: T) => string)` - 行键（默认: `'id'`）
- `rowSelection?:` - 行选择配置
- `actions?: (record: T) => ReactNode` - 自定义操作列
- `tableProps?:` - 其他 Table 组件的 props

**特性**:
- 自动添加操作列（编辑、删除）
- 统一的分页样式
- 支持自定义操作列
- 类型安全

### VirtualTable

虚拟滚动表格组件（用于大数据量）。

```tsx
import { VirtualTable } from '@/components/VirtualTable'

<VirtualTable
  columns={columns}
  dataSource={largeDataSet}
  rowKey="id"
  scroll={{ y: 500 }}
/>
```

**Props**:
- 继承所有 `Table` 组件的 props
- `scroll.y: number` - 虚拟滚动高度（必需）

**特性**:
- 虚拟滚动，支持大数据量
- 性能优化

## 通用组件

### PageContainer

页面容器组件。

```tsx
import { PageContainer } from '@/components/PageContainer'

function MyPage() {
  return (
    <PageContainer
      title="页面标题"
      breadcrumb={[
        { title: '首页' },
        { title: '当前页面' },
      ]}
    >
      <Card>页面内容</Card>
    </PageContainer>
  )
}
```

**Props**:
- `title: string` - 页面标题
- `breadcrumb?: Array<{ title: string }>` - 面包屑导航
- `children: ReactNode` - 页面内容

**特性**:
- 统一的页面布局
- 自动面包屑导航

### SearchFilters

搜索过滤器组件。

```tsx
import { SearchFilters } from '@/components/common/SearchFilters'

<SearchFilters
  fields={[
    {
      name: 'employeeId',
      label: '员工',
      type: 'select',
      options: employeeOptions,
    },
    {
      name: 'dateRange',
      label: '日期范围',
      type: 'dateRange',
    },
  ]}
  onSearch={(values) => {
    // 处理搜索
  }}
  onReset={() => {
    // 处理重置
  }}
/>
```

**Props**:
- `fields: SearchField[]` - 搜索字段配置
- `onSearch: (values: Record<string, any>) => void` - 搜索回调
- `onReset: () => void` - 重置回调
- `initialValues?: Record<string, any>` - 初始值

**字段类型**:
- `'select'` - 下拉选择
- `'input'` - 文本输入
- `'date'` - 日期选择
- `'dateRange'` - 日期范围选择

### FormModal

表单模态框组件。

```tsx
import { FormModal } from '@/components/FormModal'

<FormModal
  open={isOpen}
  title="编辑员工"
  onCancel={handleClose}
  onOk={handleSubmit}
  loading={isSubmitting}
>
  <Form form={form}>
    {/* 表单字段 */}
  </Form>
</FormModal>
```

**Props**:
- `open: boolean` - 是否打开
- `title: string` - 标题
- `onCancel: () => void` - 取消回调
- `onOk: () => void` - 确认回调
- `loading?: boolean` - 提交加载状态
- `children: ReactNode` - 表单内容

### MultiTabs

多标签页组件（用于页面内标签切换）。

```tsx
import { MultiTabs } from '@/components/MultiTabs'

<MultiTabs
  items={[
    { key: 'tab1', label: '标签1', children: <div>内容1</div> },
    { key: 'tab2', label: '标签2', children: <div>内容2</div> },
  ]}
/>
```

## 最佳实践

### 1. 使用类型安全的组件

```tsx
// ✅ 好的做法
const columns: DataTableColumn<Employee>[] = [
  { title: '姓名', dataIndex: 'name', key: 'name' },
]

<DataTable<Employee> columns={columns} data={employees} />

// ❌ 不好的做法
const columns = [
  { title: '姓名', dataIndex: 'name', key: 'name' },
]

<DataTable columns={columns} data={employees} />
```

### 2. 统一使用表单组件

```tsx
// ✅ 好的做法
<EmployeeSelect />
<AmountInput />
<CurrencySelect />

// ❌ 不好的做法
<Select>
  {employees.map(emp => (
    <Option key={emp.id} value={emp.id}>{emp.name}</Option>
  ))}
</Select>
```

### 3. 使用 DataTable 统一表格样式

```tsx
// ✅ 好的做法
<DataTable
  columns={columns}
  data={data}
  onEdit={handleEdit}
  onDelete={handleDelete}
/>

// ❌ 不好的做法
<Table
  columns={[...columns, {
    title: '操作',
    render: (_, record) => (
      <Space>
        <Button onClick={() => handleEdit(record)}>编辑</Button>
        <Button onClick={() => handleDelete(record)}>删除</Button>
      </Space>
    ),
  }]}
/>
```

### 4. 使用 PageContainer 统一页面布局

```tsx
// ✅ 好的做法
<PageContainer title="员工管理" breadcrumb={[...]}>
  <Card>内容</Card>
</PageContainer>

// ❌ 不好的做法
<div>
  <h1>员工管理</h1>
  <Card>内容</Card>
</div>
```

## 组件扩展

### 创建新的表单组件

参考 `EmployeeSelect` 的实现：

```tsx
import { Select, SelectProps } from 'antd'
import { useMyData } from '@/hooks'

export interface MySelectProps extends SelectProps {
  activeOnly?: boolean
}

export function MySelect({ activeOnly = true, ...props }: MySelectProps) {
  const { data = [], isLoading } = useMyData({ activeOnly })

  const options = data.map(item => ({
    value: item.id,
    label: item.name,
  }))

  return (
    <Select
      {...props}
      options={options}
      loading={isLoading}
      showSearch
      optionFilterProp="label"
    />
  )
}
```

### 创建新的表格列类型

```tsx
import { DataTableColumn } from '@/components/common/DataTable'

const statusColumn: DataTableColumn<Record> = {
  title: '状态',
  dataIndex: 'status',
  key: 'status',
  render: (status: string) => {
    const config = getStatusConfig(status, STATUS_MAP)
    return <Tag color={config.color}>{config.text}</Tag>
  },
}
```

## 常见问题

### Q: 如何自定义表单组件的样式？

A: 通过 `style` 或 `className` prop：

```tsx
<EmployeeSelect
  style={{ width: 200 }}
  className="custom-select"
/>
```

### Q: 如何禁用表单组件？

A: 使用 `disabled` prop：

```tsx
<EmployeeSelect disabled />
```

### Q: 如何自定义 DataTable 的操作列？

A: 使用 `actions` prop：

```tsx
<DataTable
  actions={(record) => (
    <Button onClick={() => handleCustomAction(record)}>
      自定义操作
    </Button>
  )}
/>
```

