import React, { lazy, Suspense } from 'react'
import { Spin } from 'antd'

// Lazy load components
const Dashboard = lazy(() => import('../pages/Dashboard').then(m => ({ default: m.Dashboard })))
const Flows = lazy(() => import('../pages/Flows').then(m => ({ default: m.Flows })))
const AccountTransactions = lazy(() => import('../pages/AccountTransactions').then(m => ({ default: m.AccountTransactions })))
const AccountTransfer = lazy(() => import('../pages/AccountTransfer').then(m => ({ default: m.AccountTransfer })))
const AR = lazy(() => import('../pages/AR').then(m => ({ default: m.AR })))
const AP = lazy(() => import('../pages/AP').then(m => ({ default: m.AP })))
const ImportCenter = lazy(() => import('../pages/ImportCenter').then(m => ({ default: m.ImportCenter })))
const OrgDepartmentManagement = lazy(() => import('../pages/OrgDepartmentManagement').then(m => ({ default: m.OrgDepartmentManagement })))
const DepartmentManagement = lazy(() => import('../pages/DepartmentManagement').then(m => ({ default: m.DepartmentManagement })))
const SiteManagement = lazy(() => import('../pages/SiteManagement').then(m => ({ default: m.SiteManagement })))
const SiteBills = lazy(() => import('../pages/SiteBills').then(m => ({ default: m.SiteBills })))
const CategoryManagement = lazy(() => import('../pages/CategoryManagement').then(m => ({ default: m.CategoryManagement })))
const AccountManagement = lazy(() => import('../pages/AccountManagement').then(m => ({ default: m.AccountManagement })))
const CurrencyManagement = lazy(() => import('../pages/CurrencyManagement').then(m => ({ default: m.CurrencyManagement })))
const AuditLogs = lazy(() => import('../pages/AuditLogs').then(m => ({ default: m.AuditLogs })))
const VendorManagement = lazy(() => import('../pages/VendorManagement').then(m => ({ default: m.VendorManagement })))
const EmployeeManagement = lazy(() => import('../pages/EmployeeManagement').then(m => ({ default: m.EmployeeManagement })))
const BorrowingManagement = lazy(() => import('../pages/BorrowingManagement').then(m => ({ default: m.BorrowingManagement })))
const RepaymentManagement = lazy(() => import('../pages/RepaymentManagement').then(m => ({ default: m.RepaymentManagement })))
const LeaveManagement = lazy(() => import('../pages/LeaveManagement').then(m => ({ default: m.LeaveManagement })))
const ExpenseReimbursement = lazy(() => import('../pages/ExpenseReimbursement').then(m => ({ default: m.ExpenseReimbursement })))
const SalaryPayments = lazy(() => import('../pages/SalaryPayments').then(m => ({ default: m.SalaryPayments })))
const AllowancePayments = lazy(() => import('../pages/AllowancePayments').then(m => ({ default: m.AllowancePayments })))
const IPWhitelistManagement = lazy(() => import('../pages/IPWhitelistManagement'))
const FixedAssetsManagement = lazy(() => import('../pages/FixedAssetsManagement').then(m => ({ default: m.FixedAssetsManagement })))
const FixedAssetPurchase = lazy(() => import('../pages/FixedAssetPurchase').then(m => ({ default: m.FixedAssetPurchase })))
const FixedAssetSale = lazy(() => import('../pages/FixedAssetSale').then(m => ({ default: m.FixedAssetSale })))
const FixedAssetAllocation = lazy(() => import('../pages/FixedAssetAllocation').then(m => ({ default: m.FixedAssetAllocation })))
const RentalManagement = lazy(() => import('../pages/RentalManagement').then(m => ({ default: m.RentalManagement })))
const PositionPermissionsManagement = lazy(() => import('../pages/PositionPermissionsManagement').then(m => ({ default: m.PositionPermissionsManagement })))
const EmailNotificationSettings = lazy(() => import('../pages/EmailNotificationSettings').then(m => ({ default: m.EmailNotificationSettings })))
const SiteConfigManagement = lazy(() => import('../pages/SiteConfigManagement'))
const CompanyPolicies = lazy(() => import('../pages/CompanyPolicies'))
const ReportDepartmentCash = lazy(() => import('../pages/reports/ReportDepartmentCash').then(m => ({ default: m.ReportDepartmentCash })))
const ReportSiteGrowth = lazy(() => import('../pages/reports/ReportSiteGrowth').then(m => ({ default: m.ReportSiteGrowth })))
const ReportARSummary = lazy(() => import('../pages/reports/ReportARSummary').then(m => ({ default: m.ReportARSummary })))
const ReportARDetail = lazy(() => import('../pages/reports/ReportARDetail').then(m => ({ default: m.ReportARDetail })))
const ReportAPSummary = lazy(() => import('../pages/reports/ReportAPSummary').then(m => ({ default: m.ReportAPSummary })))
const ReportAPDetail = lazy(() => import('../pages/reports/ReportAPDetail').then(m => ({ default: m.ReportAPDetail })))
const ReportExpenseSummary = lazy(() => import('../pages/reports/ReportExpenseSummary').then(m => ({ default: m.ReportExpenseSummary })))
const ReportExpenseDetail = lazy(() => import('../pages/reports/ReportExpenseDetail').then(m => ({ default: m.ReportExpenseDetail })))
const ReportAccountBalance = lazy(() => import('../pages/reports/ReportAccountBalance').then(m => ({ default: m.ReportAccountBalance })))
const ReportBorrowing = lazy(() => import('../pages/reports/ReportBorrowing').then(m => ({ default: m.ReportBorrowing })))
const ReportEmployeeSalary = lazy(() => import('../pages/reports/ReportEmployeeSalary').then(m => ({ default: m.ReportEmployeeSalary })))

// My pages - 整合个人中心
const MyCenter = lazy(() => import('../pages/my/MyCenter').then(m => ({ default: m.MyCenter })))
const MySalary = lazy(() => import('../pages/my/MySalary').then(m => ({ default: m.MySalary })))
const MyLeaves = lazy(() => import('../pages/my/MyLeaves').then(m => ({ default: m.MyLeaves })))
const MyReimbursements = lazy(() => import('../pages/my/MyReimbursements').then(m => ({ default: m.MyReimbursements })))
const MyBorrowings = lazy(() => import('../pages/my/MyBorrowings').then(m => ({ default: m.MyBorrowings })))
const MyAssets = lazy(() => import('../pages/my/MyAssets').then(m => ({ default: m.MyAssets })))
const MyApprovals = lazy(() => import('../pages/my/MyApprovals').then(m => ({ default: m.MyApprovals })))

interface AppRouterProps {
    pageKey: string
}

export const AppRouter: React.FC<AppRouterProps> = ({ pageKey }) => {
    const renderContent = () => {
        switch (pageKey) {
            // 个人工作台
            case 'my-center': return <MyCenter />
            case 'my-salary': return <MySalary />
            case 'my-leaves': return <MyLeaves />
            case 'my-reimbursements': return <MyReimbursements />
            case 'my-borrowings': return <MyBorrowings />
            case 'my-assets': return <MyAssets />
            case 'my-approvals': return <MyApprovals />
            case 'company-policies': return <CompanyPolicies />
            // 财务管理
            case 'dashboard': return <Dashboard />
            case 'flows': return <Flows />
            case 'account-transactions': return <AccountTransactions />
            case 'account-transfer': return <AccountTransfer />
            case 'ar': return <AR />
            case 'ap': return <AP />
            case 'import': return <ImportCenter />
            case 'borrowings': return <BorrowingManagement />
            case 'repayments': return <RepaymentManagement />
            // 站点管理
            case 'site-management': return <SiteManagement />
            case 'site-bills': return <SiteBills />
            // 资产管理
            case 'fixed-assets': return <FixedAssetsManagement />
            case 'fixed-asset-purchase': return <FixedAssetPurchase />
            case 'fixed-asset-sale': return <FixedAssetSale />
            case 'fixed-asset-allocation': return <FixedAssetAllocation />
            case 'rental-management': return <RentalManagement />
            // 人力资源
            case 'employee': return <EmployeeManagement />
            case 'employee-salary': return <ReportEmployeeSalary />
            case 'salary-payments': return <SalaryPayments />
            case 'allowance-payments': return <AllowancePayments />
            case 'employee-leave': return <LeaveManagement />
            case 'expense-reimbursement': return <ExpenseReimbursement />
            // 报表中心
            case 'report-dept-cash': return <ReportDepartmentCash />
            case 'report-site-growth': return <ReportSiteGrowth />
            case 'report-ar-summary': return <ReportARSummary />
            case 'report-ar-detail': return <ReportARDetail />
            case 'report-ap-summary': return <ReportAPSummary />
            case 'report-ap-detail': return <ReportAPDetail />
            case 'report-expense-summary': return <ReportExpenseSummary />
            case 'report-expense-detail': return <ReportExpenseDetail />
            case 'report-account-balance': return <ReportAccountBalance />
            case 'report-borrowing': return <ReportBorrowing />
            case 'report-employee-salary': return <ReportEmployeeSalary />
            // 系统设置
            case 'org-department': return <OrgDepartmentManagement />
            case 'department': return <DepartmentManagement />
            case 'category': return <CategoryManagement />
            case 'account': return <AccountManagement />
            case 'currency': return <CurrencyManagement />
            case 'vendor': return <VendorManagement />
            case 'position-permissions': return <PositionPermissionsManagement />
            case 'email-notification': return <EmailNotificationSettings />
            case 'site-config': return <SiteConfigManagement />
            case 'ip-whitelist': return <IPWhitelistManagement />
            case 'audit': return <AuditLogs />
            default: return <MyCenter />
        }
    }

    return (
        <Suspense fallback={<div style={{ padding: 24, textAlign: 'center' }}><Spin /></div>}>
            {renderContent()}
        </Suspense>
    )
}
