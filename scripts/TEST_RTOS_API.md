# Testing /api/rtos Endpoint

This directory contains manual test scripts for the `/api/rtos` API endpoint that returns all RTOs.

## Available Test Scripts

### 1. TypeScript Test Script (Comprehensive)

**File:** `test-rtos-api.ts`

**Description:** Comprehensive test suite that tests:
- Unauthenticated requests (should return 401)
- Authenticated requests with valid user session
- Direct database queries (bypasses API)
- Response data validation

**Prerequisites:**
- Next.js dev server running (`npm run dev`)
- Environment variables in `.env.local`:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (optional, for direct DB tests)
  - `TEST_USER_EMAIL` (optional, defaults to 'muhit@clickbit.com.au')
  - `TEST_USER_PASSWORD` (optional, defaults to 'host538@localau')
  - `NEXT_PUBLIC_BASE_URL` (optional, defaults to 'http://localhost:3000')

**Usage:**
```bash
# Using npm script (recommended)
npm run test:rtos-api

# Or directly with npx
npx tsx scripts/test-rtos-api.ts

# Or with ts-node if installed
ts-node scripts/test-rtos-api.ts
```

**Output:**
The script will run all tests and display:
- ✓/✗ status for each test
- Detailed error messages if tests fail
- Sample data from successful requests
- Summary of passed/failed tests

### 2. Bash/Curl Test Script (Quick)

**File:** `test-rtos-api.sh`

**Description:** Simple bash script using curl for quick manual testing.

**Prerequisites:**
- Next.js dev server running
- Environment variables loaded (from `.env.local`)

**Usage:**
```bash
# Make executable (first time only)
chmod +x scripts/test-rtos-api.sh

# Run the script
./scripts/test-rtos-api.sh

# Or with custom base URL
BASE_URL=http://localhost:3000 ./scripts/test-rtos-api.sh
```

**What it tests:**
- Server health check
- Unauthenticated request (should return 401)
- API endpoint existence

**Note:** For authenticated requests, you'll need to manually provide an access token.

## Manual Testing with curl

You can also test the API manually using curl:

### 1. Test unauthenticated request (should fail):
```bash
curl http://localhost:3000/api/rtos
# Expected: {"error":"Unauthorized"} with 401 status
```

### 2. Test authenticated request:
```bash
# First, get an access token by logging in through the app
# Then use it in the Authorization header:
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     http://localhost:3000/api/rtos
```

### 3. Pretty print JSON response:
```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     http://localhost:3000/api/rtos | jq .
```

## Expected API Response

**Success Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "code": "RTO_CODE",
      "name": "RTO Name",
      "status": "active",
      "logo_url": null,
      "location": "Location",
      "state": "State",
      "phone": "Phone",
      "email": "Email",
      "website": null,
      "notes": null,
      "cricos_provider_code": null,
      "delivery_modes": [],
      "certificate_types": [],
      "tga_sync_status": "synced",
      "tga_last_synced_at": "2024-01-01T00:00:00Z",
      "tga_sync_error": null,
      "contact_person_name": "Contact Name",
      "assigned_manager_id": "uuid",
      "provider_name": "Provider Name",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "assigned_manager": {
        "id": "uuid",
        "full_name": "Manager Name"
      }
    }
  ]
}
```

**Error Response (401):**
```json
{
  "error": "Unauthorized"
}
```

**Error Response (500):**
```json
{
  "error": "Failed to fetch RTOs"
}
```

## API Endpoint Details

- **URL:** `/api/rtos`
- **Method:** `GET`
- **Authentication:** Required (Supabase session)
- **Response Format:** JSON
- **Response Structure:** `{ data: Rto[] }`
- **Ordering:** RTOs are ordered by `name` (ascending)

## Troubleshooting

### "Server is not running"
- Start the Next.js dev server: `npm run dev`
- Ensure it's running on the expected port (default: 3000)

### "Authentication failed"
- Check that `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` are correct
- Verify the user exists in Supabase
- Check Supabase connection settings

### "Missing environment variables"
- Ensure `.env.local` exists in the project root
- Verify all required variables are set
- Check that variables are loaded correctly

### "Connection refused" or network errors
- Verify the base URL is correct
- Check if the server is running on a different port
- Ensure firewall/network settings allow connections

## Notes

- The API filters out invalid RTOs (missing required fields: id, code, name, status)
- RTOs are joined with the `profiles` table to get `assigned_manager` information
- The API requires a valid Supabase session (user must be authenticated)
