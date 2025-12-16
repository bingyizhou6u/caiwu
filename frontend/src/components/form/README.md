# Form 表单组件库

本目录包含所有公共的表单组件，用于统一表单交互和样式。

## 组件列表

### AccountSelect - 账户选择器
账户下拉选择组件，支持按币种过滤。

**Props:**
- `filterByCurrency?: string` - 按币种过滤账户
- `showCurrency?: boolean` - 是否显示币种信息（默认 true）
- `formatLabel?: (account) => string` - 自定义格式化账户标签
- `onAccountChange?: (accountId, account) => void` - 选择账户时的回调

**示例:**
```tsx
// 基本用法
<Form.Item name="accountId" label="账户">
  <AccountSelect />
</Form.Item>

// 按币种过滤（使用 Form.Item 的 dependencies）
<Form.Item name="currencyId" label="币种">
  <CurrencySelect />
</Form.Item>
<Form.Item 
  name="accountId" 
  label="账户"
  dependencies={['currencyId']}
>
  {({ getFieldValue }) => (
    <AccountSelect filterByCurrency={getFieldValue('currencyId')} />
  )}
</Form.Item>
```

### AmountInput - 金额输入框
金额输入组件，统一格式和验证规则。

**Props:**
- `precision?: number` - 精度（小数位数），默认 2
- `allowNegative?: boolean` - 是否允许负数，默认 false
- `currency?: string` - 币种显示（仅用于显示）

**示例:**
```tsx
// 基本用法
<Form.Item name="amount" label="金额">
  <AmountInput placeholder="请输入金额" />
</Form.Item>

// 关联币种字段（使用 Form.Item 的 dependencies）
<Form.Item name="currencyId" label="币种">
  <CurrencySelect />
</Form.Item>
<Form.Item 
  name="amount" 
  label="金额"
  dependencies={['currencyId']}
>
  {({ getFieldValue }) => (
    <AmountInput currency={getFieldValue('currencyId')} />
  )}
</Form.Item>
```

### CurrencySelect - 币种选择器
币种下拉选择组件。

**Props:**
- `codeOnly?: boolean` - 是否只显示代码（不显示名称）
- `formatLabel?: (currency) => string` - 自定义格式化币种标签

**示例:**
```tsx
<Form.Item name="currencyId" label="币种">
  <CurrencySelect placeholder="请选择币种" />
</Form.Item>
```

### EmployeeSelect - 员工选择器
员工下拉选择组件，支持按状态过滤。

**Props:**
- `activeOnly?: boolean` - 是否只显示活跃员工（默认 true）
- `showDepartment?: boolean` - 是否显示部门信息（默认 true）
- `formatLabel?: (employee) => string` - 自定义格式化员工标签

**示例:**
```tsx
<Form.Item name="employeeId" label="员工">
  <EmployeeSelect placeholder="请选择员工" />
</Form.Item>
```

### DepartmentSelect - 部门选择器
部门下拉选择组件。

**Props:**
- `formatLabel?: (department) => string` - 自定义格式化部门标签

**示例:**
```tsx
<Form.Item name="departmentId" label="部门">
  <DepartmentSelect placeholder="请选择部门" />
</Form.Item>
```

### VendorSelect - 供应商选择器
供应商下拉选择组件。

**示例:**
```tsx
<Form.Item name="vendorId" label="供应商">
  <VendorSelect placeholder="请选择供应商" />
</Form.Item>
```

## 最佳实践

### 1. 字段关联
当需要根据一个字段的值来过滤或影响另一个字段时，使用 `Form.Item` 的 `dependencies` 属性：

```tsx
<Form.Item name="currencyId" label="币种">
  <CurrencySelect />
</Form.Item>
<Form.Item 
  name="accountId" 
  label="账户"
  dependencies={['currencyId']}
>
  {({ getFieldValue }) => (
    <AccountSelect filterByCurrency={getFieldValue('currencyId')} />
  )}
</Form.Item>
```

### 2. Form.List 中的使用
在 `Form.List` 中使用时，需要通过 `Form.Item` 的 `shouldUpdate` 或 `dependencies` 来实现字段关联：

```tsx
<Form.List name="salaries">
  {(fields) => fields.map(({ key, name, ...restField }) => (
    <Space key={key}>
      <Form.Item
        {...restField}
        name={[name, 'currencyId']}
      >
        <CurrencySelect />
      </Form.Item>
      <Form.Item
        {...restField}
        name={[name, 'amountCents']}
        dependencies={[[name, 'currencyId']]}
      >
        {({ getFieldValue }) => (
          <AmountInput currency={getFieldValue([name, 'currencyId'])} />
        )}
      </Form.Item>
    </Space>
  ))}
</Form.List>
```

### 3. 自定义格式化
使用 `formatLabel` 属性自定义选项显示：

```tsx
<AccountSelect
  formatLabel={(account) => `${account.name} (${account.currency})`}
/>
```

## 注意事项

1. 所有组件都支持 Ant Design Select/InputNumber 的所有原生属性
2. 组件会自动处理加载状态和空数据情况
3. 建议始终使用 `Form.Item` 包裹组件，以获得最佳的表单验证体验
4. 在 Form.List 中使用时，注意字段名的路径格式
