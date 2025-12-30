# Frontend Styles 规范

> 本文档定义了前端样式的分层架构、使用场景和编码规范。

## 样式分层架构

```
frontend/src/styles/
├── base/              # 基础样式
│   ├── variables.css  # CSS 变量（颜色、间距、字体）
│   └── reset.css      # 样式重置
├── utilities/         # 工具类
│   └── common.css     # 通用工具类（布局、文本、交互）
├── layouts/           # 布局样式
│   ├── main-layout.css
│   └── page-container.css
├── components/        # 组件样式
│   ├── card.css
│   ├── table.css
│   └── form.css
└── overrides/         # 第三方库覆盖
    └── antd-overrides.css
```

## 使用优先级

| 优先级 | 方式 | 适用场景 |
|--------|------|----------|
| 1 | CSS 变量 | 颜色、间距、字体等设计 Token |
| 2 | 工具类 | 布局、文本样式、交互状态 |
| 3 | CSS Modules | 组件特有的复杂样式 |
| 4 | 内联样式 | **仅限**动态计算值 |

## 工具类速查

### 布局
```jsx
<div className="flex-center">居中</div>
<div className="flex-between">两端对齐</div>
<div className="inline-flex-center">行内居中</div>
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

### 加载状态
```jsx
<div className="loading-container">
    <Spin size="large" />
</div>
```

## 合理的内联样式

以下场景**允许**使用内联样式：

```jsx
// ✅ 动态计算值
<Layout style={{ marginLeft: collapsed ? 80 : 240 }}>

// ✅ 组件 style prop（允许外部覆盖）
<AmountDisplay cents={value} style={{ color: value > 0 ? '#52c41a' : '#999' }} />

// ✅ 测试文件中的样式
<TestComponent style={{ width: 200 }} />
```

## 禁止的模式

```jsx
// ❌ 硬编码颜色
<span style={{ color: '#1890ff' }}>文本</span>
// ✅ 使用 CSS 变量或工具类
<span className="text-primary">文本</span>

// ❌ 静态布局内联样式
<div style={{ display: 'flex', justifyContent: 'center' }}>
// ✅ 使用工具类
<div className="flex-center">

// ❌ 重复的内联样式
<span style={{ cursor: 'pointer' }} onClick={...}>
// ✅ 使用工具类
<span className="cursor-pointer" onClick={...}>
```

## CSS 变量命名规范

| 类型 | 前缀 | 示例 |
|------|------|------|
| 颜色 | `--color-` | `--color-primary`, `--color-text-secondary` |
| 间距 | `--spacing-` | `--spacing-sm`, `--spacing-md` |
| 字体 | `--font-` | `--font-size-base`, `--font-weight-bold` |
| 边框 | `--border-` | `--border-radius-base` |
| 阴影 | `--shadow-` | `--shadow-sm`, `--shadow-lg` |

## 检查清单

新增或修改样式时，确保：

- [ ] 颜色使用 CSS 变量（`var(--color-*)`）
- [ ] 静态布局使用工具类
- [ ] 组件特有样式使用 CSS Modules
- [ ] 动态值使用内联样式时有合理理由
- [ ] 支持亮色/暗色主题切换

---

详见 [样式指南](../../docs/frontend/styles.md) | [开发规范](../../docs/standards/development.md)
