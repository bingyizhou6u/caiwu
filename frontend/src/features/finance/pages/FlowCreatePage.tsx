import { useState, useEffect } from 'react'
import { Button, Form, Input, DatePicker, InputNumber, Select, Space, message, Upload, Card, Modal, Row, Col } from 'antd'
import { UploadOutlined, EyeOutlined, SaveOutlined, ReloadOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import dayjs from 'dayjs'
import { api } from '../../../config/api'
import { isSupportedImageType, uploadImageAsWebP } from '../../../utils/image'
import { useCreateFlow } from '../../../hooks'
import { useProjectOptions } from '../../../hooks'
import { useAccounts, useAllCategories, useSites } from '../../../hooks/useBusinessData'
import { useZodForm } from '../../../hooks/forms/useZodForm'
import { createFlowSchema } from '../../../validations/flow.schema'
import { withErrorHandler } from '../../../utils/errorHandler'
import { PageContainer } from '../../../components/PageContainer'
import { AmountInput, AccountSelect, DepartmentSelect } from '../../../components/form'

export function FlowCreate() {
  const { form, validateWithZod } = useZodForm(createFlowSchema)

  // 数据 Hook
  const { data: projects = [] } = useProjectOptions()
  const { data: accounts = [] } = useAccounts()
  const { data: allCategories = [] } = useAllCategories()
  const { data: sites = [] } = useSites()

  const { mutateAsync: createFlow, isPending: isCreating } = useCreateFlow()

  // 本地状态
  const [categories, setCategories] = useState<{ value: string, label: string, kind: string }[]>([])
  const [selectedType, setSelectedType] = useState<string>('income')
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>()
  const [uploading, setUploading] = useState(false)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [voucherUrls, setVoucherUrls] = useState<string[]>([])

  // 预览状态
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [previewIndex, setPreviewIndex] = useState(0)

  // 初始化表单默认值
  useEffect(() => {
    form.setFieldsValue({ type: 'income', bizDate: dayjs() })
  }, [form])

  // 类别根据类型过滤
  useEffect(() => {
    if (allCategories.length > 0) {
      // 借入/收回借款视为收入类别，借出/偿还借款视为支出类别
      if (['income', 'borrowing_in', 'repayment_in'].includes(selectedType)) {
        setCategories(allCategories.filter((c: any) => c.kind === 'income'))
      } else if (['expense', 'lending_out', 'repayment_out'].includes(selectedType)) {
        setCategories(allCategories.filter((c: any) => c.kind === 'expense'))
      } else {
        setCategories(allCategories)
      }
    }
  }, [selectedType, allCategories])

  // 同步凭证 URL 到表单
  useEffect(() => {
    form.setFieldValue('voucherUrls', voucherUrls)
  }, [voucherUrls, form])

  const showPreview = (urls: string[], index: number = 0) => {
    setPreviewUrls(urls)
    setPreviewIndex(index)
    setPreviewVisible(true)
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
      setVoucherUrls(prev => [...prev, url])
      message.success('凭证上传成功')
      setUploading(false)
      return false
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      message.error('上传失败: ' + errorMessage)
      setUploading(false)
      return false
    }
  }

  const handleReset = () => {
    form.resetFields()
    form.setFieldsValue({ type: 'income', bizDate: dayjs() })
    setSelectedType('income')
    setSelectedProjectId(undefined)
    setFileList([])
    setVoucherUrls([])
  }

  const onCreate = withErrorHandler(
    async () => {
      if (voucherUrls.length === 0) {
        message.error('请至少上传一张凭证')
        return
      }
      const values = await validateWithZod()

      // 后端会根据 projectId 自动判断是否为总部范围，无需传递 ownerScope
      await createFlow({
        ...values,
        bizDate: values.bizDate.format('YYYY-MM-DD HH:mm:ss'),
        amountCents: Math.round(values.amount * 100),
        voucherUrls: voucherUrls
      })

      message.success('记账成功，可继续录入')
      handleReset()
    },
    { successMessage: '已新增' }
  )

  return (
    <PageContainer
      title="新建记账"
      breadcrumb={[{ title: '财务管理' }, { title: '新建记账' }]}
    >
      <Card bordered={false} className="page-card">
        <Form form={form} layout="vertical">
          <Form.Item name="voucherUrls" hidden>
            <Input />
          </Form.Item>

          <Row gutter={24}>
            {/* 左列 */}
            <Col xs={24} md={12}>
              <Form.Item name="bizDate" label="日期时间" rules={[{ required: true, message: '请选择日期时间' }]}>
                <DatePicker
                  showTime={{ format: 'HH:mm:ss' }}
                  format="YYYY-MM-DD HH:mm:ss"
                  style={{ width: '100%' }}
                />
              </Form.Item>
              <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
                <Select
                  options={[
                    { value: 'income', label: '收入' },
                    { value: 'expense', label: '支出' },
                    { value: 'borrowing_in', label: '借入资金' },
                    { value: 'lending_out', label: '借出资金' },
                    { value: 'repayment_in', label: '收回借款' },
                    { value: 'repayment_out', label: '偿还借款' },
                  ]}
                  onChange={(value) => {
                    setSelectedType(value)
                    form.setFieldValue('categoryId', undefined)
                  }}
                />
              </Form.Item>
              <Form.Item name="amount" label="金额" rules={[{ required: true, message: '请输入金额' }]}>
                <AmountInput style={{ width: '100%' }} currency="CNY" />
              </Form.Item>
              <Form.Item name="accountId" label="账户" rules={[{ required: true, message: '请选择账户' }]}>
                <AccountSelect placeholder="选择账户" showCurrency />
              </Form.Item>
              <Form.Item name="categoryId" label="类别" rules={[{ required: true, message: '请选择类别' }]}>
                <Select options={Array.isArray(categories) ? categories : []} placeholder="选择类别" showSearch optionFilterProp="label" />
              </Form.Item>
            </Col>

            {/* 右列 */}
            <Col xs={24} md={12}>
              <Form.Item name="projectId" label="归属项目" rules={[{ required: true, message: '请选择归属项目' }]}>
                <DepartmentSelect
                  placeholder="请选择归属项目"
                  onChange={(value) => {
                    setSelectedProjectId(value)
                    form.setFieldsValue({ siteId: undefined })
                  }}
                />
              </Form.Item>
              <Form.Item name="siteId" label="站点（可选）">
                <Select
                  placeholder="请选择站点"
                  options={Array.isArray(sites) ? sites
                    .filter((s: any) => !selectedProjectId || s.projectId === selectedProjectId)
                    .map((s: any) => ({ value: s.value, label: s.label })) : []}
                  allowClear
                  onChange={(value) => {
                    if (value) {
                      const site = Array.isArray(sites) ? sites.find((s: any) => s.value === value) : undefined
                      if (site) {
                        form.setFieldsValue({ projectId: site.projectId })
                        setSelectedProjectId(site.projectId)
                      }
                    }
                  }}
                />
              </Form.Item>
              <Form.Item name="counterparty" label="对方">
                <Input placeholder="输入交易对方" />
              </Form.Item>
              <Form.Item name="memo" label="备注">
                <Input.TextArea rows={4} placeholder="输入备注信息" />
              </Form.Item>
            </Col>
          </Row>

          {/* 凭证上传 - 单独一行 */}
          <Form.Item
            label="凭证"
            required
            help={voucherUrls.length > 0 ? `已上传 ${voucherUrls.length} 张凭证` : '请上传图片文件，可上传多张'}
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
                <Space wrap>
                  {voucherUrls.map((url, index) => (
                    <Space key={index} size={4}>
                      <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => showPreview(voucherUrls, index)}
                      >
                        凭证 {index + 1}
                      </Button>
                      <Button
                        size="small"
                        danger
                        onClick={() => {
                          setVoucherUrls(voucherUrls.filter((_, i) => i !== index))
                          setFileList(fileList.filter((_, i) => i !== index))
                        }}
                      >
                        删除
                      </Button>
                    </Space>
                  ))}
                </Space>
              </div>
            )}
          </Form.Item>

          {/* 按钮区 */}
          <Form.Item style={{ marginTop: 24, marginBottom: 0 }}>
            <Space size="middle">
              <Button type="primary" icon={<SaveOutlined />} onClick={onCreate} loading={isCreating} size="large">
                保存并继续
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset} size="large">
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {/* 凭证预览模态框 */}
      <Modal
        title={`凭证预览 (${previewIndex + 1}/${previewUrls.length})`}
        open={previewVisible}
        onCancel={() => {
          setPreviewVisible(false)
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
        styles={{ body: { padding: 0, textAlign: 'center', maxHeight: '80vh', overflow: 'auto' } }}
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
    </PageContainer>
  )
}