---
description: Start local development environment
---
# Development Environment Workflow

Used to start the local full-stack development environment.

## 1. Start Backend

Backend runs at `http://localhost:8787`.

```bash
cd backend
// turbo
npm run dev
```

## 2. Start Frontend

Frontend runs at `http://localhost:5173`.

```bash
cd frontend
// turbo
npm run dev
```

## 3. Database Management (Optional)

If you need to view or manage the local D1 database:

```bash
cd backend
npm run db:studio
```
