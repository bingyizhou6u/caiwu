# 组件全面覆盖计划

**制定时间**: 2024-12-19  
**目标**: 在 3 个月内将整体组件覆盖率从 48% 提升到 70%+  
**总页面数**: 59 个页面

---

## 📊 当前覆盖率现状

### Common 组件
- PageContainer: 90% ✅
- DataTable: 76% ✅
- AmountDisplay: 53% ✅
- PageToolbar: 54% ✅
- EmptyText: 34% ⚠️
- SearchFilters: 39% ⚠️
- StatusTag: 29% ⚠️
- BatchActionButton: 8% ❌

### Form 表单组件
- AmountInput: 20% ⚠️
- CurrencySelect: 20% ⚠️
- AccountSelect: 15% ⚠️
- EmployeeSelect: 7% ❌
- DepartmentSelect: 2% ❌
- VendorSelect: 0% ❌

### 独立组件
- FormModal: 51% ✅
- SensitiveField: 3% ❌
- DateRangePicker: 3% ❌
- VirtualTable: 2% ❌
- WorkScheduleEditor: 2% ❌

**当前整体覆盖率**: 48%

---

## 🎯 覆盖率目标

### 短期目标（1个月）
- 整体覆盖率：48% → 60%
- Form 组件覆盖率：11% → 30%
- StatusTag 覆盖率：29% → 50%
- SearchFilters 覆盖率：39% → 55%
- SensitiveField 覆盖率：3% → 15%

### 中期目标（2个月）
- 整体覆盖率：60% → 65%
- Form 组件覆盖率：30% → 45%
- StatusTag 覆盖率：50% → 60%
- SearchFilters 覆盖率：55% → 65%
- SensitiveField 覆盖率：15% → 25%

### 长期目标（3个月）
- 整体覆盖率：65% → 70%+
- Form 组件覆盖率：45% → 60%+
- StatusTag 覆盖率：60% → 70%+
- SearchFilters 覆盖率：65% → 75%+
- SensitiveField 覆盖率：25% → 35%+

---

## 📋 详细推广计划

### Phase 1: Form 表单组件推广（Week 1-2）

#### Task 1.1: 推广 AmountInput 和 CurrencySelect
**目标**: AmountInput 从 20% → 35%，CurrencySelect 从 20% → 35%

**待推广页面**（15个）:
1. `finance/pages/ImportCenterPage.tsx` - 导入中心
2. `assets/pages/FixedAssetPurchasePage.tsx` - 固定资产采购
3. `assets/pages/FixedAssetSalePage.tsx` - 固定资产销售
4. `assets/pages/RentalManagementPage.tsx` - 租赁管理（部分表单）
5. `hr/pages/EmployeeManagementPage.tsx` - 员工管理（编辑表单）
6. `system/pages/VendorManagementPage.tsx` - 供应商管理（表单）
7. `system/pages/CategoryManagementPage.tsx` - 类别管理（表单）
8. `system/pages/DepartmentManagementPage.tsx` - 部门管理（表单）
9. `sites/pages/SiteBillsPage.tsx` - 站点账单（表单）
10. `reports/pages/ReportAccountBalancePage.tsx` - 账户余额报表（筛选）
11. `reports/pages/ReportDepartmentCashPage.tsx` - 部门现金报表（筛选）
12. `reports/pages/ReportExpenseDetailPage.tsx` - 费用明细报表（筛选）
13. `reports/pages/ReportExpenseSummaryPage.tsx` - 费用汇总报表（筛选）
14. `reports/pages/ReportAPDetailPage.tsx` - 应付明细报表（筛选）
15. `reports/pages/ReportARDetailPage.tsx` - 应收明细报表（筛选）

**验收标准**:
- ✅ 所有金额输入使用 AmountInput
- ✅ 所有币种选择使用 CurrencySelect
- ✅ 功能正常，无回归
- ✅ 代码审查通过

#### Task 1.2: 推广 AccountSelect
**目标**: AccountSelect 从 15% → 30%

**待推广页面**（9个）:
1. `finance/pages/ImportCenterPage.tsx` - 导入中心
2. `assets/pages/FixedAssetPurchasePage.tsx` - 固定资产采购
3. `assets/pages/FixedAssetSalePage.tsx` - 固定资产销售
4. `assets/pages/RentalManagementPage.tsx` - 租赁管理
5. `sites/pages/SiteBillsPage.tsx` - 站点账单
6. `reports/pages/ReportAccountBalancePage.tsx` - 账户余额报表
7. `reports/pages/ReportDepartmentCashPage.tsx` - 部门现金报表
8. `reports/pages/ReportAPDetailPage.tsx` - 应付明细报表
9. `reports/pages/ReportARDetailPage.tsx` - 应收明细报表

**验收标准**:
- ✅ 所有账户选择使用 AccountSelect
- ✅ 支持按币种过滤
- ✅ 功能正常，无回归

#### Task 1.3: 推广 EmployeeSelect 和 DepartmentSelect
**目标**: EmployeeSelect 从 7% → 25%，DepartmentSelect 从 2% → 20%

**待推广页面**（11个）:
1. `hr/pages/EmployeeManagementPage.tsx` - 员工管理（筛选）
2. `hr/pages/SalaryPaymentsPage.tsx` - 薪资发放（筛选）
3. `hr/pages/AllowancePaymentsPage.tsx` - 补贴发放（筛选）
4. `hr/pages/LeaveManagementPage.tsx` - 请假管理（筛选）
5. `hr/pages/ExpenseReimbursementPage.tsx` - 费用报销（筛选）
6. `reports/pages/ReportEmployeeSalaryPage.tsx` - 员工薪资报表（筛选）
7. `reports/pages/ReportAnnualLeavePage.tsx` - 年假报表（筛选）
8. `reports/pages/ReportExpenseDetailPage.tsx` - 费用明细报表（筛选）
9. `reports/pages/ReportDepartmentCashPage.tsx` - 部门现金报表（筛选）
10. `my/pages/MyApprovalsPage.tsx` - 我的审批（筛选）
11. `system/pages/DepartmentManagementPage.tsx` - 部门管理（表单）

**验收标准**:
- ✅ 所有员工选择使用 EmployeeSelect
- ✅ 所有部门选择使用 DepartmentSelect
- ✅ 功能正常，无回归

#### Task 1.4: 推广 VendorSelect
**目标**: VendorSelect 从 0% → 10%

**待推广页面**（6个）:
1. `finance/pages/APPage.tsx` - 应付管理（筛选）
2. `finance/pages/ImportCenterPage.tsx` - 导入中心
3. `system/pages/VendorManagementPage.tsx` - 供应商管理（表单）
4. `reports/pages/ReportAPSummaryPage.tsx` - 应付汇总报表（筛选）
5. `reports/pages/ReportAPDetailPage.tsx` - 应付明细报表（筛选）
6. `reports/pages/ReportExpenseDetailPage.tsx` - 费用明细报表（筛选）

**验收标准**:
- ✅ 所有供应商选择使用 VendorSelect
- ✅ 功能正常，无回归

---

### Phase 2: StatusTag 推广（Week 3-4）

#### Task 2.1: 推广 StatusTag 到所有状态显示页面
**目标**: StatusTag 从 29% → 50%

**待推广页面**（18个）:
1. `finance/pages/AccountTransactionsPage.tsx` - 账户交易（状态列）
2. `finance/pages/FlowsPage.tsx` - 流水管理（状态列）
3. `finance/pages/BorrowingManagementPage.tsx` - 借款管理（状态列）
4. `finance/pages/RepaymentManagementPage.tsx` - 还款管理（状态列）
5. `assets/pages/FixedAssetsManagementPage.tsx` - 固定资产管理（状态列）
6. `assets/pages/FixedAssetPurchasePage.tsx` - 固定资产采购（状态列）
7. `assets/pages/FixedAssetSalePage.tsx` - 固定资产销售（状态列）
8. `assets/pages/RentalManagementPage.tsx` - 租赁管理（状态列）
9. `assets/pages/FixedAssetAllocationPage.tsx` - 资产分配（状态列）
10. `sites/pages/SiteBillsPage.tsx` - 站点账单（状态列）
11. `system/pages/VendorManagementPage.tsx` - 供应商管理（状态列）
12. `system/pages/AccountManagementPage.tsx` - 账户管理（状态列）
13. `system/pages/CategoryManagementPage.tsx` - 类别管理（状态列）
14. `system/pages/DepartmentManagementPage.tsx` - 部门管理（状态列）
15. `system/pages/IPWhitelistManagementPage.tsx` - IP白名单（状态列）
16. `reports/pages/ReportBorrowingPage.tsx` - 借款报表（状态列）
17. `my/pages/MyBorrowingsPage.tsx` - 我的借款（状态列）
18. `my/pages/MyReimbursementsPage.tsx` - 我的报销（状态列）

**验收标准**:
- ✅ 所有状态显示使用 StatusTag
- ✅ 统一状态映射配置
- ✅ 功能正常，无回归

---

### Phase 3: SearchFilters 推广（Week 5-6）

#### Task 3.1: 推广 SearchFilters 到所有列表页面
**目标**: SearchFilters 从 39% → 55%

**待推广页面**（10个）:
1. `finance/pages/AccountTransactionsPage.tsx` - 账户交易
2. `finance/pages/FlowsPage.tsx` - 流水管理
3. `assets/pages/FixedAssetsManagementPage.tsx` - 固定资产管理
4. `assets/pages/FixedAssetPurchasePage.tsx` - 固定资产采购
5. `assets/pages/FixedAssetSalePage.tsx` - 固定资产销售
6. `assets/pages/FixedAssetAllocationPage.tsx` - 资产分配
7. `sites/pages/SiteManagementPage.tsx` - 站点管理
8. `sites/pages/SiteBillsPage.tsx` - 站点账单
9. `system/pages/VendorManagementPage.tsx` - 供应商管理
10. `system/pages/IPWhitelistManagementPage.tsx` - IP白名单

**验收标准**:
- ✅ 所有列表页面使用 SearchFilters
- ✅ 统一搜索表单布局
- ✅ 功能正常，无回归

---

### Phase 4: SensitiveField 推广（Week 7-8）

#### Task 4.1: 推广 SensitiveField 到敏感信息页面
**目标**: SensitiveField 从 3% → 15%

**待推广页面**（7个）:
1. `hr/pages/EmployeeManagementPage.tsx` - 员工管理（手机、身份证、银行账户）
2. `hr/pages/CreateEmployeePage.tsx` - 创建员工（敏感信息预览）
3. `hr/pages/SalaryPaymentsPage.tsx` - 薪资发放（薪资信息）
4. `reports/pages/ReportEmployeeSalaryPage.tsx` - 员工薪资报表（薪资信息）
5. `my/pages/MyProfilePage.tsx` - 个人信息（已完成）
6. `my/pages/MyAssetsPage.tsx` - 我的资产（敏感信息）
7. `system/pages/AccountManagementPage.tsx` - 账户管理（账户号）

**验收标准**:
- ✅ 所有敏感信息使用 SensitiveField
- ✅ 权限控制正确
- ✅ 审计日志完整
- ✅ 功能正常，无回归

---

### Phase 5: EmptyText 推广（Week 9-10）

#### Task 5.1: 推广 EmptyText 到所有列表页面
**目标**: EmptyText 从 34% → 50%

**待推广页面**（10个）:
1. `finance/pages/AccountTransactionsPage.tsx` - 账户交易
2. `finance/pages/FlowsPage.tsx` - 流水管理
3. `assets/pages/FixedAssetPurchasePage.tsx` - 固定资产采购
4. `assets/pages/FixedAssetSalePage.tsx` - 固定资产销售
5. `assets/pages/FixedAssetAllocationPage.tsx` - 资产分配
6. `sites/pages/SiteManagementPage.tsx` - 站点管理
7. `sites/pages/SiteBillsPage.tsx` - 站点账单
8. `system/pages/VendorManagementPage.tsx` - 供应商管理
9. `system/pages/IPWhitelistManagementPage.tsx` - IP白名单
10. `reports/pages/ReportSiteGrowthPage.tsx` - 站点增长报表

**验收标准**:
- ✅ 所有列表页面使用 EmptyText
- ✅ 统一空状态显示
- ✅ 功能正常，无回归

---

## 📅 时间表

### Month 1: Form 组件和 StatusTag 推广
- **Week 1-2**: Form 表单组件推广（Task 1.1-1.4）
- **Week 3-4**: StatusTag 推广（Task 2.1）

**目标**: 整体覆盖率 48% → 60%

### Month 2: SearchFilters 和 SensitiveField 推广
- **Week 5-6**: SearchFilters 推广（Task 3.1）
- **Week 7-8**: SensitiveField 推广（Task 4.1）

**目标**: 整体覆盖率 60% → 65%

### Month 3: EmptyText 推广和优化
- **Week 9-10**: EmptyText 推广（Task 5.1）
- **Week 11-12**: 代码审查、优化和测试

**目标**: 整体覆盖率 65% → 70%+

---

## 🎯 优先级排序

### P0 - 高优先级（立即执行）
1. **Form 表单组件推广** - 覆盖率最低，影响最大
2. **StatusTag 推广** - 统一状态显示，提升用户体验

### P1 - 中优先级（逐步执行）
3. **SearchFilters 推广** - 统一搜索体验
4. **SensitiveField 推广** - 安全性和合规性

### P2 - 低优先级（可选执行）
5. **EmptyText 推广** - 提升用户体验
6. **BatchActionButton 推广** - 统一批量操作

---

## 📊 执行检查清单

### Week 1-2: Form 组件推广
- [ ] Task 1.1: AmountInput 和 CurrencySelect（15个页面）
- [ ] Task 1.2: AccountSelect（9个页面）
- [ ] Task 1.3: EmployeeSelect 和 DepartmentSelect（11个页面）
- [ ] Task 1.4: VendorSelect（6个页面）
- [ ] 代码审查和测试
- [ ] 更新文档

### Week 3-4: StatusTag 推广
- [ ] Task 2.1: StatusTag（18个页面）
- [ ] 统一状态映射配置
- [ ] 代码审查和测试
- [ ] 更新文档

### Week 5-6: SearchFilters 推广
- [ ] Task 3.1: SearchFilters（10个页面）
- [ ] 统一搜索表单布局
- [ ] 代码审查和测试
- [ ] 更新文档

### Week 7-8: SensitiveField 推广
- [ ] Task 4.1: SensitiveField（7个页面）
- [ ] 权限控制检查
- [ ] 审计日志检查
- [ ] 代码审查和测试
- [ ] 更新文档

### Week 9-10: EmptyText 推广
- [ ] Task 5.1: EmptyText（10个页面）
- [ ] 统一空状态显示
- [ ] 代码审查和测试
- [ ] 更新文档

### Week 11-12: 收尾工作
- [ ] 全面代码审查
- [ ] 功能测试
- [ ] 性能测试
- [ ] 文档更新
- [ ] 覆盖率验证

---

## 📈 成功指标

### 覆盖率指标
- ✅ Form 组件覆盖率：11% → 30%+ (Month 1)
- ✅ StatusTag 覆盖率：29% → 50%+ (Month 1)
- ✅ SearchFilters 覆盖率：39% → 55%+ (Month 2)
- ✅ SensitiveField 覆盖率：3% → 15%+ (Month 2)
- ✅ EmptyText 覆盖率：34% → 50%+ (Month 3)
- ✅ 整体覆盖率：48% → 70%+ (Month 3)

### 质量指标
- ✅ 代码审查通过率：100%
- ✅ 功能测试通过率：100%
- ✅ 性能无回归：通过
- ✅ 用户体验提升：可量化

### 文档指标
- ✅ 组件使用文档更新：100%
- ✅ 代码示例更新：100%
- ✅ 最佳实践文档：完成

---

## 🔧 执行策略

### 1. 批量处理策略
- 按模块批量处理（财务、人力资源、系统管理等）
- 优先处理高频使用的页面
- 逐步推广到低频页面

### 2. 代码审查策略
- 每个 Phase 完成后进行代码审查
- 确保代码质量和一致性
- 及时修复问题

### 3. 测试策略
- 每个 Task 完成后进行功能测试
- 每个 Phase 完成后进行回归测试
- 最终进行全面测试

### 4. 文档策略
- 及时更新组件使用文档
- 添加代码示例和最佳实践
- 更新覆盖率报告

---

## 📝 注意事项

### 1. 兼容性
- 确保新组件与现有代码兼容
- 注意 Form.List 中的使用方式
- 注意字段关联的处理

### 2. 性能
- 注意大数据量场景的性能
- 使用虚拟滚动等优化手段
- 避免不必要的重渲染

### 3. 用户体验
- 保持交互一致性
- 提供清晰的错误提示
- 优化加载状态显示

### 4. 安全性
- SensitiveField 的权限控制
- 审计日志的完整性
- 敏感信息的保护

---

## 🎉 预期成果

### 短期成果（1个月）
- Form 组件覆盖率提升到 30%+
- StatusTag 覆盖率提升到 50%+
- 整体覆盖率提升到 60%+

### 中期成果（2个月）
- SearchFilters 覆盖率提升到 55%+
- SensitiveField 覆盖率提升到 15%+
- 整体覆盖率提升到 65%+

### 长期成果（3个月）
- EmptyText 覆盖率提升到 50%+
- 整体覆盖率提升到 70%+
- 代码质量和一致性显著提升
- 用户体验显著改善

---

**计划制定时间**: 2024-12-19  
**计划执行时间**: 2024-12-20 至 2025-03-20  
**计划负责人**: 开发团队  
**计划审查周期**: 每周审查一次
