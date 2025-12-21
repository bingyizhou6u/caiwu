---
description: Run tests for backend and frontend
---
# Testing Workflow

This workflow is based on `TESTING.md` and is used to run various tests for the project.

## Backend Testing

```bash
cd backend

# Run all tests
// turbo
npm test

# Run specific test (Example)
# npm test test/routes/auth.test.ts
```

### Coverage Check

```bash
cd backend
npm run test:coverage
```

## Frontend Testing

```bash
cd frontend

# Run unit tests
npm run test:unit
```

## E2E Testing

```bash
cd frontend
npm run test:e2e
```
