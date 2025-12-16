import { useState, useMemo, useCallback } from 'react'
import { Card, Form, Select, Button, Space, Modal } from 'antd'
import { EyeOutlined, ReloadOutlined } from '@ant-design/icons'
import { api } from '../../../config/api'
import { useAccounts } from '../../../hooks/useBusinessData'
import { useAccountTransactions } from '../../../hooks'
import { withErrorHandler } from '../../../utils/errorHandler'
import { DataTable, type DataTableColumn } from '../../../components/common/DataTable'
import { SearchFilters } from '../../../components/common/SearchFilters'
import type { AccountTransaction } from '../../../types/business'

const TYPE_LABELS: Record<string, string> = {
  income: '收入',
  expense: '支出',
  transfer: '转账',
  adjust: '调整',
}

import { PageContainer } from '../../../components/PageContainer'

export function AccountTransactions() {
  const [form] = Form.useForm()
  const [accountId, setAccountId] = useState<string>()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | undefined>()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // 数据 Hook
  const { data: accounts = [] } = useAccounts()
  const { data: rows = { total: 0, list: [] }, isLoading: loading, refetch: query } = useAccountTransactions(accountId, page, pageSize)

  const handleQuery = useCallback(
    withErrorHandler(
      async () => {
        const v = await form.validateFields()
        setAccountId(v.accountId)
        // accountId 变化会自动触发查询，但如果是同ID刷新，需要手动调用
        if (v.accountId === accountId) {
          query()
        }
      },
      { showSuccess: false }
    ),
    [form, accountId, query]
  )

  // 缓存列定义
  const columns = useMemo<DataTableColumn<AccountTransaction>[]>(() => [
    { title: '日期', dataIndex: 'transactionDate', key: 'transactionDate', width: 110 },
    { title: '凭证号', dataIndex: 'voucherNo', key: 'voucherNo', width: 120 },
    { title: '类型', dataIndex: 'transactionType', key: 'transactionType', width: 80, render: (v: string) => TYPE_LABELS[v] || v },
    { title: '类别', dataIndex: 'categoryName', key: 'categoryName', width: 120 },
    { title: '摘要', dataIndex: 'memo', key: 'memo' },
    { title: '交易对手', dataIndex: 'counterparty', key: 'counterparty', width: 120 },
    {
      title: '账变前金额',
      dataIndex: 'balanceBeforeCents',
      key: 'balanceBeforeCents',
      width: 130,
      align: 'right',
      render: (v: number) => (v / 100).toFixed(2)
    },
    {
      title: '账变金额',
      dataIndex: 'amountCents',
      key: 'amountCents',
      width: 120,
      align: 'right',
      render: (v: number, r: AccountTransaction) => {
        const amount = (v / 100).toFixed(2)
        const type = r.transactionType || r.type
        if (type === 'income') {
          return <span style={{ color: '#52c41a' }}>+{amount}</span>
        } else if (type === 'expense') {
          return <span style={{ color: '#ff4d4f' }}>-{amount}</span>
        }
        return amount
      }
    },
    {
      title: '账变后金额',
      dataIndex: 'balanceAfterCents',
      key: 'balanceAfterCents',
      width: 130,
      align: 'right',
      render: (v: number) => <strong>{(v / 100).toFixed(2)}</strong>
    },
  ], [])

  // 缓存搜索字段配置
  const searchFields = useMemo(() => [
    {
      name: 'accountId',
      label: '账户',
      type: 'select' as const,
      placeholder: '请选择账户',
      options: [
        { label: '全部', value: '' },
        ...accounts,
      ],
    },
  ], [accounts])

  // 缓存分页配置
  const paginationConfig = useMemo(() => ({
    current: page,
    pageSize: pageSize,
    total: rows.total || 0,
    onChange: (p: number, ps: number) => {
      setPage(p)
      setPageSize(ps)
    },
  }), [page, pageSize, rows.total])

  // 缓存数据
  const tableData = useMemo(() => (rows.list || []) as AccountTransaction[], [rows.list])

  // 缓存预览处理函数
  const handlePreview = useCallback((url: string) => {
    setPreviewUrl(url)
    setPreviewOpen(true)
  }, [])

  const handleClosePreview = useCallback(() => {
    setPreviewOpen(false)
  }, [])

  // 缓存 actions 渲染函数
  const renderActions = useCallback((record: AccountTransaction) => {
    return record.voucherUrl ? (
      <Button size="small" icon={<EyeOutlined />} onClick={() => handlePreview(record.voucherUrl!)}>
        查看
      </Button>
    ) : <span>-</span>
  }, [handlePreview])

  // 缓存搜索处理函数
  const handleSearch = useCallback((values: { accountId?: string }) => {
    if (values.accountId) {
      setAccountId(values.accountId)
    }
  }, [])

  const handleReset = useCallback(() => {
    form.resetFields()
    setAccountId(undefined)
  }, [form])

  return (
    <PageContainer
      title="账户明细查询"
      breadcrumb={[{ title: '财务管理' }, { title: '账户明细查询' }]}
    >
      <Card bordered={false} className="page-card">
        <SearchFilters
          fields={searchFields}
          onSearch={handleSearch}
          onReset={handleReset}
          initialValues={{ accountId }}
        />

        <Space style={{ marginBottom: 12, marginTop: 16 }}>
          <Button icon={<ReloadOutlined />} onClick={handleQuery} loading={loading}>刷新</Button>
          <Button type="primary" onClick={handleQuery} loading={loading}>查询</Button>
        </Space>

        <DataTable<AccountTransaction>
          columns={columns}
          data={tableData}
          loading={loading}
          rowKey="id"
          pagination={paginationConfig}
          actions={renderActions}
          tableProps={{ className: 'table-striped' }}
        />

        <Modal open={previewOpen} footer={null} onCancel={handleClosePreview} width={800}>
          {previewUrl && (
            <img alt="凭证预览" style={{ width: '100%' }} src={api.vouchers(previewUrl.replace('/api/vouchers/', ''))} />
          )}
        </Modal>
      </Card>
    </PageContainer>
  )
}
