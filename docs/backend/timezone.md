# 业务时区文档

> **核心文件**：`backend/src/utils/timezone.ts`

---

## ⏰ 时区标准

| 配置 | 值 |
|------|------|
| **业务时区** | Asia/Dubai (UTC+4) |
| **偏移量** | +4 小时 |
| **用途** | 所有业务日期计算、报表统计 |

---

## 📅 核心函数

### 获取业务日期

```typescript
import { getBusinessDate, getBusinessDateTime } from '../utils/timezone.js'

// 获取当前业务日期 (YYYY-MM-DD)
const today = getBusinessDate()  // "2025-12-27"

// 获取业务日期时间 (YYYY-MM-DD HH:mm:ss)
const now = getBusinessDateTime()  // "2025-12-27 14:30:00"
```

### 月份范围

```typescript
import { getBusinessMonthStart, getBusinessMonthEnd } from '../utils/timezone.js'

const start = getBusinessMonthStart()  // "2025-12-01"
const end = getBusinessMonthEnd()      // "2025-12-31"
```

### 时间戳转换

```typescript
import { toBusinessTime, businessTimeToUtc } from '../utils/timezone.js'

// UTC 时间戳 → 业务时间
const businessTime = toBusinessTime(Date.now())

// 业务日期 → UTC 时间戳
const utcTs = businessTimeToUtc("2025-12-27")
```

### 数据库查询

```typescript
import { getBusinessDayUtcRange } from '../utils/timezone.js'

// 获取某天的 UTC 时间范围
const { startUtc, endUtc } = getBusinessDayUtcRange("2025-12-27")

// 用于查询
db.select().from(table).where(
  and(
    gte(table.createdAt, startUtc),
    lte(table.createdAt, endUtc)
  )
)
```

---

## ⚠️ 使用规范

> [!CAUTION]
> **禁止使用 `new Date().toISOString().split('T')[0]`**  
> 这会使用服务器时区（UTC），导致日期不一致。

### ✅ 正确

```typescript
import { getBusinessDate } from '../utils/timezone.js'
const bizDate = getBusinessDate()
```

### ❌ 错误

```typescript
const bizDate = new Date().toISOString().split('T')[0]
```

---

## 🗓️ 前端显示

前端直接显示后端返回的业务日期字符串，无需转换：

```tsx
// 后端返回 "2025-12-27"
<span>{record.bizDate}</span>
```

---

**最后更新**：2025-12-27
