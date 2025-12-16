# 模块修复检查清单

**用途**: 按模块跟踪修复进度，确保修复完整性

---

## 📋 HR 模块修复清单

### EmployeeService.ts

#### 需要修复的查询（15处）

- [ ] **Line 61**: `select().from(employees)` - 获取所有员工邮箱（create 方法）
  - 查询名称: `EmployeeService.create.getAllEmails`
  - 优先级: 高（创建员工流程）

- [ ] **Line 73-77**: `select().from(employees)` - 检查个人邮箱（create 方法）
  - 查询名称: `EmployeeService.create.checkPersonalEmail`
  - 优先级: 高（创建员工流程）

- [ ] **Line 83-87**: `select().from(orgDepartments)` - 获取组织部门（create 方法）
  - 查询名称: `EmployeeService.create.getOrgDepartment`
  - 优先级: 高（创建员工流程）

- [ ] **Line 96-100**: `select().from(departments)` - 获取总部部门（create 方法）
  - 查询名称: `EmployeeService.create.getHQDepartment`
  - 优先级: 中（创建员工流程）

- [ ] **Line 107-109**: `select().from(positions)` - 获取职位（create 方法）
  - 查询名称: `EmployeeService.create.getPosition`
  - 优先级: 高（创建员工流程）

- [ ] **Line 271**: `select().from(employees)` - resendActivationEmail
  - 查询名称: `EmployeeService.resendActivationEmail.getEmployee`
  - 优先级: 中

- [ ] **Line 310**: `select().from(employees)` - resetTotp
  - 查询名称: `EmployeeService.resetTotp.getEmployee`
  - 优先级: 中

- [ ] **Line 422**: `select().from(employees)` - changeStatus（事务中）
  - 查询名称: `EmployeeService.changeStatus.getEmployee`
  - 优先级: 高（状态变更流程）

- [ ] **Line 453**: `select().from(departments)` - changeStatus（事务中）
  - 查询名称: `EmployeeService.changeStatus.getDepartment`
  - 优先级: 中（状态变更流程）

- [ ] **Line 541**: `select().from(employees)` - update
  - 查询名称: `EmployeeService.update.getEmployee`
  - 优先级: 高（更新流程）

- [ ] **Line 599**: `select().from(employees)` - getById
  - 查询名称: `EmployeeService.getById`
  - 优先级: 高（核心查询方法）

- [ ] **Line 618**: `select().from(employees)` - getByEmail
  - 查询名称: `EmployeeService.getByEmail`
  - 优先级: 高（核心查询方法）

- [ ] **Line 651**: `select().from(employees)` - 其他方法
  - 查询名称: 根据具体方法确定
  - 优先级: 中

**修复状态**: ⏳ 待开始  
**预计工作量**: 2天

---

### SalaryPaymentGenerationService.ts

- [ ] **Line 24**: `select().from(employees)` - 获取活跃员工（已部分优化，需完善）
  - 查询名称: `SalaryPaymentGenerationService.generatePayments.getActiveEmployees`
  - 优先级: 高
  - 注意: 已在事务中，需确认批量查询是否正常工作

**修复状态**: ⏳ 待完善  
**预计工作量**: 0.5天

---

### SalaryPaymentProcessingService.ts

- [ ] **Line 32**: `select().from(accounts)` - 获取账户
  - 查询名称: `SalaryPaymentProcessingService.processPayment.getAccount`
  - 优先级: 高（支付流程）

- [ ] **Line 246**: `select().from(accounts)` - 获取账户（事务中）
  - 查询名称: `SalaryPaymentProcessingService.confirmPayment.getAccount`
  - 优先级: 高（确认支付流程）

**修复状态**: ⏳ 待开始  
**预计工作量**: 0.5天

---

## 📋 Finance 模块修复清单

### FinanceService.ts

- [ ] **Line 63**: `select().from(accounts)` - getAccountBalanceBefore
  - 查询名称: `FinanceService.getAccountBalanceBefore.getAccount`
  - 优先级: 高（余额计算）

**修复状态**: ⏳ 待开始  
**预计工作量**: 0.5天

---

### ArApService.ts

- [ ] **Line 122**: `select().from(arApDocs)` - refreshStatus
  - 查询名称: `ArApService.refreshStatus.getDoc`
  - 优先级: 中

- [ ] **Line 189**: `select().from(arApDocs)` - settle（事务中）
  - 查询名称: `ArApService.settle.getDoc`
  - 优先级: 高（结算流程）

- [ ] **Line 197**: `select().from(accounts)` - settle（事务中）
  - 查询名称: `ArApService.settle.getAccount`
  - 优先级: 高（结算流程）

- [ ] **Line 246**: `select().from(arApDocs)` - getById
  - 查询名称: `ArApService.getById`
  - 优先级: 高（核心查询方法）

**修复状态**: ⏳ 待开始  
**预计工作量**: 1天

---

### AccountTransferService.ts

- [ ] **Line 31**: `inArray(accounts.id, ...)` - 优化批量查询
  - 查询名称: `AccountTransferService.list.getAccounts`
  - 优先级: 中
  - 修复方式: 使用 `getByIds()` 批量获取账户

**修复状态**: ⏳ 待开始  
**预计工作量**: 0.5天

---

## 📋 Assets 模块修复清单

### FixedAssetService.ts

#### 需要修复的查询（10处）

- [ ] **Line 107**: `select().from(fixedAssets)` - get（主查询）
  - 查询名称: `FixedAssetService.get.getAsset`
  - 优先级: 高（核心查询方法）

- [ ] **Line 112**: `select().from(departments)` - get（并行查询）
  - 查询名称: `FixedAssetService.get.getDepartment`
  - 优先级: 中

- [ ] **Line 114**: `select().from(sites)` - get（并行查询）
  - 查询名称: `FixedAssetService.get.getSite`
  - 优先级: 中

- [ ] **Line 116**: `select().from(vendors)` - get（并行查询）
  - 查询名称: `FixedAssetService.get.getVendor`
  - 优先级: 中

- [ ] **Line 119**: `select().from(currencies)` - get（并行查询）
  - 查询名称: `FixedAssetService.get.getCurrency`
  - 优先级: 中

- [ ] **Line 122**: `select().from(employees)` - get（并行查询）
  - 查询名称: `FixedAssetService.get.getEmployee`
  - 优先级: 中

- [ ] **Line 245**: `select().from(fixedAssets)` - update
  - 查询名称: `FixedAssetService.update.getAsset`
  - 优先级: 高（更新流程）

- [ ] **Line 289**: `select().from(fixedAssets)` - delete
  - 查询名称: `FixedAssetService.delete.getAsset`
  - 优先级: 高（删除流程）

- [ ] **Line 383**: `select().from(vendors)` - create
  - 查询名称: `FixedAssetService.create.getVendor`
  - 优先级: 中（创建流程）

- [ ] **Line 485**: `select().from(fixedAssets)` - 其他方法
  - 查询名称: 根据具体方法确定
  - 优先级: 中

**修复状态**: ⏳ 待开始  
**预计工作量**: 1.5天

---

### FixedAssetAllocationService.ts

- [ ] **Line 62**: `inArray(fixedAssets.id, ...)` - 优化批量查询
  - 查询名称: `FixedAssetAllocationService.list.getAssets`
  - 优先级: 高
  - 修复方式: 使用 `getByIds()` 批量获取资产

- [ ] **Line 120**: `select().from(fixedAssets)` - 添加性能监控
  - 查询名称: `FixedAssetAllocationService.create.getAsset`
  - 优先级: 高（创建流程）

- [ ] **Line 222**: `select().from(fixedAssets)` - 添加性能监控
  - 查询名称: `FixedAssetAllocationService.delete.getAsset`
  - 优先级: 高（删除流程）

**修复状态**: ⏳ 待开始  
**预计工作量**: 1天

---

### FixedAssetDepreciationService.ts

- [ ] **Line 29**: `select().from(fixedAssets)` - 添加性能监控
  - 查询名称: `FixedAssetDepreciationService.calculate.getAsset`
  - 优先级: 中

**修复状态**: ⏳ 待开始  
**预计工作量**: 0.5天

---

### FixedAssetChangeService.ts

- [ ] **Line 36**: `select().from(fixedAssets)` - 添加性能监控
  - 查询名称: `FixedAssetChangeService.create.getAsset`
  - 优先级: 中

**修复状态**: ⏳ 待开始  
**预计工作量**: 0.5天

---

## 📋 System 模块修复清单

### SystemConfigService.ts

- [ ] **Line 10**: `select().from(systemConfig)` - get
  - 查询名称: `SystemConfigService.get`
  - 优先级: 中（配置查询）

- [ ] **Line 24**: `select().from(systemConfig)` - getAll
  - 查询名称: `SystemConfigService.getAll`
  - 优先级: 中（配置查询）

**修复状态**: ⏳ 待开始  
**预计工作量**: 0.5天

---

## 📋 Auth 模块修复清单

### AuthService.ts

- [ ] **Line 204**: `select().from(sessions)` - getSession
  - 查询名称: `AuthService.getSession`
  - 优先级: 高（认证流程）

- [ ] **Line 262**: `select().from(employees)` - requestPasswordReset
  - 查询名称: `AuthService.requestPasswordReset.getEmployee`
  - 优先级: 中（密码重置流程）

- [ ] **Line 283**: `select().from(employees)` - resetPassword
  - 查询名称: `AuthService.resetPassword.getEmployee`
  - 优先级: 中（密码重置流程）

**修复状态**: ⏳ 待开始  
**预计工作量**: 0.5天

---

## 📋 Common 模块修复清单

### ApprovalService.ts

- [ ] **Line 190**: `select().from(table)` - getApprovalRecord
  - 查询名称: `ApprovalService.getApprovalRecord`
  - 优先级: 中
  - 注意: 已部分优化，需完善

**修复状态**: ⏳ 待完善  
**预计工作量**: 0.5天

---

## 📊 总体进度

### 修复统计

| 模块 | 文件数 | 查询数 | 批量查询 | 完成度 |
|------|--------|--------|---------|--------|
| HR | 3 | 17 | 0 | 0% |
| Finance | 3 | 6 | 1 | 0% |
| Assets | 4 | 14 | 1 | 0% |
| System | 1 | 2 | 0 | 0% |
| Auth | 1 | 3 | 0 | 0% |
| Common | 1 | 1 | 0 | 0% |
| **总计** | **13** | **43** | **2** | **0%** |

### 预计工作量

- **HR 模块**: 3天
- **Finance 模块**: 2天
- **Assets 模块**: 3.5天
- **System 模块**: 0.5天
- **Auth 模块**: 0.5天
- **Common 模块**: 0.5天
- **总计**: **10天**

---

## ✅ 验收标准

### 每个文件修复完成后

- [ ] 所有查询都添加了性能监控
- [ ] 所有批量查询都使用了批量查询工具
- [ ] 查询名称符合规范
- [ ] 代码通过类型检查
- [ ] 代码通过测试

### 每个模块修复完成后

- [ ] 模块内所有文件都修复完成
- [ ] 模块测试通过
- [ ] 性能指标正常

---

**最后更新**: 2025-01-27
