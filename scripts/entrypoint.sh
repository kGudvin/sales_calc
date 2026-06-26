#!/bin/sh
set -e

export PORT="${APP_PORT:-8090}"
npx prisma db push
npx prisma db seed
npm run start
