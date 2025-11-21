import type { MenuProps } from 'antd'

export const pageTitles: Record<string, string> = {
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
    'employee': '人员管理',
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
    'position-permissions': '权限管理',
    'email-notification': '邮件提醒设置',
    'site-config': '网站配置',
    'ip-whitelist': 'IP白名单',
    'audit': '审计日志',
}

export const buildMenuItems = (userRole: string, userInfo: any): MenuProps['items'] => {
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

    // 人员管理（整合用户权限）
    const employees: MenuProps['items'] = []
    // employee角色：只能查看自己的请假和报销
    if (userRole === 'employee') {
        employees.push({ key: 'employee-leave', label: '我的请假' })
        employees.push({ key: 'expense-reimbursement', label: '我的报销' })
    } else if (!userRole || ['manager', 'finance', 'hr', 'auditor', 'read'].includes(userRole)) {
        // hr角色：可以管理员工、查看薪资表、审批请假和报销
        if (userRole === 'hr' || !userRole || ['manager', 'finance', 'hr'].includes(userRole)) {
            employees.push({ key: 'employee', label: '人员管理' })
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
