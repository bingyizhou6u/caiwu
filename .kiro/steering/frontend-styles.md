# Frontend Styles 规范

> 本文档定义了前端样式的分层架构、使用场景和编码规范。
> 设计风格：Apple Human Interface Guidelines 极简主义

## 设计系统概述

基于 Apple Human Interface Guidelines 的设计系统：

| 特性 | 说明 |
|------|------|
| 主色 | Apple Blue (#007AFF) |
| 字体 | SF Pro 风格字体栈 |
| 间距 | 4px 基准系统 |
| 圆角 | 8px-24px 大圆角 |
| 动效 | 0.15s-0.35s 流畅过渡 |
| 主题 | 亮色/暗色双主题 |

## 样式分层架构

```
frontend/src/styles/
├── base/                    # 基础样式
│   ├── variables.css        # CSS 变量（Apple 系统色、间距、字体）
│   ├── reset.css            # 样式重置
│   ├── typography.css       # 排版样式
│   └── scrollbar.css        # 滚动条样式
├── utilities/               # 工具类
│   ├── common.css           # 通用工具类（布局、文本、交互）
│   ├── layout.css           # 布局工具类
│   ├── animations.css       # 动画
│   ├── transitions.css      # 过渡效果
│   ├── states.css           # 状态样式
│   ├── responsive.css       # 响应式
│   └── accessibility.css    # 无障碍
├── layouts/                 # 布局样式
│   ├── main-layout.css      # 主布局
│   ├── sidebar.css          # 侧边栏（毛玻璃效果）
│   ├── header.css           # 头部（52px 高度）
│   ├── content.css          # 内容区
│   ├── page-container.css   # 页面容器
│   └── multi-tabs.css       # 多标签页
├── components/              # 组件样式
│   ├── antd-overrides.css   # Ant Design 覆盖
│   ├── button.css           # 按钮
│   ├── card.css             # 卡片
│   ├── form.css             # 表单
│   ├── table.css            # 表格
│   ├── modal.css            # 弹窗
│   ├── dark-mode.css        # 暗色模式
│   └── other.css            # 其他组件
└── features/                # 功能模块样式
    ├── auth/                # 认证模块
    └── employees/           # 员工模块
```

## 使用优先级

| 优先级 | 方式 | 适用场景 | 示例 |
|--------|------|----------|------|
| 1 | CSS 变量 | 颜色、间距、字体等设计 Token | `var(--color-primary)` |
| 2 | 工具类 | 布局、文本样式、交互状态 | `className="flex-center"` |
| 3 | CSS 文件 | 组件特有的复杂样式 | `layouts/sidebar.css` |
| 4 | 内联样式 | **仅限**动态计算值 | `style={{ marginLeft: collapsed ? 80 : 240 }}` |

## CSS 变量命名规范

| 类型 | 前缀 | 示例 |
|------|------|------|
| Apple 系统色 | `--apple-` | `--apple-blue`, `--apple-green` |
| 语义化颜色 | `--color-` | `--color-primary`, `--color-text-secondary` |
| 间距 | `--spacing-` | `--spacing-sm`, `--spacing-md` |
| 字体 | `--font-` | `--font-size-base`, `--font-weight-bold` |
| 圆角 | `--radius-` | `--radius-sm`, `--radius-lg` |
| 阴影 | `--shadow-` | `--shadow-sm`, `--shadow-lg` |
| 动效 | `--duration-`, `--ease-` | `--duration-fast`, `--ease-default` |

### Apple 系统色变量

| 变量 | 亮色值 | 暗色值 | 用途 |
|------|--------|--------|------|
| `--apple-blue` | #007AFF | #0A84FF | 主色 |
| `--apple-green` | #34C759 | #30D158 | 成功 |
| `--apple-red` | #FF3B30 | #FF453A | 错误 |
| `--apple-orange` | #FF9500 | #FF9F0A | 警告 |
| `--apple-teal` | #5AC8FA | #64D2FF | 信息 |

### 常用语义化变量

| 变量 | 用途 |
|------|------|
| `--color-primary` | 主色（Apple Blue） |
| `--color-primary-hover` | 主色悬停 |
| `--color-success` | 成功/收入（Apple Green） |
| `--color-error` | 错误/支出（Apple Red） |
| `--color-text-primary` | 主要文字 |
| `--color-text-secondary` | 次要文字 |
| `--color-text-tertiary` | 辅助文字 |
| `--color-bg-base` | 基础背景 |
| `--color-bg-secondary` | 次级背景 |
| `--color-separator` | 分隔线 |

## 工具类速查

### 布局
```jsx
<div className="flex-center">居中</div>
<div className="flex-between">两端对齐</div>
<div className="inline-flex-center">行内居中</div>
```

### 间距
```jsx
<div className="mt-sm">上边距 8px</div>
<div className="mt-md">上边距 16px</div>
<div className="mb-sm">下边距 8px</div>
<div className="mb-md">下边距 16px</div>
```

### 文本颜色
```jsx
<span className="text-muted">次要文本</span>
<span className="text-success">成功（绿色）</span>
<span className="text-error">错误（红色）</span>
<span className="text-primary">主色调</span>
```

### 交互
```jsx
<span className="cursor-pointer">可点击</span>
<span className="cursor-not-allowed">禁用</span>
```

## 合理的内联样式

以下场景**允许**使用内联样式：

```jsx
// ✅ 动态计算值
<Layout style={{ marginLeft: collapsed ? 80 : 240 }}>

// ✅ 基于数据的条件颜色
<span style={{ color: amount > 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
    {formatAmount(amount)}
</span>

// ✅ Ant Design 组件的 width 属性
<Select style={{ width: '100%' }} />
```

## 禁止的模式

```jsx
// ❌ 硬编码颜色
<span style={{ color: '#007AFF' }}>文本</span>
// ✅ 使用 CSS 变量或工具类
<span className="text-primary">文本</span>

// ❌ 在 CSS 文件中硬编码颜色（variables.css 除外）
.my-class { color: #007AFF; }
// ✅ 使用 CSS 变量
.my-class { color: var(--color-primary); }
```

## 检查清单

新增或修改样式时，确保：

- [ ] 颜色使用 CSS 变量（`var(--color-*)` 或 `var(--apple-*)`）
- [ ] 静态布局使用工具类
- [ ] 组件特有样式放在对应的 CSS 文件中
- [ ] 支持亮色/暗色主题切换
- [ ] 动效使用 `--duration-*` 和 `--ease-*` 变量
- [ ] 圆角使用 `--radius-*` 变量

---

详见 [样式指南](../../docs/frontend/styles.md) | [开发规范](../../docs/standards/development.md)
