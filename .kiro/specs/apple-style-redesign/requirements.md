# Requirements Document

## Introduction

本规范定义前端 UI 整体风格重新设计，参考 Apple 设计语言，采用极简主义风格，支持亮色/暗色双主题。

## Glossary

- **Design_System**: 设计系统，包括颜色、字体、间距、组件样式等
- **Apple_Style**: Apple 设计风格，特点是极简、大量留白、精致动效、SF Pro 字体风格
- **Light_Theme**: 亮色主题，白色/浅灰背景
- **Dark_Theme**: 暗色主题，深灰/黑色背景
- **System_Color**: Apple 系统色，如 systemBlue、systemGreen 等

## Requirements

### Requirement 1: 配色系统重构

**User Story:** As a 用户, I want 界面配色符合 Apple 设计规范, so that 视觉体验更加统一和专业。

#### Acceptance Criteria

1. THE Design_System SHALL 使用 Apple Human Interface Guidelines 定义的系统色
2. THE Design_System SHALL 定义亮色主题配色方案（白色背景、深色文字）
3. THE Design_System SHALL 定义暗色主题配色方案（深色背景、浅色文字）
4. WHEN 主题切换时, THE Design_System SHALL 平滑过渡所有颜色值
5. THE Design_System SHALL 使用 CSS 变量管理所有颜色，便于主题切换

### Requirement 2: 字体与排版系统重构

**User Story:** As a 用户, I want 字体排版符合 Apple 风格, so that 阅读体验更加舒适。

#### Acceptance Criteria

1. THE Design_System SHALL 使用 SF Pro 风格的系统字体栈（-apple-system, BlinkMacSystemFont, "Segoe UI"）
2. THE Design_System SHALL 定义清晰的字体层级（标题、正文、辅助文字）
3. THE Design_System SHALL 使用适当的字重（Regular 400, Medium 500, Semibold 600）
4. THE Design_System SHALL 设置合适的行高和字间距
5. THE Design_System SHALL 重新设计标题样式（h1-h6），使用更大的字号差异
6. THE Design_System SHALL 优化段落和列表的排版样式
7. THE Design_System SHALL 增加页面内容区的留白空间

### Requirement 3: 间距与布局系统

**User Story:** As a 用户, I want 界面布局有充足的留白, so that 内容更易阅读和操作。

#### Acceptance Criteria

1. THE Design_System SHALL 定义 4px 基准的间距系统（4, 8, 12, 16, 20, 24, 32, 48）
2. THE Design_System SHALL 增加组件间的留白空间
3. THE Design_System SHALL 使用更大的内边距（padding）
4. THE Design_System SHALL 保持视觉层次清晰
5. THE Design_System SHALL 优化页面内容区的信息密度
6. THE Design_System SHALL 使用更大的圆角（8px-24px）符合 Apple 风格

### Requirement 4: 侧边栏重新设计

**User Story:** As a 用户, I want 侧边栏简洁优雅, so that 导航体验更加流畅。

#### Acceptance Criteria

1. THE Design_System SHALL 设计简约的侧边栏样式（无复杂渐变）
2. THE Design_System SHALL 使用半透明毛玻璃效果（可选）
3. THE Design_System SHALL 设计精致的菜单项 hover/选中效果
4. THE Design_System SHALL 保留折叠/展开功能
5. WHEN 侧边栏折叠时, THE Design_System SHALL 提供平滑的过渡动画

### Requirement 5: 顶部导航栏重新设计

**User Story:** As a 用户, I want 顶部导航栏简洁, so that 不分散对内容的注意力。

#### Acceptance Criteria

1. THE Design_System SHALL 设计简约的顶部导航栏
2. THE Design_System SHALL 使用毛玻璃效果（backdrop-filter: blur）
3. THE Design_System SHALL 精简导航栏元素，保持必要功能

### Requirement 6: 组件样式统一

**User Story:** As a 用户, I want 所有组件风格统一, so that 界面整体协调。

#### Acceptance Criteria

1. THE Design_System SHALL 重新设计按钮样式（圆角、颜色、hover 效果）
2. THE Design_System SHALL 重新设计卡片样式（阴影、边框、圆角）
3. THE Design_System SHALL 重新设计表格样式（行高、边框、hover 效果）
4. THE Design_System SHALL 重新设计表单样式（输入框、选择器、开关）
5. THE Design_System SHALL 重新设计弹窗样式（圆角、阴影、动画）

### Requirement 7: 动效系统

**User Story:** As a 用户, I want 界面有精致的微动效, so that 交互体验更加流畅。

#### Acceptance Criteria

1. THE Design_System SHALL 定义统一的过渡时间（0.2s - 0.3s）
2. THE Design_System SHALL 使用 Apple 风格的缓动函数（ease-out, ease-in-out）
3. THE Design_System SHALL 为 hover、focus、active 状态添加微动效
4. THE Design_System SHALL 避免过度动画，保持克制

### Requirement 8: 多标签页重新设计

**User Story:** As a 用户, I want 多标签页样式简洁, so that 页面切换更加直观。

#### Acceptance Criteria

1. THE Design_System SHALL 设计简约的标签页样式
2. THE Design_System SHALL 使用细微的选中指示器
3. THE Design_System SHALL 提供平滑的切换动画
