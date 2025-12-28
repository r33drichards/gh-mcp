#!/bin/bash
set -e

echo "Deploying web app to Vercel..."
cd apps/web
vercel --prod
