# tradexcel-portal

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Xero Integration Setup

1. Copy env template and fill credentials:

```bash
cp .env.example .env
```

2. Required Xero values:

- `XERO_CLIENT_ID`
- `XERO_CLIENT_SECRET`
- `XERO_REDIRECT_URI` (for local: `http://localhost:3000/api/auth/callback/xero`)

3. Optional but recommended Xero defaults (must exist in your Xero org):

- `XERO_SALES_ACCOUNT_CODE`
- `XERO_PURCHASES_ACCOUNT_CODE`
- `XERO_SALES_TAX_TYPE`
- `XERO_PURCHASES_TAX_TYPE`
- `XERO_PAYMENT_ACCOUNT_CODE`

4. If using Xero MCP for debugging:

- Build the MCP server first (`xero-mcp-server` repo):

```bash
npm run build
```

- Set `XERO_MCP_ENABLED=true`
- Set either `XERO_MCP_SERVER_PATH` or `XERO_MCP_ARGS`

5. Ensure DB migrations are applied:

```bash
npx prisma migrate deploy
```

## Email Queue and Scheduler Setup

Bulk communications, invoice emails, and reminder emails are queued into `notification_queue` and delivered by the notification processor API.

1. Configure SMTP environment variables:

- `SMTP_HOST`
- `SMTP_PORT` (or `SSL_PORT`/`TLS_PORT` compatibility keys)
- `SMTP_USER` (or `USER_NAME` compatibility key)
- `SMTP_PASS` (or `PASSWORD` compatibility key)
- Optional: `SMTP_SECURE`, `EMAIL_FROM`, `EMAIL_FROM_NAME`

2. Configure cron auth:

- `CRON_SECRET` (long random value)

3. Schedule this endpoint every minute (recommended):

```bash
curl -X POST "https://your-domain.com/api/notifications/process?limit=100&includeReminders=true" \
  -H "Authorization: Bearer $CRON_SECRET"
```

The same endpoint can still be called by authenticated staff users without a cron token.

## Address Autocomplete Setup

Set a Google Maps browser key to enable address suggestions on forms:

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- Optional runtime fallback: `GOOGLE_MAPS_API_KEY`

If your deploy platform injects runtime env vars but not build args, the app can fetch the key from `/api/public/google-maps-key` at runtime.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
