import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { ApprovalService } from '../../src/services/ApprovalService.js'
import { EmployeeService } from '../../src/services/EmployeeService.js'
import { 
    employees, departments, orgDepartments, positions, 
    employeeLeaves, expenseReimbursements, borrowings, currencies 
} from '../../src/db/schema.js'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import * as schema from '../../src/db/schema.js'
import schemaSql from '../../src/db/schema.sql?raw'

describe('ApprovalService', () => {
    let service: ApprovalService
    let db: ReturnType<typeof drizzle<typeof schema>>

    // Data IDs
    let managerUserId: string
    let subordinateUserId: string
    let otherUserId: string
    let subordinateEmployeeId: string
    let otherEmployeeId: string
    
    // Position/Dept IDs
    let deptId: string
    let otherDeptId: string
    let managerPosId: string
    let engineerPosId: string

    beforeAll(async () => {
        // Apply schema
        const statements = schemaSql.split(';').filter(s => s.trim().length > 0)
        for (const statement of statements) {
            await env.DB.prepare(statement).run()
        }
        db = drizzle(env.DB, { schema })
        // @ts-ignore
        db.transaction = async (cb) => cb(db)
        service = new ApprovalService(db)

        // Seed Currencies
        await db.insert(currencies).values({ code: 'CNY', name: 'RMB', active: 1 }).execute()

        // Seed Positions
        managerPosId = uuid()
        await db.insert(positions).values({
            id: managerPosId,
            code: 'project_manager',
            name: 'Project Manager',
            level: 2,
            functionRole: 'director',
            canManageSubordinates: 1,
            active: 1
        }).execute()

        engineerPosId = uuid()
        await db.insert(positions).values({
            id: engineerPosId,
            code: 'team_engineer',
            name: 'Engineer',
            level: 3,
            functionRole: 'developer',
            canManageSubordinates: 0,
            active: 1
        }).execute()

        // Seed Departments
        deptId = uuid()
        await db.insert(departments).values({ id: deptId, name: 'Dept A', active: 1 }).execute()
        
        otherDeptId = uuid()
        await db.insert(departments).values({ id: otherDeptId, name: 'Dept B', active: 1 }).execute()
    })

    beforeEach(async () => {
        // Clean Transactional Tables
        await db.delete(employeeLeaves).execute()
        await db.delete(expenseReimbursements).execute()
        await db.delete(borrowings).execute()
        await db.delete(employees).execute()

        // Seed Users & Employees
        
        // 1. Manager (Dept A)
        managerUserId = uuid()
        const managerEmail = 'manager@example.com'
        await db.insert(employees).values({
            id: managerUserId,
            email: managerEmail,
            name: 'Manager',
            positionId: managerPosId,
            departmentId: deptId,
            orgDepartmentId: null,
            active: 1
        }).execute()

        // 2. Subordinate (Dept A)
        subordinateUserId = uuid()
        subordinateEmployeeId = uuid()
        const subEmail = 'sub@example.com'
        await db.insert(employees).values({
            id: subordinateUserId,
            email: subEmail,
            name: 'Subordinate',
            positionId: engineerPosId,
            departmentId: deptId,
            orgDepartmentId: null,
            active: 1
        }).execute()

        // 3. Other (Dept B)
        otherUserId = uuid()
        otherEmployeeId = uuid()
        const otherEmail = 'other@example.com'
        await db.insert(employees).values({
            id: otherUserId,
            email: otherEmail,
            name: 'Other',
            positionId: engineerPosId,
            departmentId: otherDeptId,
            orgDepartmentId: null,
            active: 1
        }).execute()
    })

    describe('getPendingApprovals', () => {
        it('should return pending items for subordinates', async () => {
            // Create pending items for subordinate
            await db.insert(employeeLeaves).values({
                id: uuid(),
                employeeId: subordinateEmployeeId,
                leaveType: 'sick',
                startDate: '2023-01-01',
                endDate: '2023-01-02',
                days: 2,
                status: 'pending',
                createdAt: Date.now()
            }).execute()

            await db.insert(expenseReimbursements).values({
                id: uuid(),
                employeeId: subordinateEmployeeId,
                expenseType: 'meal',
                amountCents: 1000,
                currencyId: 'CNY',
                expenseDate: '2023-01-01',
                description: 'Lunch',
                status: 'pending',
                createdAt: Date.now()
            }).execute()

            await db.insert(borrowings).values({
                id: uuid(),
                userId: subordinateUserId, // Linked via User
                accountId: uuid(), // Dummy account
                amountCents: 5000,
                currency: 'CNY',
                borrowDate: '2023-01-01',
                status: 'pending',
                createdAt: Date.now()
            }).execute()

            const result = await service.getPendingApprovals(managerUserId)
            
            expect(result.counts.leaves).toBe(1)
            expect(result.counts.reimbursements).toBe(1)
            expect(result.counts.borrowings).toBe(1)
            expect(result.leaves[0].employeeName).toBe('Subordinate')
        })

        it('should NOT return items for non-subordinates', async () => {
            // Create pending items for other employee (Dept B)
            await db.insert(employeeLeaves).values({
                id: uuid(),
                employeeId: otherEmployeeId,
                leaveType: 'sick',
                startDate: '2023-01-01',
                endDate: '2023-01-02',
                days: 2,
                status: 'pending',
                createdAt: Date.now()
            }).execute()

            const result = await service.getPendingApprovals(managerUserId)
            expect(result.counts.leaves).toBe(0)
        })
    })

    describe('approveLeave', () => {
        it('should approve leave for subordinate', async () => {
            const leaveId = uuid()
            await db.insert(employeeLeaves).values({
                id: leaveId,
                employeeId: subordinateEmployeeId,
                leaveType: 'sick',
                startDate: '2023-01-01',
                endDate: '2023-01-02',
                days: 2,
                status: 'pending',
                createdAt: Date.now()
            }).execute()

            await service.approveLeave(leaveId, managerUserId, 'Approved')

            const updated = await db.select().from(employeeLeaves).where(eq(employeeLeaves.id, leaveId)).get()
            expect(updated?.status).toBe('approved')
            expect(updated?.approvedBy).toBe(managerUserId)
            expect(updated?.memo).toBe('Approved')
        })

        it('should throw FORBIDDEN for non-subordinate', async () => {
            const leaveId = uuid()
            await db.insert(employeeLeaves).values({
                id: leaveId,
                employeeId: otherEmployeeId,
                leaveType: 'sick',
                startDate: '2023-01-01',
                endDate: '2023-01-02',
                days: 2,
                status: 'pending',
                createdAt: Date.now()
            }).execute()

            await expect(service.approveLeave(leaveId, managerUserId))
                .rejects.toThrow('无权审批')
        })
    })

    describe('rejectLeave', () => {
        it('should reject leave', async () => {
            const leaveId = uuid()
            await db.insert(employeeLeaves).values({
                id: leaveId,
                employeeId: subordinateEmployeeId,
                leaveType: 'sick',
                startDate: '2023-01-01',
                endDate: '2023-01-02',
                days: 2,
                status: 'pending',
                createdAt: Date.now()
            }).execute()

            await service.rejectLeave(leaveId, managerUserId, 'Rejected')

            const updated = await db.select().from(employeeLeaves).where(eq(employeeLeaves.id, leaveId)).get()
            expect(updated?.status).toBe('rejected')
        })
    })

    describe('approveReimbursement', () => {
        it('should approve reimbursement', async () => {
            const id = uuid()
            await db.insert(expenseReimbursements).values({
                id,
                employeeId: subordinateEmployeeId,
                expenseType: 'meal',
                amountCents: 1000,
                currencyId: 'CNY',
                expenseDate: '2023-01-01',
                description: 'Lunch',
                status: 'pending',
                createdAt: Date.now()
            }).execute()

            // Note: approveReimbursement in service currently DOES NOT check permission explicitly inside the method
            // It relies on route handler or caller to check permission or it assumes anyone calling it has permission?
            // Let's check the code: 
            // `approveReimbursement` implementation:
            // It fetches record, checks pending. Then updates.
            // IT DOES NOT CALL `getSubordinateEmployeeIds` unlike `approveLeave`.
            // This might be a BUG or intended design (controller handles it).
            // But `approveLeave` checks it. `approveReimbursement` logic is inconsistent.
            // Let's verify this behavior in test.
            
            // If I call it as manager for subordinate, it should work.
            await service.approveReimbursement(id, managerUserId)
            const updated = await db.select().from(expenseReimbursements).where(eq(expenseReimbursements.id, id)).get()
            expect(updated?.status).toBe('approved')
        })

        it('should throw FORBIDDEN for non-subordinate reimbursement', async () => {
            const id = uuid()
            await db.insert(expenseReimbursements).values({
                id,
                employeeId: otherEmployeeId, // Dept B
                expenseType: 'meal',
                amountCents: 1000,
                currencyId: 'CNY',
                expenseDate: '2023-01-01',
                description: 'Lunch',
                status: 'pending',
                createdAt: Date.now()
            }).execute()

            await expect(service.approveReimbursement(id, managerUserId))
                .rejects.toThrow('无权审批')
        })
    })

    describe('approveBorrowing', () => {
         it('should approve borrowing', async () => {
            const id = uuid()
            await db.insert(borrowings).values({
                id,
                userId: subordinateUserId,
                accountId: uuid(),
                amountCents: 5000,
                currency: 'CNY',
                borrowDate: '2023-01-01',
                status: 'pending',
                createdAt: Date.now()
            }).execute()

            await service.approveBorrowing(id, managerUserId)
            const updated = await db.select().from(borrowings).where(eq(borrowings.id, id)).get()
            expect(updated?.status).toBe('approved')
         })

         it('should throw FORBIDDEN for non-subordinate borrowing', async () => {
            const id = uuid()
            await db.insert(borrowings).values({
                id,
                userId: otherUserId, // Dept B user
                accountId: uuid(),
                amountCents: 5000,
                currency: 'CNY',
                borrowDate: '2023-01-01',
                status: 'pending',
                createdAt: Date.now()
            }).execute()

            await expect(service.approveBorrowing(id, managerUserId))
                .rejects.toThrow('无权审批')
         })
    })
})

