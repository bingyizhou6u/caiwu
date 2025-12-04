/**
 * Data Transfer Objects (DTOs) for API requests
 * Used to ensure type safety for mutation payloads
 */

// Employee DTOs
export interface RegularizeEmployeeDTO {
    regular_date: string
}

export interface LeaveEmployeeDTO {
    leave_date: string
    leave_type: string
    leave_reason?: string
    leave_memo?: string
    disable_account: boolean
}

export interface RejoinEmployeeDTO {
    join_date: string
    enable_account: boolean
}

export interface SalaryItemDTO {
    currency_id: string
    amount_cents: number
}

export interface UpdateEmployeeSalariesDTO {
    employee_id: string
    salary_type: 'probation' | 'regular'
    salaries: SalaryItemDTO[]
}

export interface UpdateEmployeeAllowancesDTO {
    employee_id: string
    allowance_type: 'living' | 'housing' | 'transportation' | 'meal' | 'birthday'
    allowances: SalaryItemDTO[]
}

export interface ResetUserPasswordDTO {
    password: string
}

export interface ToggleUserActiveDTO {
    active: number
}

// Fixed Asset DTOs
export interface CreateFixedAssetDTO {
    asset_code: string
    name: string
    category?: string
    purchase_date: string
    purchase_price_cents: number
    currency: string
    account_id: string
    category_id: string
    vendor_id?: string
    department_id?: string
    site_id?: string
    custodian?: string
    depreciation_method?: string
    useful_life_years?: number
    voucher_url?: string
    memo?: string
    status?: string
    current_value_cents?: number
}

export interface UpdateFixedAssetDTO extends Partial<CreateFixedAssetDTO> { }

export interface TransferFixedAssetDTO {
    transfer_date: string
    to_department_id?: string
    to_site_id?: string
    to_custodian?: string
    memo?: string
}

export interface DepreciateFixedAssetDTO {
    depreciation_date: string
    depreciation_amount_cents: number
    memo?: string
}

export interface AllocateFixedAssetDTO {
    employee_id: string
    allocation_date: string
    allocation_type: string
    memo?: string
}

export interface ReturnFixedAssetDTO {
    return_date: string
    memo?: string
}

// AR/AP DTOs
// AR/AP DTOs
export interface CreateAPDocDTO {
    party_id: string
    issue_date: string
    due_date?: string
    amount_cents: number
    memo?: string
}

export interface CreateARDocDTO {
    site_id: string
    issue_date: string
    due_date?: string
    amount_cents: number
    memo?: string
}

export interface ConfirmARDocDTO {
    doc_id: string
    account_id: string
    category_id: string
    biz_date: string
    memo?: string
    voucher_url: string
}

export interface SettleARDocDTO {
    doc_id: string
    flow_id: string
    settle_amount_cents: number
}

// Expense DTOs
export interface CreateExpenseDTO {
    employee_id: string
    expense_type: string
    amount_cents: number
    expense_date: string
    description: string
    currency_id: string
    voucher_url?: string
    memo?: string
}

export interface UpdateExpenseDTO extends Partial<CreateExpenseDTO> { }

export interface ApproveExpenseDTO {
    status: string
    account_id?: string
    category_id?: string
    memo?: string
}
