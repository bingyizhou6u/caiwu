# Cloudflare 部署指南

本指南将帮助您将财务管理系统部署到 Cloudflare Workers 和 Pages。

## 📋 前置准备

### 1. 注册 Cloudflare 账户

访问 [Cloudflare](https://dash.cloudflare.com/sign-up) 注册免费账户。

### 2. 安装 Wrangler CLI

```bash
npm install -g wrangler

# 验证安装
wrangler --version
```

### 3. 登录 Cloudflare

```bash
wrangler login
```

这会打开浏览器窗口，按照提示完成授权。

## 🗄️ 数据库配置

### 1. 创建 D1 数据库

```bash
cd backend
wrangler d1 create caiwu-db
```

输出示例：
```
✅ Successfully created DB 'caiwu-db'

[[d1_databases]]
binding = "DB"
database_name = "caiwu-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 2. 更新 wrangler.toml

将上面输出的数据库配置复制到 `backend/wrangler.toml`：

```toml
name = "caiwu-backend"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "caiwu-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # 替换为实际 ID
```

### 3. 初始化数据库架构

```bash
# 在生产环境执行
wrangler d1 execute caiwu-db --remote --file=./src/db/schema.sql

# 验证数据库
wrangler d1 execute caiwu-db --remote --command="SELECT name FROM sqlite_master WHERE type='table';"
```

### 4. 添加审计日志表（如果有）

```bash
wrangler d1 execute caiwu-db --remote --file=./src/db/migration_add_audit_ip.sql
```

## 🚀 部署后端 API

### 1. 测试本地部署

```bash
cd backend

# 安装依赖
npm install

# 本地测试
npm run dev
```

访问 `http://localhost:8787` 测试 API。

### 2. 部署到生产环境

```bash
# 部署
npm run deploy

# 或者使用 wrangler
wrangler deploy
```

部署成功后会显示：
```
✨ Deployment complete!
https://caiwu-backend.<your-subdomain>.workers.dev
```

**记录这个 URL**，稍后前端配置需要用到。

### 3. 验证部署

```bash
curl https://caiwu-backend.<your-subdomain>.workers.dev/api/health
```

应该返回类似：
```json
{"status":"ok","timestamp":"2024-01-01T00:00:00.000Z"}
```

## 🌐 部署前端应用

### 方式一：通过 Cloudflare Dashboard（推荐）

#### 1. 连接 GitHub 仓库

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 选择您的账户
3. 点击左侧菜单 **Workers & Pages**
4. 点击 **Create application** > **Pages** > **Connect to Git**
5. 选择 GitHub，授权 Cloudflare 访问您的仓库
6. 选择 `bingyizhou6u/caiwu` 仓库

#### 2. 配置构建设置

- **Project name**: `caiwu-frontend`
- **Production branch**: `main`
- **Framework preset**: `Vite`
- **Build command**: `cd frontend && npm install && npm run build`
- **Build output directory**: `frontend/dist`
- **Root directory**: `/`（保持默认）

#### 3. 配置环境变量

点击 **Environment variables**，添加：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `VITE_API_BASE` | `https://caiwu-backend.<your-subdomain>.workers.dev` | 后端 API 地址 |
| `NODE_VERSION` | `18` | Node.js 版本 |

#### 4. 部署

点击 **Save and Deploy**，等待构建完成（约 2-3 分钟）。

部署成功后会显示：
```
✅ Success! Your site is live at:
https://caiwu-frontend.pages.dev
```

#### 5. 配置自定义域名（可选）

1. 在 Pages 项目页面，点击 **Custom domains**
2. 点击 **Set up a custom domain**
3. 输入您的域名（例如：`caiwu.yourdomain.com`）
4. 按照提示配置 DNS 记录

### 方式二：通过命令行部署

```bash
cd frontend

# 安装依赖
npm install

# 设置环境变量
export VITE_API_BASE=https://caiwu-backend.<your-subdomain>.workers.dev

# 构建
npm run build

# 部署
wrangler pages deploy dist --project-name=caiwu-frontend
```

## 🔄 配置自动部署（GitHub Actions）

### 1. 获取 Cloudflare API Token

1. 访问 [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. 点击 **Create Token**
3. 选择 **Edit Cloudflare Workers** 模板
4. 配置权限：
   - **Account** > **Workers Scripts** > **Edit**
   - **Account** > **D1** > **Edit**
   - **Account** > **Pages** > **Edit**
5. 设置 **Account Resources**：选择您的账户
6. 点击 **Continue to summary** > **Create Token**
7. **复制并保存 Token**（只显示一次）

### 2. 获取 Account ID

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 选择任意域名
3. 右侧栏会显示 **Account ID**，复制它

### 3. 配置 GitHub Secrets

1. 访问 GitHub 仓库：`https://github.com/bingyizhou6u/caiwu`
2. 点击 **Settings** > **Secrets and variables** > **Actions**
3. 点击 **New repository secret**，添加以下 Secrets：

| Name | Value | 说明 |
|------|-------|------|
| `CLOUDFLARE_API_TOKEN` | 刚才创建的 API Token | Cloudflare API 认证 |
| `CLOUDFLARE_ACCOUNT_ID` | 您的 Account ID | Cloudflare 账户 ID |
| `VITE_API_BASE` | `https://caiwu-backend.<your-subdomain>.workers.dev` | 前端 API 配置 |

### 4. 启用 GitHub Actions

项目中已包含 `.github/workflows/deploy.yml` 文件。

**测试自动部署**：
```bash
# 提交更改
git add .
git commit -m "docs: add deployment configuration"
git push origin main
```

访问 GitHub 仓库的 **Actions** 标签，查看部署进度。

## ✅ 验证部署

### 1. 检查后端 API

```bash
# 健康检查
curl https://caiwu-backend.<your-subdomain>.workers.dev/api/health

# 测试登录（需要先创建用户）
curl -X POST https://caiwu-backend.<your-subdomain>.workers.dev/api/auth/login-password \
  -H "Content-Type: application/json" \
  -d '{"email":"bingyizhou6u@gmail.com","password":"your-password"}'
```

### 2. 访问前端

访问：`https://caiwu-frontend.pages.dev`

如果配置了自定义域名，访问：`https://caiwu.yourdomain.com`

### 3. 首次登录

1. 访问前端 URL
2. 使用管理员邮箱 `bingyizhou6u@gmail.com` 登录
3. 首次登录会自动创建管理员账号
4. 设置初始密码
5. 配置双因素认证（可选）

## 🔧 常见问题

### 问题 1：部署后 API 返回 500 错误

**解决方法**：
```bash
# 查看 Workers 日志
wrangler tail caiwu-backend

# 检查数据库连接
wrangler d1 execute caiwu-db --remote --command="SELECT 1"
```

### 问题 2：前端无法连接后端

**检查**：
1. 确认 `VITE_API_BASE` 环境变量正确
2. 检查后端 CORS 配置
3. 在浏览器开发者工具中查看网络请求

**修复 CORS**：
在 `backend/src/index.ts` 中确保有：
```typescript
import { cors } from 'hono/cors'

app.use('/*', cors({
  origin: ['https://caiwu-frontend.pages.dev', 'https://caiwu.yourdomain.com'],
  credentials: true,
}))
```

### 问题 3：数据库查询失败

```bash
# 重新执行 schema
wrangler d1 execute caiwu-db --remote --file=./backend/src/db/schema.sql

# 检查表结构
wrangler d1 execute caiwu-db --remote --command="SELECT sql FROM sqlite_master WHERE type='table'"
```

### 问题 4：GitHub Actions 部署失败

**检查**：
1. GitHub Secrets 配置是否正确
2. API Token 权限是否足够
3. 查看 Actions 日志详细信息

## 📊 监控和日志

### 查看 Workers 日志

```bash
# 实时查看日志
wrangler tail caiwu-backend

# 查看最近的日志
wrangler tail caiwu-backend --format json
```

### Cloudflare Dashboard 监控

1. 访问 [Workers Dashboard](https://dash.cloudflare.com/)
2. 选择您的 Worker
3. 查看 **Metrics** 和 **Logs**

### Pages 部署日志

1. 访问 [Pages Dashboard](https://dash.cloudflare.com/)
2. 选择 `caiwu-frontend` 项目
3. 点击 **Deployments** 查看构建日志

## 🔒 安全建议

1. **启用 IP 白名单**：在系统管理中配置允许访问的 IP 地址
2. **定期备份数据**：定期导出 D1 数据库数据
3. **更新密钥**：定期更换 JWT secret 和 API tokens
4. **审计日志**：定期检查审计日志，监控异常操作
5. **HTTPS 强制**：确保所有请求都通过 HTTPS

## 🔄 更新部署

### 更新后端

```bash
cd backend
git pull origin main
npm install
wrangler deploy
```

### 更新前端

如果配置了 GitHub Actions，只需：
```bash
git push origin main
```

否则手动部署：
```bash
cd frontend
git pull origin main
npm install
npm run build
wrangler pages deploy dist --project-name=caiwu-frontend
```

## 📞 获取帮助

- **Cloudflare 文档**：https://developers.cloudflare.com/
- **Wrangler 文档**：https://developers.cloudflare.com/workers/wrangler/
- **GitHub Issues**：https://github.com/bingyizhou6u/caiwu/issues

## 🎉 部署完成

恭喜！您的财务管理系统已成功部署到 Cloudflare。

**后端 API**：`https://caiwu-backend.<your-subdomain>.workers.dev`  
**前端应用**：`https://caiwu-frontend.pages.dev`

享受使用吧！ 🚀

