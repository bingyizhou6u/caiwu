import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, DatePicker, InputNumber, Select, Space, message, Radio, Upload } from 'antd'
import { UploadOutlined, EyeOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import dayjs from 'dayjs'
import { api } from '../config/api'
import { loadDepartments, loadAccounts, loadExpenseCategories, loadIncomeCategories } from '../utils/loaders'
import { apiGet } from '../utils/api'
import { convertToWebPWithURL, isSupportedImageType, uploadImageAsWebP } from '../utils/image'

const TYPE_LABELS: Record<string, string> = {
  income: '收入',
  expense: '支出',
  transfer: '转账',
  adjust: '调整',
}

const KIND_LABELS: Record<string, string> = {
  income: '收入',
  expense: '支出',
}

type Flow = {
  id: string
  voucher_no?: string
  biz_date: string
  type: 'income'|'expense'|'transfer'|'adjust'
  account_id: string
  category_id?: string
  method?: string
  amount_cents: number
  site_id?: string
  department_id?: string
  counterparty?: string
  memo?: string
  voucher_url?: string
  voucher_urls?: string[]
}

export function Flows() {
  const [data, setData] = useState<Flow[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [voucherUploadOpen, setVoucherUploadOpen] = useState(false)
  const [currentFlow, setCurrentFlow] = useState<Flow | null>(null)
  const [form] = Form.useForm()
  const [accounts, setAccounts] = useState<{value:string,label:string}[]>([])
  const [categories, setCategories] = useState<{value:string,label:string,kind:string}[]>([])
  const [allCategories, setAllCategories] = useState<{value:string,label:string,kind:string}[]>([])
  const [departments, setDepartments] = useState<{value:string,label:string}[]>([])
  const [sites, setSites] = useState<{value:string,label:string,department_id:string}[]>([])
  const [owner, setOwner] = useState<'hq'|'department'>('hq')
  const [selectedType, setSelectedType] = useState<string>('income')
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | undefined>()
  const [uploading, setUploading] = useState(false)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [voucherUrls, setVoucherUrls] = useState<string[]>([])
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [previewIndex, setPreviewIndex] = useState(0)
  const [voucherUploadFileList, setVoucherUploadFileList] = useState<UploadFile[]>([])
  const [voucherUploadUrls, setVoucherUploadUrls] = useState<string[]>([])
  const [voucherUploading, setVoucherUploading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(api.flows, { credentials: 'include' })
      if (!res.ok) {
        const err = await res.json().catch(()=>({ error: res.statusText }))
        message.error(err.error || '获取记账列表失败')
        return
      }
      const d = await res.json()
      // 后端返回 { results: [...] }，需要处理voucher_urls字段
      const flows = Array.isArray(d) ? d : (d.results ?? [])
      // 确保每个flow都有voucher_urls数组
      const processedFlows = flows.map((flow: any) => {
        if (!flow.voucher_urls && flow.voucher_url) {
          // 向后兼容：单个URL转换为数组
          flow.voucher_urls = [flow.voucher_url]
        } else if (!flow.voucher_urls) {
          flow.voucher_urls = []
        }
        return flow
      })
      setData(processedFlows)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const loadMasterData = async () => {
      try {
        const [departmentsData, accountsData, sitesData, expenseCategoriesData, incomeCategoriesData] = await Promise.all([
          loadDepartments(),
          loadAccounts(),
          apiGet(api.sites),
          loadExpenseCategories(),
          loadIncomeCategories()
        ])
        setDepartments(departmentsData)
        setAccounts(accountsData.map((r: any) => ({
          value: r.value,
          label: r.label,
          search: `${r.label} ${(r.currency || '')}`.toLowerCase()
        })))
        setSites(sitesData.map((r: any) => ({ value: r.id, label: r.name, department_id: r.department_id })))
        const allCats = [
          ...expenseCategoriesData.map(r => ({ value: r.value, label: `支出 - ${r.label}`, kind: 'expense' })),
          ...incomeCategoriesData.map(r => ({ value: r.value, label: `收入 - ${r.label}`, kind: 'income' }))
        ]
        setAllCategories(allCats)
        setCategories(allCats.filter((c: any) => c.kind === 'income'))
      } catch (error: any) {
        message.error(`加载基础数据失败: ${error.message || '网络错误'}`)
      }
    }
    loadMasterData()
  }, [])

  // 当Modal打开时，重置类型和类别过滤
  useEffect(() => {
    if (open && allCategories.length > 0) {
      setSelectedType('income')
      setCategories(allCategories.filter((c: any) => c.kind === 'income'))
    }
  }, [open, allCategories])

  const onCreate = async () => {
    try {
      if (voucherUrls.length === 0) {
        message.error('请至少上传一张凭证')
        return
      }
      const v = await form.validateFields()
      const payload = {
        ...v,
        biz_date: v.biz_date.format('YYYY-MM-DD'),
        amount_cents: Math.round(Number(v.amount) * 100),
        owner_scope: owner,
        voucher_urls: voucherUrls
      }
      const res = await fetch(api.flows, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
      if (!res.ok) {
        const err = await res.json().catch(()=>({ error: res.statusText }))
        message.error(err.error || '新增失败')
        return
      }
      message.success('已新增')
      setOpen(false)
      form.resetFields()
      setFileList([])
      setVoucherUrls([])
      load()
    } catch (e) {}
  }

  const showPreview = (urls: string[], index: number = 0) => {
    setPreviewUrls(urls)
    setPreviewIndex(index)
    setPreviewOpen(true)
  }

  const isImage = (url: string) => {
    // 所有凭证都是WebP格式
    return true
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      if (!isSupportedImageType(file)) {
        message.error('只允许上传图片格式（JPEG、PNG、GIF、WebP）')
        setUploading(false)
        return false
      }
      
      const url = await uploadImageAsWebP(file, api.upload.voucher)
      setVoucherUrls([...voucherUrls, url])
      message.success('凭证上传成功（已转换为WebP格式）')
      setUploading(false)
      return false // 阻止自动上传
    } catch (error: any) {
      message.error('上传失败: ' + (error.message || '未知错误'))
      setUploading(false)
      return false
    }
  }

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={() => setOpen(true)}>新建记账</Button>
        <Button onClick={load}>刷新</Button>
      </Space>
      <Table rowKey="id" loading={loading} dataSource={data} pagination={{ pageSize: 20 }} columns={[
        { title: '凭证号', dataIndex: 'voucher_no' },
        { title: '日期', dataIndex: 'biz_date' },
        { title: '类型', dataIndex: 'type', render: (v:string)=> TYPE_LABELS[v] || v },
        { title: '金额', dataIndex: 'amount_cents', render: (v) => (v/100).toFixed(2) },
        { title: '归属', render: (_:any, r:any)=> r.department_id ? '项目' : '总部' },
        { title: '账户', dataIndex: 'account_name' },
        { title: '类别', dataIndex: 'category_name' },
        { title: '对方', dataIndex: 'counterparty' },
        { title: '备注', dataIndex: 'memo' },
        { 
          title: '凭证', 
          dataIndex: 'voucher_urls', 
          render: (urls: string[] | undefined, record: Flow) => {
            const voucherUrls = urls || (record.voucher_url ? [record.voucher_url] : [])
            return (
              <Space>
                {voucherUrls.length > 0 ? (
                  <Button 
                    size="small" 
                    icon={<EyeOutlined />} 
                    onClick={() => showPreview(voucherUrls, 0)}
                  >
                    查看 ({voucherUrls.length})
                  </Button>
                ) : (
                  <span style={{ color: '#999' }}>-</span>
                )}
                <Button 
                  size="small" 
                  type={voucherUrls.length > 0 ? 'default' : 'primary'}
                  onClick={() => {
                    setCurrentFlow(record)
                    setVoucherUploadUrls(voucherUrls)
                    setVoucherUploadFileList([])
                    setVoucherUploadOpen(true)
                  }}
                >
                  {voucherUrls.length > 0 ? '重新上传' : '补充凭证'}
                </Button>
              </Space>
            )
          }
        },
      ]} />

      <Modal title="新建记账" open={open} onOk={onCreate} onCancel={() => {
        setOpen(false)
        setSelectedType('income')
        setSelectedDepartmentId(undefined)
        setFileList([])
        setVoucherUrls([])
        form.resetFields()
      }} destroyOnClose>
        <Form form={form} layout="vertical" initialValues={{ type: 'income', biz_date: dayjs(), method: 'cash' }}>
          <Form.Item name="biz_date" label="日期" rules={[{ required: true }]}>
            <DatePicker />
          </Form.Item>
          <Form.Item label="凭证号" shouldUpdate>
            {() => {
              const d = form.getFieldValue('biz_date')
              return <Button onClick={async ()=>{
                if (!d) return
                const res = await fetch(`${api.flowsNextVoucher}?date=${d.format('YYYY-MM-DD')}`, { credentials: 'include' })
                const j = await res.json()
                form.setFieldValue('voucher_no', j.voucher_no)
              }}>生成</Button>
            }}
          </Form.Item>
          <Form.Item name="voucher_no" hidden>
            <Input />
          </Form.Item>
          <Form.Item label="归属">
            <Radio.Group value={owner} onChange={(e)=> setOwner(e.target.value)}>
              <Radio value="hq">总部</Radio>
              <Radio value="department">项目</Radio>
            </Radio.Group>
          </Form.Item>
          {owner === 'department' && (
            <>
              <Form.Item name="department_id" label="项目">
                <Select
                  placeholder="请选择项目"
                  options={departments}
                  allowClear
                  onChange={(value) => {
                    setSelectedDepartmentId(value)
                    form.setFieldsValue({ site_id: undefined })
                  }}
                />
              </Form.Item>
              <Form.Item name="site_id" label="站点（可选）">
                <Select
                  placeholder="请选择站点"
                  options={sites
                    .filter((s: any) => !selectedDepartmentId || s.department_id === selectedDepartmentId)
                    .map((s: any) => ({ value: s.value, label: s.label }))}
                  allowClear
                  onChange={(value) => {
                    if (value) {
                      const site = sites.find((s: any) => s.value === value)
                      if (site) {
                        form.setFieldsValue({ department_id: site.department_id })
                        setSelectedDepartmentId(site.department_id)
                      }
                    }
                  }}
                />
              </Form.Item>
            </>
          )}
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select 
              options={[
                { value: 'income', label: '收入' },
                { value: 'expense', label: '支出' },
                { value: 'transfer', label: '转账' },
                { value: 'adjust', label: '调整' },
              ]}
              onChange={(value) => {
                setSelectedType(value)
                // 根据类型过滤类别
                if (value === 'income') {
                  setCategories(allCategories.filter((c: any) => c.kind === 'income'))
                } else if (value === 'expense') {
                  setCategories(allCategories.filter((c: any) => c.kind === 'expense'))
                } else {
                  // transfer和adjust可以选择所有类别
                  setCategories(allCategories)
                }
                // 清空类别选择
                form.setFieldValue('category_id', undefined)
              }}
            />
          </Form.Item>
          <Form.Item name="amount" label="金额" rules={[{ required: true }]}>
            <InputNumber min={0.01} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="account_id" label="账户" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="选择账户"
              options={accounts}
              filterOption={(input, option)=> (option?.search || '').includes(input.toLowerCase()) }
            />
          </Form.Item>
          <Form.Item name="category_id" label="类别" rules={[{ required: true, message: '请选择类别' }]}>
            <Select options={categories} placeholder="选择类别" showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="counterparty" label="对方">
            <Input />
          </Form.Item>
          <Form.Item name="memo" label="备注">
            <Input />
          </Form.Item>
          <Form.Item 
            label="凭证" 
            required
            rules={[{ required: true, message: '请至少上传一张凭证' }]}
            help={voucherUrls.length > 0 ? `已上传 ${voucherUrls.length} 张凭证（已转换为WebP格式）` : '请上传图片文件（JPEG、PNG、GIF），系统会自动转换为WebP格式，可上传多张'}
          >
            <Upload
              beforeUpload={handleUpload}
              fileList={fileList}
              onChange={({ fileList }) => setFileList(fileList)}
              multiple
              accept="image/*"
            >
              <Button icon={<UploadOutlined />} loading={uploading}>上传凭证</Button>
            </Upload>
            {voucherUrls.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ marginBottom: 8 }}>
                  {voucherUrls.map((url, index) => (
                    <span key={index} style={{ marginRight: 8 }}>
                      <Button 
                        size="small" 
                        icon={<EyeOutlined />} 
                        onClick={() => showPreview(voucherUrls, index)}
                      >
                        查看 {index + 1}
                      </Button>
                      <Button 
                        size="small" 
                        danger
                        style={{ marginLeft: 4 }}
                        onClick={() => {
                          setVoucherUrls(voucherUrls.filter((_, i) => i !== index))
                          setFileList(fileList.filter((_, i) => i !== index))
                        }}
                      >
                        删除
                      </Button>
                    </span>
                  ))}
                </div>
                <Button size="small" onClick={() => showPreview(voucherUrls, 0)}>
                  查看所有凭证 ({voucherUrls.length})
                </Button>
              </div>
            )}
          </Form.Item>
        </Form>
      </Modal>

      {/* 补充/重新上传凭证Modal */}
      <Modal 
        title={currentFlow?.voucher_urls && currentFlow.voucher_urls.length > 0 ? '重新上传凭证' : '补充凭证'}
        open={voucherUploadOpen}
        onOk={async () => {
          if (voucherUploadUrls.length === 0) {
            message.error('请至少上传一张凭证')
            return
          }
          if (!currentFlow) return
          
          const res = await fetch(`${api.flows}/${currentFlow.id}/voucher`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ voucher_urls: voucherUploadUrls })
          })
          
          if (res.ok) {
            message.success('凭证更新成功')
            setVoucherUploadOpen(false)
            setCurrentFlow(null)
            setVoucherUploadUrls([])
            setVoucherUploadFileList([])
            load()
          } else {
            const err = await res.json().catch(()=>({ error: res.statusText }))
            message.error(err.error || '更新失败')
          }
        }}
        onCancel={() => {
          setVoucherUploadOpen(false)
          setCurrentFlow(null)
          setVoucherUploadUrls([])
          setVoucherUploadFileList([])
        }}
        okText="确认"
        cancelText="取消"
        destroyOnClose
      >
        {currentFlow && (
          <div style={{ marginBottom: 16 }}>
            <p><strong>凭证号：</strong>{currentFlow.voucher_no || '-'}</p>
            <p><strong>日期：</strong>{currentFlow.biz_date}</p>
            <p><strong>金额：</strong>{(currentFlow.amount_cents / 100).toFixed(2)}</p>
          </div>
        )}
        {voucherUploadUrls.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>
              {voucherUploadUrls.map((url, index) => (
                <span key={index} style={{ marginRight: 8 }}>
                  <Button 
                    size="small" 
                    icon={<EyeOutlined />} 
                    onClick={() => showPreview(voucherUploadUrls, index)}
                  >
                    查看 {index + 1}
                  </Button>
                  <Button 
                    size="small" 
                    danger
                    style={{ marginLeft: 4 }}
                    onClick={() => {
                      setVoucherUploadUrls(voucherUploadUrls.filter((_, i) => i !== index))
                      setVoucherUploadFileList(voucherUploadFileList.filter((_, i) => i !== index))
                    }}
                  >
                    删除
                  </Button>
                </span>
              ))}
            </div>
            <Button size="small" onClick={() => showPreview(voucherUploadUrls, 0)}>
              查看所有凭证 ({voucherUploadUrls.length})
            </Button>
          </div>
        )}
        <Upload
          beforeUpload={async (file: File) => {
            setVoucherUploading(true)
            try {
              if (!isSupportedImageType(file)) {
                message.error('只允许上传图片格式（JPEG、PNG、GIF、WebP）')
                setVoucherUploading(false)
                return false
              }
              
              const url = await uploadImageAsWebP(file, api.upload.voucher)
              setVoucherUploadUrls([...voucherUploadUrls, url])
              message.success('凭证上传成功（已转换为WebP格式）')
              setVoucherUploading(false)
              return false
            } catch (error: any) {
              message.error('上传失败: ' + (error.message || '未知错误'))
              setVoucherUploading(false)
              return false
            }
          }}
          fileList={voucherUploadFileList}
          onChange={({ fileList }) => setVoucherUploadFileList(fileList)}
          multiple
          accept="image/*"
        >
          <Button icon={<UploadOutlined />} loading={voucherUploading}>上传凭证</Button>
        </Upload>
        <div style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
          请上传图片文件（JPEG、PNG、GIF），系统会自动转换为WebP格式，可上传多张
        </div>
      </Modal>

      {/* 凭证预览Modal */}
      <Modal
        title={`凭证预览 (${previewIndex + 1}/${previewUrls.length})`}
        open={previewOpen}
        onCancel={() => {
          setPreviewOpen(false)
          setPreviewUrls([])
          setPreviewIndex(0)
        }}
        footer={
          previewUrls.length > 1 ? (
            <Space>
              <Button 
                disabled={previewIndex === 0}
                onClick={() => setPreviewIndex(previewIndex - 1)}
              >
                上一张
              </Button>
              <span>{previewIndex + 1} / {previewUrls.length}</span>
              <Button 
                disabled={previewIndex === previewUrls.length - 1}
                onClick={() => setPreviewIndex(previewIndex + 1)}
              >
                下一张
              </Button>
            </Space>
          ) : null
        }
        width={800}
        style={{ top: 20 }}
        bodyStyle={{ padding: 0, textAlign: 'center', maxHeight: '80vh', overflow: 'auto' }}
      >
        {previewUrls.length > 0 && previewUrls[previewIndex] && (
          <div style={{ padding: 16 }}>
            <img
              src={previewUrls[previewIndex]}
              alt={`凭证预览 ${previewIndex + 1}`}
              style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
