# Project Structure

## Monorepo Layout
```
/
├── backend/           # Cloudflare Workers API
├── frontend/          # React SPA
├── email-worker/      # Email service worker
└── docs/              # Documentation
```

## Backend (`/backend/src`)
```
src/
├── index.ts           # App entry, middleware chain, route mounting
├── middleware/        # Auth, DI, security, performance monitoring
├── routes/v2/         # API routes (OpenAPI + Hono)
├── services/          # Business logic by domain
│   ├── assets/        # Fixed assets, rentals
│   ├── auth/          # Authentication, sessions
│   ├── common/        # Accounts, cash flows, vendors
│   ├── finance/       # AR/AP, settlements, reports
│   ├── hr/            # Employees, salaries, leaves
│   ├── pm/            # Project management
│   ├── reports/       # Dashboard, financial reports
│   └── system/        # Config, audit, permissions
├── schemas/           # Zod validation schemas
├── db/
│   ├── schema.ts      # Drizzle table definitions
│   └── migration_*.sql # SQL migrations
├── utils/             # Helpers (errors, logger, batch-query, etc.)
└── types/             # TypeScript types
```

## Frontend (`/frontend/src`)
```
src/
├── main.tsx           # App entry with providers
├── router/            # Route definitions (lazy loaded)
├── features/          # Feature modules by domain
│   ├── auth/          # Login, session
│   ├── employees/     # Employee management
│   ├── finance/       # Cash flows, AR/AP
│   ├── assets/        # Fixed assets
│   ├── hr/            # Salaries, leaves
│   ├── pm/            # Project management
│   ├── reports/       # Reports
│   ├── sites/         # Site management
│   └── system/        # System settings
├── components/        # Shared components
│   ├── common/        # DataTable, SearchFilters
│   ├── form/          # Form inputs (AmountInput, selects)
│   └── layout/        # Layout components
├── hooks/             # Custom hooks (business/, forms/)
├── api/               # HTTP client config
├── store/             # Zustand stores
├── types/             # TypeScript types + OpenAPI generated
├── utils/             # Utilities
├── validations/       # Zod form schemas
└── config/            # App config (menu, theme, API)
```

## Key Patterns
- **Services**: One service per business entity, grouped by domain
- **Routes**: OpenAPI-first with zod-openapi validation
- **Features**: Self-contained modules with pages, hooks, components
- **Hooks**: Business logic hooks in `hooks/business/`, form hooks in `hooks/forms/`
