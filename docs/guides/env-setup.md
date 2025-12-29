# 环境变量配置检查清单

## ✅ 必需的环境变量

### 生产环境（Cloudflare Workers）

所有生产环境的环境变量必须通过 `wrangler secret` 设置：

```bash
cd backend

# 1. JWT 密钥（必需）
wrangler secret put AUTH_JWT_SECRET
# 输入一个强密码（至少32个字符）



# 3. 邮件服务 Token（可选，如果使用邮件功能）
wrangler secret put EMAIL_TOKEN
```

### 开发环境（本地开发）

开发环境的环境变量在 `wrangler.toml` 的 `[env.dev.vars]` 中配置：

```toml
[env.dev.vars]
AUTH_JWT_SECRET = "dev-jwt-secret-for-local-testing-only"

```

## 🔍 验证环境变量是否设置

### 检查生产环境 Secret

```bash
# 列出所有已设置的 Secret
wrangler secret list

# 应该看到：
# - AUTH_JWT_SECRET

```

### 检查开发环境配置

```bash
# 检查 wrangler.toml 文件
cat backend/wrangler.toml | grep -A 5 "\[env.dev.vars\]"

# 应该看到：
# AUTH_JWT_SECRET = "..."
# INIT_ADMIN_PASSWORD_HASH = "$2b$10$..."
```


1. **Cloudflare Zero Trust**: 依赖 Cloudflare Access 进行身份验证
2. **最小权限原则**: 仅赋予必要的 Service Bindings 和 Secret 权限

## 📚 相关文档

- [README.md](./README.md) - 完整的开发文档
- [DEPLOY.md](../DEPLOY.md) - 部署文档
- [.cursorrules](../.cursorrules) - 项目配置说明
