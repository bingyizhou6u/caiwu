# 资产管理模块文档

> **服务目录**：`backend/src/services/assets/`

---

## 🏢 核心功能

### 1. 固定资产 (FixedAssetService)

固定资产全生命周期管理。

**资产状态**：
- `in_use` - 使用中
- `idle` - 闲置
- `maintenance` - 维修
- `scrapped` - 报废
- `sold` - 已售

**关键操作**：
- 购买：创建资产记录
- 分配：分配给员工使用
- 归还：员工归还资产
- 调拨：跨部门/站点转移
- 出售：记录售价和买家
- 折旧：计算资产折旧

### 2. 资产分配 (FixedAssetAllocationService)

员工资产领用和归还。

**分配类型**：
- `employee_onboarding` - 入职领用
- `project_need` - 项目需要
- `replacement` - 更换

**归还类型**：
- `employee_offboarding` - 离职归还
- `project_complete` - 项目完成
- `damage` - 损坏归还

### 3. 资产变更 (FixedAssetChangeService)

所有资产变更记录。

**变更类型**：
- `purchase` - 购买
- `allocation` - 分配
- `return` - 归还
- `transfer` - 调拨
- `status_change` - 状态变更
- `sale` - 出售

---

## 🏠 租赁管理

### 租赁物业 (RentalPropertyService)

公司租赁的办公/宿舍/仓库管理。

**物业类型**：
- `office` - 办公室
- `dormitory` - 宿舍
- `apartment` - 公寓
- `warehouse` - 仓库

**租金支付**：
- 按月/年支付
- 自动生成应付账单
- 关联现金流水记录

### 宿舍分配 (DormitoryAllocationService)

员工宿舍分配管理。

- 分配房间/床位
- 计算员工租金
- 支持退宿处理

---

## 📊 资产报表

### 资产汇总

```
GET /api/v2/reports/assets/summary
```

### 资产折旧报表

```
GET /api/v2/reports/assets/depreciation
```

---

**最后更新**: 2025-12-27
