import { createBrowserRouter, Navigate } from 'react-router-dom'
import { MainLayout } from '../layouts/MainLayout'
import { lazy, Suspense } from 'react'
import { Spin } from 'antd'

// Lazy Load Components
// Lazy Load Components
const loaders: Record<string, () => Promise<any>> = {
    // System
    'system/departments': () => import('../features/system/pages/DepartmentManagement').then(m => ({ default: m.DepartmentManagement })),
    'system/categories': () => import('../features/system/pages/CategoryManagement').then(m => ({ default: m.CategoryManagement })),
    'system/accounts': () => import('../features/system/pages/AccountManagement').then(m => ({ default: m.AccountManagement })),
    'system/currencies': () => import('../features/system/pages/CurrencyManagement').then(m => ({ default: m.CurrencyManagement })),
    'system/vendors': () => import('../features/system/pages/VendorManagement').then(m => ({ default: m.VendorManagement })),
    'system/permissions': () => import('../features/system/pages/PositionPermissionsManagement').then(m => ({ default: m.PositionPermissionsManagement })),
    'system/email': () => import('../features/system/pages/EmailNotificationSettings').then(m => ({ default: m.EmailNotificationSettings })),
    'system/ip-whitelist': () => import('../features/system/pages/IPWhitelistManagement'),
    'system/audit': () => import('../features/system/pages/AuditLogs').then(m => ({ default: m.AuditLogs })),

    // Finance
    'finance/flows': () => import('../features/finance/pages/Flows').then(m => ({ default: m.Flows })),
    'finance/transfer': () => import('../features/finance/pages/AccountTransfer').then(m => ({ default: m.AccountTransfer })),
    'finance/transactions': () => import('../features/finance/pages/AccountTransactions').then(m => ({ default: m.AccountTransactions })),
    'finance/import': () => import('../features/finance/pages/ImportCenter').then(m => ({ default: m.ImportCenter })),
    'finance/borrowings': () => import('../features/finance/pages/BorrowingManagement').then(m => ({ default: m.BorrowingManagement })),
    'finance/repayments': () => import('../features/finance/pages/RepaymentManagement').then(m => ({ default: m.RepaymentManagement })),
    'finance/ar': () => import('../features/finance/pages/AR').then(m => ({ default: m.AR })),
    'finance/ap': () => import('../features/finance/pages/AP').then(m => ({ default: m.AP })),

    // Sites
    'sites/list': () => import('../features/sites/pages/SiteManagement').then(m => ({ default: m.SiteManagement })),
    'sites/bills': () => import('../features/sites/pages/SiteBills').then(m => ({ default: m.SiteBills })),

    // Assets
    'assets/list': () => import('../features/assets/pages/FixedAssetsManagement').then(m => ({ default: m.FixedAssetsManagement })),
    'assets/rental': () => import('../features/assets/pages/RentalManagement').then(m => ({ default: m.RentalManagement })),

    // HR
    'hr/employees': () => import('../features/hr/pages/EmployeeManagement').then(m => ({ default: m.EmployeeManagement })),
    'hr/employees/create': () => import('../features/hr/pages/CreateEmployee').then(m => ({ default: m.CreateEmployee })),
    'hr/salary-report': () => import('../features/reports/pages/ReportEmployeeSalary').then(m => ({ default: m.ReportEmployeeSalary })),
    'hr/salary-payments': () => import('../features/hr/pages/SalaryPayments').then(m => ({ default: m.SalaryPayments })),
    'hr/allowance-payments': () => import('../features/hr/pages/AllowancePayments').then(m => ({ default: m.AllowancePayments })),
    'hr/leaves': () => import('../features/hr/pages/LeaveManagement').then(m => ({ default: m.LeaveManagement })),
    'hr/reimbursements': () => import('../features/hr/pages/ExpenseReimbursement').then(m => ({ default: m.ExpenseReimbursement })),

    // Reports
    'reports/dept-cash': () => import('../features/reports/pages/ReportDepartmentCash').then(m => ({ default: m.ReportDepartmentCash })),
    'reports/site-growth': () => import('../features/reports/pages/ReportSiteGrowth').then(m => ({ default: m.ReportSiteGrowth })),
    'reports/ar-summary': () => import('../features/reports/pages/ReportARSummary').then(m => ({ default: m.ReportARSummary })),
    'reports/ar-detail': () => import('../features/reports/pages/ReportARDetail').then(m => ({ default: m.ReportARDetail })),
    'reports/ap-summary': () => import('../features/reports/pages/ReportAPSummary').then(m => ({ default: m.ReportAPSummary })),
    'reports/ap-detail': () => import('../features/reports/pages/ReportAPDetail').then(m => ({ default: m.ReportAPDetail })),
    'reports/expense-summary': () => import('../features/reports/pages/ReportExpenseSummary').then(m => ({ default: m.ReportExpenseSummary })),
    'reports/expense-detail': () => import('../features/reports/pages/ReportExpenseDetail').then(m => ({ default: m.ReportExpenseDetail })),
    'reports/account-balance': () => import('../features/reports/pages/ReportAccountBalance').then(m => ({ default: m.ReportAccountBalance })),
    'reports/borrowing': () => import('../features/reports/pages/ReportBorrowing').then(m => ({ default: m.ReportBorrowing })),

    // My
    'my/center': () => import('../features/my/pages/MyCenter').then(m => ({ default: m.MyCenter })),
    'my/leaves': () => import('../features/my/pages/MyLeaves').then(m => ({ default: m.MyLeaves })),
    'my/reimbursements': () => import('../features/my/pages/MyReimbursements').then(m => ({ default: m.MyReimbursements })),
    'my/borrowings': () => import('../features/my/pages/MyBorrowings').then(m => ({ default: m.MyBorrowings })),
    'my/assets': () => import('../features/my/pages/MyAssets').then(m => ({ default: m.MyAssets })),
    'my/policies': () => import('../features/my/pages/CompanyPolicies').then(m => ({ default: m.CompanyPolicies })),
    'my/approvals': () => import('../features/my/pages/MyApprovals').then(m => ({ default: m.MyApprovals })),

    // Dashboard & Auth
    'dashboard': () => import('../features/dashboard/pages/Dashboard').then(m => ({ default: m.Dashboard })),
    'change-password': () => import('../features/auth/pages/ChangePassword').then(m => ({ default: m.ChangePassword })),
    'login': () => import('../features/auth/pages/Login').then(m => ({ default: m.Login })),
    'auth/activate': () => import('../features/auth/pages/ActivateAccount').then(m => ({ default: m.ActivateAccount })),
    'auth/reset-password': () => import('../features/auth/pages/ResetPassword').then(m => ({ default: m.ResetPassword })),
    'auth/request-totp-reset': () => import('../features/auth/pages/RequestTotpReset').then(m => ({ default: m.RequestTotpReset })),
    'auth/reset-totp': () => import('../features/auth/pages/ResetTotpConfirm').then(m => ({ default: m.ResetTotpConfirm })),
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
const AccountTransfer = lazy(loaders['finance/transfer'])
const AccountTransactions = lazy(loaders['finance/transactions'])
const ImportCenter = lazy(loaders['finance/import'])
const BorrowingManagement = lazy(loaders['finance/borrowings'])
const RepaymentManagement = lazy(loaders['finance/repayments'])
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
const CreateEmployee = lazy(loaders['hr/employees/create'])
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
const ReportBorrowing = lazy(loaders['reports/borrowing'])

// My
const MyCenter = lazy(loaders['my/center'])
const MyLeaves = lazy(loaders['my/leaves'])
const MyReimbursements = lazy(loaders['my/reimbursements'])
const MyBorrowings = lazy(loaders['my/borrowings'])
const MyAssets = lazy(loaders['my/assets'])
const CompanyPolicies = lazy(loaders['my/policies'])
const MyApprovals = lazy(loaders['my/approvals'])
const Dashboard = lazy(loaders['dashboard'])
const ChangePassword = lazy(loaders['change-password'])
const Login = lazy(loaders['login'])
const ActivateAccount = lazy(loaders['auth/activate'])
const ResetPassword = lazy(loaders['auth/reset-password'])
const RequestTotpReset = lazy(loaders['auth/request-totp-reset'])
const ResetTotpConfirm = lazy(loaders['auth/reset-totp'])

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

import { SkeletonLoading } from '../components/SkeletonLoading'

const Loading = () => <SkeletonLoading />

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
            { index: true, element: <Navigate to="/dashboard" replace /> },
            { path: 'dashboard', element: <Suspense fallback={<Loading />}><Dashboard /></Suspense> },
            { path: 'change-password', element: <Suspense fallback={<Loading />}><ChangePassword /></Suspense> },

            // My
            { path: 'my/center', element: <Suspense fallback={<Loading />}><MyCenter /></Suspense> },
            { path: 'my/leaves', element: <Suspense fallback={<Loading />}><MyLeaves /></Suspense> },
            { path: 'my/reimbursements', element: <Suspense fallback={<Loading />}><MyReimbursements /></Suspense> },
            { path: 'my/borrowings', element: <Suspense fallback={<Loading />}><MyBorrowings /></Suspense> },
            { path: 'my/assets', element: <Suspense fallback={<Loading />}><MyAssets /></Suspense> },
            { path: 'my/policies', element: <Suspense fallback={<Loading />}><CompanyPolicies /></Suspense> },
            { path: 'my/approvals', element: <Suspense fallback={<Loading />}><MyApprovals /></Suspense> },

            // Finance
            { path: 'finance/flows', element: <Suspense fallback={<Loading />}><Flows /></Suspense> },
            { path: 'finance/transfer', element: <Suspense fallback={<Loading />}><AccountTransfer /></Suspense> },
            { path: 'finance/transactions', element: <Suspense fallback={<Loading />}><AccountTransactions /></Suspense> },
            { path: 'finance/import', element: <Suspense fallback={<Loading />}><ImportCenter /></Suspense> },
            { path: 'finance/borrowings', element: <Suspense fallback={<Loading />}><BorrowingManagement /></Suspense> },
            { path: 'finance/repayments', element: <Suspense fallback={<Loading />}><RepaymentManagement /></Suspense> },
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
            { path: 'hr/employees/create', element: <Suspense fallback={<Loading />}><CreateEmployee /></Suspense> },
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
            { path: 'reports/borrowing', element: <Suspense fallback={<Loading />}><ReportBorrowing /></Suspense> },

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
        ]
    }
])
