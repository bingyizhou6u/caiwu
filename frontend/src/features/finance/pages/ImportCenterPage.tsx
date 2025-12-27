import { useState } from 'react'
import { Card, Upload, Select, Button, message, Space, Typography } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { withErrorHandler } from '../../../utils/errorHandler'
import { useImportData } from '../../../hooks/business/useImport'

const { Text } = Typography

import { PageContainer } from '../../../components/PageContainer'

export function ImportCenter() {
  const [kind, setKind] = useState<string>('flows')
  const [file, setFile] = useState<File | null>(null)
  const { mutateAsync: importData, isPending: importing } = useImportData()

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

  const upload = withErrorHandler(
    async () => {
      if (!file) {
        message.error('请选择CSV文件')
        return
      }
      const text = await file.text()
      const result = await importData({ kind, text })
      message.success(`导入成功：${result.inserted}`)
    },
    {
      errorMessage: '导入失败'
    }
  )

  const getFieldDescription = () => {
    const descriptions: Record<string, string> = {
      flows: '必填字段：bizDate（日期）, type（income/expense）, accountId（账户ID）, amount（金额）\n可选字段：siteId, projectId, counterparty, memo, categoryId, voucher_no, method',
      AR: '必填字段：issueDate（开票日期）, amount（金额）\n可选字段：dueDate（到期日期）, partyId, siteId, projectId, memo',
      AP: '必填字段：issueDate（开票日期）, amount（金额）\n可选字段：dueDate（到期日期）, partyId, siteId, projectId, memo',
      opening: '必填字段：type（类型）, ref_id（关联ID）, amount（金额）, as_of（日期）',
    }
    return descriptions[kind] || ''
  }

  return (
    <PageContainer
      title="导入中心"
      breadcrumb={[{ title: '财务管理' }, { title: '导入中心' }]}
    >
      <Card bordered={false} className="page-card">
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Select style={{ width: 220 }} value={kind} onChange={setKind} options={[
              { value: 'flows', label: '流水 flows' },
              { value: 'AR', label: '应收 AR' },
              { value: 'AP', label: '应付 AP' },
              { value: 'opening', label: '期初 opening' },
            ]} />
            <Button icon={<DownloadOutlined />} onClick={downloadExample}>下载示例文件</Button>
            <Upload beforeUpload={(f) => { setFile(f); return false }} maxCount={1} accept=".csv">
              <Button>选择CSV</Button>
            </Upload>
            <Button type="primary" onClick={upload} loading={importing}>上传导入</Button>
          </div>
          <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
            <Text type="secondary" style={{ whiteSpace: 'pre-line' }}>{getFieldDescription()}</Text>
          </div>
        </Space>
      </Card>
    </PageContainer>
  )
}
