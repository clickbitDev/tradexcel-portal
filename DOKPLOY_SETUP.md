# Dokploy Configuration Instructions

This document provides step-by-step instructions for configuring your Next.js application with Supabase in Dokploy.

## Deployment

This app deploys as a **single Docker service** using the root `Dockerfile`. PDF generation and certificate processing are built into the app — no separate pdf-secure or pdf-worker services are needed.

- `Dockerfile` — single image
- Docker context path: `.`
- Container port: `3000`

Attach your Dokploy domain to the `web` service on port `3000`.

Use `docker-compose.env.example` as the reference sheet for environment variables.

Your application requires the following Supabase environment variables:

1. `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous/public key
3. `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for admin operations)
4. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` - Google Maps browser key (for address autocomplete)
5. `DATABASE_URL` - Prisma runtime database connection string
6. `DIRECT_URL` - Optional Prisma direct database connection string for CLI/admin operations

Optional fallback for runtime-only key delivery:

- `GOOGLE_MAPS_API_KEY` (same browser key; used by `/api/public/google-maps-key`)
- `ENABLE_DETAILED_PROD_ERRORS=true` (temporary admin-only detailed production error panels for testing)

For email delivery and background processing, also set:

7. `SMTP_HOST`
8. `SMTP_PORT` (or compatibility aliases `SSL_PORT`/`TLS_PORT`)
9. `SMTP_USER` (or compatibility alias `USER_NAME`)
10. `SMTP_PASS` (or compatibility alias `PASSWORD`)
11. `CRON_SECRET` (used to protect scheduled processor endpoint)

## Where to Find Your Supabase Credentials

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Settings** → **API**
4. You'll find:
   - **Project URL** → Use this for `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → Use this for `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → Use this for `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep this secret!)

## Dokploy Configuration Steps

### Step 1: Configure Build Arguments

Build arguments are used during the Docker build process to embed values in the client-side bundle.

1. In Dokploy, go to your application settings
2. Navigate to the **Build Arguments** section (or **Docker Build Args**)
3. Add the following build arguments:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-browser-key
   ```

   **Important:** Replace the placeholder values with your actual Supabase credentials.

   Do not pass `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, or `DIRECT_URL` as build arguments. They are runtime-only secrets.

### Step 2: Configure Runtime Environment Variables

Runtime environment variables are used by the server-side code when the application is running.

1. In Dokploy, go to your application settings
2. Navigate to the **Environment Variables** section (or **Runtime Environment Variables**)
3. Add the following environment variables:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
    DATABASE_URL=postgresql://...
    DIRECT_URL=postgresql://...
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-browser-key
    GOOGLE_MAPS_API_KEY=your-google-maps-browser-key
    ENABLE_DETAILED_PROD_ERRORS=true
   ```

    **Important:** Use the same values as in Step 1.
    Set `ENABLE_DETAILED_PROD_ERRORS=true` only while testing. The detailed panel is restricted to admin-level users, but you should switch it back off after validation.

### Step 3: Verify Configuration

After setting both build arguments and runtime environment variables:

1. Save your configuration
2. Trigger a new deployment
3. Check the application logs to verify the environment variables are being read correctly

## Why Both Are Needed

- **Build Arguments**: Required because `NEXT_PUBLIC_*` variables are embedded into the client-side JavaScript bundle during the build process. Without these, the client-side code won't have access to Supabase.

- **Runtime Environment Variables**: Required because server-side code (API routes, server components, middleware) also needs access to these variables at runtime. The standalone Next.js server reads these from the environment.

- **Prisma Runtime Variables**: `DATABASE_URL` is required in the running container. `DIRECT_URL` is strongly recommended for Prisma CLI and admin operations.

## Scheduler Setup (Recommended)

Set up a Dokploy cron/scheduled job to process queued notifications every minute:

```bash
curl -X POST "https://your-domain.com/api/notifications/process?limit=100&includeReminders=true" \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

This processes queued emails/SMS/WhatsApp and evaluates reminder rules in one run.

## Troubleshooting

### Error: "Missing environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY"

This error means the runtime environment variables are not set. 

**Solution:**
1. Verify that the required runtime environment variables are set in Dokploy's **Environment Variables** section
2. Make sure there are no typos in the variable names
3. Ensure the values are correct (copy-paste from Supabase dashboard)
4. Redeploy the application after adding/updating environment variables

### Error: `DATABASE_URL must be set before using Prisma`

This means the deployed container is running without Prisma's runtime connection string.

**Solution:**
1. Add `DATABASE_URL` to Dokploy's **Environment Variables** section
2. Add `DIRECT_URL` too if Prisma CLI tasks or direct connections are used
3. Redeploy the application

### Application builds but fails at runtime

If the build succeeds but the application fails when starting:

1. Check that runtime environment variables are set (not just build arguments)
2. Verify the environment variables are visible in the container logs
3. Ensure there are no extra spaces or quotes around the values

### Client-side Supabase calls fail

If server-side works but client-side doesn't:

1. Verify build arguments were set during the build
2. Check that `NEXT_PUBLIC_*` variables were included in build arguments
3. Rebuild the application with the correct build arguments

### Bad Gateway (502) Error

If you see a "Bad Gateway" error after deployment:

1. **Check Container Logs**: In Dokploy, go to the **Logs** tab to see if the container is starting correctly
   - Look for errors about missing environment variables
   - Check if the server is listening on the correct port
   - Verify the container is running (not crashed)

2. **Port Configuration**: 
   - The application defaults to port **3000** (standard Next.js port)
   - If Dokploy expects a different port, you can override it by setting the `PORT` environment variable in Dokploy
   - Make sure the port in Dokploy's application settings matches the port the container is listening on

3. **Container Health**:
   - Wait a few seconds after deployment for the container to fully start
   - Check if the container status shows as "Running" in Dokploy
   - If the container keeps restarting, check the logs for startup errors

4. **Environment Variables**:
   - Ensure all required environment variables are set (see Step 2 above)
   - Missing environment variables can cause the server to fail on startup
   - Verify variables are set in the **Runtime Environment Variables** section (not just build arguments)

## Security Notes

- ⚠️ **Never commit** your Supabase keys to version control
- ⚠️ The `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security (RLS) - keep it secret
- ✅ The `NEXT_PUBLIC_SUPABASE_ANON_KEY` is safe to expose in client-side code (it's public by design)
- ✅ Use Dokploy's secure environment variable management - never hardcode keys

## Quick Checklist

- [ ] Found Supabase credentials in dashboard
- [ ] Added `NEXT_PUBLIC_SUPABASE_URL` as build argument
- [ ] Added `NEXT_PUBLIC_SUPABASE_ANON_KEY` as build argument
- [ ] Added `SUPABASE_SERVICE_ROLE_KEY` as build argument
- [ ] Added `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` as build argument
- [ ] Added `NEXT_PUBLIC_SUPABASE_URL` as runtime environment variable
- [ ] Added `NEXT_PUBLIC_SUPABASE_ANON_KEY` as runtime environment variable
- [ ] Added `SUPABASE_SERVICE_ROLE_KEY` as runtime environment variable
- [ ] Added `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` as runtime environment variable
- [ ] Added optional `GOOGLE_MAPS_API_KEY` runtime fallback
- [ ] Added optional `ENABLE_DETAILED_PROD_ERRORS=true` for testing and planned to remove it afterward
- [ ] Added `SMTP_HOST` as runtime environment variable
- [ ] Added `SMTP_PORT` (or `SSL_PORT`/`TLS_PORT`) as runtime environment variable
- [ ] Added `SMTP_USER` (or `USER_NAME`) as runtime environment variable
- [ ] Added `SMTP_PASS` (or `PASSWORD`) as runtime environment variable
- [ ] Added `CRON_SECRET` as runtime environment variable
- [ ] Added `OWNER_PASSWORD` as runtime environment variable (required for PDF encryption)
- [ ] Added `BACKBLAZE_BUCKET_ENDPOINT`, `BACKBLAZE_ACCESS_KEY_ID`, `BACKBLAZE_SECRET_ACCESS_KEY`, `BACKBLAZE_APPLICATION_BUCKETNAME`, `BACKBLAZE_BUCKET_REGION` as runtime environment variables
- [ ] Added Dokploy scheduled job for `/api/notifications/process`
- [ ] Triggered new deployment
- [ ] Verified application starts without errors
