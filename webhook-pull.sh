#!/bin/bash

cd /Volumes/blackbox/clickbit/edward-portal

git fetch origin main
git checkout -f main
git pull origin main

echo $(date): Auto-pull completed >> /var/log/webhook.log