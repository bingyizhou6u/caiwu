# 线上环境 E2E 测试文档

## 概述

本测试套件用于在线上测试环境（cloudflarets.com）进行端到端测试，验证系统各功能模块的正常运行。

## 测试配置

### 环境变量

在运行测试前，需要设置以下环境变量：

```bash
export LIVE_TEST_URL=https://cloudflarets.com
export LIVE_TEST_EMAIL=bingyizhou6u@gmail.com
export LIVE_TEST_PASSWORD=Qq1234
export LIVE_TEST_TOTP_SECRET=<从数据库获取>
```

### 获取 TOTP Secret

```bash
cd backend
npx wrangler d1 execute caiwu-db --remote --command "SELECT totp_secret FROM employees WHERE email = 'bingyizhou6u@gmail.com'"
```

## 运行测试

### 运行所有测试

```bash
cd frontend
npm run test:e2e:live
```

### 运行特定模块测试

```bash
# 认证模块
npx playwright test tests/live-env.spec.ts --grep "认证模块" --workers=1

# 财务模块
npx playwright test tests/live-env.spec.ts --grep "财务模块" --workers=1

# 人事模块
npx playwright test tests/live-env.spec.ts --grep "人事模块" --workers=1
```

## 测试覆盖范围

### ✅ 认证模块 (2个测试)
- 登录流程
- 登出流程

### ✅ 仪表盘和个人中心 (7个测试)
- 查看仪表盘
- 查看个人中心
- 查看我的请假
- 查看我的报销
- 查看我的借款
- 查看我的资产
- 查看我的审批

### ✅ 财务模块 (9个测试)
- 查看收支列表
- 查看新增收支页面
- 查看账户转账
- 查看账户交易
- 查看导入中心
- 查看借款管理
- 查看还款管理
- 查看应收管理
- 查看应付管理

### ✅ 人事模块 (6个测试)
- 查看员工管理
- 查看薪资报表
- 查看薪资发放
- 查看补贴发放
- 查看请假管理
- 查看报销管理

### ✅ 报表模块 (10个测试)
- 查看部门现金流报表
- 查看站点增长报表
- 查看应收汇总报表
- 查看应收明细报表
- 查看应付汇总报表
- 查看应付明细报表
- 查看费用汇总报表
- 查看费用明细报表
- 查看账户余额报表
- 查看借款报表

### ✅ 系统管理模块 (9个测试)
- 查看部门管理
- 查看类别管理
- 查看账户管理
- 查看币种管理
- 查看供应商管理
- 查看权限管理
- 查看邮件设置
- 查看IP白名单
- 查看审计日志

### ✅ 站点模块 (2个测试)
- 查看站点管理
- 查看站点账单

### ✅ 资产模块 (2个测试)
- 查看固定资产
- 查看租赁物业

## 测试统计

- **总测试用例数**: 47个
- **覆盖模块数**: 8个主要模块
- **测试类型**: 只读测试（不创建/修改/删除数据）

## 注意事项

1. **顺序执行**: 测试使用 `--workers=1` 参数顺序执行，避免会话冲突
2. **只读测试**: 所有测试均为只读操作，不会修改线上数据
3. **超时设置**: 每个测试默认超时时间为 60 秒
4. **信任设备**: 如果设备已被信任，会跳过 TOTP 验证

## 故障排查

### 登录失败
- 检查 TOTP Secret 是否正确
- 检查网络连接是否正常
- 检查测试账号是否可用

### 页面加载超时
- 检查线上环境是否正常运行
- 检查网络延迟
- 适当增加超时时间

### 测试中断
- 检查是否有其他测试正在运行
- 检查系统资源是否充足
- 使用 `--workers=1` 确保顺序执行

## 持续集成

可以将此测试集成到 CI/CD 流程中：

```yaml
# GitHub Actions 示例
- name: Run Live E2E Tests
  env:
    LIVE_TEST_TOTP_SECRET: ${{ secrets.LIVE_TEST_TOTP_SECRET }}
  run: |
    cd frontend
    npm run test:e2e:live
```

