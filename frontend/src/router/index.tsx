import { createBrowserRouter, Navigate } from 'react-router-dom'
import { MainLayout } from '../layouts/MainLayout'
import { lazy, Suspense } from 'react'
import { Spin } from 'antd'

// Lazy Load Components
// Lazy Load Components
const loaders: Record<string, () => Promise<any>> = {
    // System
    'system/departments': () => import('../features/system/pages/DepartmentManagementPage').then(m => ({ default: m.DepartmentManagement })),
    'system/categories': () => import('../features/system/pages/CategoryManagementPage').then(m => ({ default: m.CategoryManagement })),
    'system/accounts': () => import('../features/system/pages/AccountManagementPage').then(m => ({ default: m.AccountManagement })),
    'system/currencies': () => import('../features/system/pages/CurrencyManagementPage').then(m => ({ default: m.CurrencyManagement })),
    'system/vendors': () => import('../features/system/pages/VendorManagementPage').then(m => ({ default: m.VendorManagement })),
    'system/permissions': () => import('../features/system/pages/PositionPermissionsManagementPage').then(m => ({ default: m.PositionPermissionsManagement })),
    'system/email': () => import('../features/system/pages/EmailNotificationSettingsPage').then(m => ({ default: m.EmailNotificationSettings })),
    'system/ip-whitelist': () => import('../features/system/pages/IPWhitelistManagementPage'),
    'system/audit': () => import('../features/system/pages/AuditLogsPage').then(m => ({ default: m.AuditLogs })),

    // Finance
    'finance/flows': () => import('../features/finance/pages/FlowsPage').then(m => ({ default: m.Flows })),
    'finance/flows/create': () => import('../features/finance/pages/FlowCreatePage').then(m => ({ default: m.FlowCreate })),
    'finance/transfer': () => import('../features/finance/pages/AccountTransferPage').then(m => ({ default: m.AccountTransfer })),
    'finance/transactions': () => import('../features/finance/pages/AccountTransactionsPage').then(m => ({ default: m.AccountTransactions })),
    'finance/import': () => import('../features/finance/pages/ImportCenterPage').then(m => ({ default: m.ImportCenter })),
    'finance/ar': () => import('../features/finance/pages/ARPage').then(m => ({ default: m.AR })),
    'finance/ap': () => import('../features/finance/pages/APPage').then(m => ({ default: m.AP })),

    // Sites
    'sites/list': () => import('../features/sites/pages/SiteManagementPage').then(m => ({ default: m.SiteManagement })),
    'sites/bills': () => import('../features/sites/pages/SiteBillsPage').then(m => ({ default: m.SiteBills })),

    // Assets
    'assets/list': () => import('../features/assets/pages/FixedAssetsManagementPage').then(m => ({ default: m.FixedAssetsManagement })),
    'assets/rental': () => import('../features/assets/pages/RentalManagementPage').then(m => ({ default: m.RentalManagement })),

    // HR
    'hr/employees': () => import('../features/hr/pages/EmployeeManagementPage').then(m => ({ default: m.EmployeeManagement })),
    'hr/salary-report': () => import('../features/reports/pages/ReportEmployeeSalaryPage').then(m => ({ default: m.ReportEmployeeSalary })),
    'hr/salary-payments': () => import('../features/hr/pages/SalaryPaymentsPage').then(m => ({ default: m.SalaryPayments })),
    'hr/allowance-payments': () => import('../features/hr/pages/AllowancePaymentsPage').then(m => ({ default: m.AllowancePayments })),
    'hr/leaves': () => import('../features/hr/pages/LeaveManagementPage').then(m => ({ default: m.LeaveManagement })),
    'hr/reimbursements': () => import('../features/hr/pages/ExpenseReimbursementPage').then(m => ({ default: m.ExpenseReimbursement })),

    // Reports
    'reports/dept-cash': () => import('../features/reports/pages/ReportDepartmentCashPage').then(m => ({ default: m.ReportDepartmentCash })),
    'reports/site-growth': () => import('../features/reports/pages/ReportSiteGrowthPage').then(m => ({ default: m.ReportSiteGrowth })),
    'reports/ar-summary': () => import('../features/reports/pages/ReportARSummaryPage').then(m => ({ default: m.ReportARSummary })),
    'reports/ar-detail': () => import('../features/reports/pages/ReportARDetailPage').then(m => ({ default: m.ReportARDetail })),
    'reports/ap-summary': () => import('../features/reports/pages/ReportAPSummaryPage').then(m => ({ default: m.ReportAPSummary })),
    'reports/ap-detail': () => import('../features/reports/pages/ReportAPDetailPage').then(m => ({ default: m.ReportAPDetail })),
    'reports/expense-summary': () => import('../features/reports/pages/ReportExpenseSummaryPage').then(m => ({ default: m.ReportExpenseSummary })),
    'reports/expense-detail': () => import('../features/reports/pages/ReportExpenseDetailPage').then(m => ({ default: m.ReportExpenseDetail })),
    'reports/account-balance': () => import('../features/reports/pages/ReportAccountBalancePage').then(m => ({ default: m.ReportAccountBalance })),

    // My
    'my/center': () => import('../features/my/pages/MyCenterPage').then(m => ({ default: m.MyCenter })),
    'my/leaves': () => import('../features/my/pages/MyLeavesPage').then(m => ({ default: m.MyLeaves })),
    'my/reimbursements': () => import('../features/my/pages/MyReimbursementsPage').then(m => ({ default: m.MyReimbursements })),
    'my/assets': () => import('../features/my/pages/MyAssetsPage').then(m => ({ default: m.MyAssets })),
    'my/policies': () => import('../features/my/pages/CompanyPoliciesPage').then(m => ({ default: m.CompanyPolicies })),
    'my/approvals': () => import('../features/my/pages/MyApprovalsPage').then(m => ({ default: m.MyApprovals })),

    // PM (项目管理)
    'pm/config': () => import('../features/system/pages/DepartmentManagementPage').then(m => ({ default: m.DepartmentManagement })),
    'pm/projects': () => import('../features/pm/pages/ProjectListPage'),
    'pm/projects/:id': () => import('../features/pm/pages/ProjectDetailPage'),
    'pm/tasks/kanban': () => import('../features/pm/pages/TaskKanbanPage'),
    'pm/tasks/new': () => import('../features/pm/pages/TaskFormPage'),
    'pm/tasks/:id/edit': () => import('../features/pm/pages/TaskFormPage'),
    'pm/timelogs': () => import('../features/pm/pages/TimelogPage'),

    // Auth
    'change-password': () => import('../features/auth/pages/ChangePasswordPage').then(m => ({ default: m.ChangePassword })),
    'login': () => import('../features/auth/pages/LoginPage').then(m => ({ default: m.Login })),
    'auth/activate': () => import('../features/auth/pages/ActivateAccountPage').then(m => ({ default: m.ActivateAccount })),
    'auth/reset-password': () => import('../features/auth/pages/ResetPasswordPage').then(m => ({ default: m.ResetPassword })),
    'auth/request-totp-reset': () => import('../features/auth/pages/RequestTotpResetPage').then(m => ({ default: m.RequestTotpReset })),
    'auth/reset-totp': () => import('../features/auth/pages/ResetTotpConfirmPage').then(m => ({ default: m.ResetTotpConfirm })),
}

// System
const DepartmentManagement = lazy(loaders['system/departments'])
const CategoryManagement = lazy(loaders['system/categories'])
const AccountManagement = lazy(loaders['system/accounts'])
const CurrencyManagement = lazy(loaders['system/currencies'])
const VendorManagement = lazy(loaders['system/vendors'])
const PositionPermissionsManagement = lazy(loaders['system/permissions'])
const EmailNotificationSettings = lazy(loaders['system/email'])
const IPWhitelistManagement = lazy(loaders['system/ip-whitelist'])
const AuditLogs = lazy(loaders['system/audit'])

// Finance
const Flows = lazy(loaders['finance/flows'])
const FlowCreate = lazy(loaders['finance/flows/create'])
const AccountTransfer = lazy(loaders['finance/transfer'])
const AccountTransactions = lazy(loaders['finance/transactions'])
const ImportCenter = lazy(loaders['finance/import'])
const AR = lazy(loaders['finance/ar'])
const AP = lazy(loaders['finance/ap'])

// Sites
const SiteManagement = lazy(loaders['sites/list'])
const SiteBills = lazy(loaders['sites/bills'])

// Assets
const FixedAssetsManagement = lazy(loaders['assets/list'])
const RentalManagement = lazy(loaders['assets/rental'])

// HR
const EmployeeManagement = lazy(loaders['hr/employees'])
const ReportEmployeeSalary = lazy(loaders['hr/salary-report'])
const SalaryPayments = lazy(loaders['hr/salary-payments'])
const AllowancePayments = lazy(loaders['hr/allowance-payments'])
const LeaveManagement = lazy(loaders['hr/leaves'])
const ExpenseReimbursement = lazy(loaders['hr/reimbursements'])

// Reports
const ReportDepartmentCash = lazy(loaders['reports/dept-cash'])
const ReportSiteGrowth = lazy(loaders['reports/site-growth'])
const ReportARSummary = lazy(loaders['reports/ar-summary'])
const ReportARDetail = lazy(loaders['reports/ar-detail'])
const ReportAPSummary = lazy(loaders['reports/ap-summary'])
const ReportAPDetail = lazy(loaders['reports/ap-detail'])
const ReportExpenseSummary = lazy(loaders['reports/expense-summary'])
const ReportExpenseDetail = lazy(loaders['reports/expense-detail'])
const ReportAccountBalance = lazy(loaders['reports/account-balance'])

// My
const MyCenter = lazy(loaders['my/center'])
const MyLeaves = lazy(loaders['my/leaves'])
const MyReimbursements = lazy(loaders['my/reimbursements'])
const MyAssets = lazy(loaders['my/assets'])
const CompanyPolicies = lazy(loaders['my/policies'])
const MyApprovals = lazy(loaders['my/approvals'])
const ChangePassword = lazy(loaders['change-password'])
const Login = lazy(loaders['login'])
const ActivateAccount = lazy(loaders['auth/activate'])
const ResetPassword = lazy(loaders['auth/reset-password'])
const RequestTotpReset = lazy(loaders['auth/request-totp-reset'])
const ResetTotpConfirm = lazy(loaders['auth/reset-totp'])

// PM
const ProjectConfigPage = lazy(loaders['pm/config'])
const ProjectListPage = lazy(loaders['pm/projects'])
const ProjectDetailPage = lazy(loaders['pm/projects/:id'])
const TaskKanbanPage = lazy(loaders['pm/tasks/kanban'])
const TaskFormPage = lazy(loaders['pm/tasks/new'])
const TimelogPage = lazy(loaders['pm/timelogs'])

/**
 * 预加载路由组件
 * @param path 路由路径 (config/menu.ts key)
 */
export const preloadRoute = (path: string) => {
    const loader = loaders[path]
    if (loader) {
        loader()
    }
}



const Loading = () => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spin size="large" />
    </div>
)

import { PrivateRoute } from './PrivateRoute'

export const router = createBrowserRouter([
    {
        path: '/login',
        element: <Suspense fallback={<Loading />}><Login /></Suspense>,
    },
    {
        path: '/auth/activate',
        element: <Suspense fallback={<Loading />}><ActivateAccount /></Suspense>,
    },

    {
        path: '/auth/reset-password',
        element: <Suspense fallback={<Loading />}><ResetPassword /></Suspense>,
    },
    {
        path: '/auth/request-totp-reset',
        element: <Suspense fallback={<Loading />}><RequestTotpReset /></Suspense>,
    },
    {
        path: '/auth/reset-totp',
        element: <Suspense fallback={<Loading />}><ResetTotpConfirm /></Suspense>,
    },
    {
        path: '/',
        element: <PrivateRoute><MainLayout /></PrivateRoute>,
        children: [
            { index: true, element: <Navigate to="/my/center" replace /> },
            { path: 'change-password', element: <Suspense fallback={<Loading />}><ChangePassword /></Suspense> },

            // My
            { path: 'my/center', element: <Suspense fallback={<Loading />}><MyCenter /></Suspense> },
            { path: 'my/leaves', element: <Suspense fallback={<Loading />}><MyLeaves /></Suspense> },
            { path: 'my/reimbursements', element: <Suspense fallback={<Loading />}><MyReimbursements /></Suspense> },
            { path: 'my/assets', element: <Suspense fallback={<Loading />}><MyAssets /></Suspense> },
            { path: 'my/policies', element: <Suspense fallback={<Loading />}><CompanyPolicies /></Suspense> },
            { path: 'my/approvals', element: <Suspense fallback={<Loading />}><MyApprovals /></Suspense> },

            // Finance
            { path: 'finance/flows', element: <Suspense fallback={<Loading />}><Flows /></Suspense> },
            { path: 'finance/flows/create', element: <Suspense fallback={<Loading />}><FlowCreate /></Suspense> },
            { path: 'finance/transfer', element: <Suspense fallback={<Loading />}><AccountTransfer /></Suspense> },
            { path: 'finance/transactions', element: <Suspense fallback={<Loading />}><AccountTransactions /></Suspense> },
            { path: 'finance/import', element: <Suspense fallback={<Loading />}><ImportCenter /></Suspense> },
            { path: 'finance/ar', element: <Suspense fallback={<Loading />}><AR /></Suspense> },
            { path: 'finance/ap', element: <Suspense fallback={<Loading />}><AP /></Suspense> },

            // Sites
            { path: 'sites/list', element: <Suspense fallback={<Loading />}><SiteManagement /></Suspense> },
            { path: 'sites/bills', element: <Suspense fallback={<Loading />}><SiteBills /></Suspense> },

            // Assets
            { path: 'assets/list', element: <Suspense fallback={<Loading />}><FixedAssetsManagement /></Suspense> },
            { path: 'assets/rental', element: <Suspense fallback={<Loading />}><RentalManagement /></Suspense> },

            // HR
            { path: 'hr/employees', element: <Suspense fallback={<Loading />}><EmployeeManagement /></Suspense> },
            { path: 'hr/salary-report', element: <Suspense fallback={<Loading />}><ReportEmployeeSalary /></Suspense> },
            { path: 'hr/salary-payments', element: <Suspense fallback={<Loading />}><SalaryPayments /></Suspense> },
            { path: 'hr/allowance-payments', element: <Suspense fallback={<Loading />}><AllowancePayments /></Suspense> },
            { path: 'hr/leaves', element: <Suspense fallback={<Loading />}><LeaveManagement /></Suspense> },
            { path: 'hr/reimbursements', element: <Suspense fallback={<Loading />}><ExpenseReimbursement /></Suspense> },

            // Reports
            { path: 'reports/dept-cash', element: <Suspense fallback={<Loading />}><ReportDepartmentCash /></Suspense> },
            { path: 'reports/site-growth', element: <Suspense fallback={<Loading />}><ReportSiteGrowth /></Suspense> },
            { path: 'reports/ar-summary', element: <Suspense fallback={<Loading />}><ReportARSummary /></Suspense> },
            { path: 'reports/ar-detail', element: <Suspense fallback={<Loading />}><ReportARDetail /></Suspense> },
            { path: 'reports/ap-summary', element: <Suspense fallback={<Loading />}><ReportAPSummary /></Suspense> },
            { path: 'reports/ap-detail', element: <Suspense fallback={<Loading />}><ReportAPDetail /></Suspense> },
            { path: 'reports/expense-summary', element: <Suspense fallback={<Loading />}><ReportExpenseSummary /></Suspense> },
            { path: 'reports/expense-detail', element: <Suspense fallback={<Loading />}><ReportExpenseDetail /></Suspense> },
            { path: 'reports/account-balance', element: <Suspense fallback={<Loading />}><ReportAccountBalance /></Suspense> },

            // System
            { path: 'system/departments', element: <Suspense fallback={<Loading />}><DepartmentManagement /></Suspense> },
            { path: 'system/categories', element: <Suspense fallback={<Loading />}><CategoryManagement /></Suspense> },
            { path: 'system/accounts', element: <Suspense fallback={<Loading />}><AccountManagement /></Suspense> },
            { path: 'system/currencies', element: <Suspense fallback={<Loading />}><CurrencyManagement /></Suspense> },
            { path: 'system/vendors', element: <Suspense fallback={<Loading />}><VendorManagement /></Suspense> },
            { path: 'system/permissions', element: <Suspense fallback={<Loading />}><PositionPermissionsManagement /></Suspense> },
            { path: 'system/email', element: <Suspense fallback={<Loading />}><EmailNotificationSettings /></Suspense> },
            { path: 'system/ip-whitelist', element: <Suspense fallback={<Loading />}><IPWhitelistManagement /></Suspense> },
            { path: 'system/audit', element: <Suspense fallback={<Loading />}><AuditLogs /></Suspense> },

            // PM (项目管理)
            { path: 'pm/config', element: <Suspense fallback={<Loading />}><ProjectConfigPage /></Suspense> },
            { path: 'pm/projects', element: <Suspense fallback={<Loading />}><ProjectListPage /></Suspense> },
            { path: 'pm/projects/:id', element: <Suspense fallback={<Loading />}><ProjectDetailPage /></Suspense> },
            { path: 'pm/tasks/kanban', element: <Suspense fallback={<Loading />}><TaskKanbanPage /></Suspense> },
            { path: 'pm/tasks/new', element: <Suspense fallback={<Loading />}><TaskFormPage /></Suspense> },
            { path: 'pm/tasks/:id/edit', element: <Suspense fallback={<Loading />}><TaskFormPage /></Suspense> },
            { path: 'pm/timelogs', element: <Suspense fallback={<Loading />}><TimelogPage /></Suspense> },
        ]
    }
])
