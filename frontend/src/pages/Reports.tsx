import { useState } from 'react'
import { Card, Tabs, Button, Table, Space, Statistic, message, Select, InputNumber } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { api } from '../config/api'
import { DateRangePicker } from '../components/DateRangePicker'

export function Reports() {
  const [deptRows, setDeptRows] = useState<any[]>([])
  const [siteRows, setSiteRows] = useState<any[]>([])
  const [arSummaryRows, setArSummaryRows] = useState<any[]>([])
  const [arDetailRows, setArDetailRows] = useState<any[]>([])
  const [apSummaryRows, setApSummaryRows] = useState<any[]>([])
  const [apDetailRows, setApDetailRows] = useState<any[]>([])
  const [expenseSummaryRows, setExpenseSummaryRows] = useState<any[]>([])
  const [expenseDetailRows, setExpenseDetailRows] = useState<any[]>([])
  const [newSiteRows, setNewSiteRows] = useState<any[]>([])
  const [categories, setCategories] = useState<{ value: string, label: string }[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>()
  const [arStats, setArStats] = useState<any>({})
  const [apStats, setApStats] = useState<any>({})
  const [expenseStats, setExpenseStats] = useState<any>({})
  const [newSiteDays, setNewSiteDays] = useState<number>(30)
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])

  const start = range[0].format('YYYY-MM-DD')
  const end = range[1].format('YYYY-MM-DD')

  // 加载类别列表
  const loadCategories = async () => {
    try {
      const res = await fetch(`${api.categories}?kind=expense`, { credentials: 'include' })
      if (res.ok) {
        const j = await res.json()
        setCategories((j.results ?? []).map((r: any) => ({ value: r.id, label: r.name })))
      }
    } catch (e) {
      // ignore
    }
  }

  return (
    <Card title="报表">
      <Space style={{ marginBottom: 12 }} wrap>
        <DateRangePicker value={range} onChange={(v) => v && setRange(v)} />
        <Button onClick={async ()=>{
          const res = await fetch(`${api.reports.departmentCash}?start=${start}&end=${end}`, { credentials: 'include' })
          const j = await res.json()
          if (!res.ok) return message.error('项目汇总失败')
          setDeptRows(j.rows ?? [])
        }}>项目汇总</Button>
        <Button onClick={async ()=>{
          const res = await fetch(`${api.reports.siteGrowth}?start=${start}&end=${end}`, { credentials: 'include' })
          const j = await res.json()
          if (!res.ok) return message.error('站点增长失败')
          setSiteRows(j.rows ?? [])
        }}>站点增长</Button>
        <Button onClick={async ()=>{
          const res = await fetch(`${api.reports.arSummary}?kind=AR&start=${start}&end=${end}`, { credentials: 'include' })
          const j = await res.json()
          if (!res.ok) return message.error('AR汇总失败')
          setArSummaryRows(j.rows ?? [])
          setArStats({ total: j.total_cents, settled: j.settled_cents, byStatus: j.by_status })
        }}>应收账款汇总</Button>
        <Button onClick={async ()=>{
          const res = await fetch(`${api.reports.arDetail}?start=${start}&end=${end}`, { credentials: 'include' })
          const j = await res.json()
          if (!res.ok) return message.error('应收账款明细失败')
          setArDetailRows(j.rows ?? [])
        }}>应收账款明细</Button>
        <Button onClick={async ()=>{
          const res = await fetch(`${api.reports.apSummary}?start=${start}&end=${end}`, { credentials: 'include' })
          const j = await res.json()
          if (!res.ok) return message.error('AP汇总失败')
          setApSummaryRows(j.rows ?? [])
          setApStats({ total: j.total_cents, settled: j.settled_cents, byStatus: j.by_status })
        }}>应付账款汇总</Button>
        <Button onClick={async ()=>{
          const res = await fetch(`${api.reports.apDetail}?start=${start}&end=${end}`, { credentials: 'include' })
          const j = await res.json()
          if (!res.ok) return message.error('应付账款明细失败')
          setApDetailRows(j.rows ?? [])
        }}>应付账款明细</Button>
        <Button onClick={async ()=>{
          await loadCategories()
          const res = await fetch(`${api.reports.expenseSummary}?start=${start}&end=${end}`, { credentials: 'include' })
          const j = await res.json()
          if (!res.ok) return message.error('日常支出汇总失败')
          setExpenseSummaryRows(j.rows ?? [])
          setExpenseStats({ total: j.total_cents })
        }}>日常支出汇总</Button>
        <Button onClick={async ()=>{
          await loadCategories()
          const res = await fetch(`${api.reports.expenseDetail}?start=${start}&end=${end}${selectedCategoryId ? `&category_id=${selectedCategoryId}` : ''}`, { credentials: 'include' })
          const j = await res.json()
          if (!res.ok) return message.error('日常支出明细失败')
          setExpenseDetailRows(j.rows ?? [])
        }}>日常支出明细</Button>
        <Space>
          <InputNumber 
            min={1} 
            max={365} 
            value={newSiteDays} 
            onChange={(v) => v && setNewSiteDays(v)}
            addonBefore="站点天数"
            style={{ width: 150 }}
          />
          <Button onClick={async ()=>{
            const res = await fetch(`${api.reports.newSiteRevenue}?start=${start}&end=${end}&days=${newSiteDays}`, { credentials: 'include' })
            const j = await res.json()
            if (!res.ok) return message.error('站点收费失败')
            setNewSiteRows(j.rows ?? [])
          }}>站点收费</Button>
        </Space>
      </Space>
      <Tabs
        items={[
          { 
            key: 'dept', 
            label: '项目汇总', 
            children: (
              <Table 
                rowKey="department_id" 
                dataSource={deptRows} 
                columns={[
                  { title: '项目', dataIndex: 'department_name' },
                  { title: '收入', dataIndex: 'income_cents', render: (v:number)=> (v/100).toFixed(2) },
                  { title: '支出', dataIndex: 'expense_cents', render: (v:number)=> (v/100).toFixed(2) },
                  { title: '净额', dataIndex: 'net_cents', render: (v:number)=> (v/100).toFixed(2) },
                ]} 
              />
            )
          },
          { 
            key: 'site', 
            label: '站点增长', 
            children: (
              <Table 
                rowKey="site_id" 
                dataSource={siteRows} 
                columns={[
                  { title: '站点', dataIndex: 'site_name' },
                  { title: '收入', dataIndex: 'income_cents', render: (v:number)=> (v/100).toFixed(2) },
                  { title: '支出', dataIndex: 'expense_cents', render: (v:number)=> (v/100).toFixed(2) },
                  { title: '净额', dataIndex: 'net_cents', render: (v:number)=> (v/100).toFixed(2) },
                  { title: '对比期收入', dataIndex: 'prev_income_cents', render: (v:number)=> (v/100).toFixed(2) },
                  { title: '增长率', dataIndex: 'growth_rate', render: (v:number)=> (v*100).toFixed(1) + '%' },
                ]} 
              />
            )
          },
          { 
            key: 'ar-summary', 
            label: '应收账款汇总', 
            children: (
              <>
                <Space style={{ marginBottom: 12 }}>
                  <Statistic title="期间总额" value={((arStats.total||0)/100).toFixed(2)} />
                  <Statistic title="期间已结" value={((arStats.settled||0)/100).toFixed(2)} />
                  {arStats.byStatus && Object.entries(arStats.byStatus).map(([status, cents]: [string, any]) => (
                    <Statistic key={status} title={`${status}状态`} value={((cents||0)/100).toFixed(2)} />
                  ))}
                </Space>
                <Table 
                  rowKey="id" 
                  dataSource={arSummaryRows} 
                  columns={[
                    { title: '单号', dataIndex: 'doc_no' },
                    { title: '开立', dataIndex: 'issue_date' },
                    { title: '到期', dataIndex: 'due_date' },
                    { title: '客户', dataIndex: 'party_id' },
                    { title: '金额', dataIndex: 'amount_cents', render: (v:number)=> (v/100).toFixed(2) },
                    { title: '已结', dataIndex: 'settled_cents', render: (v:number)=> (v/100).toFixed(2) },
                    { title: '状态', dataIndex: 'status' },
                  ]} 
                />
              </>
            )
          },
          { 
            key: 'ar-detail', 
            label: '应收账款明细', 
            children: (
              <Table 
                rowKey="id" 
                dataSource={arDetailRows} 
                columns={[
                  { title: '单号', dataIndex: 'doc_no' },
                  { title: '开立日期', dataIndex: 'issue_date' },
                  { title: '到期日', dataIndex: 'due_date' },
                  { title: '客户', dataIndex: 'party_id' },
                  { title: '金额', dataIndex: 'amount_cents', render: (v:number)=> (v/100).toFixed(2) },
                  { title: '已结', dataIndex: 'settled_cents', render: (v:number)=> (v/100).toFixed(2) },
                  { title: '未结', dataIndex: 'remaining_cents', render: (v:number)=> (v/100).toFixed(2) },
                  { title: '状态', dataIndex: 'status' },
                  { title: '备注', dataIndex: 'memo' },
                ]} 
              />
            )
          },
          { 
            key: 'ap-summary', 
            label: '应付账款汇总', 
            children: (
              <>
                <Space style={{ marginBottom: 12 }}>
                  <Statistic title="期间总额" value={((apStats.total||0)/100).toFixed(2)} />
                  <Statistic title="期间已结" value={((apStats.settled||0)/100).toFixed(2)} />
                  {apStats.byStatus && Object.entries(apStats.byStatus).map(([status, cents]: [string, any]) => (
                    <Statistic key={status} title={`${status}状态`} value={((cents||0)/100).toFixed(2)} />
                  ))}
                </Space>
                <Table 
                  rowKey="id" 
                  dataSource={apSummaryRows} 
                  columns={[
                    { title: '单号', dataIndex: 'doc_no' },
                    { title: '开立', dataIndex: 'issue_date' },
                    { title: '到期', dataIndex: 'due_date' },
                    { title: '供应商', dataIndex: 'party_id' },
                    { title: '金额', dataIndex: 'amount_cents', render: (v:number)=> (v/100).toFixed(2) },
                    { title: '已结', dataIndex: 'settled_cents', render: (v:number)=> (v/100).toFixed(2) },
                    { title: '状态', dataIndex: 'status' },
                  ]} 
                />
              </>
            )
          },
          { 
            key: 'ap-detail', 
            label: '应付账款明细', 
            children: (
              <Table 
                rowKey="id" 
                dataSource={apDetailRows} 
                columns={[
                  { title: '单号', dataIndex: 'doc_no' },
                  { title: '开立日期', dataIndex: 'issue_date' },
                  { title: '到期日', dataIndex: 'due_date' },
                  { title: '供应商', dataIndex: 'party_id' },
                  { title: '金额', dataIndex: 'amount_cents', render: (v:number)=> (v/100).toFixed(2) },
                  { title: '已结', dataIndex: 'settled_cents', render: (v:number)=> (v/100).toFixed(2) },
                  { title: '未结', dataIndex: 'remaining_cents', render: (v:number)=> (v/100).toFixed(2) },
                  { title: '状态', dataIndex: 'status' },
                  { title: '备注', dataIndex: 'memo' },
                ]} 
              />
            )
          },
          { 
            key: 'expense-summary', 
            label: '日常支出汇总', 
            children: (
              <>
                <Space style={{ marginBottom: 12 }}>
                  <Statistic title="支出总额" value={((expenseStats.total||0)/100).toFixed(2)} />
                </Space>
                <Table 
                  rowKey="category_id" 
                  dataSource={expenseSummaryRows} 
                  columns={[
                    { title: '类别', dataIndex: 'category_name' },
                    { title: '金额', dataIndex: 'total_cents', render: (v:number)=> (v/100).toFixed(2) },
                    { title: '笔数', dataIndex: 'count' },
                  ]} 
                />
              </>
            )
          },
          { 
            key: 'expense-detail', 
            label: '日常支出明细', 
            children: (
              <>
                <Space style={{ marginBottom: 12 }}>
                  <Select
                    style={{ width: 200 }}
                    placeholder="筛选类别"
                    allowClear
                    options={categories}
                    value={selectedCategoryId}
                    onChange={(v) => {
                      setSelectedCategoryId(v)
                    }}
                  />
                  <Button onClick={async ()=>{
                    await loadCategories()
                    const res = await fetch(`${api.reports.expenseDetail}?start=${start}&end=${end}${selectedCategoryId ? `&category_id=${selectedCategoryId}` : ''}`, { credentials: 'include' })
                    const j = await res.json()
                    if (!res.ok) return message.error('日常支出明细失败')
                    setExpenseDetailRows(j.rows ?? [])
                  }}>刷新</Button>
                </Space>
                <Table 
                  rowKey="id" 
                  dataSource={expenseDetailRows} 
                  columns={[
                    { title: '凭证号', dataIndex: 'voucher_no' },
                    { title: '日期', dataIndex: 'biz_date' },
                    { title: '类别', dataIndex: 'category_name' },
                    { title: '账户', dataIndex: 'account_name' },
                    { title: '金额', dataIndex: 'amount_cents', render: (v:number)=> (v/100).toFixed(2) },
                    { title: '对方', dataIndex: 'counterparty' },
                    { title: '项目', dataIndex: 'department_name' },
                    { title: '站点', dataIndex: 'site_name' },
                    { title: '备注', dataIndex: 'memo' },
                  ]} 
                />
              </>
            )
          },
          { 
            key: 'new-site', 
            label: '站点收费', 
            children: (
              <Table 
                rowKey="site_id" 
                dataSource={newSiteRows} 
                columns={[
                  { title: '站点', dataIndex: 'site_name' },
                  { title: '创建时间', dataIndex: 'site_created_at', render: (v:number)=> v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-' },
                  { title: '收入', dataIndex: 'income_cents', render: (v:number)=> (v/100).toFixed(2) },
                  { title: '支出', dataIndex: 'expense_cents', render: (v:number)=> (v/100).toFixed(2) },
                  { title: '净额', dataIndex: 'net_cents', render: (v:number)=> (v/100).toFixed(2) },
                  { title: '收入笔数', dataIndex: 'income_count' },
                ]} 
              />
            )
          },
        ]}
      />
    </Card>
  )
}
