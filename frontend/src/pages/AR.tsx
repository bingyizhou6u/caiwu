import { useEffect, useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, DatePicker, InputNumber, Select, Space, message, Descriptions, Upload } from 'antd'
import { UploadOutlined, EyeOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import dayjs from 'dayjs'
import { api } from '../config/api'
import { loadAccounts, loadIncomeCategories } from '../utils/loaders'
import { apiGet } from '../utils/api'

export function AR() {
  const [docs, setDocs] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<any | null>(null)
  const [settleForm] = Form.useForm()
  const [flows, setFlows] = useState<{ value: string, label: string }[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmForm] = Form.useForm()
  const [confirmingDoc, setConfirmingDoc] = useState<any | null>(null)
  const [accounts, setAccounts] = useState<{value:string,label:string}[]>([])
  const [categories, setCategories] = useState<{value:string,label:string}[]>([])
  const [sites, setSites] = useState<{value:string,label:string}[]>([])
  const [uploading, setUploading] = useState(false)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [voucherUrl, setVoucherUrl] = useState<string | undefined>()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | undefined>()

  const load = async () => {
    const r = await fetch(`${api.ar.docs}?kind=AR`, { credentials: 'include' })
    if (!r.ok) {
      const err = await r.json().catch(()=>({ error: r.statusText }))
      message.error(err.error || '加载应收失败')
      return
    }
    const j = await r.json()
    setDocs(j.results ?? [])
  }
  useEffect(()=>{ load() },[])
  useEffect(()=>{
    fetch(api.flows, { credentials: 'include' })
      .then(async (r)=>{
        if (!r.ok) {
          const err = await r.json().catch(()=>({ error: r.statusText }))
          message.error(err.error || '加载流水失败')
          return
        }
        const d = await r.json()
        const rows = d.results ?? []
        setFlows(rows.map((r:any)=>({ value: r.id, label: `${r.biz_date} ${r.voucher_no ?? ''} ${(r.amount_cents/100).toFixed(2)} ${r.type}` })))
      })
    // 加载账户列表
    fetch(api.accounts, { credentials: 'include' })
      .then(async (r) => {
        if (r.ok) {
          const d = await r.json()
          const rows = d.results ?? d ?? []
          setAccounts(rows.map((r: any)=>{
            const aliasPart = r.alias ? ` (${r.alias})` : ''
            const currencyPart = r.currency ? ` [${r.currency}]` : ''
            return { value: r.id, label: `${r.name}${aliasPart}${currencyPart}` }
          }))
        }
      })
    // 加载类别列表（只加载收入类别）
    fetch(api.categories, { credentials: 'include' })
      .then(async (r) => {
        if (r.ok) {
          const d = await r.json()
          const rows = d.results ?? d ?? []
          setCategories(rows.filter((r: any) => r.kind === 'income').map((r: any)=>({ value: r.id, label: r.name })))
        }
      })
    // 加载站点列表
    fetch(api.sites, { credentials: 'include' })
      .then(async (r) => {
        if (r.ok) {
          const d = await r.json()
          const rows = d.results ?? d ?? []
          setSites(rows.map((r: any)=>({ value: r.id, label: r.name })))
        }
      })
  },[])

  const createDoc = async () => {
    const v = await form.validateFields()
    const payload = {
      kind: 'AR',
      site_id: v.site_id,
      issue_date: v.issue_date.format('YYYY-MM-DD'),
      due_date: v.due_date?.format('YYYY-MM-DD'),
      amount_cents: Math.round(Number(v.amount)*100),
      memo: v.memo
    }
    const res = await fetch(api.ar.docs, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'include' })
    if (!res.ok) return message.error('新增失败')
    message.success('已新增')
    setOpen(false)
    form.resetFields()
    load()
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      if (!allowedTypes.includes(file.type)) {
        message.error('只允许上传图片格式（JPEG、PNG、GIF、WebP）')
        setUploading(false)
        return false
      }
      
      let fileToUpload: File | Blob = file
      
      if (file.type !== 'image/webp') {
        const img = new Image()
        const imageUrl = URL.createObjectURL(file)
        
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = imageUrl
        })
        
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          message.error('无法创建Canvas上下文')
          setUploading(false)
          URL.revokeObjectURL(imageUrl)
          return false
        }
        
        ctx.drawImage(img, 0, 0)
        
        const webpBlob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('转换失败'))
            }
          }, 'image/webp', 0.85)
        })
        
        fileToUpload = new File([webpBlob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' })
        URL.revokeObjectURL(imageUrl)
      }
      
      const formData = new FormData()
      formData.append('file', fileToUpload)
      
      const res = await fetch(api.upload.voucher, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      })
      
      const data = await res.json()
      if (!res.ok) {
        message.error(data.error || '上传失败')
        setUploading(false)
        return false
      }
      
      setVoucherUrl(data.url)
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
    <Card title="应收">
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={()=>setOpen(true)}>新建应收</Button>
        <Button onClick={load}>刷新</Button>
      </Space>
      <Table rowKey="id" dataSource={docs} columns={[
        { title: '单号', dataIndex: 'doc_no' },
        { title: '客户（站点）', dataIndex: 'site_name', render: (v: string) => v || '-' },
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
            <Button size="small" onClick={async ()=>{
              const res = await fetch(`${api.ar.statement}?doc_id=${r.id}`, { credentials: 'include' })
              const j = await res.json()
              setDetail(j)
              setDetailOpen(true)
            }}>对账单</Button>
          </Space> }
      ]} />

      <Modal title="新建应收" open={open} onOk={createDoc} onCancel={()=>setOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical" initialValues={{ issue_date: dayjs() }}>
          <Form.Item name="site_id" label="客户（站点）" rules={[{ required: true, message: '请选择站点' }]}>
            <Select options={sites} placeholder="选择站点" showSearch />
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

      <Modal width={720} title="对账单/核销" open={detailOpen} onCancel={()=>setDetailOpen(false)} footer={null} destroyOnClose>
        {detail && (
          <>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="单号">{detail.doc?.doc_no}</Descriptions.Item>
              <Descriptions.Item label="状态">{detail.doc?.status}</Descriptions.Item>
              <Descriptions.Item label="开立">{detail.doc?.issue_date}</Descriptions.Item>
              <Descriptions.Item label="到期">{detail.doc?.due_date || '-'}</Descriptions.Item>
              <Descriptions.Item label="金额">{(detail.doc?.amount_cents/100).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="已结">{(detail.settled_cents/100).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="未结" span={2}>{(detail.remaining_cents/100).toFixed(2)}</Descriptions.Item>
            </Descriptions>
            <div style={{ height: 8 }} />
            <Table rowKey="id" size="small" dataSource={detail.settlements} pagination={false} columns={[
              { title: '日期', dataIndex: 'settle_date' },
              { title: '流水ID', dataIndex: 'flow_id', render: (v: string) => v ? v.slice(0, 8) + '...' : '-' },
              { title: '核销金额', dataIndex: 'settle_amount_cents', render: (v:number)=> (v/100).toFixed(2) },
            ]} />
            <div style={{ height: 12 }} />
            <Form layout="inline" form={settleForm}>
              <Form.Item name="flow_id" rules={[{ required: true }]}>
                <Select style={{ width: 360 }} options={flows} placeholder="选择对应的收款流水" />
              </Form.Item>
              <Form.Item name="settle_amount" rules={[{ required: true }]}>
                <InputNumber min={0.01} step={0.01} placeholder="核销金额" />
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button type="primary" onClick={async ()=>{
                    const v = await settleForm.validateFields()
                    const payload = {
                      doc_id: detail.doc.id,
                      flow_id: v.flow_id,
                      settle_amount_cents: Math.round(Number(v.settle_amount)*100)
                    }
                    const res = await fetch(api.ar.settlements, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'include' })
                    if (!res.ok) return message.error('核销失败')
                    message.success('已核销')
                    // refresh statement
                    const r2 = await fetch(`${api.ar.statement}?doc_id=${detail.doc.id}`, { credentials: 'include' })
                    const j2 = await r2.json()
                    setDetail(j2)
                    settleForm.resetFields()
                    load()
                  }}>登记核销</Button>
                </Space>
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      <Modal title="确认应收" open={confirmOpen} onCancel={()=>{
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
            const res = await fetch(api.ar.confirm, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'include' })
            if (!res.ok) {
              const err = await res.json().catch(()=>({ error: res.statusText }))
              message.error(err.error || '确认失败')
              return
            }
            message.success('已确认并生成收入记录')
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

      <Modal open={previewOpen} footer={null} onCancel={() => setPreviewOpen(false)} width={800}>
        {previewUrl && (
          <img alt="凭证预览" style={{ width: '100%' }} src={api.vouchers(previewUrl.replace('/api/vouchers/', ''))} />
        )}
      </Modal>
    </Card>
  )
}


