# 线上测试环境 - 模块化测试

线上测试已按模块拆分，可以独立运行各个模块的测试，避免一次性运行所有测试耗时过长。

## 模块列表

| 模块 | 文件 | 测试命令 | 说明 |
|------|------|---------|------|
| 认证模块 | `live-env-auth.spec.ts` | `npm run test:e2e:live:auth` | 登录、登出流程 |
| 个人中心 | `live-env-dashboard.spec.ts` | `npm run test:e2e:live:dashboard` | 个人中心、我的工作台 |
| 财务模块 | `live-env-finance.spec.ts` | `npm run test:e2e:live:finance` | 收支、转账、应收应付等 |
| 人事模块 | `live-env-hr.spec.ts` | `npm run test:e2e:live:hr` | 员工管理、薪资、请假、报销等 |
| 报表模块 | `live-env-reports.spec.ts` | `npm run test:e2e:live:reports` | 各类财务报表 |
| 系统管理模块 | `live-env-system.spec.ts` | `npm run test:e2e:live:system` | 部门、账户、权限等系统设置 |
| 站点模块 | `live-env-sites.spec.ts` | `npm run test:e2e:live:sites` | 站点管理和账单 |
| 资产模块 | `live-env-assets.spec.ts` | `npm run test:e2e:live:assets` | 固定资产和租赁物业 |
| CRUD操作 | `live-env-crud.spec.ts` | `npm run test:e2e:live:crud` | ⚠️ 增删改查完整流程（会修改数据） |

## 使用方法

### 1. 配置环境变量

在运行测试前，需要设置以下环境变量：

```bash
export LIVE_TEST_URL=https://cloudflarets.com
export LIVE_TEST_EMAIL=your-test-email@example.com
export LIVE_TEST_PASSWORD=your-password
export LIVE_TEST_TOTP_SECRET=your-totp-secret
```

或者创建 `.env` 文件：

```bash
LIVE_TEST_URL=https://cloudflarets.com
LIVE_TEST_EMAIL=your-test-email@example.com
LIVE_TEST_PASSWORD=your-password
LIVE_TEST_TOTP_SECRET=your-totp-secret
```

### 2. 运行单个模块测试

```bash
# 运行认证模块测试
npm run test:e2e:live:auth

# 运行财务模块测试
npm run test:e2e:live:finance

# 运行人事模块测试
npm run test:e2e:live:hr

# ... 其他模块类似
```

### 3. 运行所有模块测试（按顺序）

如果需要运行所有模块，可以依次执行：

```bash
npm run test:e2e:live:auth && \
npm run test:e2e:live:dashboard && \
npm run test:e2e:live:finance && \
npm run test:e2e:live:hr && \
npm run test:e2e:live:reports && \
npm run test:e2e:live:system && \
npm run test:e2e:live:sites && \
npm run test:e2e:live:assets
```

### 4. 使用 Playwright 直接运行

也可以直接使用 Playwright 命令运行：

```bash
# 运行单个模块
npx playwright test tests/live-env-auth.spec.ts --workers=1

# 运行多个模块
npx playwright test tests/live-env-auth.spec.ts tests/live-env-finance.spec.ts --workers=1

# 运行所有模块
npx playwright test tests/live-env-*.spec.ts --workers=1
```

## 测试特点

1. **Token 复用机制**：每个模块测试开始时获取一次 token，后续测试复用，避免频繁登录
2. **独立运行**：每个模块可以独立运行，互不影响
3. **顺序执行**：使用 `test.describe.serial` 确保测试按顺序执行，避免会话冲突
4. **自动登录**：使用 `ensureLoggedIn` 确保每个测试前已登录

## 测试覆盖情况

### 当前测试类型

| 测试类型 | 覆盖情况 | 说明 |
|---------|---------|------|
| **读取 (Read)** | ✅ 完全覆盖 | 所有模块都有"查看"测试 |
| **创建 (Create)** | ⚠️ 部分覆盖 | 仅在 `live-env-crud.spec.ts` 中 |
| **更新 (Update)** | ⚠️ 部分覆盖 | 仅在 `live-env-crud.spec.ts` 中 |
| **删除 (Delete)** | ⚠️ 部分覆盖 | 仅在 `live-env-crud.spec.ts` 中 |

### CRUD 测试说明

`live-env-crud.spec.ts` 包含完整的增删改查测试，但需要注意：

1. **会修改数据**：这些测试会实际创建、修改、删除数据
2. **测试环境**：确保在测试环境运行，不要在生产环境运行
3. **数据清理**：测试会尝试清理自己创建的测试数据（名称包含"E2E测试"）
4. **权限要求**：需要相应的权限才能执行增删改操作

### 运行 CRUD 测试

```bash
# 运行完整的 CRUD 测试
npm run test:e2e:live:crud

# 或使用 Playwright 直接运行
npx playwright test tests/live-env-crud.spec.ts --workers=1
```

## 注意事项

1. **TOTP Secret**：必须配置 `LIVE_TEST_TOTP_SECRET`，否则测试会被跳过
2. **测试环境**：确保测试环境稳定，避免频繁的 Cloudflare Workers 资源限制错误
3. **测试顺序**：虽然模块可以独立运行，但建议先运行认证模块，确保 token 获取正常
4. **并发限制**：使用 `--workers=1` 确保测试顺序执行，避免会话冲突
5. **CRUD 测试**：⚠️ CRUD 测试会修改数据，请确保在测试环境运行，并具有相应权限

## 故障排查

### Token 获取失败

如果看到 "获取 token 失败，将使用 UI 登录" 的警告：
- 检查 TOTP Secret 是否正确
- 检查网络连接是否正常
- 检查测试环境是否可访问

### 测试超时

如果测试经常超时：
- 增加 `LIVE_TEST_TIMEOUT` 环境变量（默认 60000ms）
- 检查测试环境性能
- 减少并发测试数量

### 会话冲突

如果出现登录失败或会话冲突：
- 确保使用 `--workers=1` 参数
- 检查是否有其他测试同时运行
- 等待前一个测试完全结束再运行下一个

