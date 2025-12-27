# 环境变量配置检查清单

## ✅ 必需的环境变量

### 生产环境（Cloudflare Workers）

所有生产环境的环境变量必须通过 `wrangler secret` 设置：

```bash
cd backend

# 1. JWT 密钥（必需）
wrangler secret put AUTH_JWT_SECRET
# 输入一个强密码（至少32个字符）

# 2. 初始化管理员密码哈希（必需）
# 首先生成密码哈希
npm run gen:password-hash "your-secure-password"
# 复制输出的哈希值，然后运行：
wrangler secret put INIT_ADMIN_PASSWORD_HASH
# 粘贴哈希值

# 3. 邮件服务 Token（可选，如果使用邮件功能）
wrangler secret put EMAIL_TOKEN
```

### 开发环境（本地开发）

开发环境的环境变量在 `wrangler.toml` 的 `[env.dev.vars]` 中配置：

```toml
[env.dev.vars]
AUTH_JWT_SECRET = "dev-jwt-secret-for-local-testing-only"
INIT_ADMIN_PASSWORD_HASH = "$2b$10$..."  # 使用 npm run gen:password-hash 生成
```

## 🔍 验证环境变量是否设置

### 检查生产环境 Secret

```bash
# 列出所有已设置的 Secret
wrangler secret list

# 应该看到：
# - AUTH_JWT_SECRET
# - INIT_ADMIN_PASSWORD_HASH
```

### 检查开发环境配置

```bash
# 检查 wrangler.toml 文件
cat backend/wrangler.toml | grep -A 5 "\[env.dev.vars\]"

# 应该看到：
# AUTH_JWT_SECRET = "..."
# INIT_ADMIN_PASSWORD_HASH = "$2b$10$..."
```

## ⚠️ 常见问题

### 1. 系统初始化失败：未设置 INIT_ADMIN_PASSWORD_HASH

**错误信息**:
```
系统初始化失败：未设置 INIT_ADMIN_PASSWORD_HASH 环境变量
```

**解决方法**:
1. 生成密码哈希：`npm run gen:password-hash "your-password"`
2. 设置 Secret：`wrangler secret put INIT_ADMIN_PASSWORD_HASH`
3. 或在开发环境的 `wrangler.toml` 中设置

### 2. 忘记已设置的密码哈希

如果忘记了已设置的密码哈希，需要重新设置：

```bash
# 生成新的密码哈希
npm run gen:password-hash "new-password"

# 更新 Secret
wrangler secret put INIT_ADMIN_PASSWORD_HASH
```

### 3. 开发环境环境变量未生效

确保：
1. `wrangler.toml` 文件中的 `[env.dev.vars]` 配置正确
2. 使用 `npm run dev` 启动开发服务器（不是直接运行 `wrangler dev`）

## 📝 密码哈希生成工具

使用内置工具生成密码哈希：

```bash
npm run gen:password-hash "your-password"
```

工具会输出：
- 生成的 bcrypt 哈希值
- 如何在开发环境配置
- 如何在生产环境设置 Secret

## 🔐 安全建议

1. **使用强密码**: 初始化管理员密码应该足够复杂（至少12个字符，包含大小写字母、数字和特殊字符）
2. **定期轮换**: 建议定期更新密码哈希
3. **不要提交到版本控制**: 密码哈希不应该提交到 Git 仓库
4. **使用不同的密码**: 开发环境和生产环境使用不同的密码

## 📚 相关文档

- [README.md](./README.md) - 完整的开发文档
- [DEPLOY.md](../DEPLOY.md) - 部署文档
- [.cursorrules](../.cursorrules) - 项目配置说明
