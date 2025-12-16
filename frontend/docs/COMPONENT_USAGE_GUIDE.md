# 公共组件使用指南

**版本**: 1.0  
**更新日期**: 2024-12-19  
**适用范围**: 前端开发团队

---

## 📋 目录

1. [概述](#概述)
2. [组件选择决策树](#组件选择决策树)
3. [Common 组件使用指南](#common-组件使用指南)
4. [Form 表单组件使用指南](#form-表单组件使用指南)
5. [独立组件使用指南](#独立组件使用指南)
6. [最佳实践](#最佳实践)
7. [常见问题](#常见问题)

---

## 概述

本文档旨在统一前端开发中公共组件的使用规范，确保代码一致性、可维护性和开发效率。

### 为什么使用公共组件？

1. **代码复用**: 减少重复代码，提高开发效率
2. **统一体验**: 保证 UI/UX 的一致性
3. **易于维护**: 集中维护，一次修改全局生效
4. **类型安全**: TypeScript 类型定义完善
5. **性能优化**: 统一的性能优化策略

### 组件分类

- **Common 组件** (`components/common/`): 通用业务组件
- **Form 组件** (`components/form/`): 表单字段组件
- **独立组件**: 特定功能组件

---

## 组件选择决策树

### 列表页面组件选择

```
需要显示数据列表？
├─ 是 → 使用 DataTable
│   ├─ 需要搜索筛选？ → 使用 SearchFilters
│   ├─ 需要操作按钮？ → 使用 PageToolbar
│   └─ 需要批量操作？ → 使用 BatchActionButton
│
└─ 否 → 使用 PageContainer + 自定义内容
```

### 表单页面组件选择

```
需要表单输入？
├─ 是 → 使用 FormModal（弹窗表单）或 PageContainer + Form（页面表单）
│   ├─ 需要选择账户？ → 使用 AccountSelect
│   ├─ 需要输入金额？ → 使用 AmountInput
│   ├─ 需要选择币种？ → 使用 CurrencySelect
│   ├─ 需要选择部门？ → 使用 DepartmentSelect
│   ├─ 需要选择员工？ → 使用 EmployeeSelect
│   └─ 需要选择供应商？ → 使用 VendorSelect
│
└─ 否 → 使用 PageContainer
```

### 金额显示组件选择

```
需要显示金额？
├─ 是 → 使用 AmountDisplay
│   └─ 需要处理空值？ → AmountDisplay 已内置处理
│
└─ 否 → 使用普通文本显示
```

### 状态显示组件选择

```
需要显示状态？
├─ 是 → 使用 StatusTag
│   └─ 需要自定义状态映射？ → 传入 statusMap
│
└─ 否 → 使用普通文本或 Tag
```

---

## Common 组件使用指南

### 1. PageContainer - 页面容器

**必要度**: ⭐⭐⭐⭐⭐  
**覆盖率**: 92%

#### 何时使用

- ✅ **必须使用**: 所有页面组件都应该使用 PageContainer
- ✅ 需要统一的页面布局（标题、面包屑）
- ✅ 需要错误边界保护
- ✅ 需要加载状态显示

#### 使用示例

```tsx
import { PageContainer } from '@/components/PageContainer'

export function MyPage() {
  return (
    <PageContainer
      title="页面标题"
      breadcrumb={[
        { title: '首页', path: '/dashboard' },
        { title: '当前页面' }
      ]}
      loading={isLoading}
    >
      {/* 页面内容 */}
    </PageContainer>
  )
}
```

#### 禁止事项

- ❌ 不要直接使用 Layout + Breadcrumb + Spin，应使用 PageContainer
- ❌ 不要在页面中手动实现错误边界，PageContainer 已内置

---

### 2. DataTable - 数据表格

**必要度**: ⭐⭐⭐⭐⭐  
**覆盖率**: 81%

#### 何时使用

- ✅ **必须使用**: 所有需要显示数据列表的页面
- ✅ 需要分页、排序、筛选功能
- ✅ 需要操作列（编辑、删除）

#### 使用示例

```tsx
import { DataTable, type DataTableColumn } from '@/components/common'

const columns: DataTableColumn<MyDataType>[] = [
  { title: 'ID', dataIndex: 'id', key: 'id' },
  { title: '名称', dataIndex: 'name', key: 'name' },
  // ... 其他列
]

export function MyListPage() {
  return (
    <PageContainer title="列表页面">
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        pagination={{
          current: page,
          pageSize: pageSize,
          total: total,
          onChange: (p, ps) => {
            setPage(p)
            setPageSize(ps)
          }
        }}
        onEdit={(record) => handleEdit(record)}
        onDelete={(record) => handleDelete(record)}
        onRefresh={() => refetch()}
      />
    </PageContainer>
  )
}
```

#### 禁止事项

- ❌ 不要直接使用 Ant Design Table，应使用 DataTable
- ❌ 不要在列定义中手动实现操作列，使用 `onEdit` 和 `onDelete` 属性

---

### 3. SearchFilters - 搜索筛选

**必要度**: ⭐⭐⭐⭐  
**覆盖率**: 34% (目标: 60%+)

#### 何时使用

- ✅ **应该使用**: 所有需要搜索筛选的列表页面
- ✅ 需要多个筛选条件
- ✅ 需要日期范围选择

#### 使用示例

```tsx
import { SearchFilters } from '@/components/common'
import type { SearchFilterField } from '@/components/common/SearchFilters'

const filterFields: SearchFilterField[] = [
  {
    name: 'keyword',
    label: '关键词',
    type: 'input',
    placeholder: '请输入关键词'
  },
  {
    name: 'status',
    label: '状态',
    type: 'select',
    options: [
      { label: '启用', value: 'active' },
      { label: '禁用', value: 'inactive' }
    ]
  },
  {
    name: 'dateRange',
    label: '日期范围',
    type: 'dateRange',
    showQuickSelect: true
  }
]

export function MyListPage() {
  const handleSearch = (values: Record<string, any>) => {
    // values.dateRangeStart, values.dateRangeEnd 已自动格式化
    setSearchParams(values)
    refetch()
  }

  return (
    <PageContainer title="列表页面">
      <SearchFilters
        fields={filterFields}
        onSearch={handleSearch}
        onReset={() => {
          setSearchParams({})
          refetch()
        }}
      />
      <DataTable ... />
    </PageContainer>
  )
}
```

#### 禁止事项

- ❌ 不要手动实现搜索表单，应使用 SearchFilters
- ❌ 不要手动处理日期格式化，SearchFilters 已自动处理

---

### 4. FormModal - 表单模态框

**必要度**: ⭐⭐⭐⭐  
**覆盖率**: 34% (目标: 60%+)

#### 何时使用

- ✅ **应该使用**: 所有弹窗表单
- ✅ 需要表单验证
- ✅ 需要统一的提交和取消逻辑

#### 使用示例

```tsx
import { FormModal } from '@/components/FormModal'
import { Form, Input } from 'antd'

export function MyPage() {
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)

  const handleSubmit = async () => {
    const values = await form.validateFields()
    await api.create(values)
    message.success('创建成功')
    setModalOpen(false)
    refetch()
  }

  return (
    <>
      <Button onClick={() => setModalOpen(true)}>新建</Button>
      <FormModal
        open={modalOpen}
        title="新建记录"
        form={form}
        onSubmit={handleSubmit}
        onCancel={() => {
          setModalOpen(false)
          form.resetFields()
        }}
      >
        <Form.Item name="name" label="名称" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
      </FormModal>
    </>
  )
}
```

#### 禁止事项

- ❌ 不要直接使用 Modal + Form，应使用 FormModal
- ❌ 不要手动处理表单验证和错误处理，FormModal 已内置

---

### 5. AmountDisplay - 金额显示

**必要度**: ⭐⭐⭐⭐  
**覆盖率**: 51%

#### 何时使用

- ✅ **应该使用**: 所有需要显示金额的地方
- ✅ 需要统一金额格式
- ✅ 需要处理空值

#### 使用示例

```tsx
import { AmountDisplay } from '@/components/common'

// 基本使用
<AmountDisplay cents={amountCents} currency="CNY" />

// 不显示币种符号
<AmountDisplay cents={amountCents} currency="CNY" showSymbol={false} />

// 自定义空值显示
<AmountDisplay cents={null} emptyText="暂无金额" />
```

#### 禁止事项

- ❌ 不要手动格式化金额，应使用 AmountDisplay
- ❌ 不要手动处理空值，AmountDisplay 已内置处理

---

### 6. StatusTag - 状态标签

**必要度**: ⭐⭐⭐  
**覆盖率**: 20% (目标: 50%+)

#### 何时使用

- ✅ **应该使用**: 需要显示状态的地方
- ✅ 需要统一状态样式
- ✅ 需要自定义状态映射

#### 使用示例

```tsx
import { StatusTag } from '@/components/common'
import { getStatusConfig } from '@/utils/status'

const statusMap = {
  active: { text: '启用', color: 'green' },
  inactive: { text: '禁用', color: 'red' }
}

<StatusTag status={record.status} statusMap={statusMap} />
```

#### 禁止事项

- ❌ 不要直接使用 Tag，应使用 StatusTag（如果需要统一状态显示）

---

### 7. PageToolbar - 页面工具栏

**必要度**: ⭐⭐⭐⭐  
**覆盖率**: 59%

#### 何时使用

- ✅ **应该使用**: 页面顶部需要操作按钮
- ✅ 需要统一的按钮布局和样式

#### 使用示例

```tsx
import { PageToolbar } from '@/components/common'
import { PlusOutlined } from '@ant-design/icons'

<PageToolbar
  actions={[
    {
      label: '新建',
      type: 'primary',
      icon: <PlusOutlined />,
      onClick: () => setModalOpen(true)
    },
    {
      label: '导出',
      onClick: handleExport
    }
  ]}
/>
```

---

### 8. EmptyText - 空值文本

**必要度**: ⭐⭐⭐  
**覆盖率**: 34%

#### 何时使用

- ✅ **可选使用**: 需要统一空值显示
- ⚠️ 也可以用三元运算符简单替代：`value ?? '-'`

#### 使用示例

```tsx
import { EmptyText } from '@/components/common'

<EmptyText value={record.description} emptyText="暂无描述" />
```

---

### 9. BatchActionButton - 批量操作按钮

**必要度**: ⭐⭐⭐  
**覆盖率**: 8% (目标: 提升)

#### 何时使用

- ✅ **应该使用**: 需要批量操作的页面
- ✅ 需要确认对话框

#### 使用示例

```tsx
import { BatchActionButton } from '@/components/common'
import { DataTable } from '@/components/common'

const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])

<BatchActionButton
  label="批量删除"
  selectedCount={selectedRowKeys.length}
  onConfirm={() => handleBatchDelete(selectedRowKeys)}
  confirmTitle={(count) => `确定要删除选中的 ${count} 项吗？`}
/>

<DataTable
  rowSelection={{
    selectedRowKeys,
    onChange: setSelectedRowKeys
  }}
  // ...
/>
```

---

## Form 表单组件使用指南

### 概述

Form 表单组件封装了常用的表单字段，统一了数据获取、格式化、验证等逻辑。

**重要**: 所有 Form 表单组件都应该被使用，而不是直接使用 Ant Design 的 Select/InputNumber。

### 1. AccountSelect - 账户选择器

**必要度**: ⭐⭐⭐⭐  
**覆盖率**: 0% (目标: 50%+)

#### 何时使用

- ✅ **必须使用**: 所有需要选择账户的表单
- ✅ 需要按币种过滤账户
- ✅ 需要统一账户显示格式

#### 使用示例

```tsx
import { AccountSelect } from '@/components/form'
import { Form } from 'antd'

<Form.Item name="accountId" label="账户" rules={[{ required: true }]}>
  <AccountSelect
    filterByCurrency="CNY"
    showCurrency
    placeholder="请选择账户"
    onAccountChange={(id, account) => {
      // account 包含账户完整信息
      console.log('选择的账户:', account)
    }}
  />
</Form.Item>
```

#### 禁止事项

- ❌ **禁止**: 直接使用 `<Select>` 选择账户
- ❌ **禁止**: 手动实现账户数据获取和格式化

---

### 2. AmountInput - 金额输入框

**必要度**: ⭐⭐⭐⭐  
**覆盖率**: 0% (目标: 50%+)

#### 何时使用

- ✅ **必须使用**: 所有需要输入金额的表单
- ✅ 需要统一金额格式和验证

#### 使用示例

```tsx
import { AmountInput } from '@/components/form'
import { Form } from 'antd'

<Form.Item name="amount" label="金额" rules={[{ required: true }]}>
  <AmountInput
    precision={2}
    allowNegative={false}
    currency="CNY"
    placeholder="请输入金额"
  />
</Form.Item>
```

#### 禁止事项

- ❌ **禁止**: 直接使用 `<InputNumber>` 输入金额
- ❌ **禁止**: 手动配置 precision、min 等属性

---

### 3. CurrencySelect - 币种选择器

**必要度**: ⭐⭐⭐⭐  
**覆盖率**: 0% (目标: 50%+)

#### 何时使用

- ✅ **必须使用**: 所有需要选择币种的表单
- ✅ 需要统一币种显示格式

#### 使用示例

```tsx
import { CurrencySelect } from '@/components/form'
import { Form } from 'antd'

<Form.Item name="currency" label="币种" rules={[{ required: true }]}>
  <CurrencySelect placeholder="请选择币种" />
</Form.Item>
```

#### 禁止事项

- ❌ **禁止**: 直接使用 `<Select>` 选择币种

---

### 4. DepartmentSelect - 部门选择器

**必要度**: ⭐⭐⭐⭐  
**覆盖率**: 0% (目标: 50%+)

#### 何时使用

- ✅ **必须使用**: 所有需要选择部门的表单
- ✅ 需要按项目过滤部门

#### 使用示例

```tsx
import { DepartmentSelect } from '@/components/form'
import { Form } from 'antd'

<Form.Item name="departmentId" label="部门" rules={[{ required: true }]}>
  <DepartmentSelect
    activeOnly
    placeholder="请选择部门"
  />
</Form.Item>
```

#### 禁止事项

- ❌ **禁止**: 直接使用 `<Select>` 选择部门

---

### 5. EmployeeSelect - 员工选择器

**必要度**: ⭐⭐⭐⭐  
**覆盖率**: 0% (目标: 50%+)

#### 何时使用

- ✅ **必须使用**: 所有需要选择员工的表单
- ✅ 需要搜索和过滤员工

#### 使用示例

```tsx
import { EmployeeSelect } from '@/components/form'
import { Form } from 'antd'

<Form.Item name="employeeId" label="员工" rules={[{ required: true }]}>
  <EmployeeSelect
    activeOnly
    placeholder="请选择员工"
    showSearch
  />
</Form.Item>
```

#### 禁止事项

- ❌ **禁止**: 直接使用 `<Select>` 选择员工

---

### 6. VendorSelect - 供应商选择器

**必要度**: ⭐⭐⭐⭐  
**覆盖率**: 0% (目标: 50%+)

#### 何时使用

- ✅ **必须使用**: 所有需要选择供应商的表单
- ✅ 需要统一供应商显示格式

#### 使用示例

```tsx
import { VendorSelect } from '@/components/form'
import { Form } from 'antd'

<Form.Item name="vendorId" label="供应商" rules={[{ required: true }]}>
  <VendorSelect
    activeOnly
    placeholder="请选择供应商"
  />
</Form.Item>
```

#### 禁止事项

- ❌ **禁止**: 直接使用 `<Select>` 选择供应商

---

## 独立组件使用指南

### 1. DateRangePicker - 日期范围选择器

**必要度**: ⭐⭐⭐⭐  
**覆盖率**: 14%

#### 何时使用

- ✅ **应该使用**: 报表页面需要日期范围选择
- ✅ 需要快捷日期选择功能

#### 使用示例

```tsx
import { DateRangePicker } from '@/components/DateRangePicker'
import dayjs from 'dayjs'

const [range, setRange] = useState<[Dayjs, Dayjs] | null>([
  dayjs().startOf('month'),
  dayjs()
])

<DateRangePicker
  value={range}
  onChange={(v) => v && setRange(v)}
/>
```

---

### 2. SensitiveField - 敏感字段显示

**必要度**: ⭐⭐⭐⭐  
**覆盖率**: 2% (目标: 80%+)

#### 何时使用

- ✅ **必须使用**: 所有需要显示敏感信息的页面
- ✅ 需要权限控制和审计日志
- ✅ 需要脱敏显示

#### 使用示例

```tsx
import { SensitiveField } from '@/components/SensitiveField'

// 薪资信息
<SensitiveField
  value={formatAmountWithCurrency(salaryCents, 'CNY', false)}
  type="salary"
  permission="hr.salary.view"
  entityId={employeeId}
  entityType="employee"
/>

// 电话号码
<SensitiveField
  value={phone}
  type="phone"
  permission="hr.employee.view_sensitive"
  entityId={employeeId}
  entityType="employee"
/>
```

#### 禁止事项

- ❌ **禁止**: 直接显示敏感信息，应使用 SensitiveField

---

### 3. VirtualTable - 虚拟滚动表格

**必要度**: ⭐⭐⭐  
**覆盖率**: 2%

#### 何时使用

- ✅ **可选使用**: 数据量特别大（1000+ 行）的表格
- ⚠️ 大多数场景使用 DataTable 即可

---

## 最佳实践

### 1. 组件导入规范

```tsx
// ✅ 正确：从统一导出文件导入
import { DataTable, PageToolbar, AmountDisplay } from '@/components/common'
import { AccountSelect, AmountInput } from '@/components/form'

// ❌ 错误：直接从文件导入
import { DataTable } from '@/components/common/DataTable'
```

### 2. 页面结构标准模板

```tsx
import { PageContainer } from '@/components/PageContainer'
import { DataTable, PageToolbar, SearchFilters } from '@/components/common'
import { FormModal } from '@/components/FormModal'

export function MyListPage() {
  return (
    <PageContainer title="页面标题">
      <PageToolbar actions={[...]} />
      <SearchFilters fields={[...]} onSearch={handleSearch} />
      <DataTable columns={columns} data={data} />
      <FormModal ... />
    </PageContainer>
  )
}
```

### 3. 表单页面标准模板

```tsx
import { PageContainer } from '@/components/PageContainer'
import { FormModal } from '@/components/FormModal'
import { AccountSelect, AmountInput } from '@/components/form'
import { Form } from 'antd'

export function MyFormPage() {
  const [form] = Form.useForm()
  
  return (
    <PageContainer title="表单页面">
      <FormModal form={form} onSubmit={handleSubmit}>
        <Form.Item name="accountId" label="账户">
          <AccountSelect />
        </Form.Item>
        <Form.Item name="amount" label="金额">
          <AmountInput />
        </Form.Item>
      </FormModal>
    </PageContainer>
  )
}
```

### 4. 类型定义规范

```tsx
// ✅ 正确：使用组件导出的类型
import type { DataTableColumn } from '@/components/common'
import type { SearchFilterField } from '@/components/common/SearchFilters'

const columns: DataTableColumn<MyType>[] = [...]
const fields: SearchFilterField[] = [...]
```

---

## 常见问题

### Q1: 什么时候应该使用公共组件？

**A**: 如果公共组件能满足需求，就应该使用。不要因为"想自定义"而拒绝使用公共组件。

### Q2: 公共组件功能不够怎么办？

**A**: 
1. 先检查是否有配置项可以满足需求
2. 如果确实不够，提出需求，完善组件
3. 不要绕过组件直接使用底层组件

### Q3: Form 表单组件必须使用吗？

**A**: **是的**，所有 Form 表单组件都应该被使用。这是强制要求，代码审查时会检查。

### Q4: 如何判断应该使用哪个组件？

**A**: 参考本文档的"组件选择决策树"部分。

### Q5: 组件性能如何？

**A**: 所有公共组件都经过性能优化，使用 React.memo、useMemo 等优化手段。

---

## 代码审查检查清单

在提交代码前，请检查：

- [ ] 所有页面都使用了 PageContainer
- [ ] 所有列表都使用了 DataTable
- [ ] 所有表单字段都使用了 Form 表单组件（AccountSelect、AmountInput 等）
- [ ] 所有弹窗表单都使用了 FormModal
- [ ] 所有搜索筛选都使用了 SearchFilters
- [ ] 所有金额显示都使用了 AmountDisplay
- [ ] 所有敏感信息显示都使用了 SensitiveField
- [ ] 没有直接使用 Ant Design 的 Table、Select、InputNumber 等组件（除非公共组件不支持）

---

## 相关文档

- [组件库文档](../src/docs/COMPONENT_LIBRARY.md)
- [代码审查检查清单](./CODE_REVIEW_CHECKLIST.md)
- [组件必要度分析](../../.agent/COMPONENTS_NECESSITY_ANALYSIS.md)

---

**文档维护**: 前端开发团队  
**最后更新**: 2024-12-19
