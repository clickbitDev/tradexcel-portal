#!/bin/bash
# Apply migrations via Supabase API

set -e

echo "Applying bills table migration..."

# Read the SQL file
SQL_CONTENT=$(cat scripts/apply_migrations.sql)

# Use Supabase Management API to execute SQL
curl -X POST "https://vrurnquhemoohagrabbz.supabase.co/rest/v1/rpc/exec_sql" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZydXJucXVoZW1vb2hhZ3JhYmJ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE5MjM2MCwiZXhwIjoyMDgzNzY4MzYwfQ.DDBOWH81ScfRfAzjt7OvS076LeDyQCBBKkbptqiNqkA" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZydXJucXVoZW1vb2hhZ3JhYmJ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE5MjM2MCwiZXhwIjoyMDgzNzY4MzYwfQ.DDBOWH81ScfRfAzjt7OvS076LeDyQCBBKkbptqiNqkA" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$SQL_CONTENT" | jq -R -s .)}"

echo "Migration applied successfully!"
