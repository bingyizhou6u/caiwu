# 组件拆分指南

> **最后更新**: 2025-12-30  
> **相关文档**: [表单组件](form-components.md) | [样式架构](styles.md)

---

## 概述

本文档说明如何将大型组件（>500行）拆分为更小、更易维护的子组件。

## 拆分原则

1. **单一职责原则**：每个组件只负责一个功能
2. **可复用性**：提取可在多处使用的组件
3. **关注点分离**：将数据获取、业务逻辑、UI渲染分离
4. **保持可测试性**：拆分后的组件应该易于测试

## RentalManagement.tsx 拆分建议

### 当前结构分析

`RentalManagement.tsx` (1125行) 包含：
- 主表格展示
- 创建/编辑表单模态框
- 详情模态框（包含多个子表格）
- 支付记录模态框
- 宿舍分配模态框
- 文件上传逻辑
- 多个状态管理

### 建议拆分方案

#### 1. 表单组件
```
components/
  ├── RentalPropertyForm.tsx        # 创建/编辑表单（可复用）
  ├── RentalPaymentForm.tsx         # 支付记录表单
  └── DormitoryAllocationForm.tsx   # 宿舍分配表单
```

#### 2. 模态框组件
```
components/
  ├── CreateRentalPropertyModal.tsx # 创建模态框
  ├── EditRentalPropertyModal.tsx   # 编辑模态框
  ├── RentalDetailModal.tsx         # 详情模态框
  │   ├── RentalBasicInfo.tsx       # 基本信息标签页
  │   ├── RentalPaymentsTab.tsx     # 付款记录标签页
  │   ├── RentalAllocationsTab.tsx  # 宿舍分配标签页
  │   └── RentalChangesTab.tsx      # 变动记录标签页
  └── RentalPaymentModal.tsx         # 支付记录模态框
```

#### 3. 表格组件
```
components/
  ├── RentalPropertyTable.tsx       # 主表格
  └── RentalTableColumns.tsx        # 表格列定义（常量）
```

#### 4. 工具函数
```
utils/
  ├── rentalFormatters.ts           # 格式化函数
  └── rentalConstants.ts            # 常量定义
```

### 拆分步骤

1. **提取常量**：将选项、状态映射等提取到单独文件
2. **提取表单组件**：创建可复用的表单组件
3. **提取模态框组件**：将每个模态框提取为独立组件
4. **提取表格组件**：将表格和列定义分离
5. **提取工具函数**：将格式化、验证等逻辑提取
6. **重构主组件**：使用提取的组件重构主组件

### 示例：提取表单组件

```tsx
// components/RentalPropertyForm.tsx
interface RentalPropertyFormProps {
  form: FormInstance
  mode: 'create' | 'edit'
  currencies: SelectOption[]
  departments: SelectOption[]
  employees: SelectOption[]
  onContractUpload?: (file: File) => Promise<void>
  contractFileList?: UploadFile[]
  contractUploading?: boolean
}

export function RentalPropertyForm({
  form,
  mode,
  currencies,
  departments,
  employees,
  onContractUpload,
  contractFileList,
  contractUploading,
}: RentalPropertyFormProps) {
  // 表单字段渲染逻辑
}
```

### 拆分后的优势

1. **可维护性**：每个组件职责单一，易于理解和修改
2. **可测试性**：小组件更容易编写单元测试
3. **可复用性**：表单组件可以在不同场景复用
4. **性能优化**：可以使用 React.memo 优化子组件
5. **代码组织**：代码结构更清晰，易于导航

## 其他大型组件拆分建议

### ExpenseReimbursement.tsx (829行)
- 提取：创建/编辑表单、审批表单、表格列定义

### SalaryPayments.tsx (707行)
- 提取：薪资生成表单、分配表单、确认表单、表格列定义

### Flows.tsx (649行)
- 提取：创建表单、凭证上传组件、表格列定义

### EmployeeManagement.tsx (588行)
- 提取：员工表格、操作菜单、详情展示

## 注意事项

1. **保持向后兼容**：拆分时确保不影响现有功能
2. **类型安全**：确保所有组件都有完整的类型定义
3. **Props 设计**：合理设计组件接口，避免过度耦合
4. **状态管理**：考虑使用 Context 或状态提升管理共享状态
5. **测试覆盖**：拆分后确保测试覆盖不降低

