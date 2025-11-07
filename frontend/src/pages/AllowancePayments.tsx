import { useEffect, useState } from 'react'
import { Card, Table, Button, Modal, Form, Space, message, Tag, Select, Upload, Input, DatePicker, InputNumber } from 'antd'
import { UploadOutlined, EyeOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { api } from '../config/api'
import type { ColumnsType } from 'antd/es/table'
import { formatAmount } from '../utils/formatters'
import dayjs from 'dayjs'
import { loadCurrencies, loadAccounts, loadEmployees } from '../utils/loaders'

const { TextArea } = Input

type AllowancePayment = {
  id: string
  employee_id: string
  employee_name: string
  department_id?: string
  department_name?: string
  year: number
  month: number
  allowance_type: 'living' | 'housing' | 'transportation' | 'meal' | 'birthday'
  currency_id: string
  currency_name?: string
  amount_cents: number
  payment_date: string
  payment_method: 'cash' | 'transfer'
  voucher_url?: string
  memo?: string
  created_by?: string
  created_by_name?: string
  created_at: number
  updated_at: number
}

const ALLOWANCE_TYPE_LABELS: Record<string, string> = {
  living: '生活补贴',
  housing: '住房补贴',
  transportation: '交通补贴',
  meal: '伙食补贴',
  birthday: '生日补贴',
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: '现金',
  transfer: '转账',
}

export function AllowancePayments({ userRole }: { userRole?: string }) {
  const [data, setData] = useState<AllowancePayment[]>([])
  const [loading, setLoading] = useState(false)
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [month, setMonth] = useState<number | undefined>(new Date().getMonth() + 1)
  const [allowanceType, setAllowanceType] = useState<string | undefined>(undefined)
  const [employeeId, setEmployeeId] = useState<string | undefined>(undefined)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [generateYear, setGenerateYear] = useState<number>(new Date().getFullYear())
  const [generateMonth, setGenerateMonth] = useState<number>(new Date().getMonth() + 1)
  const [generateDate, setGenerateDate] = useState<string>(dayjs().format('YYYY-MM-DD'))
  const [generateLoading, setGenerateLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm] = Form.useForm()
  const [createLoading, setCreateLoading] = useState(false)
  const [employees, setEmployees] = useState<Array<{ value: string, label: string }>>([])
  const [currencies, setCurrencies] = useState<Array<{ value: string, label: string }>>([])
  const [accounts, setAccounts] = useState<Array<{ value: string, label: string, currency?: string }>>([])
  const [editOpen, setEditOpen] = useState(false)
  const [editForm] = Form.useForm()
  const [currentRecord, setCurrentRecord] = useState<AllowancePayment | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [voucherFile, setVoucherFile] = useState<File | null>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])

  const isManager = userRole === 'manager'
  const isFinance = userRole === 'finance' || isManager
  const isEmployee = userRole === 'employee'

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (year) params.append('year', year.toString())
      if (month) params.append('month', month.toString())
      if (allowanceType) params.append('allowance_type', allowanceType)
      if (employeeId) params.append('employee_id', employeeId)

      const res = await fetch(`${api.allowancePayments}?${params.toString()}`)
      const d = await res.json()
      if (res.ok) {
        setData(d.results || [])
      } else {
        message.error(d.error || '加载失败')
      }
    } catch (error: any) {
      message.error('加载失败：' + (error.message || '网络错误'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [year, month, allowanceType, employeeId])

  useEffect(() => {
    const loadMasterData = async () => {
      if (isFinance) {
        try {
          const [currenciesData, accountsData, employeesData] = await Promise.all([
            loadCurrencies(),
            loadAccounts(),
            loadEmployees()
          ])
          setCurrencies(currenciesData.map(c => ({ value: c.value as string, label: c.label.split(' - ')[1] || c.label })))
          setAccounts(accountsData.map(a => ({ 
            value: a.value as string, 
            label: `${a.label.split(' (')[0]} (${a.currency || ''})`,
            currency: a.currency
          })))
          setEmployees(employeesData.map(e => ({ value: e.value as string, label: e.label.split(' (')[0] })))
        } catch (error: any) {
          message.error(`加载基础数据失败: ${error.message || '网络错误'}`)
        }
      }
    }
    loadMasterData()
  }, [isFinance])

  const handleGenerate = async () => {
    if (!generateDate) {
      message.error('请选择发放日期')
      return
    }

    setGenerateLoading(true)
    try {
      const res = await fetch(api.allowancePaymentsGenerate, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: generateYear,
          month: generateMonth,
          payment_date: generateDate,
        }),
      })
      const d = await res.json()
      if (res.ok) {
        message.success(`成功生成 ${d.created} 条补贴发放记录`)
        setGenerateOpen(false)
        load()
      } else {
        message.error(d.error || '生成失败')
      }
    } catch (error: any) {
      message.error('生成失败：' + (error.message || '网络错误'))
    } finally {
      setGenerateLoading(false)
    }
  }

  const handleCreate = async (v: any) => {
    setCreateLoading(true)
    try {
      const res = await fetch(api.allowancePayments, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: v.employee_id,
          year: v.year,
          month: v.month,
          allowance_type: v.allowance_type,
          currency_id: v.currency_id,
          amount_cents: Math.round(v.amount * 100),
          payment_date: v.payment_date,
          payment_method: v.payment_method || 'cash',
          memo: v.memo,
        }),
      })
      const d = await res.json()
      if (res.ok) {
        message.success('创建成功')
        setCreateOpen(false)
        createForm.resetFields()
        load()
      } else {
        message.error(d.error || '创建失败')
      }
    } catch (error: any) {
      message.error('创建失败：' + (error.message || '网络错误'))
    } finally {
      setCreateLoading(false)
    }
  }

  const handleEdit = (record: AllowancePayment) => {
    setCurrentRecord(record)
    editForm.setFieldsValue({
      payment_date: dayjs(record.payment_date),
      payment_method: record.payment_method,
      memo: record.memo,
    })
    setEditOpen(true)
  }

  const handleUpdate = async (v: any) => {
    if (!currentRecord) return
    setEditLoading(true)
    try {
      const res = await fetch(api.allowancePaymentsById(currentRecord.id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_date: v.payment_date,
          payment_method: v.payment_method,
          voucher_url: v.voucher_url,
          memo: v.memo,
        }),
      })
      const d = await res.json()
      if (res.ok) {
        message.success('更新成功')
        setEditOpen(false)
        setCurrentRecord(null)
        editForm.resetFields()
        load()
      } else {
        message.error(d.error || '更新失败')
      }
    } catch (error: any) {
      message.error('更新失败：' + (error.message || '网络错误'))
    } finally {
      setEditLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条补贴发放记录吗？',
      onOk: async () => {
        try {
          const res = await fetch(api.allowancePaymentsById(id), { method: 'DELETE' })
          const d = await res.json()
          if (res.ok) {
            message.success('删除成功')
            load()
          } else {
            message.error(d.error || '删除失败')
          }
        } catch (error: any) {
          message.error('删除失败：' + (error.message || '网络错误'))
        }
      },
    })
  }

  const handleUpload = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(api.upload.voucher, {
      method: 'POST',
      body: formData,
    })
    const d = await res.json()
    if (res.ok) {
      return d.url
    } else {
      throw new Error(d.error || '上传失败')
    }
  }

  const columns: ColumnsType<AllowancePayment> = [
    {
      title: '员工',
      dataIndex: 'employee_name',
      key: 'employee_name',
      fixed: 'left',
    },
    {
      title: '项目',
      dataIndex: 'department_name',
      key: 'department_name',
    },
    {
      title: '年份',
      dataIndex: 'year',
      key: 'year',
      width: 80,
    },
    {
      title: '月份',
      dataIndex: 'month',
      key: 'month',
      width: 80,
    },
    {
      title: '补贴类型',
      dataIndex: 'allowance_type',
      key: 'allowance_type',
      width: 100,
      render: (type: string) => <Tag>{ALLOWANCE_TYPE_LABELS[type] || type}</Tag>,
    },
    {
      title: '币种',
      dataIndex: 'currency_name',
      key: 'currency_name',
      width: 80,
    },
    {
      title: '金额',
      dataIndex: 'amount_cents',
      key: 'amount_cents',
      width: 120,
      align: 'right',
      render: (cents: number, record: AllowancePayment) => formatAmount(cents),
    },
    {
      title: '发放日期',
      dataIndex: 'payment_date',
      key: 'payment_date',
      width: 120,
    },
    {
      title: '发放方式',
      dataIndex: 'payment_method',
      key: 'payment_method',
      width: 100,
      render: (method: string) => PAYMENT_METHOD_LABELS[method] || method,
    },
    {
      title: '凭证',
      dataIndex: 'voucher_url',
      key: 'voucher_url',
      width: 100,
      render: (url?: string) => {
        if (!url) return '-'
        return (
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => window.open(api.vouchers(url), '_blank')}
          >
            查看
          </Button>
        )
      },
    },
    {
      title: '备注',
      dataIndex: 'memo',
      key: 'memo',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 150,
      render: (_: any, record: AllowancePayment) => (
        <Space>
          {isFinance && (
            <>
              <Button type="link" size="small" onClick={() => handleEdit(record)}>
                编辑
              </Button>
              <Button type="link" size="small" danger onClick={() => handleDelete(record.id)}>
                删除
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ]

  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const y = new Date().getFullYear() - 2 + i
    return { value: y, label: `${y}年` }
  })

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: `${i + 1}月`,
  }))

  return (
    <Card
      title="补贴发放管理"
      extra={
        isFinance && (
          <Space>
            <Button onClick={() => setGenerateOpen(true)}>
              生成补贴发放
            </Button>
            <Button type="primary" onClick={() => setCreateOpen(true)}>
              新建发放记录
            </Button>
          </Space>
        )
      }
    >
      <Space style={{ marginBottom: 16 }}>
        <Select
          style={{ width: 120 }}
          value={year}
          onChange={setYear}
          options={yearOptions}
        />
        <Select
          style={{ width: 120 }}
          value={month}
          onChange={setMonth}
          placeholder="全部月份"
          allowClear
          options={monthOptions}
        />
        <Select
          style={{ width: 120 }}
          value={allowanceType}
          onChange={setAllowanceType}
          placeholder="全部类型"
          allowClear
          options={Object.entries(ALLOWANCE_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
        />
        {isFinance && (
          <Select
            style={{ width: 150 }}
            value={employeeId}
            onChange={setEmployeeId}
            placeholder="全部员工"
            allowClear
            showSearch
            options={employees}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        )}
        <Button onClick={load}>刷新</Button>
      </Space>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 1400 }}
      />

      <Modal
        title="生成补贴发放"
        open={generateOpen}
        onOk={handleGenerate}
        onCancel={() => setGenerateOpen(false)}
        confirmLoading={generateLoading}
      >
        <Form layout="vertical">
          <Form.Item label="年份">
            <Select
              value={generateYear}
              onChange={setGenerateYear}
              options={yearOptions}
            />
          </Form.Item>
          <Form.Item label="月份">
            <Select
              value={generateMonth}
              onChange={setGenerateMonth}
              options={monthOptions}
            />
          </Form.Item>
          <Form.Item label="发放日期" required>
            <DatePicker
              style={{ width: '100%' }}
              value={generateDate ? dayjs(generateDate) : null}
              onChange={(date) => setGenerateDate(date ? date.format('YYYY-MM-DD') : '')}
              format="YYYY-MM-DD"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新建发放记录"
        open={createOpen}
        onOk={() => createForm.submit()}
        onCancel={() => {
          setCreateOpen(false)
          createForm.resetFields()
        }}
        confirmLoading={createLoading}
        width={600}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreate}
        >
          <Form.Item name="employee_id" label="员工" rules={[{ required: true, message: '请选择员工' }]}>
            <Select
              placeholder="请选择员工"
              showSearch
              options={employees}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item name="year" label="年份" rules={[{ required: true, message: '请选择年份' }]}>
            <Select placeholder="请选择年份" options={yearOptions} />
          </Form.Item>
          <Form.Item name="month" label="月份" rules={[{ required: true, message: '请选择月份' }]}>
            <Select placeholder="请选择月份" options={monthOptions} />
          </Form.Item>
          <Form.Item name="allowance_type" label="补贴类型" rules={[{ required: true, message: '请选择补贴类型' }]}>
            <Select
              placeholder="请选择补贴类型"
              options={Object.entries(ALLOWANCE_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </Form.Item>
          <Form.Item name="currency_id" label="币种" rules={[{ required: true, message: '请选择币种' }]}>
            <Select placeholder="请选择币种" options={currencies} />
          </Form.Item>
          <Form.Item name="amount" label="金额" rules={[{ required: true, message: '请输入金额' }]}>
            <InputNumber
              style={{ width: '100%' }}
              placeholder="请输入金额"
              min={0}
              precision={2}
            />
          </Form.Item>
          <Form.Item name="payment_date" label="发放日期" rules={[{ required: true, message: '请选择发放日期' }]}>
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="payment_method" label="发放方式" initialValue="cash">
            <Select
              options={Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </Form.Item>
          <Form.Item name="memo" label="备注">
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑发放记录"
        open={editOpen}
        onOk={() => editForm.submit()}
        onCancel={() => {
          setEditOpen(false)
          setCurrentRecord(null)
          editForm.resetFields()
        }}
        confirmLoading={editLoading}
        width={600}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleUpdate}
        >
          <Form.Item name="payment_date" label="发放日期" rules={[{ required: true, message: '请选择发放日期' }]}>
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="payment_method" label="发放方式" rules={[{ required: true, message: '请选择发放方式' }]}>
            <Select
              options={Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </Form.Item>
          <Form.Item name="voucher_url" label="凭证">
            <Upload
              fileList={fileList}
              beforeUpload={(file) => {
                setVoucherFile(file)
                setFileList([{ uid: '-1', name: file.name, status: 'uploading' }])
                handleUpload(file)
                  .then((url) => {
                    editForm.setFieldsValue({ voucher_url: url })
                    setFileList([{ uid: '-1', name: file.name, status: 'done' }])
                    setUploading(false)
                  })
                  .catch((error) => {
                    message.error('上传失败：' + error.message)
                    setFileList([])
                    setUploading(false)
                  })
                return false
              }}
              onRemove={() => {
                setVoucherFile(null)
                setFileList([])
                editForm.setFieldsValue({ voucher_url: undefined })
              }}
            >
              <Button icon={<UploadOutlined />} loading={uploading}>
                上传凭证
              </Button>
            </Upload>
          </Form.Item>
          <Form.Item name="memo" label="备注">
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

