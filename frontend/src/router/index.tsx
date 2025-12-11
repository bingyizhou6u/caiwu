import { createBrowserRouter, Navigate } from 'react-router-dom'
import { MainLayout } from '../layouts/MainLayout'
import { Login } from '../features/auth/pages/Login'
import { lazy, Suspense } from 'react'
import { Spin } from 'antd'

// Lazy Load Components
// System
const DepartmentManagement = lazy(() => import('../features/system/pages/DepartmentManagement').then(m => ({ default: m.DepartmentManagement })))
const CategoryManagement = lazy(() => import('../features/system/pages/CategoryManagement').then(m => ({ default: m.CategoryManagement })))
const AccountManagement = lazy(() => import('../features/system/pages/AccountManagement').then(m => ({ default: m.AccountManagement })))
const CurrencyManagement = lazy(() => import('../features/system/pages/CurrencyManagement').then(m => ({ default: m.CurrencyManagement })))
const VendorManagement = lazy(() => import('../features/system/pages/VendorManagement').then(m => ({ default: m.VendorManagement })))
const PositionPermissionsManagement = lazy(() => import('../features/system/pages/PositionPermissionsManagement').then(m => ({ default: m.PositionPermissionsManagement })))
const EmailNotificationSettings = lazy(() => import('../features/system/pages/EmailNotificationSettings').then(m => ({ default: m.EmailNotificationSettings })))
const IPWhitelistManagement = lazy(() => import('../features/system/pages/IPWhitelistManagement'))
const AuditLogs = lazy(() => import('../features/system/pages/AuditLogs').then(m => ({ default: m.AuditLogs })))

// Finance
const Flows = lazy(() => import('../features/finance/pages/Flows').then(m => ({ default: m.Flows })))
const AccountTransfer = lazy(() => import('../features/finance/pages/AccountTransfer').then(m => ({ default: m.AccountTransfer })))
const AccountTransactions = lazy(() => import('../features/finance/pages/AccountTransactions').then(m => ({ default: m.AccountTransactions })))
const ImportCenter = lazy(() => import('../features/finance/pages/ImportCenter').then(m => ({ default: m.ImportCenter })))
const BorrowingManagement = lazy(() => import('../features/finance/pages/BorrowingManagement').then(m => ({ default: m.BorrowingManagement })))
const RepaymentManagement = lazy(() => import('../features/finance/pages/RepaymentManagement').then(m => ({ default: m.RepaymentManagement })))
const AR = lazy(() => import('../features/finance/pages/AR').then(m => ({ default: m.AR })))
const AP = lazy(() => import('../features/finance/pages/AP').then(m => ({ default: m.AP })))

// Sites
const SiteManagement = lazy(() => import('../features/sites/pages/SiteManagement').then(m => ({ default: m.SiteManagement })))
const SiteBills = lazy(() => import('../features/sites/pages/SiteBills').then(m => ({ default: m.SiteBills })))

// Assets
const FixedAssetsManagement = lazy(() => import('../features/assets/pages/FixedAssetsManagement').then(m => ({ default: m.FixedAssetsManagement })))
const RentalManagement = lazy(() => import('../features/assets/pages/RentalManagement').then(m => ({ default: m.RentalManagement })))

// HR
const EmployeeManagement = lazy(() => import('../features/hr/pages/EmployeeManagement').then(m => ({ default: m.EmployeeManagement })))
const CreateEmployee = lazy(() => import('../features/hr/pages/CreateEmployee').then(m => ({ default: m.CreateEmployee })))
const ReportEmployeeSalary = lazy(() => import('../features/reports/pages/ReportEmployeeSalary').then(m => ({ default: m.ReportEmployeeSalary })))
const SalaryPayments = lazy(() => import('../features/hr/pages/SalaryPayments').then(m => ({ default: m.SalaryPayments })))
const AllowancePayments = lazy(() => import('../features/hr/pages/AllowancePayments').then(m => ({ default: m.AllowancePayments })))
const LeaveManagement = lazy(() => import('../features/hr/pages/LeaveManagement').then(m => ({ default: m.LeaveManagement })))
const ExpenseReimbursement = lazy(() => import('../features/hr/pages/ExpenseReimbursement').then(m => ({ default: m.ExpenseReimbursement })))

// Reports
const ReportDepartmentCash = lazy(() => import('../features/reports/pages/ReportDepartmentCash').then(m => ({ default: m.ReportDepartmentCash })))
const ReportSiteGrowth = lazy(() => import('../features/reports/pages/ReportSiteGrowth').then(m => ({ default: m.ReportSiteGrowth })))
const ReportARSummary = lazy(() => import('../features/reports/pages/ReportARSummary').then(m => ({ default: m.ReportARSummary })))
const ReportARDetail = lazy(() => import('../features/reports/pages/ReportARDetail').then(m => ({ default: m.ReportARDetail })))
const ReportAPSummary = lazy(() => import('../features/reports/pages/ReportAPSummary').then(m => ({ default: m.ReportAPSummary })))
const ReportAPDetail = lazy(() => import('../features/reports/pages/ReportAPDetail').then(m => ({ default: m.ReportAPDetail })))
const ReportExpenseSummary = lazy(() => import('../features/reports/pages/ReportExpenseSummary').then(m => ({ default: m.ReportExpenseSummary })))
const ReportExpenseDetail = lazy(() => import('../features/reports/pages/ReportExpenseDetail').then(m => ({ default: m.ReportExpenseDetail })))
const ReportAccountBalance = lazy(() => import('../features/reports/pages/ReportAccountBalance').then(m => ({ default: m.ReportAccountBalance })))
const ReportBorrowing = lazy(() => import('../features/reports/pages/ReportBorrowing').then(m => ({ default: m.ReportBorrowing })))

// My
const MyCenter = lazy(() => import('../features/my/pages/MyCenter').then(m => ({ default: m.MyCenter })))
const MyLeaves = lazy(() => import('../features/my/pages/MyLeaves').then(m => ({ default: m.MyLeaves })))
const MyReimbursements = lazy(() => import('../features/my/pages/MyReimbursements').then(m => ({ default: m.MyReimbursements })))
const MyBorrowings = lazy(() => import('../features/my/pages/MyBorrowings').then(m => ({ default: m.MyBorrowings })))
const MyAssets = lazy(() => import('../features/my/pages/MyAssets').then(m => ({ default: m.MyAssets })))

const CompanyPolicies = lazy(() => import('../features/my/pages/CompanyPolicies').then(m => ({ default: m.CompanyPolicies })))
const MyApprovals = lazy(() => import('../features/my/pages/MyApprovals').then(m => ({ default: m.MyApprovals })))
const Dashboard = lazy(() => import('../features/dashboard/pages/Dashboard').then(m => ({ default: m.Dashboard })))
const ChangePassword = lazy(() => import('../features/auth/pages/ChangePassword').then(m => ({ default: m.ChangePassword })))
const ActivateAccount = lazy(() => import('../features/auth/pages/ActivateAccount').then(m => ({ default: m.ActivateAccount })))

const ResetPassword = lazy(() => import('../features/auth/pages/ResetPassword').then(m => ({ default: m.ResetPassword })))
const RequestTotpReset = lazy(() => import('../features/auth/pages/RequestTotpReset').then(m => ({ default: m.RequestTotpReset })))
const ResetTotpConfirm = lazy(() => import('../features/auth/pages/ResetTotpConfirm').then(m => ({ default: m.ResetTotpConfirm })))

const Loading = () => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 400 }}>
        <Spin size="large" />
    </div>
)

import { PrivateRoute } from './PrivateRoute'

export const router = createBrowserRouter([
    {
        path: '/login',
        element: <Login />,
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
