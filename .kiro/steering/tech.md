# Tech Stack

## Backend (`/backend`)
- **Runtime**: Cloudflare Workers
- **Framework**: Hono with OpenAPI (zod-openapi)
- **Database**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **Storage**: Cloudflare R2 (vouchers), KV (sessions/cache)
- **Validation**: Zod schemas
- **API Docs**: Swagger UI at `/api/ui`

## Frontend (`/frontend`)
- **Framework**: React 18 + TypeScript
- **Build**: Vite
- **UI Library**: Ant Design 5
- **State**: Zustand (app state), React Query (server state)
- **Routing**: React Router 7
- **Testing**: Vitest (unit), Playwright (E2E)
- **Deployment**: Cloudflare Pages

## Common Commands

### Backend
```bash
cd backend
npm run dev              # Start dev server (port 8787)
npm test                 # Run tests
npm run test:coverage    # Tests with coverage
npm run typecheck        # TypeScript check
npm run lint             # ESLint
npm run format           # Prettier
npm run migrate:up       # Apply migrations (local)
npm run migrate:up:remote # Apply migrations (production)
npm run db:generate      # Generate Drizzle migrations
npm run gen:openapi      # Export OpenAPI spec
npm run deploy           # Deploy to Workers
```

### Frontend
```bash
cd frontend
npm run dev              # Start dev server (port 5173)
npm run build            # Production build
npm test                 # Unit tests
npm run test:e2e         # Playwright E2E tests
npm run typecheck        # TypeScript check
npm run gen:types        # Generate types from OpenAPI
```

## Key Dependencies
- Backend: hono, drizzle-orm, zod, @hono/zod-openapi
- Frontend: react, antd, @tanstack/react-query, zustand, dayjs, zod
