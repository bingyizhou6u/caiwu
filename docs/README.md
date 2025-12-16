# AR公司财务管理系统 - 文档索引

> 最后更新：2025-01-XX  
> 本文档索引帮助快速定位项目相关文档

## 📚 文档结构

### 核心文档

#### 架构决策记录 (ADR)
- [001 - 使用 Drizzle ORM](./adr/001-use-drizzle-orm.md)
- [002 - V2 API 响应格式](./adr/002-v2-api-response-format.md)
- [003 - Cloudflare Workers](./adr/003-cloudflare-workers.md)

#### 部署与运维
- [部署指南](./DEPLOYMENT.md) - 生产环境部署步骤、环境配置、常见问题
- [错误码参考](./ERROR_CODES.md) - 系统错误码定义和说明

### 开发文档

#### 前端开发
- [测试指南](../frontend/src/docs/TESTING_GUIDE.md) - Vitest 和 Playwright 测试指南
- [组件库文档](../frontend/src/docs/COMPONENT_LIBRARY.md) - 通用组件使用说明
- [Hooks 使用指南](../frontend/src/docs/HOOKS_USAGE.md) - React Query Hooks 使用
- [代码分割指南](../frontend/src/docs/CODE_SPLITTING.md) - 代码分割和性能优化
- [组件性能优化](../frontend/src/docs/COMPONENT_PERFORMANCE.md) - React 性能优化技巧
- [React Query 优化](../frontend/src/docs/REACT_QUERY_OPTIMIZATION.md) - React Query 最佳实践
- [重构指南](../frontend/src/docs/REFACTORING_GUIDE.md) - 代码重构规范和流程
- [API 最佳实践](../frontend/docs/API_BEST_PRACTICES.md) - 前端 API 调用规范

#### 后端开发
- [测试迁移指南](../backend/test/V2_MIGRATION_GUIDE.md) - V2 API 测试迁移说明

#### 代码审计
- [RBAC 合规性审计](./RBAC_AUDIT.md) - 权限系统审计报告
- [命名规范审计](./NAMING_AUDIT.md) - API 命名规范审计报告

### 项目文档

- [后端 README](../backend/README.md) - 后端项目说明
- [前端 README](../frontend/README.md) - 前端项目说明

### 归档文档

历史文档已归档至 [archive](./archive/) 目录，包括：
- 前端重构相关文档
- 代码优化计划
- 业务改进建议

**注意**: 归档文档可能包含过时信息，仅供参考。

---

## 📖 快速导航

### 新手入门
1. 阅读 [部署指南](./DEPLOYMENT.md) 了解项目架构
2. 查看 [前端 README](../frontend/README.md) 和 [后端 README](../backend/README.md)
3. 参考 [API 最佳实践](../frontend/docs/API_BEST_PRACTICES.md) 开始开发

### 开发指南
- **前端开发**: 查看 `frontend/src/docs/` 目录下的文档
- **后端开发**: 查看 `backend/README.md` 和 `backend/test/V2_MIGRATION_GUIDE.md`
- **测试**: 参考 [测试指南](../frontend/src/docs/TESTING_GUIDE.md)

### 架构理解
- 查看 [架构决策记录](./adr/) 了解技术选型原因
- 阅读 [部署指南](./DEPLOYMENT.md) 了解部署架构

---

## 🔄 文档维护

- 文档应随代码更新及时维护
- 重大架构变更需更新对应的 ADR
- 新增功能需更新相关开发文档

---

## 📝 文档规范

- 使用 Markdown 格式
- 代码示例使用 TypeScript/JavaScript
- 中文注释和说明
- 保持文档简洁清晰

