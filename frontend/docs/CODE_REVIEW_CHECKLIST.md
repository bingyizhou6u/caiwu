# 代码审查检查清单

**版本**: 1.0  
**更新日期**: 2024-12-19  
**适用范围**: 所有代码审查

---

## 📋 审查前准备

在开始代码审查前，请确保：

- [ ] 代码已通过本地构建
- [ ] 代码已通过本地测试
- [ ] 代码已通过 Linter 检查
- [ ] 已阅读相关需求文档

---

## 🔍 代码规范检查

### 命名规范

- [ ] **文件命名**
  - [ ] 页面组件：`XxxPage.tsx`
  - [ ] 服务类：`XxxService.ts`
  - [ ] 路由文件：`xxx.ts`（小写复数）
  - [ ] 工具函数：`xxx.ts`（小写）

- [ ] **变量命名**
  - [ ] 使用驼峰命名：`camelCase`
  - [ ] 常量使用大写：`CONSTANT_NAME`
  - [ ] 金额字段使用 `amountCents`（整数，单位为分）

- [ ] **函数命名**
  - [ ] 使用动词开头：`handleClick`, `fetchData`
  - [ ] 布尔值使用 `is/has/should` 前缀：`isLoading`, `hasPermission`

### 代码风格

- [ ] **导入语句**
  - [ ] 按顺序组织：框架导入 → 类型导入 → 工具导入 → 业务导入
  - [ ] 使用统一导出：`from '@/components/common'`
  - [ ] 移除未使用的导入

- [ ] **类型定义**
  - [ ] 使用 TypeScript 类型
  - [ ] 避免使用 `any`
  - [ ] 使用组件导出的类型：`DataTableColumn`, `SearchFilterField`

- [ ] **注释规范**
  - [ ] 业务逻辑注释使用中文
  - [ ] 复杂逻辑有解释性注释
  - [ ] 关键函数有 JSDoc 注释

---

## 🧩 组件使用检查

### 必须使用的组件

- [ ] **PageContainer**
  - [ ] 所有页面组件都使用了 PageContainer
  - [ ] 没有直接使用 Layout + Breadcrumb + Spin

- [ ] **DataTable**
  - [ ] 所有列表页面都使用了 DataTable
  - [ ] 没有直接使用 Ant Design Table
  - [ ] 操作列使用 `onEdit` 和 `onDelete` 属性

- [ ] **Form 表单组件**（强制要求）
  - [ ] 选择账户：使用 `AccountSelect`，不是 `<Select>`
  - [ ] 输入金额：使用 `AmountInput`，不是 `<InputNumber>`
  - [ ] 选择币种：使用 `CurrencySelect`，不是 `<Select>`
  - [ ] 选择部门：使用 `DepartmentSelect`，不是 `<Select>`
  - [ ] 选择员工：使用 `EmployeeSelect`，不是 `<Select>`
  - [ ] 选择供应商：使用 `VendorSelect`，不是 `<Select>`

### 应该使用的组件

- [ ] **SearchFilters**
  - [ ] 列表页面有搜索筛选功能时，使用了 SearchFilters
  - [ ] 没有手动实现搜索表单

- [ ] **FormModal**
  - [ ] 弹窗表单使用了 FormModal
  - [ ] 没有直接使用 Modal + Form

- [ ] **AmountDisplay**
  - [ ] 显示金额的地方使用了 AmountDisplay
  - [ ] 没有手动格式化金额

- [ ] **StatusTag**
  - [ ] 显示状态的地方使用了 StatusTag（如果需要统一状态显示）

- [ ] **PageToolbar**
  - [ ] 页面顶部操作按钮使用了 PageToolbar

- [ ] **SensitiveField**
  - [ ] 显示敏感信息的地方使用了 SensitiveField
  - [ ] 没有直接显示敏感信息

### 禁止使用的模式

- [ ] **禁止直接使用 Ant Design 组件**
  - [ ] ❌ 不使用 `<Table>`，应使用 `<DataTable>`
  - [ ] ❌ 不使用 `<Select>` 选择账户/员工/部门等，应使用对应的 Form 组件
  - [ ] ❌ 不使用 `<InputNumber>` 输入金额，应使用 `<AmountInput>`
  - [ ] ❌ 不使用 `<Modal>` + `<Form>`，应使用 `<FormModal>`

- [ ] **禁止重复实现**
  - [ ] ❌ 不手动实现操作列，应使用 DataTable 的 `onEdit`/`onDelete`
  - [ ] ❌ 不手动实现搜索表单，应使用 SearchFilters
  - [ ] ❌ 不手动格式化金额，应使用 AmountDisplay
  - [ ] ❌ 不手动处理日期格式化，SearchFilters 已自动处理

---

## 🎨 UI/UX 检查

- [ ] **页面布局**
  - [ ] 使用 PageContainer 统一布局
  - [ ] 面包屑导航正确
  - [ ] 页面标题清晰

- [ ] **交互体验**
  - [ ] 加载状态正确显示
  - [ ] 错误提示友好
  - [ ] 空状态有提示
  - [ ] 操作反馈及时

- [ ] **响应式设计**
  - [ ] 移动端适配（如需要）
  - [ ] 表格横向滚动（如需要）

---

## 🔒 安全性检查

- [ ] **权限控制**
  - [ ] 敏感信息使用 SensitiveField
  - [ ] 权限检查正确
  - [ ] 审计日志记录（如需要）

- [ ] **数据验证**
  - [ ] 表单验证完整
  - [ ] 后端验证不依赖前端
  - [ ] 金额验证正确（整数，单位为分）

- [ ] **错误处理**
  - [ ] 错误处理统一使用 `Errors.xxx()`
  - [ ] 错误消息用户友好
  - [ ] 敏感错误信息不暴露

---

## ⚡ 性能检查

- [ ] **组件优化**
  - [ ] 使用 React.memo（如需要）
  - [ ] 使用 useMemo/useCallback（如需要）
  - [ ] 避免不必要的重渲染

- [ ] **数据加载**
  - [ ] 使用 React Query 管理服务端状态
  - [ ] 合理使用缓存
  - [ ] 避免重复请求

- [ ] **代码分割**
  - [ ] 路由级别的代码分割
  - [ ] 大型组件懒加载（如需要）

---

## 🧪 测试检查

- [ ] **单元测试**
  - [ ] 关键逻辑有单元测试
  - [ ] 测试覆盖率达标（如要求）

- [ ] **集成测试**
  - [ ] 关键流程有集成测试（如要求）

- [ ] **手动测试**
  - [ ] 功能测试通过
  - [ ] 边界情况测试
  - [ ] 错误情况测试

---

## 📝 文档检查

- [ ] **代码注释**
  - [ ] 复杂逻辑有注释
  - [ ] 关键函数有 JSDoc

- [ ] **README 更新**
  - [ ] 新增功能更新 README（如需要）
  - [ ] 配置变更更新文档（如需要）

---

## 🐛 常见问题检查

### 前端常见问题

- [ ] **金额处理**
  - [ ] 金额以整数（cents）存储和传输
  - [ ] 显示时使用 AmountDisplay 格式化
  - [ ] 输入时使用 AmountInput

- [ ] **日期处理**
  - [ ] 使用 dayjs 处理日期
  - [ ] SearchFilters 自动处理日期格式化
  - [ ] 日期范围使用 DateRangePicker

- [ ] **状态管理**
  - [ ] 使用 React Query 管理服务端状态
  - [ ] 使用 Zustand 管理客户端状态（如需要）
  - [ ] 避免不必要的全局状态

- [ ] **类型安全**
  - [ ] 使用 TypeScript 类型
  - [ ] 避免使用 `any`
  - [ ] 使用组件导出的类型

### 后端常见问题

- [ ] **服务访问**
  - [ ] 统一使用 `c.var.services.xxx`
  - [ ] 不使用 `c.get('services').xxx`

- [ ] **错误处理**
  - [ ] 统一使用 `Errors.xxx()`
  - [ ] 不使用 `throw new Error()`
  - [ ] 错误消息使用中文

- [ ] **API 设计**
  - [ ] API 路径统一为 `/api/v2/xxx`
  - [ ] 响应格式统一：`{ success: boolean, data: ... }`

---

## ✅ 审查通过标准

代码审查通过需要满足：

1. ✅ **必须项全部通过**
   - PageContainer 使用
   - DataTable 使用（列表页面）
   - Form 表单组件使用（表单页面）

2. ✅ **代码规范检查通过**
   - 命名规范正确
   - 代码风格统一
   - 无 Linter 错误

3. ✅ **功能测试通过**
   - 功能正常
   - 无回归问题
   - 边界情况处理正确

4. ✅ **安全性检查通过**
   - 权限控制正确
   - 敏感信息保护
   - 错误处理安全

---

## 📋 审查模板

### 审查意见格式

```markdown
## 代码审查意见

### ✅ 优点
- 代码结构清晰
- 组件使用规范
- ...

### ⚠️ 需要改进
- [ ] 问题1：描述
  - 位置：文件路径:行号
  - 建议：改进建议
- [ ] 问题2：描述
  - 位置：文件路径:行号
  - 建议：改进建议

### 🔴 必须修复
- [ ] 问题1：描述（阻塞合并）
  - 位置：文件路径:行号
  - 原因：为什么必须修复
```

---

## 🔗 相关文档

- [组件使用指南](./COMPONENT_USAGE_GUIDE.md)
- [组件库文档](../src/docs/COMPONENT_LIBRARY.md)
- [代码规范检查报告](../../.agent/CODE_STANDARD_REVIEW.md)

---

**文档维护**: 前端开发团队  
**最后更新**: 2024-12-19
