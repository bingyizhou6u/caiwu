import type { MenuProps } from 'antd'
import { hasPermission } from '../utils/permissions'
import { getMenuIcon } from './menuIcons'

export const pageTitles: Record<string, string> = {
    // 我的工作台
    'my-center': '个人中心',
    'my-leaves': '我的请假',
    'my-reimbursements': '我的报销',
    'my-assets': '我的资产',
    'company-policies': '公司制度',
    'my-approvals': '我的审批',
    // 财务管理
    'flow-create': '新建记账',
    'flows': '收支明细',
    'account-transfer': '账户转账',
    'account-transactions': '账户明细',
    'import': '数据导入',
    'ar': '应收账款',
    'ap': '应付账款',
    // 站点管理
    'site-management': '站点管理',
    'site-bills': '站点账单',
    // 资产管理
    'fixed-assets': '资产列表',
    'fixed-asset-purchase': '资产买入',
    'fixed-asset-sale': '资产卖出',
    'fixed-asset-allocation': '资产分配',
    'rental-management': '租房管理',
    // 人力资源
    'employee': '人员管理',
    'employee-salary': '员工薪资报表',
    'salary-payments': '薪资发放管理',
    'allowance-payments': '补贴发放管理',
    'employee-leave': '请假管理',
    'expense-reimbursement': '报销管理',
    // 报表中心
    'report-dept-cash': '项目汇总报表',
    'report-site-growth': '站点增长报表',
    'report-ar-summary': '应收账款汇总',
    'report-ar-detail': '应收账款明细',
    'report-ap-summary': '应付账款汇总',
    'report-ap-detail': '应付账款明细',
    'report-expense-summary': '日常支出汇总',
    'report-expense-detail': '日常支出明细',
    'report-account-balance': '账户余额报表',
    // 系统设置
    'department': '项目管理',
    'category': '类别管理',
    'account': '账户管理',
    'currency': '币种管理',
    'vendor': '供应商管理',
    'position-permissions': '权限管理',
    'email-notification': '邮件提醒设置',
    'ip-whitelist': 'IP白名单',
    'audit': '审计日志',
    'change-password': '修改密码',
    // 项目管理(PM)
    'pm-projects': '项目列表',
    'pm-kanban': '任务看板',
    'pm-timelogs': '工时管理',
}

export const buildMenuItems = (userInfo: any): MenuProps['items'] => {
    const items: MenuProps['items'] = []

    // 1. 我的工作台（所有人可见）
    const myCenter: MenuProps['items'] = []
    myCenter.push({ key: 'my-center', label: '个人中心', icon: getMenuIcon('my-center') })
    myCenter.push({ key: 'my-leaves', label: '我的请假', icon: getMenuIcon('my-leaves') })
    myCenter.push({ key: 'my-reimbursements', label: '我的报销', icon: getMenuIcon('my-reimbursements') })
    myCenter.push({ key: 'my-assets', label: '我的资产', icon: getMenuIcon('my-assets') })
    myCenter.push({ key: 'company-policies', label: '公司制度', icon: getMenuIcon('company-policies') })
    // 有管理权限的用户显示审批菜单
    if (userInfo?.position?.canManageSubordinates === 1) {
        myCenter.push({ key: 'my-approvals', label: '我的审批', icon: getMenuIcon('my-approvals') })
    }
    items.push({ key: 'my', label: '我的工作台', icon: getMenuIcon('my'), children: myCenter })

    // 2. 财务管理
    const finance: MenuProps['items'] = []
    if (hasPermission(userInfo, 'finance', 'flow', 'create')) {
        finance.push({ key: 'flow-create', label: '新建记账', icon: getMenuIcon('flow-create') })
    }
    if (hasPermission(userInfo, 'finance', 'flow', 'view')) {
        finance.push({ key: 'flows', label: '收支明细', icon: getMenuIcon('flows') })
    }
    if (hasPermission(userInfo, 'finance', 'transfer', 'view')) {
        finance.push({ key: 'account-transfer', label: '账户转账', icon: getMenuIcon('account-transfer') })
        finance.push({ key: 'account-transactions', label: '账户明细', icon: getMenuIcon('account-transactions') })
    }
    if (hasPermission(userInfo, 'finance', 'ar', 'view')) {
        finance.push({ key: 'ar', label: '应收账款', icon: getMenuIcon('ar') })
    }
    if (hasPermission(userInfo, 'finance', 'ap', 'view')) {
        finance.push({ key: 'ap', label: '应付账款', icon: getMenuIcon('ap') })
    }
    // 数据导入需要财务数据导入权限
    if (hasPermission(userInfo, 'finance', 'import', 'create')) {
        finance.push({ key: 'import', label: '数据导入', icon: getMenuIcon('import') })
    }
    // 财务基础数据管理 - 整合为财务设置菜单
    if (hasPermission(userInfo, 'system', 'department', 'view')) {
        finance.push({
            key: 'finance-settings',
            label: '财务设置',
            icon: getMenuIcon('finance-settings'),
            children: [
                { key: 'category', label: '类别管理', icon: getMenuIcon('category') },
                { key: 'account', label: '账户管理', icon: getMenuIcon('account') },
                { key: 'currency', label: '币种管理', icon: getMenuIcon('currency') },
                { key: 'vendor', label: '供应商管理', icon: getMenuIcon('vendor') },
            ]
        })
    }
    if (finance.length > 0) {
        items.push({ key: 'finance', label: '财务管理', icon: getMenuIcon('finance'), children: finance })
    }

    // 3. 人力资源
    const employees: MenuProps['items'] = []
    // 组员只能看到自己的请假报销
    if (userInfo?.position?.dataScope === 'self') {
        employees.push({ key: 'employee-leave', label: '我的请假', icon: getMenuIcon('employee-leave') })
        employees.push({ key: 'expense-reimbursement', label: '我的报销', icon: getMenuIcon('expense-reimbursement') })
    } else {
        // 其他职位根据权限显示
        if (hasPermission(userInfo, 'hr', 'employee', 'view')) {
            employees.push({ key: 'employee', label: '人员管理', icon: getMenuIcon('employee') })
        }
        if (hasPermission(userInfo, 'hr', 'salary', 'view')) {
            employees.push({ key: 'employee-salary', label: '员工薪资报表', icon: getMenuIcon('employee-salary') })
            employees.push({ key: 'salary-payments', label: '薪资发放管理', icon: getMenuIcon('salary-payments') })
            employees.push({ key: 'allowance-payments', label: '补贴发放管理', icon: getMenuIcon('allowance-payments') })
        }
        if (hasPermission(userInfo, 'hr', 'leave', 'view')) {
            employees.push({ key: 'employee-leave', label: '请假管理', icon: getMenuIcon('employee-leave') })
        }
        if (hasPermission(userInfo, 'hr', 'reimbursement', 'view')) {
            employees.push({ key: 'expense-reimbursement', label: '报销管理', icon: getMenuIcon('expense-reimbursement') })
        }
    }
    if (employees.length > 0) {
        items.push({ key: 'employees', label: '人力资源', icon: getMenuIcon('employees'), children: employees })
    }

    // 4. 站点管理
    const sites: MenuProps['items'] = []
    if (hasPermission(userInfo, 'site', 'info', 'view')) {
        sites.push({ key: 'site-management', label: '站点管理', icon: getMenuIcon('site-management') })
    }
    if (hasPermission(userInfo, 'site', 'bill', 'view')) {
        sites.push({ key: 'site-bills', label: '站点账单', icon: getMenuIcon('site-bills') })
    }
    if (sites.length > 0) {
        items.push({ key: 'sites', label: '站点管理', icon: getMenuIcon('sites'), children: sites })
    }

    // 5. 资产管理
    const fixedAssets: MenuProps['items'] = []
    if (hasPermission(userInfo, 'asset', 'fixed', 'view')) {
        fixedAssets.push({ key: 'fixed-assets', label: '资产列表', icon: getMenuIcon('fixed-assets') })
        // 隐藏买入/卖出/分配菜单，统一在列表页操作
        // if (hasPermission(userInfo, 'asset', 'fixed', 'create')) {
        //     fixedAssets.push({ key: 'fixed-asset-purchase', label: '资产买入' })
        //     fixedAssets.push({ key: 'fixed-asset-sale', label: '资产卖出' })
        // }
        // if (hasPermission(userInfo, 'asset', 'fixed', 'allocate')) {
        //     fixedAssets.push({ key: 'fixed-asset-allocation', label: '资产分配' })
        // }
    }
    if (hasPermission(userInfo, 'asset', 'rental', 'view')) {
        fixedAssets.push({ key: 'rental-management', label: '租房管理', icon: getMenuIcon('rental-management') })
    }
    if (fixedAssets.length > 0) {
        items.push({ key: 'fixed-assets-menu', label: '资产管理', icon: getMenuIcon('fixed-assets-menu'), children: fixedAssets })
    }

    // 6. 报表中心
    const reports: MenuProps['items'] = []
    // 检查是否有报表查看权限
    if (hasPermission(userInfo, 'report', 'view')) {
        // 财务报表
        reports.push({
            key: 'report-finance',
            label: '财务报表',
            icon: getMenuIcon('report-finance'),
            children: [
                { key: 'report-dept-cash', label: '项目汇总报表', icon: getMenuIcon('report-dept-cash') },
                { key: 'report-account-balance', label: '账户余额报表', icon: getMenuIcon('report-account-balance') },
                { key: 'report-expense-summary', label: '日常支出汇总', icon: getMenuIcon('report-expense-summary') },
                { key: 'report-expense-detail', label: '日常支出明细', icon: getMenuIcon('report-expense-detail') },
            ]
        })

        // 往来报表
        reports.push({
            key: 'report-arap',
            label: '往来报表',
            icon: getMenuIcon('report-arap'),
            children: [
                { key: 'report-ar-summary', label: '应收账款汇总', icon: getMenuIcon('report-ar-summary') },
                { key: 'report-ar-detail', label: '应收账款明细', icon: getMenuIcon('report-ar-detail') },
                { key: 'report-ap-summary', label: '应付账款汇总', icon: getMenuIcon('report-ap-summary') },
                { key: 'report-ap-detail', label: '应付账款明细', icon: getMenuIcon('report-ap-detail') },
            ]
        })

        // 运营报表
        reports.push({
            key: 'report-operation',
            label: '运营报表',
            icon: getMenuIcon('report-operation'),
            children: [
                { key: 'report-site-growth', label: '站点增长报表', icon: getMenuIcon('report-site-growth') },
            ]
        })
    }
    if (reports.length > 0) {
        items.push({ key: 'reports', label: '报表中心', icon: getMenuIcon('reports'), children: reports })
    }

    // 7. 项目管理 (PM)
    const pm: MenuProps['items'] = []
    if (hasPermission(userInfo, 'pm', 'project', 'view')) {
        pm.push({ key: 'pm-projects', label: '项目列表', icon: getMenuIcon('pm-projects') })
    }
    if (hasPermission(userInfo, 'pm', 'task', 'view')) {
        pm.push({ key: 'pm-kanban', label: '任务看板', icon: getMenuIcon('pm-kanban') })
    }
    if (hasPermission(userInfo, 'pm', 'timelog', 'view') || hasPermission(userInfo, 'self', 'timelog', 'view')) {
        pm.push({ key: 'pm-timelogs', label: '工时管理', icon: getMenuIcon('pm-timelogs') })
    }
    if (pm.length > 0) {
        items.push({ key: 'pm', label: '项目管理', icon: getMenuIcon('pm'), children: pm })
    }

    // 8. 系统设置
    const system: MenuProps['items'] = []
    // 基础数据管理
    if (hasPermission(userInfo, 'system', 'department', 'view')) {
        system.push({ key: 'department', label: '项目管理', icon: getMenuIcon('department') })
    }
    // 系统管理：只有总部主管 (DataScope='all') 可见
    if (userInfo?.position?.dataScope === 'all') {
        system.push({ key: 'position-permissions', label: '权限管理', icon: getMenuIcon('position-permissions') })
        system.push({ key: 'email-notification', label: '邮件提醒设置', icon: getMenuIcon('email-notification') })
        system.push({ key: 'ip-whitelist', label: 'IP白名单', icon: getMenuIcon('ip-whitelist') })
        system.push({ key: 'audit', label: '审计日志', icon: getMenuIcon('audit') })
    }
    if (system.length > 0) {
        items.push({ key: 'system', label: '系统设置', icon: getMenuIcon('system'), children: system })
    }

    return items
}

// Map menu key to path
export const KEY_TO_PATH: Record<string, string> = {
    'my-center': '/my/center',
    'my-leaves': '/my/leaves',
    'my-reimbursements': '/my/reimbursements',
    'my-assets': '/my/assets',
    'company-policies': '/my/policies',
    'my-approvals': '/my/approvals',

    'flow-create': '/finance/flows/create',
    'flows': '/finance/flows',
    'account-transfer': '/finance/transfer',
    'account-transactions': '/finance/transactions',
    'import': '/finance/import',
    'ar': '/finance/ar',
    'ap': '/finance/ap',

    'site-management': '/sites/list',
    'site-bills': '/sites/bills',

    'fixed-assets': '/assets/list',
    'rental-management': '/assets/rental',

    'employee': '/hr/employees',
    'employee-salary': '/hr/salary-report',
    'salary-payments': '/hr/salary-payments',
    'allowance-payments': '/hr/allowance-payments',
    'employee-leave': '/hr/leaves',
    'expense-reimbursement': '/hr/reimbursements',

    'report-dept-cash': '/reports/dept-cash',
    'report-site-growth': '/reports/site-growth',
    'report-ar-summary': '/reports/ar-summary',
    'report-ar-detail': '/reports/ar-detail',
    'report-ap-summary': '/reports/ap-summary',
    'report-ap-detail': '/reports/ap-detail',
    'report-expense-summary': '/reports/expense-summary',
    'report-expense-detail': '/reports/expense-detail',
    'report-account-balance': '/reports/account-balance',

    'department': '/system/departments',
    'category': '/system/categories',
    'account': '/system/accounts',
    'currency': '/system/currencies',
    'vendor': '/system/vendors',
    'position-permissions': '/system/permissions',
    'email-notification': '/system/email',
    'ip-whitelist': '/system/ip-whitelist',
    'audit': '/system/audit',
    'change-password': '/change-password',

    // PM
    'pm-projects': '/pm/projects',
    'pm-kanban': '/pm/tasks/kanban',
    'pm-timelogs': '/pm/timelogs',
}

// 反向映射：路径 -> 菜单 key
export const PATH_TO_KEY: Record<string, string> = Object.entries(KEY_TO_PATH).reduce(
    (acc, [key, path]) => {
        acc[path] = key
        return acc
    },
    {} as Record<string, string>
)
