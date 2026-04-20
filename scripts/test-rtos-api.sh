#!/bin/bash

# Manual test script for /api/rtos endpoint using curl
# 
# Usage:
#   chmod +x scripts/test-rtos-api.sh
#   ./scripts/test-rtos-api.sh
#
# Or with custom base URL:
#   BASE_URL=http://localhost:3000 ./scripts/test-rtos-api.sh

set -e

# Load environment variables
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
fi

BASE_URL="${BASE_URL:-http://localhost:3000}"
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}"

echo "============================================================"
echo "Testing /api/rtos endpoint with curl"
echo "============================================================"
echo "Base URL: $BASE_URL"
echo "Supabase URL: ${SUPABASE_URL:+✓} ${SUPABASE_URL:-✗}"
echo "============================================================"
echo ""

# Test 1: Unauthenticated request (should fail)
echo "Test 1: Unauthenticated Request (should return 401)"
echo "------------------------------------------------------------"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$BASE_URL/api/rtos")
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "401" ]; then
    echo "✅ PASS: Got 401 Unauthorized as expected"
    echo "Response: $BODY"
else
    echo "❌ FAIL: Expected 401, got $HTTP_STATUS"
    echo "Response: $BODY"
fi
echo ""

# Test 2: Check if server is running
echo "Test 2: Server Health Check"
echo "------------------------------------------------------------"
if curl -s -f "$BASE_URL" > /dev/null 2>&1; then
    echo "✅ PASS: Server is running"
else
    echo "❌ FAIL: Server is not running at $BASE_URL"
    echo "Please start the dev server with: npm run dev"
    exit 1
fi
echo ""

# Test 3: Authenticated request (requires manual token)
echo "Test 3: Authenticated Request"
echo "------------------------------------------------------------"
echo "To test authenticated requests, you need to:"
echo "1. Get an access token by logging in through the app"
echo "2. Or use the TypeScript test script: npx tsx scripts/test-rtos-api.ts"
echo ""
echo "Example curl command with token:"
echo "  curl -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' $BASE_URL/api/rtos"
echo ""

# Test 4: Check API endpoint exists
echo "Test 4: API Endpoint Exists"
echo "------------------------------------------------------------"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$BASE_URL/api/rtos")
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)

if [ "$HTTP_STATUS" = "401" ] || [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ PASS: API endpoint exists (status: $HTTP_STATUS)"
else
    echo "❌ FAIL: API endpoint returned unexpected status: $HTTP_STATUS"
    echo "Response: $(echo "$RESPONSE" | sed '/HTTP_STATUS/d')"
fi
echo ""

echo "============================================================"
echo "Basic tests completed!"
echo "For full testing with authentication, use:"
echo "  npx tsx scripts/test-rtos-api.ts"
echo "============================================================"
