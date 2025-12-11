# 前端 API 调用最佳实践

## 📚 概述

本文档提供前端 API 调用的最佳实践和标准模式。

## ✅ 推荐方式

### 1. 导入

```typescript
import { api } from '../../../config/api'
import { api as apiClient } from '../../../api/http'
```

### 2. 基本请求

#### GET 请求
```typescript
// 获取列表
const employees = await apiClient.get<Employee[]>(api.employees)

// 获取单个资源
const employee = await apiClient.get<Employee>(api.employeesById(id))

// 带查询参数
const params = new URLSearchParams({ status: 'active' })
const employees = await apiClient.get<Employee[]>(`${api.employees}?${params}`)
```

#### POST 请求
```typescript
const newEmployee = await apiClient.post<Employee>(api.employees, {
  name: 'John Doe',
  department_id: 'dept-1',
  email: 'john@example.com'
})
```

#### PUT 请求
```typescript
const updated = await apiClient.put<Employee>(api.employeesById(id), {
  name: 'Jane Doe'
})
```

#### DELETE 请求
```typescript
await apiClient.delete(api.employeesById(id))
```

### 3. 错误处理

#### 方式一：try-catch
```typescript
try {
  await apiClient.post(api.employees, data)
  message.success('创建成功')
  // 刷新数据或导航
} catch (error) {
  // 错误已被 apiClient 自动显示
  // 这里可以做额外处理
  console.error(error)
}
```

#### 方式二：safeApiCall
```typescript
import { safeApiCall } from '../../../utils/api'

const result = await safeApiCall(
  () => apiClient.post(api.employees, data),
  '创建员工失败'
)

if (result) {
  message.success('创建成功')
  // 处理成功结果
}
```

#### 方式三：跳过自动错误处理
```typescript
try {
  const data = await apiClient.get<Employee[]>(api.employees, {
    skipErrorHandle: true
  })
  // 处理数据
} catch (error) {
  // 自定义错误处理
  if (error.status === 404) {
    message.warning('未找到数据')
  } else {
    message.error('加载失败')
  }
}
```

### 4. 文件上传

```typescript
const formData = new FormData()
formData.append('file', file)
formData.append('name', 'document.pdf')

const result = await apiClient.post<UploadResult>(
  api.upload.voucher,
  formData
  // FormData 会自动设置正确的 Content-Type
)
```

### 5. 下载文件

```typescript
const blob = await apiClient.blob(api.exportData)
const url = window.URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = 'export.xlsx'
a.click()
window.URL.revokeObjectURL(url)
```

## 🎯 类型定义

### 定义响应类型
```typescript
interface Employee {
  id: string
  name: string
  email: string
  department_id: string
  // ...
}

interface PaginatedResponse<T> {
  results: T[]
  total: number
  page: number
  page_size: number
}
```

### 使用类型
```typescript
// 单个对象
const employee = await apiClient.get<Employee>(api.employeesById(id))

// 数组
const employees = await apiClient.get<Employee[]>(api.employees)

// 分页响应
const response = await apiClient.get<PaginatedResponse<Employee>>(
  `${api.employees}?page=1`
)
```

## 🔄 React Hooks 集成

### 使用 useApiQuery
```typescript
import { useApiQuery } from '../../../utils/useApiQuery'

const { data: employees, loading, error, refetch } = useApiQuery<Employee[]>(
  ['employees'],
  () => apiClient.get<Employee[]>(api.employees)
)
```

### 使用 useApiMutation
```typescript
import { useApiMutation } from '../../../utils/useApiQuery'

const createMutation = useApiMutation(
  (data: CreateEmployeeDTO) => apiClient.post<Employee>(api.employees, data),
  {
    onSuccess: () => {
      message.success('创建成功')
      queryClient.invalidateQueries(['employees'])
    },
  }
)

// 使用
await createMutation.mutateAsync(formData)
```

## ❌ 避免的做法

### 不要使用 any 类型
```typescript
// ❌ 错误
const data = await apiClient.get<any>(api.employees)

// ✅ 正确
const data = await apiClient.get<Employee[]>(api.employees)
```

### 不要混合使用旧的工具函数
```typescript
// ❌ 错误（已弃用）
import { apiGet, apiPost } from '../../../utils/api'
const data = await apiGet(api.employees)

// ✅ 正确
import { api as apiClient } from '../../../api/http'
const data = await apiClient.get<Employee[]>(api.employees)
```

### 不要手动拼接 URL
```typescript
// ❌ 错误
const data = await apiClient.get(`/api/employees/${id}`)

// ✅ 正确
import { api } from '../../../config/api'
const data = await apiClient.get(api.employeesById(id))
```

## 📋 检查清单

创建新的 API 调用时，确保：

- [ ] 使用 `import { api as apiClient } from '../../../api/http'`
- [ ] 使用 `import { api } from '../../../config/api'` 获取 URL
- [ ] 为 API 调用提供明确的类型参数（不使用 `any`）
- [ ] 添加适当的错误处理（try-catch 或 safeApiCall）
- [ ] 成功后显示用户反馈（message.success）
- [ ] 成功后刷新相关数据或导航

## 🔗 相关文件

- `frontend/src/api/http.ts` - HTTP 客户端实现
- `frontend/src/config/api.ts` - API 端点配置
- `frontend/src/utils/api.ts` - API 辅助函数（部分已弃用）
- `frontend/src/utils/useApiQuery.ts` - React Query hooks

## 📝 示例完整组件

```typescript
import { useState } from 'react'
import { Button, Form, Input, message } from 'antd'
import { api } from '../../../config/api'
import { api as apiClient } from '../../../api/http'
import { safeApiCall } from '../../../utils/api'

interface Employee {
  id: string
  name: string
  email: string
}

export function EmployeeForm() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (values: any) => {
    setLoading(true)
    try {
      const result = await apiClient.post<Employee>(api.employees, values)
      message.success('创建成功')
      form.resetFields()
      // 刷新列表或导航
    } catch (error) {
      // 错误已被自动显示
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form form={form} onFinish={handleSubmit}>
      <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}>
        <Input />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          提交
        </Button>
      </Form.Item>
    </Form>
  )
}
```
