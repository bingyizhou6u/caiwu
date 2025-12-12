import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and, desc, sql, inArray, isNull, or, notInArray, aliasedTable } from 'drizzle-orm'
import {
    borrowings,
    repayments,
    accounts,
    employees,
    departments,
    orgDepartments,
    positions
} from '../db/schema.js'
import { uuid } from '../utils/db.js'
import { Errors } from '../utils/errors.js'

export class BorrowingService {
    constructor(private db: DrizzleD1Database<any>) { }

    async listBorrowings(page: number = 1, pageSize: number = 20, whereClause?: any) {
        const offset = (page - 1) * pageSize

        // 1. Get total count
        const countResult = await this.db
            .select({ count: sql<number>`count(1)` })
            .from(borrowings)
            .where(whereClause)
            .get()
        const total = countResult?.count ?? 0

        // 2. Get paged data
        const borrowingsList = await this.db
            .select()
            .from(borrowings)
            .where(whereClause)
            .orderBy(desc(borrowings.borrowDate), desc(borrowings.createdAt))
            .limit(pageSize)
            .offset(offset)
            .execute()

        const userIds = new Set<string>()
        const accountIds = new Set<string>()
        borrowingsList.forEach(b => {
            userIds.add(b.userId)
            accountIds.add(b.accountId)
        })

        const [usersList, accountsList] = await Promise.all([
            userIds.size > 0 ? this.db.select().from(employees).where(inArray(employees.id, Array.from(userIds))).execute() : [],
            accountIds.size > 0 ? this.db.select().from(accounts).where(inArray(accounts.id, Array.from(accountIds))).execute() : []
        ])

        const userMap = new Map(usersList.map(u => [u.id, u]))
        const accountMap = new Map(accountsList.map(a => [a.id, a]))

        const list = borrowingsList.map(b => {
            const user = userMap.get(b.userId)
            const employee = user
            const account = accountMap.get(b.accountId)
            return {
                borrowing: b,
                borrowerName: employee?.name || null,
                borrowerEmail: employee?.personalEmail || employee?.email || null,
                accountName: account?.name || null,
                accountCurrency: account?.currency || null
            }
        })

        return { total, list }
    }

    async getBorrowingById(id: string) {
        const result = await this.db.select({
            borrowing: borrowings,
            borrowerName: employees.name,
            borrowerEmail: employees.personalEmail,
            accountName: accounts.name,
            accountCurrency: accounts.currency
        })
            .from(borrowings)
            .leftJoin(employees, eq(employees.id, borrowings.userId))
            .leftJoin(accounts, eq(accounts.id, borrowings.accountId))
            .where(eq(borrowings.id, id))
            .get()

        if (!result) return null

        return {
            ...result.borrowing,
            borrower_name: result.borrowerName,
            borrower_email: result.borrowerEmail,
            accountName: result.accountName,
            account_currency: result.accountCurrency
        }
    }

    async createBorrowing(data: {
        userId: string
        accountId: string
        amountCents: number
        currency: string
        borrowDate: string
        memo?: string
        createdBy?: string
    }) {
        return await this.db.transaction(async (tx) => {
            const id = uuid()
            await tx.insert(borrowings).values({
                id,
                userId: data.userId,
                accountId: data.accountId,
                amountCents: data.amountCents,
                currency: data.currency,
                borrowDate: data.borrowDate,
                memo: data.memo,
                status: 'outstanding', // Default status.
                createdAt: Date.now()
            }).execute()
            return { id }
        })
    }

    async listRepayments(limit: number = 200, whereClause?: any) {
        // Migrating logic from routes/borrowings.ts lines 218-249 (raw SQL)
        // Join repayments, borrowings, employees (borrower), accounts, employees (creator)
        return await this.db.select({
            repayment: repayments,
            userId: borrowings.userId,
            borrowerName: employees.name,
            borrowerEmail: employees.personalEmail,
            accountName: accounts.name,
            accountCurrency: accounts.currency,
            creatorName: sql<string>`creator.name`.as('creatorName') // Aliased join needed?
        })
            .from(repayments)
            .leftJoin(borrowings, eq(borrowings.id, repayments.borrowingId))
            .leftJoin(employees, eq(employees.id, borrowings.userId))
            .leftJoin(accounts, eq(accounts.id, repayments.accountId))
            .leftJoin(aliasedTable(employees, 'creator'), eq(sql`creator.id`, repayments.createdBy)) // How to do alias in Drizzle?
            // Drizzle alias approach:
            // const creator = aliasedTable(employees, 'creator')
            // .leftJoin(creator, eq(creator.id, repayments.createdBy))
            .where(whereClause)
            .orderBy(desc(repayments.repayDate), desc(repayments.createdAt))
            .limit(limit)
            .execute()
    }

    // Rewrite listRepayments with proper aliases outside
    async listRepaymentsV2(limit: number = 200, whereClause?: any) {
        const creator = aliasedTable(employees, 'creator')

        const rows = await this.db.select({
            repayment: repayments,
            userId: borrowings.userId,
            borrowerName: employees.name,
            borrowerEmail: employees.personalEmail,
            accountName: accounts.name,
            accountCurrency: accounts.currency,
            creatorName: creator.name
        })
            .from(repayments)
            .leftJoin(borrowings, eq(borrowings.id, repayments.borrowingId))
            .leftJoin(employees, eq(employees.id, borrowings.userId))
            .leftJoin(accounts, eq(accounts.id, repayments.accountId))
            .leftJoin(creator, eq(creator.id, repayments.createdBy))
            .where(whereClause)
            .orderBy(desc(repayments.repayDate), desc(repayments.createdAt))
            .limit(limit)
            .execute()

        return rows.map(r => ({
            ...r.repayment,
            userId: r.userId,
            borrower_name: r.borrowerName,
            borrower_email: r.borrowerEmail,
            accountName: r.accountName,
            account_currency: r.accountCurrency,
            creator_name: r.creatorName
        }))
    }

    async getRepaymentById(id: string) {
        const creator = aliasedTable(employees, 'creator')
        const result = await this.db.select({
            repayment: repayments,
            userId: borrowings.userId,
            borrowerName: employees.name,
            borrowerEmail: employees.personalEmail,
            accountName: accounts.name,
            accountCurrency: accounts.currency,
            creatorName: creator.name
        })
            .from(repayments)
            .leftJoin(borrowings, eq(borrowings.id, repayments.borrowingId))
            .leftJoin(employees, eq(employees.id, borrowings.userId))
            .leftJoin(accounts, eq(accounts.id, repayments.accountId))
            .leftJoin(creator, eq(creator.id, repayments.createdBy))
            .where(eq(repayments.id, id))
            .get()

        if (!result) return null

        return {
            ...result.repayment,
            userId: result.userId,
            borrower_name: result.borrowerName,
            borrower_email: result.borrowerEmail,
            accountName: result.accountName,
            account_currency: result.accountCurrency,
            creator_name: result.creatorName
        }
    }

    async createRepayment(data: {
        borrowingId: string
        accountId: string
        amountCents: number
        currency: string
        repayDate: string
        memo?: string
        createdBy?: string
    }) {
        return await this.db.transaction(async (tx) => {
            const id = uuid()
            await tx.insert(repayments).values({
                id,
                borrowingId: data.borrowingId,
                accountId: data.accountId,
                amountCents: data.amountCents,
                currency: data.currency,
                repayDate: data.repayDate,
                memo: data.memo,
                createdBy: data.createdBy,
                createdAt: Date.now()
            }).execute()
            return { id }
        })
    }

    async getBorrowingBalances(whereClause?: any) {
        const e = aliasedTable(employees, 'e')
        const b = aliasedTable(borrowings, 'b')

        // Use Drizzle builder with sql aggregations
        // We select from employees and join borrowings
        const repaidSubquery = sql`(
            select sum(r.amount_cents)
            from repayments r
            where r.borrowing_id in (
                select id from borrowings b2 
                where b2.user_id = ${e.id} and b2.currency = ${b.currency}
            )
        )`

        const rows = await this.db.select({
            userId: e.id,
            borrower_name: e.name,
            borrower_email: e.personalEmail,
            currency: b.currency,
            total_borrowed_cents: sql<number>`coalesce(sum(${b.amountCents}), 0)`,
            total_repaid_cents: sql<number>`coalesce(${repaidSubquery}, 0)`,
            balance_cents: sql<number>`(coalesce(sum(${b.amountCents}), 0) - coalesce(${repaidSubquery}, 0))`
        })
            .from(e)
            .innerJoin(b, eq(b.userId, e.id))
            .where(whereClause)
            .groupBy(e.id, e.name, e.personalEmail, b.currency)
            .having(sql`(coalesce(sum(${b.amountCents}), 0) - coalesce(${repaidSubquery}, 0)) != 0`)
            .orderBy(e.name, b.currency)
            .execute()

        return rows
    }

    async getEmployeeBorrowings(employeeId: string) {
        // 1. 获取借款列表及每笔借款的已还金额
        const borrowingsList = await this.db.select({
            borrowing: borrowings,
            accountName: accounts.name,
            repaidCents: sql<number>`COALESCE(sum(${repayments.amountCents}), 0)`.as('repaidCents')
        })
            .from(borrowings)
            .leftJoin(accounts, eq(accounts.id, borrowings.accountId))
            .leftJoin(repayments, eq(repayments.borrowingId, borrowings.id))
            .where(eq(borrowings.userId, employeeId))
            .groupBy(borrowings.id)
            .orderBy(desc(borrowings.createdAt))
            .execute()

        // 2. 获取总统计
        const [borrowStats, repayStats] = await Promise.all([
            this.db.select({
                total: sql<number>`COALESCE(SUM(${borrowings.amountCents}), 0)`
            }).from(borrowings).where(eq(borrowings.userId, employeeId)).get(),

            this.db.select({
                total: sql<number>`COALESCE(SUM(${repayments.amountCents}), 0)`
            }).from(repayments)
                .innerJoin(borrowings, eq(borrowings.id, repayments.borrowingId))
                .where(eq(borrowings.userId, employeeId)).get()
        ])

        const totalBorrowed = borrowStats?.total || 0
        const totalRepaid = repayStats?.total || 0

        return {
            borrowings: borrowingsList.map(b => ({
                ...b.borrowing,
                accountName: b.accountName,
                repaidCents: b.repaidCents
            })),
            stats: {
                totalBorrowedCents: totalBorrowed,
                totalRepaidCents: totalRepaid,
                balanceCents: totalBorrowed - totalRepaid,
            },
        }
    }
}
