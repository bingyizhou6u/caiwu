import { useEffect, useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, DatePicker, InputNumber, Select, Space, message, Upload } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import dayjs from 'dayjs'
import { api } from '../config/api'
import { loadAccounts, loadExpenseCategories } from '../utils/loaders'
import { authedFetch, authedJsonFetch } from '../utils/authedFetch'
import { uploadImageAsWebP, isSupportedImageType } from '../utils/image'

export function AP() {
  const [docs, setDocs] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmForm] = Form.useForm()
  const [confirmingDoc, setConfirmingDoc] = useState<any | null>(null)
  const [accounts, setAccounts] = useState<{value:string,label:string}[]>([])
  const [categories, setCategories] = useState<{value:string,label:string}[]>([])
  const [uploading, setUploading] = useState(false)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [voucherUrl, setVoucherUrl] = useState<string | undefined>()

  const load = async () => {
    try {
      const data = await authedJsonFetch(`${api.ar.docs}?kind=AP`)
      setDocs(data.results ?? data ?? [])
    } catch (error: any) {
      message.error(error.message || '加载应付失败')
    }
  }
  useEffect(()=>{ load() },[])
  useEffect(()=>{
    // 加载账户列表
    authedJsonFetch(api.accounts)
      .then((d: any) => {
        const rows = d.results ?? d ?? []
        setAccounts(rows.map((r: any) => {
          const aliasPart = r.alias ? ` (${r.alias})` : ''
          const currencyPart = r.currency ? ` [${r.currency}]` : ''
          return { value: r.id, label: `${r.name}${aliasPart}${currencyPart}` }
        }))
      })
      .catch(() => {})
    // 加载类别列表（只加载支出类别）
    authedJsonFetch(api.categories)
      .then((d: any) => {
        const rows = d.results ?? d ?? []
        setCategories(rows.filter((r: any) => r.kind === 'expense').map((r: any)=>({ value: r.id, label: r.name })))
      })
      .catch(() => {})
  },[])

  const createDoc = async () => {
    const v = await form.validateFields()
    const payload = {
      kind: 'AP',
      party_id: v.party,
      issue_date: v.issue_date.format('YYYY-MM-DD'),
      due_date: v.due_date?.format('YYYY-MM-DD'),
      amount_cents: Math.round(Number(v.amount)*100),
      memo: v.memo
    }
    try {
      await authedJsonFetch(api.ar.docs, { method: 'POST', body: JSON.stringify(payload) })
      message.success('已新增')
    } catch (error: any) {
      message.error(error.message || '新增失败')
      return
    }
    setOpen(false)
    form.resetFields()
    load()
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
      setVoucherUrl(url)
      setFileList([{ uid: '1', name: file.name, status: 'done' }])
      message.success('凭证上传成功（已转换为WebP格式）')
      setUploading(false)
      return false
    } catch (error: any) {
      message.error('上传失败: ' + (error.message || '未知错误'))
      setUploading(false)
      return false
    }
  }

  return (
    <Card title="应付">
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={()=>setOpen(true)}>新建应付</Button>
        <Button onClick={load}>刷新</Button>
      </Space>
      <Table rowKey="id" dataSource={docs} columns={[
        { title: '单号', dataIndex: 'doc_no' },
        { title: '开立日期', dataIndex: 'issue_date' },
        { title: '到期日', dataIndex: 'due_date' },
        { title: '金额', dataIndex: 'amount_cents', render: (v:number)=> (v/100).toFixed(2) },
        { title: '已结', dataIndex: 'settled_cents', render: (v:number)=> (v/100).toFixed(2) },
        { title: '状态', dataIndex: 'status' },
        { title: '操作', render: (_:any, r:any)=> <Space>
            {r.status === 'open' && (
              <Button size="small" type="primary" onClick={()=>{
                setConfirmingDoc(r)
                setConfirmOpen(true)
                confirmForm.resetFields()
                setFileList([])
                setVoucherUrl(undefined)
                confirmForm.setFieldsValue({ biz_date: dayjs(r.issue_date) })
              }}>确认</Button>
            )}
          </Space> }
      ]} />

      <Modal title="新建应付" open={open} onOk={createDoc} onCancel={()=>setOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical" initialValues={{ issue_date: dayjs() }}>
          <Form.Item name="party" label="供应商">
            <Input />
          </Form.Item>
          <Form.Item name="issue_date" label="开立日期" rules={[{ required: true }]}>
            <DatePicker />
          </Form.Item>
          <Form.Item name="due_date" label="到期日">
            <DatePicker />
          </Form.Item>
          <Form.Item name="amount" label="金额" rules={[{ required: true }]}>
            <InputNumber min={0.01} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="memo" label="备注">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="确认应付" open={confirmOpen} onCancel={()=>{
        setConfirmOpen(false)
        setConfirmingDoc(null)
        setFileList([])
        setVoucherUrl(undefined)
      }} footer={null} destroyOnClose>
        {confirmingDoc && (
          <Form form={confirmForm} layout="vertical" onFinish={async ()=>{
            if (!voucherUrl) {
              message.error('请先上传凭证')
              return
            }
            const v = await confirmForm.validateFields()
            const payload = {
              doc_id: confirmingDoc.id,
              account_id: v.account_id,
              category_id: v.category_id,
              biz_date: v.biz_date.format('YYYY-MM-DD'),
              memo: v.memo,
              voucher_url: voucherUrl
            }
            try {
              await authedJsonFetch(api.ar.confirm, { method: 'POST', body: JSON.stringify(payload) })
              message.success('已确认并生成支出记录')
            } catch (error: any) {
              message.error(error.message || '确认失败')
              return
            }
            setConfirmOpen(false)
            setConfirmingDoc(null)
            setFileList([])
            setVoucherUrl(undefined)
            load()
          }}>
            <Form.Item label="金额">{(confirmingDoc.amount_cents/100).toFixed(2)}</Form.Item>
            <Form.Item name="account_id" label="账户" rules={[{ required: true }]}>
              <Select options={accounts} placeholder="选择账户" showSearch />
            </Form.Item>
            <Form.Item name="category_id" label="类别" rules={[{ required: true }]}>
              <Select options={categories} placeholder="选择类别" />
            </Form.Item>
            <Form.Item name="biz_date" label="业务日期" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="memo" label="备注">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item label="凭证" required>
              <Upload
                fileList={fileList}
                beforeUpload={(file) => {
                  handleUpload(file)
                  return false
                }}
                onRemove={() => {
                  setFileList([])
                  setVoucherUrl(undefined)
                }}
                accept="image/*"
                maxCount={1}
              >
                <Button icon={<UploadOutlined />} loading={uploading}>上传凭证</Button>
              </Upload>
              {voucherUrl && <div style={{ marginTop: 8, color: '#52c41a' }}>✓ 凭证已上传</div>}
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">确认</Button>
                <Button onClick={()=>{
                  setConfirmOpen(false)
                  setConfirmingDoc(null)
                  setFileList([])
                  setVoucherUrl(undefined)
                }}>取消</Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </Card>
  )
}
