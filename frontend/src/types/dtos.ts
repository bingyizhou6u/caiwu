/**
 * API 请求的数据传输对象 (DTOs)
 * 用于确保变更请求负载的类型安全
 */

// 员工 DTOs
export interface RegularizeEmployeeDTO {
    regularDate: string
}

export interface LeaveEmployeeDTO {
    leaveDate: string
    leaveType: string
    leaveReason?: string
    leaveMemo?: string
    disableAccount: boolean
}

export interface RejoinEmployeeDTO {
    joinDate: string
    enableAccount: boolean
}

export interface SalaryItemDTO {
    currencyId: string
    amountCents: number
}

export interface UpdateEmployeeSalariesDTO {
    employeeId: string
    salaryType: 'probation' | 'regular'
    salaries: SalaryItemDTO[]
}

export interface UpdateEmployeeAllowancesDTO {
    employeeId: string
    allowanceType: 'living' | 'housing' | 'transportation' | 'meal' | 'birthday'
    allowances: SalaryItemDTO[]
}

export interface ToggleUserActiveDTO {
    active: number
}

// 固定资产 DTOs
export interface CreateFixedAssetDTO {
    assetCode: string
    name: string
    category?: string
    purchaseDate: string
    purchasePriceCents: number
    currency: string
    accountId: string
    categoryId: string
    vendorId?: string
    projectId?: string
    siteId?: string
    custodian?: string
    depreciationMethod?: string
    usefulLifeYears?: number
    voucherUrl?: string
    memo?: string
    status?: string
    currentValueCents?: number
}

export interface UpdateFixedAssetDTO extends Partial<CreateFixedAssetDTO> { }

export interface TransferFixedAssetDTO {
    transferDate: string
    toProjectId?: string
    toSiteId?: string
    toCustodian?: string
    memo?: string
}

export interface DepreciateFixedAssetDTO {
    depreciationDate: string
    depreciationAmountCents: number
    memo?: string
}

export interface AllocateFixedAssetDTO {
    employeeId: string
    allocationDate: string
    allocationType: string
    memo?: string
}

export interface ReturnFixedAssetDTO {
    returnDate: string
    memo?: string
}

// 应收应付 DTOs
export interface CreateAPDocDTO {
    partyId: string
    issueDate: string
    dueDate?: string
    amountCents: number
    memo?: string
}

export interface CreateARDocDTO {
    siteId: string
    issueDate: string
    dueDate?: string
    amountCents: number
    memo?: string
}

export interface ConfirmARDocDTO {
    docId: string
    accountId: string
    categoryId: string
    bizDate: string
    memo?: string
    voucherUrl: string
}

export interface SettleARDocDTO {
    docId: string
    flowId: string
    settleAmountCents: number
}

// 报销 DTOs
export interface CreateExpenseDTO {
    employeeId: string
    expenseType: string
    amountCents: number
    expenseDate: string
    description: string
    currencyId: string
    voucherUrl?: string
    memo?: string
}

export interface UpdateExpenseDTO extends Partial<CreateExpenseDTO> { }

export interface ApproveExpenseDTO {
    status: string
    accountId?: string
    categoryId?: string
    memo?: string
}
