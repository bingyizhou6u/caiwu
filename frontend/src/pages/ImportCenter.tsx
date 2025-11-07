import { useState } from 'react'
import { Card, Upload, Select, Button, message, Space, Typography } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { api } from '../config/api'

const { Text } = Typography

export function ImportCenter() {
  const [kind, setKind] = useState<string>('flows')
  const [file, setFile] = useState<File | null>(null)

  const downloadExample = () => {
    const examples: Record<string, string> = {
      flows: '/examples/import-flows-example.csv',
      AR: '/examples/import-ar-example.csv',
      AP: '/examples/import-ap-example.csv',
      opening: '/examples/import-opening-example.csv',
    }
    const url = examples[kind]
    if (url) {
      const link = document.createElement('a')
      link.href = url
      link.download = `import-${kind}-example.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const upload = async () => {
    if (!file) return message.error('请选择CSV文件')
    try {
      const text = await file.text()
      const res = await fetch(`${api.import}?kind=${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: text,
        credentials: 'include'
      })
      const j = await res.json()
      if (res.ok) {
        message.success(`导入成功：${j.inserted}`)
      } else {
        message.error(j.error || '导入失败')
      }
    } catch (error: any) {
      message.error(error.message || '导入失败')
    }
  }

  const getFieldDescription = () => {
    const descriptions: Record<string, string> = {
      flows: '必填字段：biz_date（日期）, type（income/expense）, account_id（账户ID）, amount（金额）\n可选字段：site_id, department_id, counterparty, memo, category_id, voucher_no, method',
      AR: '必填字段：issue_date（开票日期）, amount（金额）\n可选字段：due_date（到期日期）, party_id, site_id, department_id, memo',
      AP: '必填字段：issue_date（开票日期）, amount（金额）\n可选字段：due_date（到期日期）, party_id, site_id, department_id, memo',
      opening: '必填字段：type（类型）, ref_id（关联ID）, amount（金额）, as_of（日期）',
    }
    return descriptions[kind] || ''
  }

  return (
    <Card title="导入中心">
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Select style={{ width: 220 }} value={kind} onChange={setKind} options={[
            { value: 'flows', label: '流水 flows' },
            { value: 'AR', label: '应收 AR' },
            { value: 'AP', label: '应付 AP' },
            { value: 'opening', label: '期初 opening' },
          ]} />
          <Button icon={<DownloadOutlined />} onClick={downloadExample}>下载示例文件</Button>
          <Upload beforeUpload={(f)=>{ setFile(f); return false }} maxCount={1} accept=".csv">
            <Button>选择CSV</Button>
          </Upload>
          <Button type="primary" onClick={upload}>上传导入</Button>
        </div>
        <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
          <Text type="secondary" style={{ whiteSpace: 'pre-line' }}>{getFieldDescription()}</Text>
        </div>
      </Space>
    </Card>
  )
}





