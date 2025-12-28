#!/bin/bash
set -e

echo "Deploying MCP server to Fly.io..."
cd apps/mcp-server
fly deploy
