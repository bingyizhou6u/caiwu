# ESLint 配置指南

**版本**: 1.0  
**更新日期**: 2024-12-19

---

## 📋 概述

本文档提供 ESLint 配置建议，用于检查公共组件的使用规范。

---

## 🚀 快速开始

### 1. 安装 ESLint 和相关插件

```bash
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-react eslint-plugin-react-hooks
```

### 2. 创建 ESLint 配置文件

创建 `.eslintrc.cjs` 文件：

```javascript
module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  rules: {
    // 自定义规则可以在这里添加
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};
```

### 3. 添加自定义规则（可选）

如果需要强制使用公共组件，可以添加自定义规则。这需要创建 ESLint 插件。

---

## 📝 推荐的 ESLint 规则

### TypeScript 规则

```javascript
rules: {
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  '@typescript-eslint/explicit-function-return-type': 'off',
  '@typescript-eslint/explicit-module-boundary-types': 'off',
}
```

### React 规则

```javascript
rules: {
  'react/react-in-jsx-scope': 'off', // React 17+ 不需要
  'react/prop-types': 'off', // 使用 TypeScript
  'react-hooks/rules-of-hooks': 'error',
  'react-hooks/exhaustive-deps': 'warn',
}
```

### 代码风格规则

```javascript
rules: {
  'no-console': ['warn', { allow: ['warn', 'error'] }],
  'prefer-const': 'error',
  'no-var': 'error',
}
```

---

## 🔍 组件使用检查（手动）

由于创建自定义 ESLint 规则比较复杂，建议通过以下方式检查：

### 1. 代码审查检查清单

使用 [代码审查检查清单](./CODE_REVIEW_CHECKLIST.md) 进行人工检查。

### 2. 脚本检查（可选）

可以创建一个简单的脚本检查组件使用：

```bash
#!/bin/bash
# check-components.sh

# 检查是否直接使用 Ant Design Table
grep -r "from ['\"]antd.*Table" src/features --include="*.tsx" | grep -v "DataTable"

# 检查是否直接使用 Select 选择账户/员工等
grep -r "<Select" src/features --include="*.tsx" | grep -E "(account|employee|department|vendor|currency)"

# 检查是否直接使用 InputNumber 输入金额
grep -r "<InputNumber" src/features --include="*.tsx" | grep -i "amount"
```

### 3. CI/CD 集成

在 CI/CD 流程中添加检查脚本：

```yaml
# .github/workflows/check.yml
name: Code Check
on: [push, pull_request]
jobs:
  check-components:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Check component usage
        run: |
          # 运行检查脚本
          ./scripts/check-components.sh
```

---

## 📚 相关文档

- [组件使用指南](./COMPONENT_USAGE_GUIDE.md)
- [代码审查检查清单](./CODE_REVIEW_CHECKLIST.md)

---

**注意**: 当前项目可能没有配置 ESLint。如果需要，可以按照本文档进行配置。组件使用检查主要通过代码审查检查清单进行。
