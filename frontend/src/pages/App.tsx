import { Layout, Menu, Button, Form, Input, Card, Space, message, Tabs, Spin } from 'antd'
import type { MenuProps } from 'antd'
import { useEffect, useState, lazy, Suspense } from 'react'
import { CloseOutlined } from '@ant-design/icons'
import { api } from '../config/api'
import { initPermissions, clearPermissionsCache } from '../utils/permissions'

// 代码分割：按需加载页面组件
const Dashboard = lazy(() => import('./Dashboard').then(m => ({ default: m.Dashboard })))
const Flows = lazy(() => import('./Flows').then(m => ({ default: m.Flows })))
const AccountTransactions = lazy(() => import('./AccountTransactions').then(m => ({ default: m.AccountTransactions })))
const AccountTransfer = lazy(() => import('./AccountTransfer').then(m => ({ default: m.AccountTransfer })))
const AR = lazy(() => import('./AR').then(m => ({ default: m.AR })))
const AP = lazy(() => import('./AP').then(m => ({ default: m.AP })))
const ImportCenter = lazy(() => import('./ImportCenter').then(m => ({ default: m.ImportCenter })))
const OrgDepartmentManagement = lazy(() => import('./OrgDepartmentManagement').then(m => ({ default: m.OrgDepartmentManagement })))
const DepartmentManagement = lazy(() => import('./DepartmentManagement').then(m => ({ default: m.DepartmentManagement })))
const SiteManagement = lazy(() => import('./SiteManagement').then(m => ({ default: m.SiteManagement })))
const SiteBills = lazy(() => import('./SiteBills').then(m => ({ default: m.SiteBills })))
const CategoryManagement = lazy(() => import('./CategoryManagement').then(m => ({ default: m.CategoryManagement })))
const AccountManagement = lazy(() => import('./AccountManagement').then(m => ({ default: m.AccountManagement })))
const CurrencyManagement = lazy(() => import('./CurrencyManagement').then(m => ({ default: m.CurrencyManagement })))
const AuditLogs = lazy(() => import('./AuditLogs').then(m => ({ default: m.AuditLogs })))
const VendorManagement = lazy(() => import('./VendorManagement').then(m => ({ default: m.VendorManagement })))
const EmployeeManagement = lazy(() => import('./EmployeeManagement').then(m => ({ default: m.EmployeeManagement })))
const BorrowingManagement = lazy(() => import('./BorrowingManagement').then(m => ({ default: m.BorrowingManagement })))
const RepaymentManagement = lazy(() => import('./RepaymentManagement').then(m => ({ default: m.RepaymentManagement })))
const LeaveManagement = lazy(() => import('./LeaveManagement').then(m => ({ default: m.LeaveManagement })))
const ExpenseReimbursement = lazy(() => import('./ExpenseReimbursement').then(m => ({ default: m.ExpenseReimbursement })))
const SalaryPayments = lazy(() => import('./SalaryPayments').then(m => ({ default: m.SalaryPayments })))
const AllowancePayments = lazy(() => import('./AllowancePayments').then(m => ({ default: m.AllowancePayments })))
const IPWhitelistManagement = lazy(() => import('./IPWhitelistManagement'))
const FixedAssetsManagement = lazy(() => import('./FixedAssetsManagement').then(m => ({ default: m.FixedAssetsManagement })))
const FixedAssetPurchase = lazy(() => import('./FixedAssetPurchase').then(m => ({ default: m.FixedAssetPurchase })))
const FixedAssetSale = lazy(() => import('./FixedAssetSale').then(m => ({ default: m.FixedAssetSale })))
const FixedAssetAllocation = lazy(() => import('./FixedAssetAllocation').then(m => ({ default: m.FixedAssetAllocation })))
const RentalManagement = lazy(() => import('./RentalManagement').then(m => ({ default: m.RentalManagement })))
const RolePermissionsManagement = lazy(() => import('./RolePermissionsManagement').then(m => ({ default: m.RolePermissionsManagement })))
const PositionPermissionsManagement = lazy(() => import('./PositionPermissionsManagement').then(m => ({ default: m.PositionPermissionsManagement })))
const EmailNotificationSettings = lazy(() => import('./EmailNotificationSettings').then(m => ({ default: m.EmailNotificationSettings })))
const SiteConfigManagement = lazy(() => import('./SiteConfigManagement'))
const ReportDepartmentCash = lazy(() => import('./reports/ReportDepartmentCash').then(m => ({ default: m.ReportDepartmentCash })))
const ReportSiteGrowth = lazy(() => import('./reports/ReportSiteGrowth').then(m => ({ default: m.ReportSiteGrowth })))
const ReportARSummary = lazy(() => import('./reports/ReportARSummary').then(m => ({ default: m.ReportARSummary })))
const ReportARDetail = lazy(() => import('./reports/ReportARDetail').then(m => ({ default: m.ReportARDetail })))
const ReportAPSummary = lazy(() => import('./reports/ReportAPSummary').then(m => ({ default: m.ReportAPSummary })))
const ReportAPDetail = lazy(() => import('./reports/ReportAPDetail').then(m => ({ default: m.ReportAPDetail })))
const ReportExpenseSummary = lazy(() => import('./reports/ReportExpenseSummary').then(m => ({ default: m.ReportExpenseSummary })))
const ReportExpenseDetail = lazy(() => import('./reports/ReportExpenseDetail').then(m => ({ default: m.ReportExpenseDetail })))
const ReportAccountBalance = lazy(() => import('./reports/ReportAccountBalance').then(m => ({ default: m.ReportAccountBalance })))
const ReportBorrowing = lazy(() => import('./reports/ReportBorrowing').then(m => ({ default: m.ReportBorrowing })))
const ReportEmployeeSalary = lazy(() => import('./reports/ReportEmployeeSalary').then(m => ({ default: m.ReportEmployeeSalary })))

const { Header, Sider, Content } = Layout

// 页面标题映射
const pageTitles: Record<string, string> = {
  'dashboard': '首页',
  'flows': '收支记账',
  'account-transfer': '账户转账',
  'account-transactions': '账户明细',
  'import': '数据导入',
  'ar': '应收账款',
  'ap': '应付账款',
  'report-dept-cash': '项目汇总报表',
  'report-site-growth': '站点增长报表',
  'report-ar-summary': '应收账款汇总',
  'report-ar-detail': '应收账款明细',
  'report-ap-summary': '应付账款汇总',
  'report-ap-detail': '应付账款明细',
  'report-expense-summary': '日常支出汇总',
  'report-expense-detail': '日常支出明细',
  'report-account-balance': '账户余额报表',
  'report-borrowing': '借款统计报表',
  'employee': '员工管理',
  'employee-salary': '员工薪资报表',
  'salary-payments': '薪资发放管理',
  'allowance-payments': '补贴发放管理',
  'employee-leave': '请假管理',
  'expense-reimbursement': '报销管理',
  'site-management': '站点管理',
  'site-bills': '站点账单',
  'department': '项目管理',
  'org-department': '部门管理',
  'category': '类别管理',
  'account': '账户管理',
  'currency': '币种管理',
  'vendor': '供应商管理',
  'fixed-assets': '资产列表',
  'fixed-asset-purchase': '资产买入',
  'fixed-asset-sale': '资产卖出',
  'fixed-asset-allocation': '资产分配',
  'rental-management': '租房管理',
  'borrowings': '借款管理',
  'repayments': '还款管理',
  'role-permissions': '角色权限管理',
  'position-permissions': '权限管理',
  'email-notification': '邮件提醒设置',
  'site-config': '网站配置',
  'ip-whitelist': 'IP白名单',
  'audit': '审计日志',
}

interface TabItem {
  key: string
  label: string
  closable: boolean
}

export function App() {
  // 从 localStorage 恢复标签页状态
  const [tabs, setTabs] = useState<TabItem[]>(() => {
    const saved = localStorage.getItem('tabs')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return parsed.length > 0 ? parsed : [{ key: 'dashboard', label: '首页', closable: false }]
      } catch {
        return [{ key: 'dashboard', label: '首页', closable: false }]
      }
    }
    return [{ key: 'dashboard', label: '首页', closable: false }]
  })
  
  // 从 localStorage 恢复选中的页面，如果没有则默认为 dashboard
  const [selected, setSelected] = useState(() => {
    const saved = localStorage.getItem('selectedPage')
    return saved || 'dashboard'
  })
  const [openKeys, setOpenKeys] = useState<string[]>(() => {
    const saved = localStorage.getItem('openMenuKeys')
    return saved ? JSON.parse(saved) : []
  })
  const [apiOk, setApiOk] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [userRole, setUserRole] = useState<string>('')
  const [userInfo, setUserInfo] = useState<{ name?: string; email?: string; role?: string; position?: { code: string; name: string; canViewReports?: boolean } | null } | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginStep, setLoginStep] = useState<'login' | 'changePassword' | 'twoFactor'>('login')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [totpData, setTotpData] = useState<any>(null)
  const [hasTotp, setHasTotp] = useState(false)
  const [contextMenuVisible, setContextMenuVisible] = useState(false)
  const [contextMenuKey, setContextMenuKey] = useState<string>('')
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  useEffect(() => {
    // 确保当前选中的页面在标签列表中
    setTabs(prevTabs => {
      const existingTab = prevTabs.find(tab => tab.key === selected)
      if (existingTab) {
        return prevTabs
      }
      const title = pageTitles[selected] || selected
      const newTabs = [...prevTabs, { key: selected, label: title, closable: selected !== 'dashboard' }]
      localStorage.setItem('tabs', JSON.stringify(newTabs))
      return newTabs
    })
  }, [selected])

  useEffect(() => {
    fetch(api.health).then(r => r.json()).then(d => setApiOk(!!d.db)).catch(() => setApiOk(false))
    // 检查当前用户状态（仅在首次加载时检查）
    // 后端现在返回 200，即使未登录也不会报错
    fetch(api.me, { credentials: 'include' })
      .then(async (r) => {
        if (r.ok) {
          const data = await r.json()
          if (data.loggedIn) {
            setLoggedIn(true)
            setUserRole(data.role || '')
            setUserInfo({
              name: data.name || '',
              email: data.email || '',
              role: data.role || '',
              position: data.position || null
            })
            // 初始化权限
            await initPermissions()
          }
        }
      })
      .catch(() => {
        // 网络错误等，静默处理
      })
      .finally(() => {
        setCheckingAuth(false)
      })
  }, [])

  const onLogin = async (v: any) => {
    if (!v?.email || typeof v.email !== 'string') return message.error('请输入有效邮箱')
    if (!v?.password) return message.error('请输入密码')
    setLoginLoading(true)
    try {
      const payload = { 
        email: v.email.trim(), 
        password: v.password
      }
      const res = await fetch(api.auth.loginPassword, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload), 
        credentials: 'include' 
      })
      const data = await res.json()
      if (res.ok) {
        // 检查是否需要首次修改密码
        if (data.mustChangePassword) {
          setLoginEmail(v.email.trim())
          setLoginPassword(v.password)
          setLoginStep('changePassword')
          message.info('首次登录，请修改密码')
        } else if (data.needBindTotp) {
          // 需要绑定TOTP
          setLoginEmail(v.email.trim())
          setLoginPassword(v.password)
          setHasTotp(false)
          setLoginStep('twoFactor')
          message.info('请绑定Google验证码')
        } else if (data.needTotp) {
          // 需要输入TOTP验证码
          setLoginEmail(v.email.trim())
          setLoginPassword(v.password)
          setHasTotp(true)
          setLoginStep('twoFactor')
          message.info('请输入Google验证码')
        } else {
          // 登录成功
          setLoggedIn(true)
          setUserRole(data.user?.role || '')
          setUserInfo({
            name: data.user?.name || '',
            email: data.user?.email || '',
            role: data.user?.role || ''
          })
          // 初始化权限
          await initPermissions()
          message.success('登录成功')
        }
      } else {
        message.error(data.error || '登录失败')
      }
    } catch (error: any) {
      message.error('登录失败：' + (error.message || '网络错误'))
    } finally {
      setLoginLoading(false)
    }
  }

  const onChangePassword = async (v: any) => {
    if (!v?.oldPassword || !v?.newPassword) return message.error('请输入密码')
    if (v.newPassword.length < 6) return message.error('密码至少6位')
    setLoginLoading(true)
    try {
      const res = await fetch(api.auth.changePasswordFirst, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          email: loginEmail, 
          oldPassword: v.oldPassword, 
          newPassword: v.newPassword 
        }), 
        credentials: 'include' 
      })
      const data = await res.json()
      if (res.ok) {
        // 更新密码，跳转到二步验证页面
        setLoginPassword(v.newPassword)
        setLoginStep('twoFactor')
        setHasTotp(false)
        message.success('密码已修改，请完成二步验证')
      } else {
        message.error(data.error || '修改密码失败')
      }
    } catch (error: any) {
      message.error('修改密码失败：' + (error.message || '网络错误'))
    } finally {
      setLoginLoading(false)
    }
  }

  const onTwoFactor = async (v: any) => {
    if (!v?.totp || v.totp.length !== 6) return message.error('请输入6位验证码')
    setLoginLoading(true)
    try {
      // 如果未绑定TOTP，先获取二维码
      if (!hasTotp && !totpData) {
        const qrRes = await fetch(api.auth.getTotpQr, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: loginEmail, password: loginPassword }),
          credentials: 'include'
        })
        const qrData = await qrRes.json()
        if (!qrRes.ok) {
          message.error(qrData.error || '获取二维码失败')
          setLoginLoading(false)
          return
        }
        setTotpData(qrData)
        message.info('请先扫描二维码')
        setLoginLoading(false)
        return
      }
      
      // 如果已绑定TOTP，验证验证码后登录
      if (hasTotp) {
        const res = await fetch(api.auth.loginPassword, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: loginEmail, password: loginPassword, totp: v.totp }),
          credentials: 'include'
        })
        const data = await res.json()
        if (res.ok) {
          setLoggedIn(true)
          setUserRole(data.user?.role || '')
          setUserInfo({
            name: data.user?.name || '',
            email: data.user?.email || '',
            role: data.user?.role || ''
          })
          // 初始化权限
          await initPermissions()
          message.success('登录成功')
        } else {
          message.error(data.error || '验证失败')
        }
      } else {
        // 绑定TOTP
        const res = await fetch(api.auth.bindTotpFirst, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: loginEmail, password: loginPassword, secret: totpData.secret, totp: v.totp }),
          credentials: 'include'
        })
        const data = await res.json()
        if (res.ok) {
          setLoggedIn(true)
          setUserRole(data.user?.role || '')
          setUserInfo({
            name: data.user?.name || '',
            email: data.user?.email || '',
            role: data.user?.role || ''
          })
          // 初始化权限
          await initPermissions()
          message.success('Google验证码已绑定，登录成功')
        } else {
          message.error(data.error || '绑定失败')
        }
      }
    } catch (error: any) {
      message.error('操作失败：' + (error.message || '网络错误'))
    } finally {
      setLoginLoading(false)
    }
  }

  const loadTotpStatus = async () => {
    if (loginStep !== 'twoFactor' || !loginEmail || !loginPassword) return
    try {
      const res = await fetch(api.auth.loginPassword, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
        credentials: 'include'
      })
      const data = await res.json()
      if (res.ok && data.needBindTotp) {
        setHasTotp(false)
      } else if (res.ok && data.needTotp) {
        setHasTotp(true)
      } else if (!res.ok && data.error === 'Google验证码必填') {
        setHasTotp(true)
      }
    } catch (error) {
      // 忽略错误
    }
  }

  useEffect(() => {
    if (loginStep === 'twoFactor') {
      loadTotpStatus()
    }
  }, [loginStep])
  
  const onLogout = async () => {
    try {
      await fetch(api.auth.logout, { method: 'POST', credentials: 'include' })
    } catch (e) {
      // 忽略错误
    }
    setLoggedIn(false)
    setUserRole('')
    setUserInfo(null)
    setLoginStep('login')
    setLoginEmail('')
    setLoginPassword('')
    setTotpData(null)
    setHasTotp(false)
    clearPermissionsCache()
    // 清除保存的页面状态
    localStorage.removeItem('selectedPage')
    localStorage.removeItem('openMenuKeys')
    localStorage.removeItem('tabs')
    setSelected('dashboard')
    setOpenKeys([])
    setTabs([{ key: 'dashboard', label: '首页', closable: false }])
    message.success('已退出登录')
  }

  if (checkingAuth) {
    // 正在检查认证状态，显示加载状态
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Header 
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            color: 'white',
            zIndex: 1000,
            height: 64,
            lineHeight: '64px',
            padding: '0 24px'
          }}
        >
          AR公司管理系统 {apiOk ? '' : '（API未连接）'}
        </Header>
        <Content style={{ padding: 24, marginTop: 64, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ textAlign: 'center', color: '#666' }}>加载中...</div>
        </Content>
      </Layout>
    )
  }

  if (!loggedIn) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Header 
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            color: 'white',
            zIndex: 1000,
            height: 64,
            lineHeight: '64px',
            padding: '0 24px'
          }}
        >
          AR公司管理系统 {apiOk ? '' : '（API未连接）'}
        </Header>
        <Content style={{ padding: 24, marginTop: 64, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {loginStep === 'login' ? (
            <Card title="登录" style={{ width: 360 }}>
              <Form layout="vertical" onFinish={onLogin} onFinishFailed={()=> message.error('请检查表单填写')}>
                <Form.Item name="email" label="邮箱" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}>
                  <Input placeholder="请输入邮箱地址" />
                </Form.Item>
                <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
                  <Input.Password placeholder="请输入密码" />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={loginLoading} disabled={!apiOk} block>
                    登录
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          ) : loginStep === 'changePassword' ? (
            <Card title="首次登录 - 修改密码" style={{ width: 360 }}>
              <Form layout="vertical" onFinish={onChangePassword} onFinishFailed={()=> message.error('请检查表单填写')}>
                <Form.Item>
                  <div style={{ marginBottom: 16, color: '#666' }}>
                    邮箱：<strong>{loginEmail}</strong>
                  </div>
                </Form.Item>
                <Form.Item name="oldPassword" label="当前密码" rules={[{ required: true, message: '请输入当前密码' }]}>
                  <Input.Password placeholder="请输入管理员设置的初始密码" />
                </Form.Item>
                <Form.Item name="newPassword" label="新密码" rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '密码至少6位' }]}>
                  <Input.Password placeholder="请输入新密码（至少6位）" />
                </Form.Item>
                <Form.Item name="confirmPassword" label="确认新密码" dependencies={['newPassword']} rules={[
                  { required: true, message: '请确认新密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve()
                      }
                      return Promise.reject(new Error('两次输入的密码不一致'))
                    },
                  }),
                ]}>
                  <Input.Password placeholder="请再次输入新密码" />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={loginLoading} disabled={!apiOk} block>
                    修改密码
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          ) : (
            <Card title={hasTotp ? "二步验证" : "绑定Google验证码"} style={{ width: 400 }}>
              {!hasTotp && !totpData ? (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <Button type="primary" onClick={async () => {
                    setLoginLoading(true)
                    try {
                      const res = await fetch(api.auth.getTotpQr, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
                        credentials: 'include'
                      })
                      const data = await res.json()
                      if (res.ok) {
                        setTotpData(data)
                      } else {
                        message.error(data.error || '获取二维码失败')
                      }
                    } catch (error: any) {
                      message.error('获取二维码失败：' + (error.message || '网络错误'))
                    } finally {
                      setLoginLoading(false)
                    }
                  }} loading={loginLoading} disabled={!apiOk}>
                    获取二维码
                  </Button>
                </div>
              ) : (
                <Form layout="vertical" onFinish={onTwoFactor} onFinishFailed={()=> message.error('请检查表单填写')}>
                  {!hasTotp && totpData && (
                    <Form.Item>
                      <div style={{ textAlign: 'center', marginBottom: 16 }}>
                        <div style={{ marginBottom: 8 }}>请使用Google Authenticator扫描二维码</div>
                        <img src={totpData.qrCode} alt="QR Code" style={{ width: 200, height: 200, border: '1px solid #ddd', borderRadius: 4 }} />
                      </div>
                    </Form.Item>
                  )}
                  <Form.Item name="totp" label={hasTotp ? "Google验证码" : "Google验证码"} rules={[{ required: true, message: '请输入验证码' }, { pattern: /^\d{6}$/, message: '请输入6位数字验证码' }]}>
                    <Input placeholder="请输入6位验证码" maxLength={6} style={{ letterSpacing: 8, fontSize: 20, textAlign: 'center' }} />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" loading={loginLoading} disabled={!apiOk} block>
                      {hasTotp ? '验证登录' : '绑定验证码'}
                    </Button>
                  </Form.Item>
                </Form>
              )}
            </Card>
          )}
        </Content>
      </Layout>
    )
  }

  const buildMenuItems = (): MenuProps['items'] => {
    const items: MenuProps['items'] = []
    
    // 首页
    if (!userRole || ['manager', 'finance', 'hr', 'auditor', 'read', 'employee'].includes(userRole)) {
      items.push({ key: 'dashboard', label: '首页', icon: null })
    }
    
    // 日常业务
    const dailyBusiness: MenuProps['items'] = []
    if (!userRole || ['manager', 'finance', 'hr', 'auditor', 'read'].includes(userRole)) {
      dailyBusiness.push({ key: 'flows', label: '收支记账' })
      dailyBusiness.push({ key: 'account-transfer', label: '账户转账' })
      dailyBusiness.push({ key: 'account-transactions', label: '账户明细' })
    }
    if (!userRole || ['manager', 'finance'].includes(userRole)) {
      dailyBusiness.push({ key: 'import', label: '数据导入' })
    }
    if (dailyBusiness.length > 0) {
      items.push({ key: 'daily', label: '日常业务', children: dailyBusiness })
    }
    
    // 往来账款
    const arAp: MenuProps['items'] = []
    if (!userRole || ['manager', 'finance', 'hr', 'auditor', 'read'].includes(userRole)) {
      arAp.push({ key: 'ar', label: '应收账款' })
      arAp.push({ key: 'ap', label: '应付账款' })
    }
    if (arAp.length > 0) {
      items.push({ key: 'arap', label: '往来账款', children: arAp })
    }
    
    // 报表（只有总部人员可以查看）
    const reports: MenuProps['items'] = []
    // 检查是否可以查看报表：完全基于职位权限
    const canViewReports = userInfo?.position?.canViewReports === true
    if (canViewReports) {
      reports.push({ key: 'report-dept-cash', label: '项目汇总报表' })
      reports.push({ key: 'report-site-growth', label: '站点增长报表' })
      reports.push({ key: 'report-ar-summary', label: '应收账款汇总' })
      reports.push({ key: 'report-ar-detail', label: '应收账款明细' })
      reports.push({ key: 'report-ap-summary', label: '应付账款汇总' })
      reports.push({ key: 'report-ap-detail', label: '应付账款明细' })
      reports.push({ key: 'report-expense-summary', label: '日常支出汇总' })
      reports.push({ key: 'report-expense-detail', label: '日常支出明细' })
      reports.push({ key: 'report-account-balance', label: '账户余额报表' })
      reports.push({ key: 'report-borrowing', label: '借款统计报表' })
    }
    if (reports.length > 0) {
      items.push({ key: 'reports', label: '报表中心', children: reports })
    }
    
    // 借款管理
    const borrowing: MenuProps['items'] = []
    if (!userRole || ['manager', 'finance', 'hr', 'auditor', 'read'].includes(userRole)) {
      borrowing.push({ key: 'borrowings', label: '借款管理' })
      borrowing.push({ key: 'repayments', label: '还款管理' })
    }
    if (borrowing.length > 0) {
      items.push({ key: 'borrowing', label: '借款管理', children: borrowing })
    }
    
    // 站点管理（独立一级菜单）
    const sites: MenuProps['items'] = []
    if (!userRole || ['manager', 'finance', 'hr', 'auditor', 'read'].includes(userRole)) {
      sites.push({ key: 'site-management', label: '站点管理' })
      sites.push({ key: 'site-bills', label: '站点账单' })
    }
    if (sites.length > 0) {
      items.push({ key: 'sites', label: '站点管理', children: sites })
    }
    
    // 基础数据
    const settings: MenuProps['items'] = []
    if (!userRole || ['manager', 'finance'].includes(userRole)) {
      settings.push({ key: 'department', label: '项目管理' })
      settings.push({ key: 'org-department', label: '部门管理' })
      settings.push({ key: 'category', label: '类别管理' })
      settings.push({ key: 'account', label: '账户管理' })
      settings.push({ key: 'currency', label: '币种管理' })
      settings.push({ key: 'vendor', label: '供应商管理' })
    }
    if (settings.length > 0) {
      items.push({ key: 'settings', label: '基础数据', children: settings })
    }
    
    // 资产管理（独立一级菜单）
    const fixedAssets: MenuProps['items'] = []
    if (!userRole || ['manager', 'finance', 'hr', 'auditor', 'read'].includes(userRole)) {
      fixedAssets.push({ key: 'fixed-assets', label: '资产列表' })
      if (userRole === 'finance' || userRole === 'manager') {
        fixedAssets.push({ key: 'fixed-asset-purchase', label: '资产买入' })
        fixedAssets.push({ key: 'fixed-asset-sale', label: '资产卖出' })
      }
      if (userRole === 'finance' || userRole === 'manager' || userRole === 'hr') {
        fixedAssets.push({ key: 'fixed-asset-allocation', label: '资产分配' })
      }
      if (userRole === 'finance' || userRole === 'manager') {
        fixedAssets.push({ key: 'rental-management', label: '租房管理' })
      }
    }
    if (fixedAssets.length > 0) {
      items.push({ key: 'fixed-assets-menu', label: '资产管理', children: fixedAssets })
    }
    
    // 员工管理（整合用户权限）
    const employees: MenuProps['items'] = []
    // employee角色：只能查看自己的请假和报销
    if (userRole === 'employee') {
      employees.push({ key: 'employee-leave', label: '我的请假' })
      employees.push({ key: 'expense-reimbursement', label: '我的报销' })
    } else if (!userRole || ['manager', 'finance', 'hr', 'auditor', 'read'].includes(userRole)) {
      // hr角色：可以管理员工、查看薪资表、审批请假和报销
      if (userRole === 'hr' || !userRole || ['manager', 'finance', 'hr'].includes(userRole)) {
        employees.push({ key: 'employee', label: '员工管理' })
      }
      employees.push({ key: 'employee-salary', label: '员工薪资报表' })
      employees.push({ key: 'salary-payments', label: '薪资发放管理' })
      employees.push({ key: 'allowance-payments', label: '补贴发放管理' })
      employees.push({ key: 'employee-leave', label: '请假管理' })
      employees.push({ key: 'expense-reimbursement', label: '报销管理' })
    }
    if (employees.length > 0) {
      items.push({ key: 'employees', label: '人员管理', children: employees })
    }
    
    // 系统管理（仅保留系统级配置）
    const system: MenuProps['items'] = []
    if (userRole && ['manager'].includes(userRole)) {
      system.push({ key: 'position-permissions', label: '权限管理' })
      system.push({ key: 'email-notification', label: '邮件提醒设置' })
      system.push({ key: 'site-config', label: '网站配置' })
      system.push({ key: 'ip-whitelist', label: 'IP白名单' })
      system.push({ key: 'audit', label: '审计日志' })
    }
    if (system.length > 0) {
      items.push({ key: 'system', label: '系统管理', children: system })
    }
    
    return items
  }

  // 添加或激活标签页
  const addOrActivateTab = (key: string) => {
    const title = pageTitles[key] || key
    setTabs(prevTabs => {
      const existingTab = prevTabs.find(tab => tab.key === key)
      if (existingTab) {
        // 标签已存在，直接激活
        return prevTabs
      }
      // 添加新标签
      const newTabs = [...prevTabs, { key, label: title, closable: key !== 'dashboard' }]
      localStorage.setItem('tabs', JSON.stringify(newTabs))
      return newTabs
    })
    setSelected(key)
    localStorage.setItem('selectedPage', key)
  }

  // 关闭标签页
  const removeTab = (targetKey: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (targetKey === 'dashboard') {
      return // 首页标签不能关闭
    }
    
    setTabs(prevTabs => {
      const newTabs = prevTabs.filter(tab => tab.key !== targetKey)
      localStorage.setItem('tabs', JSON.stringify(newTabs))
      
      // 如果关闭的是当前激活的标签，切换到其他标签
      if (targetKey === selected) {
        const currentIndex = prevTabs.findIndex(tab => tab.key === targetKey)
        let newSelected = 'dashboard'
        
        if (currentIndex > 0) {
          // 切换到前一个标签
          newSelected = prevTabs[currentIndex - 1].key
        } else if (newTabs.length > 0) {
          // 切换到第一个标签
          newSelected = newTabs[0].key
        }
        
        setSelected(newSelected)
        localStorage.setItem('selectedPage', newSelected)
      }
      
      return newTabs
    })
  }

  // 关闭其他标签（除当前标签外的所有标签）
  const closeOtherTabs = (targetKey: string) => {
    if (targetKey === 'dashboard') {
      // 如果点击的是首页，关闭所有其他标签
      setTabs([{ key: 'dashboard', label: '首页', closable: false }])
      localStorage.setItem('tabs', JSON.stringify([{ key: 'dashboard', label: '首页', closable: false }]))
      setSelected('dashboard')
      localStorage.setItem('selectedPage', 'dashboard')
    } else {
      // 保留当前标签和首页
      const newTabs = tabs.filter(tab => tab.key === targetKey || tab.key === 'dashboard')
      setTabs(newTabs)
      localStorage.setItem('tabs', JSON.stringify(newTabs))
      setSelected(targetKey)
      localStorage.setItem('selectedPage', targetKey)
    }
  }

  // 关闭左侧标签
  const closeLeftTabs = (targetKey: string) => {
    const currentIndex = tabs.findIndex(tab => tab.key === targetKey)
    if (currentIndex <= 0) return // 没有左侧标签或点击的是第一个标签
    
    // 保留当前标签及右侧的所有标签（包括首页）
    const newTabs = tabs.filter((tab, index) => index >= currentIndex || tab.key === 'dashboard')
    setTabs(newTabs)
    localStorage.setItem('tabs', JSON.stringify(newTabs))
    setSelected(targetKey)
    localStorage.setItem('selectedPage', targetKey)
  }

  // 关闭右侧标签
  const closeRightTabs = (targetKey: string) => {
    const currentIndex = tabs.findIndex(tab => tab.key === targetKey)
    if (currentIndex < 0 || currentIndex >= tabs.length - 1) return // 没有右侧标签或点击的是最后一个标签
    
    // 保留当前标签及左侧的所有标签
    const newTabs = tabs.filter((tab, index) => index <= currentIndex)
    setTabs(newTabs)
    localStorage.setItem('tabs', JSON.stringify(newTabs))
    setSelected(targetKey)
    localStorage.setItem('selectedPage', targetKey)
  }

  // 关闭全部标签（保留首页）
  const closeAllTabs = () => {
    setTabs([{ key: 'dashboard', label: '首页', closable: false }])
    localStorage.setItem('tabs', JSON.stringify([{ key: 'dashboard', label: '首页', closable: false }]))
    setSelected('dashboard')
    localStorage.setItem('selectedPage', 'dashboard')
  }

  // 处理标签右键菜单
  const handleTabContextMenu = (e: React.MouseEvent, key: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenuKey(key)
    setContextMenuPosition({ x: e.clientX, y: e.clientY })
    setContextMenuVisible(true)
  }

  // 关闭右键菜单
  const handleContextMenuClose = () => {
    setContextMenuVisible(false)
  }

  // 切换标签页
  const onChangeTab = (key: string) => {
    setSelected(key)
    localStorage.setItem('selectedPage', key)
  }

  const menuItems = buildMenuItems() || []

  const handleOpenChange = (keys: string[]) => {
    // 获取当前展开的最后一个菜单键（即最新点击的菜单）
    const latestOpenKey = keys.find(key => openKeys.indexOf(key) === -1)
    // 如果展开了新菜单，则只保留这个新菜单，收起其他所有菜单
    if (latestOpenKey) {
      setOpenKeys([latestOpenKey])
      localStorage.setItem('openMenuKeys', JSON.stringify([latestOpenKey]))
    } else {
      // 如果收起了菜单，更新状态
      setOpenKeys(keys)
      localStorage.setItem('openMenuKeys', JSON.stringify(keys))
    }
  }

  const siderWidth = 200
  
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        width={siderWidth}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          overflow: 'auto',
          height: '100vh',
          zIndex: 1000
        }}
      >
        <div style={{ color: 'white', padding: 12, fontWeight: 600 }}>财务记账</div>
        <Menu 
          theme="dark" 
          mode="inline" 
          selectedKeys={[selected]}
          openKeys={openKeys}
          onOpenChange={handleOpenChange}
          onClick={(e) => {
            // 检查是否是父级菜单（有children的项）
            const parentItem = menuItems.find(item => item?.key === e.key)
            if (parentItem && (parentItem as any).children) {
              // 如果有子菜单，不设置selected，让用户点击子菜单
              return
            }
            addOrActivateTab(e.key)
          }}
          items={menuItems}
        />
      </Sider>
      <Layout style={{ marginLeft: siderWidth }}>
        <Header 
          style={{ 
            position: 'fixed',
            top: 0,
            left: siderWidth,
            right: 0,
            color: 'white', 
            display: 'flex', 
            justifyContent: 'space-between',
            zIndex: 999,
            height: 64,
            lineHeight: '64px',
            padding: '0 24px'
          }}
        >
          <div>AR公司管理系统</div>
          <Space>
            <Button onClick={onLogout}>退出登录</Button>
          </Space>
        </Header>
        <Content style={{ padding: 16, marginTop: 64, minHeight: 'calc(100vh - 64px)' }}>
          <Tabs
            type="editable-card"
            activeKey={selected}
            onChange={onChangeTab}
            hideAdd
            onEdit={(targetKey, action) => {
              if (action === 'remove') {
                removeTab(targetKey as string)
              }
            }}
            items={tabs.map(tab => ({
              key: tab.key,
              label: (
                <span
                  onContextMenu={(e) => handleTabContextMenu(e, tab.key)}
                  style={{ display: 'inline-block', width: '100%' }}
                >
                  {tab.label}
                </span>
              ),
              closable: tab.closable,
              closeIcon: tab.closable ? <CloseOutlined /> : null,
            }))}
            style={{ marginBottom: 16 }}
          />
          {contextMenuVisible && (
            <>
              {/* 点击其他地方关闭右键菜单 */}
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 9998
                }}
                onClick={handleContextMenuClose}
                onContextMenu={(e) => {
                  e.preventDefault()
                  handleContextMenuClose()
                }}
              />
              {/* 自定义右键菜单 */}
              <div
                style={{
                  position: 'fixed',
                  left: contextMenuPosition.x,
                  top: contextMenuPosition.y,
                  zIndex: 9999,
                  background: 'white',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  minWidth: 120,
                }}
              >
                <Menu
                  mode="vertical"
                  selectedKeys={[]}
                  items={(() => {
                    const currentIndex = tabs.findIndex(tab => tab.key === contextMenuKey)
                    const hasLeftTabs = currentIndex > 0
                    const hasRightTabs = currentIndex >= 0 && currentIndex < tabs.length - 1
                    const hasOtherTabs = tabs.filter(tab => tab.key !== contextMenuKey && tab.key !== 'dashboard').length > 0
                    
                    return [
                      {
                        key: 'close',
                        label: '关闭',
                        disabled: contextMenuKey === 'dashboard',
                        onClick: () => {
                          removeTab(contextMenuKey)
                          handleContextMenuClose()
                        }
                      },
                      {
                        key: 'close-others',
                        label: '关闭其他',
                        disabled: !hasOtherTabs,
                        onClick: () => {
                          closeOtherTabs(contextMenuKey)
                          handleContextMenuClose()
                        }
                      },
                      {
                        key: 'close-left',
                        label: '关闭左侧',
                        disabled: !hasLeftTabs,
                        onClick: () => {
                          closeLeftTabs(contextMenuKey)
                          handleContextMenuClose()
                        }
                      },
                      {
                        key: 'close-right',
                        label: '关闭右侧',
                        disabled: !hasRightTabs,
                        onClick: () => {
                          closeRightTabs(contextMenuKey)
                          handleContextMenuClose()
                        }
                      },
                      {
                        key: 'close-all',
                        label: '关闭全部',
                        disabled: tabs.length <= 1,
                        onClick: () => {
                          closeAllTabs()
                          handleContextMenuClose()
                        }
                      }
                    ]
                  })()}
                />
              </div>
            </>
          )}
          <Suspense fallback={<div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>}>
            {selected === 'dashboard' && <Dashboard userRole={userRole} userInfo={userInfo} />}
            {selected === 'flows' && <Flows />}
            {selected === 'account-transfer' && <AccountTransfer />}
            {selected === 'account-transactions' && <AccountTransactions />}
            {selected === 'ar' && <AR />}
            {selected === 'ap' && <AP />}
            {selected === 'import' && <ImportCenter />}
            {selected === 'report-dept-cash' && <ReportDepartmentCash />}
            {selected === 'report-site-growth' && <ReportSiteGrowth />}
            {selected === 'report-ar-summary' && <ReportARSummary />}
            {selected === 'report-ar-detail' && <ReportARDetail />}
            {selected === 'report-ap-summary' && <ReportAPSummary />}
            {selected === 'report-ap-detail' && <ReportAPDetail />}
            {selected === 'report-expense-summary' && <ReportExpenseSummary />}
            {selected === 'report-expense-detail' && <ReportExpenseDetail />}
            {selected === 'report-account-balance' && <ReportAccountBalance />}
            {selected === 'report-borrowing' && <ReportBorrowing />}
            {selected === 'employee' && <EmployeeManagement userRole={userRole} />}
            {selected === 'employee-salary' && <ReportEmployeeSalary />}
            {selected === 'salary-payments' && <SalaryPayments userRole={userRole} />}
            {selected === 'allowance-payments' && <AllowancePayments userRole={userRole} />}
            {selected === 'employee-leave' && <LeaveManagement userRole={userRole} />}
            {selected === 'expense-reimbursement' && <ExpenseReimbursement userRole={userRole} />}
            {selected === 'site-management' && <SiteManagement userRole={userRole} />}
            {selected === 'site-bills' && <SiteBills userRole={userRole} />}
            {selected === 'department' && <DepartmentManagement userRole={userRole} />}
            {selected === 'org-department' && <OrgDepartmentManagement userRole={userRole} />}
            {selected === 'category' && <CategoryManagement userRole={userRole} />}
            {selected === 'account' && <AccountManagement userRole={userRole} />}
            {selected === 'currency' && <CurrencyManagement userRole={userRole} />}
            {selected === 'vendor' && <VendorManagement userRole={userRole} />}
            {selected === 'fixed-assets' && <FixedAssetsManagement userRole={userRole} />}
            {selected === 'fixed-asset-purchase' && <FixedAssetPurchase userRole={userRole} />}
            {selected === 'fixed-asset-sale' && <FixedAssetSale userRole={userRole} />}
            {selected === 'fixed-asset-allocation' && <FixedAssetAllocation userRole={userRole} />}
            {selected === 'rental-management' && <RentalManagement userRole={userRole} />}
            {selected === 'borrowings' && <BorrowingManagement userRole={userRole} />}
            {selected === 'repayments' && <RepaymentManagement userRole={userRole} />}
            {selected === 'role-permissions' && <RolePermissionsManagement />}
            {selected === 'position-permissions' && <PositionPermissionsManagement />}
            {selected === 'email-notification' && <EmailNotificationSettings />}
            {selected === 'site-config' && <SiteConfigManagement />}
            {selected === 'ip-whitelist' && <IPWhitelistManagement />}
            {selected === 'audit' && <AuditLogs />}
          </Suspense>
        </Content>
      </Layout>
    </Layout>
  )
}


