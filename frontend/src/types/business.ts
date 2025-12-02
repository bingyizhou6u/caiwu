export interface SelectOption {
    value: string
    label: string
    currency?: string
    search?: string
    [key: string]: string | undefined
}

export interface Flow {
    id: string
    voucher_no?: string
    biz_date: string
    type: 'income' | 'expense' | 'transfer' | 'adjust'
    account_id: string
    account_name?: string
    category_id?: string
    category_name?: string
    method?: string
    amount_cents: number
    site_id?: string
    department_id?: string
    counterparty?: string
    memo?: string
    voucher_url?: string
    voucher_urls?: string[]
}

export interface AccountTransfer {
    id: string
    transfer_date: string
    from_account_id: string
    from_account_name: string
    from_account_currency: string
    to_account_id: string
    to_account_name: string
    to_account_currency: string
    from_amount_cents: number
    to_amount_cents: number
    exchange_rate?: number
    memo?: string
    voucher_url?: string
}

export interface AccountTransaction {
    id: string
    biz_date: string
    type: string
    amount_cents: number
    balance_cents: number
    memo?: string
    related_id?: string
    related_type?: string
}

export interface Borrowing {
    id: string
    borrowing_date: string
    borrower: string
    amount_cents: number
    currency: string
    reason?: string
    expected_repay_date?: string
    status: 'pending' | 'approved' | 'rejected' | 'repaid' | 'partial_repaid'
    repaid_amount_cents: number
    memo?: string
}

export interface Repayment {
    id: string
    repayment_date: string
    borrowing_id: string
    amount_cents: number
    account_id: string
    memo?: string
}

export interface ARAP {
    id: string
    type: 'ar' | 'ap'
    issue_date: string
    due_date?: string
    party_name: string
    amount_cents: number
    currency: string
    status: 'pending' | 'paid' | 'partial_paid' | 'overdue' | 'bad_debt'
    paid_amount_cents: number
    memo?: string
}
