# AR公司财务管理系统 - 前端

> 基于 React 18 + TypeScript + Vite 构建的企业管理系统前端  
> 📚 完整文档: [知识库索引](../docs/README.md)

## 🚀 快速开始

### 安装与运行

```bash
# 安装依赖
npm install

# 启动开发服务器 (端口 5173)
npm run dev

# 构建生产版本
npm run build
```

### 常用命令

```bash
# 开发
npm run dev              # 启动开发服务器
npm run typecheck        # 类型检查
npm run lint             # 代码检查

# 测试
npm test                 # 单元测试
npm run test:e2e         # E2E 测试

# 构建
npm run build            # 生产构建
npm run gen:types        # 从 OpenAPI 生成类型
```

## 🛠 技术栈

| 技术 | 说明 |
|------|------|
| React 18 | 核心框架 |
| TypeScript | 类型安全 |
| Vite | 构建工具 |
| Ant Design 5 | UI 组件库 |
| React Query | 服务端状态 |
| Zustand | 客户端状态 |
| React Router 7 | 路由 |

## 📁 项目结构

```
src/
├── features/       # 业务模块（按域划分）
├── components/     # 公共组件
├── hooks/          # 自定义 Hooks
├── router/         # 路由配置
├── store/          # 状态管理
├── types/          # TypeScript 类型
└── utils/          # 工具函数
```

## 📚 详细文档

| 主题 | 文档 |
|------|------|
| 自定义 Hooks | [docs/frontend/hooks.md](../docs/frontend/hooks.md) |
| 路由配置 | [docs/frontend/router.md](../docs/frontend/router.md) |
| 表单组件 | [docs/frontend/form-components.md](../docs/frontend/form-components.md) |
| 组件拆分 | [docs/frontend/component-split.md](../docs/frontend/component-split.md) |
| 样式架构 | [docs/frontend/styles.md](../docs/frontend/styles.md) |
| 测试指南 | [docs/guides/testing.md](../docs/guides/testing.md) |
| 开发规范 | [docs/standards/development.md](../docs/standards/development.md) |

## ✅ 组件使用规范

**必须使用的公共组件**:
- `PageContainer` - 所有页面
- `DataTable` - 所有列表页面
- `AmountInput` / `AccountSelect` / `EmployeeSelect` - 表单组件

详见 [表单组件文档](../docs/frontend/form-components.md)

---

**最后更新**: 2025-12-30
