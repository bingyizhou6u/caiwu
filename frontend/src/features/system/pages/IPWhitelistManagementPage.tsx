import React, { useState, useMemo } from 'react'
import { Button, Input, Form, message, Space, Popconfirm, Switch, Card, Alert } from 'antd'
import { PlusOutlined, DeleteOutlined, SyncOutlined, ReloadOutlined, FileAddOutlined } from '@ant-design/icons'
import { withErrorHandler } from '../../../utils/errorHandler'
import { useIPWhitelist, useIPRuleStatus, useCreateIPRule, useToggleIPRule, useAddIP, useDeleteIP, useBatchAddIP, useBatchDeleteIP, useSyncIPWhitelist } from '../../../hooks/business/useIPWhitelist'
import { FormModal } from '../../../components/FormModal'
import { useZodForm } from '../../../hooks/forms/useZodForm'
import { useTableActions } from '../../../hooks/forms/useTableActions'
import { ipWhitelistSchema, ipBatchSchema } from '../../../validations/ipWhitelist.schema'
import type { IPWhitelist } from '../../../hooks/business/useIPWhitelist'
import { useBatchOperation } from '../../../hooks/business/useBatchOperation'
import { DataTable } from '../../../components/common/DataTable'
import type { DataTableColumn } from '../../../components/common/DataTable'

import { PageContainer } from '../../../components/PageContainer'

const IPWhitelistManagement: React.FC = () => {
  const { data: data = [], isLoading, refetch } = useIPWhitelist()
  const { data: ruleStatus, isLoading: loadingRule, refetch: refetchRule } = useIPRuleStatus()

  const { mutateAsync: createRule } = useCreateIPRule()
  const { mutateAsync: toggleRule } = useToggleIPRule()
  const { mutateAsync: addIP } = useAddIP()
  const { mutateAsync: deleteIP } = useDeleteIP()
  const { mutateAsync: batchAddIP } = useBatchAddIP()
  const { mutateAsync: batchDeleteIP } = useBatchDeleteIP()
  const { mutateAsync: syncIP, isPending: syncing } = useSyncIPWhitelist()

  const [modalOpen, setModalOpen] = useState(false)
  const [batchModalOpen, setBatchModalOpen] = useState(false)

  const { form, validateWithZod } = useZodForm(ipWhitelistSchema)
  const { form: batchForm, validateWithZod: validateBatch } = useZodForm(ipBatchSchema)

  const tableActions = useTableActions<IPWhitelist>()
  const { selectedRowKeys, rowSelection, clearSelection } = tableActions

  const handleCreateRule = useMemo(() => withErrorHandler(
    async () => {
      await createRule()
      refetchRule()
    },
    {
      successMessage: '规则创建成功',
      errorMessage: '创建规则失败'
    }
  ), [createRule, refetchRule])

  const handleToggleRule = useMemo(() => withErrorHandler(
    async (enabled: boolean) => {
      if (!ruleStatus?.ruleId) {
        await createRule()
      }
      await toggleRule(enabled)
      refetchRule()
      return enabled ? '规则已启用' : '规则已停用'
    },
    {
      showSuccess: true,
      onSuccess: (msg) => message.success(msg),
      errorMessage: '操作失败',
      onError: () => refetchRule()
    }
  ), [ruleStatus, createRule, toggleRule, refetchRule])

  const handleAdd = useMemo(() => withErrorHandler(
    async () => {
      const values = await validateWithZod()
      await addIP(values)
      setModalOpen(false)
      form.resetFields()
      refetch()
    },
    {
      successMessage: '添加成功',
      errorMessage: '添加失败'
    }
  ), [form, validateWithZod, addIP, refetch])

  const handleBatchAdd = useMemo(() => withErrorHandler(
    async () => {
      const values = await validateBatch()
      const ipLines = values.ips_text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)

      const ips = ipLines.map(ip => ({
        ip,
        description: values.description || undefined,
      }))

      const result = await batchAddIP(ips)
      setBatchModalOpen(false)
      batchForm.resetFields()
      refetch()
      return result
    },
    {
      onSuccess: (result) => {
        if (result.failedCount > 0) {
          message.warning(`批量添加完成：成功 ${result.successCount} 条，失败 ${result.failedCount} 条`)
        } else {
          message.success(`批量添加成功：共添加 ${result.successCount} 条IP地址`)
        }
      },
      errorMessage: '批量添加失败'
    }
  ), [batchForm, validateBatch, batchAddIP, refetch])

  const handleDelete = useMemo(() => withErrorHandler(
    async (id: string) => {
      await deleteIP(id)
      refetch()
    },
    {
      successMessage: '删除成功',
      errorMessage: '删除失败'
    }
  ), [deleteIP, refetch])

  const { handleBatch: handleBatchDelete, loading: batchDeleting } = useBatchOperation(
    batchDeleteIP,
    tableActions,
    {
      onSuccess: (data: any) => {
        refetch()
        if (data.failedCount > 0) {
          message.warning(`批量删除完成：成功 ${data.successCount} 条，失败 ${data.failedCount} 条`)
        } else {
          message.success(`批量删除成功：共删除 ${data.successCount} 条IP地址`)
        }
      },
      errorMessage: '批量删除失败'
    }
  )

  const handleSync = useMemo(() => withErrorHandler(
    async () => {
      const result = await syncIP()
      refetch()
      return result
    },
    {
      onSuccess: (result) => message.success(`同步成功，新增 ${result.synced} 条记录`),
      errorMessage: '同步失败'
    }
  ), [syncIP, refetch])

  const columns: DataTableColumn<IPWhitelist>[] = [
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => text || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (timestamp: number) => new Date(timestamp).toLocaleString('zh-CN'),
    },
  ]

  return (
    <PageContainer
      title="IP白名单管理"
      breadcrumb={[{ title: '系统设置' }, { title: 'IP白名单管理' }]}
    >
      {/* 规则状态卡片 */}
      <Card style={{ marginBottom: '16px' }} className="page-card" bordered={false}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0 }}>自定义规则状态</h3>
            <div style={{ marginTop: '8px', color: '#666' }}>
              规则表达式：<code>not ip.src in $caiwu-whitelist</code>
              <br />
              {ruleStatus?.ruleId && (
                <span style={{ fontSize: '12px' }}>
                  规则ID: {ruleStatus.ruleId.substring(0, 8)}...
                </span>
              )}
            </div>
          </div>
          <Space>
            {loadingRule ? (
              <span style={{ color: '#999' }}>规则加载中...</span>
            ) : (
              <Space>
                {ruleStatus?.ruleId && (
                  <span style={{ marginRight: '8px' }}>
                    {ruleStatus.enabled ? (
                      <span style={{ color: '#52c41a' }}>已启用</span>
                    ) : (
                      <span style={{ color: '#ff4d4f' }}>已停用</span>
                    )}
                  </span>
                )}
                {!ruleStatus?.ruleId && (
                  <span style={{ color: '#999', marginRight: '8px', fontSize: '12px' }}>规则未创建，切换开关将自动创建</span>
                )}
                <Switch
                  checked={ruleStatus?.enabled || false}
                  onChange={handleToggleRule}
                  loading={loadingRule}
                  checkedChildren="启用"
                  unCheckedChildren="停用"
                />
              </Space>
            )}
          </Space>
        </div>
        {ruleStatus?.enabled && (
          <Alert
            message="规则已启用"
            description="不在白名单中的IP将被阻止访问"
            type="warning"
            showIcon
            style={{ marginTop: '16px' }}
          />
        )}
      </Card>

      {/* IP列表 */}
      <Card className="page-card" bordered={false}>
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>IP白名单列表</h3>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>刷新</Button>
            <Button
              icon={<SyncOutlined />}
              onClick={handleSync}
              loading={syncing}
            >
              从 Cloudflare 同步
            </Button>
            <Button
              danger
              disabled={selectedRowKeys.length === 0}
              icon={<DeleteOutlined />}
              loading={batchDeleting}
            >
              <Popconfirm
                title={`确定要删除选中的 ${selectedRowKeys.length} 条IP地址吗？`}
                onConfirm={handleBatchDelete}
                okText="确定"
                cancelText="取消"
                disabled={selectedRowKeys.length === 0}
              >
                <span>批量删除 ({selectedRowKeys.length})</span>
              </Popconfirm>
            </Button>
            <Button icon={<FileAddOutlined />} onClick={() => setBatchModalOpen(true)}>
              批量添加
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              添加IP
            </Button>
          </Space>
        </div>

        <DataTable<IPWhitelist>
          columns={columns}
          data={data}
          loading={isLoading}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          tableProps={{
            className: 'table-striped',
            rowSelection,
          }}
          actions={(_: unknown, record: IPWhitelist) => (
            <Popconfirm
              title="确定要删除此IP白名单吗？"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        />
      </Card>

      <FormModal
        title="添加IP白名单"
        open={modalOpen}
        form={form}
        onSubmit={handleAdd}
        onCancel={() => {
          setModalOpen(false)
          form.resetFields()
        }}
      >
        <Form.Item
          label="IP地址"
          name="ip_address"
          rules={[{ required: true }]}
        >
          <Input placeholder="例如: 175.157.96.241 或 2001:db8::1" />
        </Form.Item>
        <Form.Item
          label="描述"
          name="description"
        >
          <Input.TextArea rows={3} placeholder="可选，用于说明此IP的用途" />
        </Form.Item>
      </FormModal>

      <FormModal
        title="批量添加IP白名单"
        open={batchModalOpen}
        form={batchForm}
        onSubmit={handleBatchAdd}
        onCancel={() => {
          setBatchModalOpen(false)
          batchForm.resetFields()
        }}
        width={600}
      >
        <Form.Item
          label="IP地址列表"
          name="ips_text"
          rules={[{ required: true }]}
          extra="每行输入一个IP地址（支持IPv4和IPv6，包括CIDR格式）"
        >
          <Input.TextArea
            rows={10}
            placeholder={`例如：\n175.157.96.241\n192.168.1.0/24\n2001:db8::1\n2402:4000:126a:ede6:150f:2c99:837a:48d3`}
          />
        </Form.Item>
        <Form.Item
          label="描述（可选）"
          name="description"
          extra="此描述将应用于所有添加的IP地址"
        >
          <Input.TextArea rows={3} placeholder="可选，用于说明这些IP的用途" />
        </Form.Item>
      </FormModal>
    </PageContainer>
  )
}

export default IPWhitelistManagement
