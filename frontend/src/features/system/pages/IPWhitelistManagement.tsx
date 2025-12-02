import React, { useState, useEffect } from 'react'
import { Table, Button, Input, Modal, Form, message, Space, Popconfirm, Switch, Card, Alert } from 'antd'
import { PlusOutlined, DeleteOutlined, SyncOutlined, ReloadOutlined, FileAddOutlined } from '@ant-design/icons'
import type { TableRowSelection } from 'antd/es/table/interface'
import { api } from '../../../config/api'
import { apiGet, apiPost, apiDelete, apiRequest } from '../../../utils/api'

interface IPWhitelist {
  id: string
  ip_address: string
  description?: string
  cloudflare_rule_id?: string
  created_at: number
  updated_at: number
}

interface RuleStatus {
  enabled: boolean
  ruleId?: string
  rulesetId?: string
}

const IPWhitelistManagement: React.FC = () => {
  const [data, setData] = useState<IPWhitelist[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [batchForm] = Form.useForm()
  const [syncing, setSyncing] = useState(false)
  const [ruleStatus, setRuleStatus] = useState<RuleStatus | null>(null)
  const [loadingRule, setLoadingRule] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [batchDeleting, setBatchDeleting] = useState(false)

  useEffect(() => {
    // 按顺序执行：1. 同步规则状态 2. 同步IP列表 3. 加载数据
    const initialize = async () => {
      try {
        // 1. 先从Cloudflare同步规则状态（会自动同步到数据库）
        await loadRuleStatus()
        
        // 2. 再从Cloudflare同步IP列表到数据库
        await syncFromCloudflare()
        
        // 3. 最后从数据库加载并显示数据
        await loadData()
      } catch (error: any) {
        console.error('Failed to initialize:', error)
        // 即使同步失败，也尝试加载现有数据
        await loadData()
      }
    }
    
    initialize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const syncFromCloudflare = async () => {
    try {
      const result = await apiPost(api.ipWhitelistSync, {})
      if (result.synced > 0) {
        message.success(`已从Cloudflare同步 ${result.synced} 条IP记录`)
      }
    } catch (error: any) {
      console.error('Failed to sync from Cloudflare:', error)
      // 同步失败不影响继续加载
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await apiGet(api.ipWhitelist)
      setData(data || [])
    } catch (error: any) {
      message.error(error.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const loadRuleStatus = async () => {
    setLoadingRule(true)
    try {
      // apiGet 返回数组，但此接口返回对象，需要使用 apiRequest
      const response = await apiRequest(api.ipWhitelistRule)
      const result = response.data || response.results?.[0] || { enabled: false }
      setRuleStatus(result as RuleStatus)
    } catch (error: any) {
      console.error('Failed to load rule status:', error)
      setRuleStatus({ enabled: false })
    } finally {
      setLoadingRule(false)
    }
  }

  const handleCreateRule = async () => {
    try {
      await apiPost(api.ipWhitelistRuleCreate, {})
      message.success('规则创建成功')
      loadRuleStatus()
    } catch (error: any) {
      message.error(error.message || '创建规则失败')
    }
  }

  const handleToggleRule = async (enabled: boolean) => {
    try {
      // 如果规则不存在，先创建规则
      if (!ruleStatus?.ruleId) {
        await handleCreateRule()
        // 重新加载状态
        await loadRuleStatus()
        // 如果创建成功，再次尝试切换
        const updatedResponse = await apiRequest(api.ipWhitelistRule)
        const updatedStatus = updatedResponse.data || updatedResponse.results?.[0] as RuleStatus
        if (updatedStatus?.ruleId && enabled) {
          await apiPost(api.ipWhitelistRuleToggle, { enabled })
          message.success('规则已启用')
          loadRuleStatus()
          return
        }
      } else {
        await apiPost(api.ipWhitelistRuleToggle, { enabled })
        message.success(enabled ? '规则已启用' : '规则已停用')
        loadRuleStatus()
      }
    } catch (error: any) {
      message.error(error.message || '操作失败')
      loadRuleStatus() // 重新加载状态以恢复开关状态
    }
  }

  const handleAdd = async (values: { ip_address: string, description?: string }) => {
    try {
      await apiPost(api.ipWhitelist, values)
      message.success('添加成功')
      setModalOpen(false)
      form.resetFields()
      loadData()
    } catch (error: any) {
      console.error('Error adding IP:', error)
      message.error(error.message || '添加失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await apiDelete(api.ipWhitelistById(id))
      message.success('删除成功')
      loadData()
    } catch (error: any) {
      message.error(error.message || '删除失败')
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await apiPost(api.ipWhitelistSync, {})
      message.success(`同步成功，新增 ${result.synced} 条记录`)
      loadData()
    } catch (error: any) {
      message.error(error.message || '同步失败')
    } finally {
      setSyncing(false)
    }
  }

  // 批量添加IP
  const handleBatchAdd = async (values: { ips_text: string, description?: string }) => {
    try {
      // 解析IP地址文本（每行一个）
      const ipLines = values.ips_text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)

      if (ipLines.length === 0) {
        message.error('请输入至少一个IP地址')
        return
      }

      // 验证IP地址格式
      const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\/(?:[0-9]|[1-2][0-9]|3[0-2]))?$/
      const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]+|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))(?:\/(?:[0-9]|[1-9][0-9]|1[0-1][0-9]|12[0-8]))?$/i

      const invalidIPs: string[] = []
      for (const ip of ipLines) {
        if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
          invalidIPs.push(ip)
        }
      }

      if (invalidIPs.length > 0) {
        message.error(`以下IP地址格式无效：${invalidIPs.join(', ')}`)
        return
      }

      // 构建批量添加的请求体
      const ips = ipLines.map(ip => ({
        ip,
        description: values.description || undefined,
      }))

      const result = await apiPost(api.ipWhitelistBatch, { ips })
      
      if (result.success) {
        if (result.failedCount > 0) {
          message.warning(`批量添加完成：成功 ${result.successCount} 条，失败 ${result.failedCount} 条`)
          if (result.errors && result.errors.length > 0) {
            console.error('批量添加错误详情：', result.errors)
          }
        } else {
          message.success(`批量添加成功：共添加 ${result.successCount} 条IP地址`)
        }
        setBatchModalOpen(false)
        batchForm.resetFields()
        loadData()
      } else {
        message.error(`批量添加失败：${result.errors?.map((e: any) => e.error).join(', ') || '未知错误'}`)
      }
    } catch (error: any) {
      console.error('Error batch adding IPs:', error)
      message.error(error.message || '批量添加失败')
    }
  }

  // 批量删除IP
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的IP地址')
      return
    }

    setBatchDeleting(true)
    try {
      const result = await apiRequest(api.ipWhitelistBatch, {
        method: 'DELETE',
        body: JSON.stringify({ ids: selectedRowKeys }),
      })
      
      const data = result.data || result
      if (data.success) {
        if (data.failedCount > 0) {
          message.warning(`批量删除完成：成功 ${data.successCount} 条，失败 ${data.failedCount} 条`)
        } else {
          message.success(`批量删除成功：共删除 ${data.successCount} 条IP地址`)
        }
        setSelectedRowKeys([])
        loadData()
      } else {
        message.error('批量删除失败')
      }
    } catch (error: any) {
      console.error('Error batch deleting IPs:', error)
      message.error(error.message || '批量删除失败')
    } finally {
      setBatchDeleting(false)
    }
  }

  // Table行选择配置
  const rowSelection: TableRowSelection<IPWhitelist> = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => {
      setSelectedRowKeys(keys)
    },
    getCheckboxProps: () => ({}),
  }

  const columns = [
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
      dataIndex: 'created_at',
      key: 'created_at',
      render: (timestamp: number) => new Date(timestamp).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: IPWhitelist) => (
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
      ),
    },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>IP白名单管理</h2>
      </div>

      {/* 规则状态卡片 */}
      <Card style={{ marginBottom: '16px' }}>
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
      <Card>
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>IP白名单列表</h3>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
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

        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          rowSelection={rowSelection}
        />
      </Card>

      <Modal
        title="添加IP白名单"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          form.resetFields()
        }}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAdd}
        >
          <Form.Item
            label="IP地址"
            name="ip_address"
            rules={[
              { required: true, message: '请输入IP地址' },
              {
                validator: (_: any, value: string) => {
                  if (!value) return Promise.resolve()
                  
                  // IPv4 验证（支持CIDR）
                  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\/(?:[0-9]|[1-2][0-9]|3[0-2]))?$/
                  if (ipv4Regex.test(value)) {
                    return Promise.resolve()
                  }
                  
                  // IPv6 验证（包括压缩格式、CIDR等）
                  const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]+|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))(?:\/(?:[0-9]|[1-9][0-9]|1[0-1][0-9]|12[0-8]))?$/i
                  if (ipv6Regex.test(value)) {
                    return Promise.resolve()
                  }
                  
                  return Promise.reject(new Error('请输入有效的IPv4或IPv6地址'))
                },
              },
            ]}
          >
            <Input placeholder="例如: 175.157.96.241 或 2001:db8::1" />
          </Form.Item>
          <Form.Item
            label="描述"
            name="description"
          >
            <Input.TextArea rows={3} placeholder="可选，用于说明此IP的用途" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="批量添加IP白名单"
        open={batchModalOpen}
        width={600}
        onCancel={() => {
          setBatchModalOpen(false)
          batchForm.resetFields()
        }}
        onOk={() => batchForm.submit()}
      >
        <Form
          form={batchForm}
          layout="vertical"
          onFinish={handleBatchAdd}
        >
          <Form.Item
            label="IP地址列表"
            name="ips_text"
            rules={[
              { required: true, message: '请输入IP地址列表' },
            ]}
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
        </Form>
      </Modal>
    </div>
  )
}

export default IPWhitelistManagement

