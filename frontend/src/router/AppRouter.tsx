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

interface AppRouterProps {
    pageKey: string
}

export const AppRouter: React.FC<AppRouterProps> = ({ pageKey }) => {
    const renderContent = () => {
        switch (pageKey) {
            case 'dashboard': return <Dashboard />
            case 'flows': return <Flows />
            case 'account-transactions': return <AccountTransactions />
            case 'account-transfer': return <AccountTransfer />
            case 'ar': return <AR />
            case 'ap': return <AP />
            case 'import': return <ImportCenter />
            case 'org-department': return <OrgDepartmentManagement />
            case 'department': return <DepartmentManagement />
            case 'site-management': return <SiteManagement />
            case 'site-bills': return <SiteBills />
            case 'category': return <CategoryManagement />
            case 'account': return <AccountManagement />
            case 'currency': return <CurrencyManagement />
            case 'audit': return <AuditLogs />
            case 'vendor': return <VendorManagement />
            case 'employee': return <EmployeeManagement />
            case 'borrowings': return <BorrowingManagement />
            case 'repayments': return <RepaymentManagement />
            case 'employee-leave': return <LeaveManagement />
            case 'expense-reimbursement': return <ExpenseReimbursement />
            case 'salary-payments': return <SalaryPayments />
            case 'allowance-payments': return <AllowancePayments />
            case 'ip-whitelist': return <IPWhitelistManagement />
            case 'fixed-assets': return <FixedAssetsManagement />
            case 'fixed-asset-purchase': return <FixedAssetPurchase />
            case 'fixed-asset-sale': return <FixedAssetSale />
            case 'fixed-asset-allocation': return <FixedAssetAllocation />
            case 'rental-management': return <RentalManagement />
            case 'position-permissions': return <PositionPermissionsManagement />
            case 'email-notification': return <EmailNotificationSettings />
            case 'site-config': return <SiteConfigManagement />
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
            default: return <Dashboard />
        }
    }

    return (
        <Suspense fallback={<div style={{ padding: 24, textAlign: 'center' }}><Spin /></div>}>
            {renderContent()}
        </Suspense>
    )
}
