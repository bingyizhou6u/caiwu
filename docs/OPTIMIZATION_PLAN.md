# 代码规范全面优化计划

**创建时间**: 2025-01-27  
**目标**: 将所有代码优化至100%符合开发规范  
**预计完成时间**: 2-3周

---

## 📋 优化目标

### 最终目标

- ✅ **性能监控覆盖率**: 100%
- ✅ **批量查询优化率**: 100%
- ✅ **服务组织规范**: 100%（已完成）
- ✅ **错误处理统一**: 100%（已完成）

### 当前状态

| 指标 | 当前 | 目标 | 差距 |
|------|------|------|------|
| 性能监控覆盖率 | 6% | 100% | 94% |
| 批量查询优化率 | 33% | 100% | 67% |
| 服务组织规范 | 100% | 100% | 0% |
| 错误处理统一 | 100% | 100% | 0% |

---

## 🎯 优化策略

### 策略1：按模块逐步优化

**优势**:
- 降低风险，避免大规模改动
- 便于测试和验证
- 可以并行开发

**顺序**:
1. HR 模块（核心，使用频率高）
2. Finance 模块（核心，业务关键）
3. Assets 模块（中等复杂度）
4. System 模块（基础服务）
5. Auth 模块（安全关键）
6. Common 模块（通用服务）
7. Reports 模块（报表服务）

### 策略2：优先修复高频查询

**原则**:
- 先修复高频调用的方法
- 先修复核心业务流程
- 先修复性能瓶颈

---

## 📅 优化时间表

### 第1周：核心模块优化

#### Day 1-2: HR 模块
- [ ] EmployeeService - 添加性能监控（15处）
- [ ] SalaryPaymentGenerationService - 完善性能监控（1处）
- [ ] SalaryPaymentProcessingService - 添加性能监控（2处）
- [ ] 其他 HR 服务 - 检查并修复

**预计工作量**: 2天  
**影响范围**: 人事管理核心功能

#### Day 3-4: Finance 模块
- [ ] FinanceService - 添加性能监控（1处）
- [ ] ArApService - 添加性能监控（4处）
- [ ] AccountTransferService - 优化批量查询（1处）
- [ ] BorrowingService - 已优化，检查完整性

**预计工作量**: 2天  
**影响范围**: 财务管理核心功能

#### Day 5: Assets 模块
- [ ] FixedAssetService - 添加性能监控（10处）
- [ ] FixedAssetAllocationService - 添加性能监控（2处）+ 优化批量查询（1处）
- [ ] FixedAssetDepreciationService - 添加性能监控（1处）
- [ ] FixedAssetChangeService - 添加性能监控（1处）

**预计工作量**: 1天  
**影响范围**: 资产管理功能

### 第2周：基础模块优化

#### Day 6-7: System 模块
- [ ] SystemConfigService - 添加性能监控（2处）
- [ ] 其他 System 服务 - 检查并修复

**预计工作量**: 2天  
**影响范围**: 系统配置功能

#### Day 8: Auth 模块
- [ ] AuthService - 添加性能监控（3处）

**预计工作量**: 1天  
**影响范围**: 认证功能

#### Day 9: Common 模块
- [ ] ApprovalService - 完善性能监控（1处）
- [ ] 其他 Common 服务 - 检查并修复

**预计工作量**: 1天  
**影响范围**: 通用服务

#### Day 10: Reports 模块
- [ ] 检查所有报表服务
- [ ] 优化批量查询（如需要）

**预计工作量**: 1天  
**影响范围**: 报表功能

### 第3周：测试和优化

#### Day 11-12: 全面测试
- [ ] 单元测试
- [ ] 集成测试
- [ ] 性能测试

#### Day 13-14: 优化和文档
- [ ] 性能优化
- [ ] 文档更新
- [ ] 代码审查

---

## 🔧 修复方法

### 方法1：使用 QueryHelpers（推荐）

**优势**:
- 代码简洁
- 自动应用最佳实践
- 统一接口

**模板**:
```typescript
import { query, getByIds } from '../utils/query-helpers.js'

// 单个查询
const result = await query(
  this.db,
  'ServiceName.methodName.queryName',
  () => this.db.select().from(table).where(condition).get(),
  c // Context（可选）
)

// 批量查询
const results = await getByIds(
  this.db,
  table,
  ids,
  'ServiceName.methodName.getByIds',
  { batchSize: 100, parallel: true },
  c
)
```

### 方法2：使用 DBPerformanceTracker + BatchQuery

**适用场景**:
- 需要更细粒度控制
- 复杂查询逻辑

**模板**:
```typescript
import { DBPerformanceTracker } from '../utils/db-performance.js'
import { BatchQuery } from '../utils/batch-query.js'

const result = await DBPerformanceTracker.track(
  'ServiceName.methodName',
  () => BatchQuery.getByIds(db, table, ids, {
    batchSize: 100,
    parallel: true,
    queryName: 'getItems'
  }),
  c
)
```

---

## 📝 详细修复清单

### HR 模块修复清单

#### EmployeeService.ts
- [ ] Line 61: `select().from(employees)` - 获取所有员工邮箱
- [ ] Line 73-77: `select().from(employees)` - 检查个人邮箱
- [ ] Line 83-87: `select().from(orgDepartments)` - 获取组织部门
- [ ] Line 96-100: `select().from(departments)` - 获取总部部门
- [ ] Line 107-109: `select().from(positions)` - 获取职位
- [ ] Line 271: `select().from(employees)` - resendActivationEmail
- [ ] Line 310: `select().from(employees)` - resetTotp
- [ ] Line 422: `select().from(employees)` - changeStatus
- [ ] Line 453: `select().from(departments)` - changeStatus
- [ ] Line 541: `select().from(employees)` - update
- [ ] Line 599: `select().from(employees)` - getById
- [ ] Line 618: `select().from(employees)` - getByEmail
- [ ] Line 651: `select().from(employees)` - 其他方法

#### SalaryPaymentGenerationService.ts
- [ ] Line 24: `select().from(employees)` - 获取活跃员工（已部分优化，需完善）

#### SalaryPaymentProcessingService.ts
- [ ] Line 32: `select().from(accounts)` - 获取账户
- [ ] Line 246: `select().from(accounts)` - 获取账户

### Finance 模块修复清单

#### FinanceService.ts
- [ ] Line 63: `select().from(accounts)` - getAccountBalanceBefore

#### ArApService.ts
- [ ] Line 122: `select().from(arApDocs)` - refreshStatus
- [ ] Line 189: `select().from(arApDocs)` - settle
- [ ] Line 197: `select().from(accounts)` - settle
- [ ] Line 246: `select().from(arApDocs)` - getById

#### AccountTransferService.ts
- [ ] Line 31: `inArray(accounts.id, ...)` - 优化批量查询

### Assets 模块修复清单

#### FixedAssetService.ts
- [ ] Line 107: `select().from(fixedAssets)` - get
- [ ] Line 112: `select().from(departments)` - get
- [ ] Line 114: `select().from(sites)` - get
- [ ] Line 116: `select().from(vendors)` - get
- [ ] Line 119: `select().from(currencies)` - get
- [ ] Line 122: `select().from(employees)` - get
- [ ] Line 245: `select().from(fixedAssets)` - update
- [ ] Line 289: `select().from(fixedAssets)` - delete
- [ ] Line 383: `select().from(vendors)` - create
- [ ] Line 485: `select().from(fixedAssets)` - 其他方法

#### FixedAssetAllocationService.ts
- [ ] Line 62: `inArray(fixedAssets.id, ...)` - 优化批量查询
- [ ] Line 120: `select().from(fixedAssets)` - 添加性能监控
- [ ] Line 222: `select().from(fixedAssets)` - 添加性能监控

#### FixedAssetDepreciationService.ts
- [ ] Line 29: `select().from(fixedAssets)` - 添加性能监控

#### FixedAssetChangeService.ts
- [ ] Line 36: `select().from(fixedAssets)` - 添加性能监控

### System 模块修复清单

#### SystemConfigService.ts
- [ ] Line 10: `select().from(systemConfig)` - get
- [ ] Line 24: `select().from(systemConfig)` - getAll

### Auth 模块修复清单

#### AuthService.ts
- [ ] Line 204: `select().from(sessions)` - getSession
- [ ] Line 262: `select().from(employees)` - requestPasswordReset
- [ ] Line 283: `select().from(employees)` - resetPassword

### Common 模块修复清单

#### ApprovalService.ts
- [ ] Line 190: `select().from(table)` - getApprovalRecord（已部分优化，需完善）

---

## 🛠️ 修复工具和脚本

### 1. 代码模板

创建标准化的代码模板，确保新代码符合规范。

### 2. 批量修复脚本

创建辅助脚本帮助批量修复（可选）。

### 3. 检查脚本

创建检查脚本，验证修复是否完成。

---

## ✅ 验收标准

### 每个模块修复完成后

- [ ] 所有数据库查询都使用性能监控
- [ ] 所有批量操作都使用批量查询工具
- [ ] 代码通过类型检查
- [ ] 代码通过测试
- [ ] 性能指标正常

### 全部修复完成后

- [ ] 性能监控覆盖率 100%
- [ ] 批量查询优化率 100%
- [ ] 所有测试通过
- [ ] 性能测试通过
- [ ] 文档更新完成

---

## 📊 进度跟踪

### 修复进度

| 模块 | 文件数 | 查询数 | 批量查询 | 状态 | 完成度 |
|------|--------|--------|---------|------|--------|
| HR | 5 | ~20 | 0 | ⏳ 待开始 | 0% |
| Finance | 4 | ~8 | 2 | ⏳ 待开始 | 0% |
| Assets | 4 | ~15 | 1 | ⏳ 待开始 | 0% |
| System | 3 | ~5 | 0 | ⏳ 待开始 | 0% |
| Auth | 1 | 3 | 0 | ⏳ 待开始 | 0% |
| Common | 1 | 1 | 0 | ⏳ 待开始 | 0% |
| Reports | 4 | 0 | 0 | ✅ 已检查 | 100% |
| **总计** | **22** | **~52** | **3** | - | **5%** |

---

## 🎯 下一步行动

1. **开始修复 HR 模块** - EmployeeService
2. **创建修复模板** - 标准化修复流程
3. **建立测试流程** - 确保修复不破坏功能
4. **跟踪进度** - 定期更新进度表

---

**计划创建时间**: 2025-01-27  
**预计完成时间**: 2025-02-17（3周）  
**负责人**: 开发团队
