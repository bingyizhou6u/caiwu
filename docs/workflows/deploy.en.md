---
description: Deploy the application to Cloudflare
---
# Deployment Workflow

This workflow is based on `DEPLOY.md` and is used to deploy the application to the Cloudflare production environment.

## 1. Database Migration

**Important**: Ensure the database Schema is up-to-date before deploying.

```bash
cd backend
# Check migration status
npm run migrate:check

# Apply migrations (Production)
npm run migrate:up
```

## 2. Set Environment Variables (If needed)

If new environment variables are introduced, set them via `wrangler secret`:

```bash
cd backend
# Example: wrangler secret put NEW_SECRET
```

## 3. Deploy Backend

```bash
cd backend
// turbo
npm run deploy
```

## 4. Deploy Frontend

```bash
cd frontend
# Build
npm run build

# Deploy (Usually automated via Cloudflare Pages, manual deployment below)
# npx wrangler pages deploy dist --project-name=your-project
```

## 5. Verify Deployment

1. Visit the production URL.
2. Login with a test account.
3. Verify key functionalities (e.g., creating documents).
4. Check Cloudflare Dashboard logs to ensure no errors.
