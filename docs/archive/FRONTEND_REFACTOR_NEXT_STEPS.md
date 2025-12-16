# 前端重构后续优化任务清单

> 更新时间：2025-01-21  
> 当前完成度：**约 85%**（阶段一、二已完成）

---

## 📊 当前状态

### ✅ 已完成（阶段一、二）
- ✅ 通用组件提取（DataTable, SearchFilters）
- ✅ React Query Hooks 迁移（37+ 个文件）
- ✅ 表单验证统一（useZodForm）
- ✅ 错误处理统一（withErrorHandler）
- ✅ 数据加载统一（useBusinessData hooks）
- ✅ 创建业务 Hooks（useMy, useReports, useSites, useAuth 等）

### ⚠️ 进行中
- ⚠️ RentalManagement.tsx（部分重构，仍有文件上传调用）

### ⏳ 待开始
- ⏳ 类型安全改进
- ⏳ 代码优化和清理

---

## 🎯 后续优化任务

### 🔴 高优先级（建议优先处理）

#### 1. RentalManagement.tsx 完全重构
**状态**: ⚠️ 部分完成  
**优先级**: 🔴 高  
**工作量**: 1-2天  
**收益**: 高

**任务描述**:
- 当前状态：已创建 `useRentalProperties`, `useRentalPayments`, `useDormitoryAllocations` hooks
- 剩余工作：
  - 移除文件上传的直接 `apiClient` 调用（可选，文件上传通常直接调用）
  - 检查是否还有其他需要重构的部分

**文件位置**: `frontend/src/features/assets/pages/RentalManagement.tsx`

---

### 🟡 中优先级（近期处理）

#### 2. 类型安全改进
**状态**: ⏳ 待开始  
**优先级**: 🟡 中  
**工作量**: 2-3天  
**收益**: 中

**任务描述**:
移除 `as any` 类型断言，完善类型定义

**影响文件**:
- `frontend/src/features/hr/pages/LeaveManagement.tsx` (2处)
- `frontend/src/features/auth/pages/ResetTotpConfirm.tsx` (1处)
- `frontend/src/features/auth/pages/Login.tsx` (4处)
- `frontend/src/features/auth/pages/RequestTotpReset.tsx` (1处)
- `frontend/src/features/assets/pages/FixedAssetPurchase.tsx` (5处)

**改进建议**:
```typescript
// 重构前
const data = response as any

// 重构后
interface ApiResponse {
  data: T
  success: boolean
}
const data: ApiResponse<T> = response
```

---

#### 3. 清理混用模式
**状态**: ⏳ 待开始  
**优先级**: 🟡 中  
**工作量**: 1-2天  
**收益**: 中

**任务描述**:
检查并清理同时使用新旧模式的文件

**检查项**:
- [ ] 确认所有文件已迁移到 React Query hooks
- [ ] 移除旧的 `loadX` 函数调用（如果还有）
- [ ] 统一使用 `useBusinessData` hooks
- [ ] 统一使用 `withErrorHandler` 进行错误处理

**可能影响文件**:
- 检查所有已重构的文件，确保没有混用模式

---

### 🟢 低优先级（后续优化）

#### 4. 代码优化和提取
**状态**: ⏳ 待开始  
**优先级**: 🟢 低  
**工作量**: 持续进行  
**收益**: 低

**任务描述**:
提取更多通用逻辑，减少重复代码

**优化方向**:
1. **提取通用表单字段组件**
   - 员工选择器组件
   - 日期范围选择器组件
   - 金额输入组件（自动处理 cents 转换）

2. **提取通用业务逻辑**
   - 审批流程通用逻辑
   - 状态转换通用逻辑
   - 数据格式化通用函数

3. **优化组件结构**
   - 拆分大型组件（>500行）
   - 提取可复用的子组件

**示例**:
```typescript
// 创建通用员工选择器
export function EmployeeSelect({ value, onChange, ...props }) {
  const { data: employees = [] } = useEmployees()
  return (
    <Select value={value} onChange={onChange} {...props}>
      {employees.map(emp => (
        <Option key={emp.id} value={emp.id}>
          {emp.name} ({emp.departmentName})
        </Option>
      ))}
    </Select>
  )
}
```

---

#### 5. 性能优化
**状态**: ⏳ 待开始  
**优先级**: 🟢 低  
**工作量**: 持续进行  
**收益**: 低中

**优化方向**:
1. **React Query 缓存优化**
   - 调整 `staleTime` 和 `cacheTime`
   - 使用 `select` 优化数据转换
   - 实现乐观更新（Optimistic Updates）

2. **组件性能优化**
   - 使用 `React.memo` 优化重渲染
   - 使用 `useMemo` 和 `useCallback` 优化计算
   - 懒加载大型组件

3. **代码分割**
   - 路由级别的代码分割
   - 大型组件的动态导入

**示例**:
```typescript
// 使用 select 优化数据转换
const { data: employees } = useEmployees({
  select: (data) => data.map(e => ({ id: e.id, name: e.name }))
})

// 使用 React.memo 优化组件
export const EmployeeSelect = React.memo(({ value, onChange }) => {
  // ...
})
```

---

#### 6. 测试覆盖
**状态**: ⏳ 待开始  
**优先级**: 🟢 低  
**工作量**: 持续进行  
**收益**: 中

**任务描述**:
为重构后的代码添加测试覆盖

**测试类型**:
1. **单元测试**
   - Hooks 测试（React Query hooks）
   - 工具函数测试
   - 组件测试

2. **集成测试**
   - 页面组件测试
   - 表单提交流程测试

3. **E2E 测试**
   - 关键业务流程测试

**测试工具**:
- Vitest（单元测试）
- React Testing Library（组件测试）
- Playwright（E2E 测试）

---

#### 7. 文档完善
**状态**: ⏳ 待开始  
**优先级**: 🟢 低  
**工作量**: 1-2天  
**收益**: 低中

**任务描述**:
更新和完善技术文档

**文档内容**:
1. **Hooks 使用文档**
   - 各业务 hooks 的使用示例
   - 最佳实践指南

2. **组件库文档**
   - DataTable 组件 API
   - SearchFilters 组件 API
   - 通用组件使用指南

3. **重构指南**
   - 如何迁移旧代码到新模式
   - 代码规范检查清单

---

## 📋 实施检查清单

### 高优先级
- [ ] RentalManagement.tsx 完全重构
  - [ ] 检查文件上传调用是否需要重构
  - [ ] 确认所有功能已迁移到 hooks

### 中优先级
- [ ] 类型安全改进
  - [ ] 移除 `as any` 类型断言
  - [ ] 完善 API 响应类型定义
  - [ ] 完善组件 Props 类型定义
- [ ] 清理混用模式
  - [ ] 检查所有文件是否统一使用新模式
  - [ ] 移除旧的 `loadX` 函数调用
  - [ ] 统一错误处理方式

### 低优先级
- [ ] 代码优化和提取
  - [ ] 提取通用表单字段组件
  - [ ] 提取通用业务逻辑
  - [ ] 优化组件结构
- [ ] 性能优化
  - [ ] React Query 缓存优化
  - [ ] 组件性能优化
  - [ ] 代码分割
- [ ] 测试覆盖
  - [ ] 添加单元测试
  - [ ] 添加集成测试
  - [ ] 添加 E2E 测试
- [ ] 文档完善
  - [ ] Hooks 使用文档
  - [ ] 组件库文档
  - [ ] 重构指南

---

## 📊 统计摘要

| 指标 | 当前值 | 目标值 |
|------|--------|--------|
| 重构完成度 | ~85% | 100% |
| 使用 React Query | ~90% | 100% |
| 类型安全（无 as any） | ~80% | 100% |
| 测试覆盖率 | ~0% | 80%+ |
| 代码复用率 | ~75% | 90%+ |

---

## 🎯 建议实施顺序

### 第一阶段（1-2周）
1. ✅ 完成 RentalManagement.tsx 完全重构（如果还有剩余工作）
2. ✅ 类型安全改进（移除 as any）
3. ✅ 清理混用模式

### 第二阶段（2-4周）
4. ✅ 代码优化和提取
5. ✅ 性能优化
6. ✅ 添加测试覆盖

### 第三阶段（持续）
7. ✅ 文档完善
8. ✅ 持续优化和重构

---

## 📝 注意事项

1. **保持向后兼容**: 所有优化都要保持 API 接口不变
2. **充分测试**: 每个优化都要有对应的测试覆盖
3. **渐进式重构**: 不要一次性重构所有代码，按模块逐步进行
4. **代码审查**: 重构后的代码需要经过代码审查
5. **文档更新**: 更新相关技术文档和注释

---

## 🔗 相关文档

- [前端重构完成质量评估报告](./FRONTEND_REFACTOR_AUDIT.md)
- [代码精简优化方案](./CODE_OPTIMIZATION_PLAN.md)
- [项目改进建议](./PROJECT_RECOMMENDATIONS.md)

---

**最后更新**: 2025-01-21  
**维护者**: AI Assistant

