# 项目管理模块 (PM)

> **最后更新**: 2025-12-28  
> 任务管理、工时记录、看板视图

---

## 📋 模块概述

项目管理模块提供任务跟踪、工时管理和看板视图功能，支持完整的软件开发工作流。

### 核心功能

| 功能 | 说明 |
|------|------|
| 项目管理 | 创建/编辑项目，项目进度统计 |
| 任务看板 | 可拖拽的Kanban视图，状态流转 |
| 任务管理 | 创建/编辑任务，多人员分配 |
| 工时记录 | 按任务记录工时，统计汇总 |

---

## 🔄 任务工作流

### 状态流程

```
待办 → 需求评审 → 开发中 → 代码评审 → 测试中 → 已完成
 │                                              │
 └──────────── 已阻塞 / 已取消 ←────────────────┘
```

### 状态说明

| 状态 | 键值 | 颜色 | 说明 |
|------|------|------|------|
| 待办 | `todo` | 灰色 | 新建任务的初始状态 |
| 需求评审 | `design_review` | 橙色 | 评审需求文档/设计方案 |
| 开发中 | `in_progress` | 蓝色 | 正在开发实现 |
| 代码评审 | `code_review` | 黄色 | 代码审核阶段 |
| 测试中 | `testing` | 紫色 | 测试验证阶段 |
| 已完成 | `completed` | 绿色 | 任务已完成 |
| 已阻塞 | `blocked` | 红色 | 任务被阻塞 |
| 已取消 | `cancelled` | 灰色 | 任务已取消 |

---

## 👥 人员角色分配

任务支持为不同阶段指定**多个**负责人（多选）：

| 角色 | 字段 | 对应阶段 | 存储格式 |
|------|------|---------|---------|
| 开发人员 | `assigneeIds` | 开发中 | JSON 数组 |
| 审核人员 | `reviewerIds` | 需求评审/代码评审 | JSON 数组 |
| 测试人员 | `testerIds` | 测试中 | JSON 数组 |

### API 响应示例

```json
{
  "id": "task-uuid",
  "title": "实现登录功能",
  "status": "in_progress",
  "assigneeIds": ["emp-1", "emp-2"],
  "assigneeNames": ["张三", "李四"],
  "reviewerIds": ["emp-3"],
  "reviewerNames": ["王五"],
  "testerIds": [],
  "testerNames": []
}
```

---

## 📊 数据库设计

### tasks 表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT | 主键 UUID |
| `code` | TEXT | 任务编号，如 TASK-PRJ-001-001 |
| `projectId` | TEXT | 所属项目 |
| `title` | TEXT | 任务标题 |
| `description` | TEXT | 任务描述 |
| `type` | TEXT | 类型：dev/design/test/doc/deploy |
| `priority` | TEXT | 优先级：high/medium/low |
| `status` | TEXT | 状态（见工作流） |
| `assigneeIds` | TEXT | 开发人员 JSON 数组 |
| `reviewerIds` | TEXT | 审核人员 JSON 数组 |
| `testerIds` | TEXT | 测试人员 JSON 数组 |
| `estimatedHours` | INTEGER | 预估工时 |
| `actualHours` | INTEGER | 实际工时（汇总） |
| `startDate` | TEXT | 开始日期 |
| `dueDate` | TEXT | 截止日期 |

### task_timelogs 表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT | 主键 UUID |
| `taskId` | TEXT | 关联任务 |
| `employeeId` | TEXT | 记录人员 |
| `logDate` | TEXT | 工时日期 |
| `hours` | INTEGER | 工时（小时） |
| `description` | TEXT | 工作描述 |

---

## 🎨 前端页面

### 页面列表

| 页面 | 路径 | 功能 |
|------|------|------|
| 项目列表 | `/pm/projects` | 查看所有项目 |
| 项目详情 | `/pm/projects/:id` | 项目统计、任务列表 |
| 任务看板 | `/pm/tasks/kanban` | 可拖拽看板视图 |
| 新建任务 | `/pm/tasks/new` | 创建任务表单 |
| 编辑任务 | `/pm/tasks/:id/edit` | 编辑任务表单 |
| 工时管理 | `/pm/timelogs` | 工时记录列表 |

### 看板功能

- **拖拽切换状态**：将任务卡片拖到不同列切换状态
- **任务详情弹窗**：点击卡片查看完整信息
- **悬停效果**：卡片悬停时上浮并显示阴影
- **过期提醒**：超过截止日期的任务显示红色日期

---

## 🔌 API 端点

### 任务相关

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v2/pm/tasks` | 获取任务列表 |
| GET | `/api/v2/pm/tasks/:id` | 获取任务详情 |
| POST | `/api/v2/pm/tasks` | 创建任务 |
| PUT | `/api/v2/pm/tasks/:id` | 更新任务 |
| DELETE | `/api/v2/pm/tasks/:id` | 删除任务 |
| GET | `/api/v2/pm/tasks/kanban` | 看板数据 |
| PUT | `/api/v2/pm/tasks/:id/status` | 更新状态 |

### 项目相关

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v2/pm/projects` | 项目列表 |
| GET | `/api/v2/pm/projects/:id` | 项目详情 |

---

## 📝 开发备注

### MultiTabs 标签名

项目详情页等动态路由页面的标签名通过以下机制设置：
1. 精确匹配 `KEY_TO_PATH` 配置
2. 读取 `document.title`（由 PageContainer 设置）
3. 路径模式匹配（如 `/pm/projects/:id` → "项目详情"）

### 旧数据兼容

人员字段从单选改为多选后，保留了旧字段：
- `assigneeId` → `assigneeIds`（兼容）
- `reviewerId` → `reviewerIds`（兼容）
- `testerId` → `testerIds`（兼容）

TaskService 会自动处理旧数据转换。

---

**最后更新**: 2025-12-28
