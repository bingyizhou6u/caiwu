export interface SelectOption {
    value: string
    label: string
    currency?: string
    search?: string
    [key: string]: string | undefined
}

export interface Flow {
    id: string
    voucherNo?: string
    bizDate: string
    type: 'income' | 'expense' | 'transfer' | 'adjust' | 'borrowing_in' | 'lending_out' | 'repayment_in' | 'repayment_out'
    accountId: string
    accountName?: string
    categoryId?: string
    categoryName?: string
    method?: string
    amountCents: number
    siteId?: string
    departmentId?: string
    counterparty?: string
    memo?: string
    voucherUrl?: string
    voucherUrls?: string[]
}

export interface AccountTransfer {
    id: string
    transferDate: string
    fromAccountId: string
    fromAccountName: string
    fromAccountCurrency: string
    toAccountId: string
    toAccountName: string
    toAccountCurrency: string
    fromAmountCents: number
    toAmountCents: number
    exchangeRate?: number
    memo?: string
    voucherUrl?: string
}

export interface AccountTransaction {
    id: string
    bizDate?: string
    transactionDate?: string
    type?: string
    transactionType?: string
    amountCents: number
    balanceCents?: number
    balanceBeforeCents?: number
    balanceAfterCents?: number
    memo?: string
    relatedId?: string
    relatedType?: string
    voucherNo?: string | null
    voucherUrl?: string | null
    counterparty?: string | null
    categoryName?: string | null
    createdAt?: number
}

export interface Borrowing {
    id: string
    borrowDate: string
    borrower: string
    borrowerName?: string
    borrowerEmail?: string
    amountCents: number
    currency: string
    accountId?: string
    accountName?: string
    reason?: string
    expectedRepayDate?: string
    status: 'pending' | 'approved' | 'rejected' | 'repaid' | 'partial_repaid'
    repaidAmountCents: number
    creatorName?: string
    memo?: string
}

export interface Repayment {
    id: string
    repayDate: string
    borrowingId: string
    amountCents: number
    currency: string
    accountId: string
    accountName?: string
    borrowerName?: string
    borrowerEmail?: string
    creatorName?: string
    memo?: string
}

export interface ARAP {
    id: string
    type: 'ar' | 'ap'
    issueDate: string
    dueDate?: string
    partyName: string
    amountCents: number
    currency: string
    status: 'pending' | 'paid' | 'partial_paid' | 'overdue' | 'bad_debt' | 'open'
    settledCents: number
    remainingCents: number
    memo?: string
}
