import { Layout, Menu, Button, Form, Input, Card, Space, message, Tabs, Spin, Dropdown, Avatar } from 'antd'
import type { MenuProps } from 'antd'
import { useEffect, useState, lazy, Suspense } from 'react'
import { CloseOutlined, UserOutlined, LogoutOutlined, DownOutlined } from '@ant-design/icons'
import { api } from '../config/api'
import { AuthProvider, useAuth } from '../context/AuthContext'
import { buildMenuItems, pageTitles } from '../config/menu'

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

interface TabItem {
  key: string
  label: string
  closable: boolean
}

function AppContent() {
  const { user, loggedIn, loading, login, logout } = useAuth()

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

  const [loginLoading, setLoginLoading] = useState(false)
  const [loginStep, setLoginStep] = useState<'login' | 'changePassword' | 'twoFactor'>('login')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [totpData, setTotpData] = useState<any>(null)
  const [hasTotp, setHasTotp] = useState(false)

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
          await login(data)
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
          await login(data)
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
          await login(data)
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

  const handleLogout = async () => {
    await logout()
    setLoginStep('login')
    setLoginEmail('')
    setLoginPassword('')
    setTotpData(null)
    setHasTotp(false)
    setSelected('dashboard')
    setOpenKeys([])
    setTabs([{ key: 'dashboard', label: '首页', closable: false }])
  }

  if (loading) {
    return (
      <Layout style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5' }}>
        <div style={{ textAlign: 'center' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: '#666', fontSize: 16 }}>正在加载系统资源...</div>
        </div>
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
              <Form layout="vertical" onFinish={onLogin} onFinishFailed={() => message.error('请检查表单填写')}>
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
              <Form layout="vertical" onFinish={onChangePassword} onFinishFailed={() => message.error('请检查表单填写')}>
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
                <Form layout="vertical" onFinish={onTwoFactor} onFinishFailed={() => message.error('请检查表单填写')}>
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

  const renderContent = () => {
    return (
      <Suspense fallback={
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          minHeight: 400,
          background: '#fff',
          borderRadius: 4
        }}>
          <div style={{ textAlign: 'center' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16, color: '#999' }}>页面加载中...</div>
          </div>
        </div>
      }>
        {selected === 'dashboard' && <Dashboard userRole={user?.role} userInfo={user} />}
        {selected === 'flows' && <Flows />}
        {selected === 'account-transactions' && <AccountTransactions />}
        {selected === 'account-transfer' && <AccountTransfer />}
        {selected === 'ar' && <AR />}
        {selected === 'ap' && <AP />}
        {selected === 'import' && <ImportCenter />}
        {selected === 'org-department' && <OrgDepartmentManagement />}
        {selected === 'department' && <DepartmentManagement />}
        {selected === 'site-management' && <SiteManagement />}
        {selected === 'site-bills' && <SiteBills />}
        {selected === 'category' && <CategoryManagement />}
        {selected === 'account' && <AccountManagement />}
        {selected === 'currency' && <CurrencyManagement />}
        {selected === 'audit' && <AuditLogs />}
        {selected === 'vendor' && <VendorManagement />}
        {selected === 'employee' && <EmployeeManagement />}
        {selected === 'borrowings' && <BorrowingManagement />}
        {selected === 'repayments' && <RepaymentManagement />}
        {selected === 'employee-leave' && <LeaveManagement />}
        {selected === 'expense-reimbursement' && <ExpenseReimbursement />}
        {selected === 'salary-payments' && <SalaryPayments />}
        {selected === 'allowance-payments' && <AllowancePayments />}
        {selected === 'ip-whitelist' && <IPWhitelistManagement />}
        {selected === 'fixed-assets' && <FixedAssetsManagement />}
        {selected === 'fixed-asset-purchase' && <FixedAssetPurchase />}
        {selected === 'fixed-asset-sale' && <FixedAssetSale />}
        {selected === 'fixed-asset-allocation' && <FixedAssetAllocation />}
        {selected === 'rental-management' && <RentalManagement />}
        {selected === 'position-permissions' && <PositionPermissionsManagement />}
        {selected === 'email-notification' && <EmailNotificationSettings />}
        {selected === 'site-config' && <SiteConfigManagement />}
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
        {selected === 'report-employee-salary' && <ReportEmployeeSalary />}
      </Suspense>
    )
  }

  const userMenu: MenuProps['items'] = [
    {
      key: 'profile',
      label: (
        <div style={{ padding: '4px 0' }}>
          <div style={{ fontWeight: 'bold' }}>{user?.name}</div>
          <div style={{ fontSize: '12px', color: '#888' }}>{user?.email}</div>
          <div style={{ fontSize: '12px', color: '#888' }}>{user?.role}</div>
        </div>
      ),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} theme="dark" style={{ overflow: 'auto', height: '100vh', position: 'fixed', left: 0, top: 0, bottom: 0 }}>
        <div style={{ height: 64, margin: 16, background: 'rgba(255, 255, 255, 0.2)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 16 }}>
          AR公司管理系统
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selected]}
          openKeys={openKeys}
          onOpenChange={(keys) => {
            setOpenKeys(keys)
            localStorage.setItem('openMenuKeys', JSON.stringify(keys))
          }}
          items={buildMenuItems(user?.role || '', user)}
          onClick={({ key }) => addOrActivateTab(key)}
        />
      </Sider>
      <Layout style={{ marginLeft: 220 }}>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,21,41,0.08)', zIndex: 1 }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Tabs
              hideAdd
              type="editable-card"
              activeKey={selected}
              items={tabs.map(tab => ({
                key: tab.key,
                label: (
                  <Dropdown
                    menu={{
                      items: [
                        { key: 'close', label: '关闭当前', disabled: tab.key === 'dashboard', onClick: (e) => removeTab(tab.key, e as any) },
                        { key: 'closeOther', label: '关闭其他', onClick: () => closeOtherTabs(tab.key) },
                        { key: 'closeLeft', label: '关闭左侧', disabled: tabs.findIndex(t => t.key === tab.key) <= 0, onClick: () => closeLeftTabs(tab.key) },
                        { key: 'closeRight', label: '关闭右侧', disabled: tabs.findIndex(t => t.key === tab.key) >= tabs.length - 1, onClick: () => closeRightTabs(tab.key) },
                        { key: 'closeAll', label: '关闭全部', onClick: closeAllTabs },
                      ]
                    }}
                    trigger={['contextMenu']}
                  >
                    <span>{tab.label}</span>
                  </Dropdown>
                ),
                closable: tab.closable,
              }))}
              onChange={(key) => {
                setSelected(key)
                localStorage.setItem('selectedPage', key)
              }}
              onEdit={(targetKey, action) => {
                if (action === 'remove') {
                  removeTab(targetKey as string)
                }
              }}
              tabBarStyle={{ margin: 0, border: 'none' }}
            />
          </div>
          <div style={{ marginLeft: 16 }}>
            <Dropdown menu={{ items: userMenu }} placement="bottomRight">
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1890ff', marginRight: 8 }} />
                <span style={{ marginRight: 8 }}>{user?.name}</span>
                <DownOutlined style={{ fontSize: 12 }} />
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ margin: '24px 16px 0', overflow: 'initial' }}>
          <div style={{ padding: 24, background: '#fff', minHeight: 360, borderRadius: 4 }}>
            {renderContent()}
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
