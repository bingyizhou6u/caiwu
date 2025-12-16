# ADR-001: 使用 Drizzle ORM

## 状态

已采用

## 上下文

项目需要选择一个 ORM（对象关系映射）工具来管理数据库操作。需要考虑以下因素：

1. **Cloudflare Workers 环境限制**: 运行在边缘计算环境，不支持 Node.js 原生 API
2. **SQLite 数据库**: 使用 Cloudflare D1（基于 SQLite）
3. **类型安全**: TypeScript 项目需要类型安全的数据库操作
4. **性能**: 边缘计算环境对性能要求较高
5. **迁移管理**: 需要良好的数据库迁移支持

## 决策

选择 **Drizzle ORM** 作为项目的 ORM 工具。

## 理由

### 优势

1. **轻量级**: Drizzle 是一个轻量级 ORM，适合边缘计算环境
2. **类型安全**: 完整的 TypeScript 类型支持，编译时类型检查
3. **SQL-like 语法**: 接近原生 SQL 的语法，学习成本低
4. **性能优秀**: 生成的 SQL 查询效率高，适合性能敏感场景
5. **迁移支持**: 内置迁移工具（Drizzle Kit）
6. **Cloudflare 支持**: 官方支持 Cloudflare D1

### 与其他方案对比

| 方案 | 优势 | 劣势 | 适用场景 |
|------|------|------|---------|
| **Drizzle ORM** | 轻量、类型安全、性能好 | 生态相对较新 | ✅ 边缘计算、TypeScript 项目 |
| Prisma | 功能强大、生态成熟 | 体积大、不适合边缘环境 | 传统 Node.js 应用 |
| TypeORM | 功能全面 | 体积大、性能一般 | 传统 Node.js 应用 |
| 原生 SQL | 性能最优 | 类型不安全、维护成本高 | 简单项目 |

## 后果

### 正面影响

1. ✅ 类型安全的数据库操作，减少运行时错误
2. ✅ 良好的开发体验，IDE 自动补全
3. ✅ 适合 Cloudflare Workers 环境
4. ✅ 性能优秀，满足边缘计算需求

### 负面影响

1. ⚠️ 生态相对较新，社区资源较少
2. ⚠️ 某些高级功能可能需要手动 SQL
3. ⚠️ 学习曲线（虽然相对平缓）

### 风险缓解

1. **文档完善**: 项目内部文档详细记录使用模式
2. **代码审查**: 确保数据库操作符合最佳实践
3. **测试覆盖**: 充分的测试确保功能正确性

## 实施

### Schema 定义示例

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const employees = sqliteTable('employees', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  // ...
})
```

### 查询示例

```typescript
import { eq } from 'drizzle-orm'

// 查询单个记录
const employee = await db.query.employees.findFirst({
  where: eq(employees.id, employeeId)
})

// 复杂查询
const results = await db
  .select()
  .from(employees)
  .where(eq(employees.status, 'active'))
  .limit(10)
```

### 迁移管理

使用 Drizzle Kit 生成迁移：

```bash
npm run db:generate
npm run migrate:up
```

## 参考

- [Drizzle ORM 官方文档](https://orm.drizzle.team/)
- [Drizzle Kit 文档](https://orm.drizzle.team/kit-docs/overview)
- [Cloudflare D1 文档](https://developers.cloudflare.com/d1/)

## 更新记录

- 2025-12-15: 初始版本

