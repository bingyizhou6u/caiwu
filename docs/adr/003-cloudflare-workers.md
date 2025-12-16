# ADR-003: 使用 Cloudflare Workers 作为运行环境

## 状态

已采用

## 上下文

项目需要选择一个运行环境来部署后端服务。需要考虑以下因素：

1. **全球部署**: 需要低延迟的全球访问
2. **成本效益**: 控制服务器成本
3. **可扩展性**: 自动扩展应对流量波动
4. **开发体验**: 良好的开发工具和文档
5. **生态系统**: 数据库、存储等服务的集成

## 决策

选择 **Cloudflare Workers** 作为后端运行环境。

## 理由

### 优势

1. **边缘计算**: 代码运行在全球边缘节点，低延迟
2. **零服务器管理**: 无需管理服务器，自动扩展
3. **成本效益**: 按请求计费，成本可控
4. **完整生态**: D1（数据库）、R2（存储）、KV（缓存）等
5. **开发体验**: Wrangler CLI 提供良好的开发工具
6. **安全性**: Cloudflare 的安全防护和 DDoS 保护

### 与其他方案对比

| 方案 | 优势 | 劣势 | 适用场景 |
|------|------|------|---------|
| **Cloudflare Workers** | 边缘计算、成本低、生态完整 | 运行时限制 | ✅ 全球应用、API 服务 |
| AWS Lambda | 功能强大、生态成熟 | 成本较高、配置复杂 | 复杂应用 |
| Vercel Functions | 简单易用 | 功能受限、成本较高 | 简单应用 |
| 传统服务器 | 完全控制 | 需要运维、成本高 | 特殊需求 |

## 后果

### 正面影响

1. ✅ 全球低延迟访问
2. ✅ 无需服务器运维
3. ✅ 自动扩展，应对流量峰值
4. ✅ 成本可控，按需付费
5. ✅ 集成 Cloudflare 安全服务

### 负面影响

1. ⚠️ 运行时限制（CPU 时间、内存等）
2. ⚠️ 不支持某些 Node.js API
3. ⚠️ 冷启动可能影响首次请求

### 风险缓解

1. **代码优化**: 优化代码减少执行时间
2. **缓存策略**: 使用缓存减少数据库查询
3. **监控告警**: 监控性能指标，及时发现问题

## 实施

### 项目结构

```
backend/
├── src/
│   └── index.ts        # Workers 入口文件
├── wrangler.toml       # Workers 配置
└── package.json
```

### 配置示例

```toml
# wrangler.toml
name = "caiwu-backend"
main = "src/index.ts"
compatibility_date = "2024-11-21"

[[d1_databases]]
binding = "DB"
database_name = "caiwu-db"

[[r2_buckets]]
binding = "VOUCHERS"
bucket_name = "caiwu-vouchers"

[[kv_namespaces]]
binding = "SESSIONS_KV"
```

### 开发命令

```bash
# 本地开发
npm run dev

# 部署
npm run deploy
```

### 环境变量

```bash
# 设置 Secret
wrangler secret put AUTH_JWT_SECRET
```

## 限制与注意事项

### 运行时限制

- **CPU 时间**: 免费版 10ms，付费版 50ms
- **内存**: 128MB
- **请求大小**: 100MB
- **响应大小**: 100MB

### 不支持的 Node.js API

- `fs` 模块（文件系统）
- `child_process` 模块
- 某些 `crypto` 模块功能

### 最佳实践

1. **优化代码**: 减少不必要的计算
2. **使用缓存**: 缓存频繁访问的数据
3. **异步操作**: 使用 `waitUntil` 处理后台任务
4. **错误处理**: 完善的错误处理和监控

## 参考

- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [D1 数据库文档](https://developers.cloudflare.com/d1/)
- [R2 存储文档](https://developers.cloudflare.com/r2/)

## 更新记录

- 2025-12-15: 初始版本

