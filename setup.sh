#!/bin/bash
set -e
echo "Setting up GK Legend Studio automation..."
echo ""

if command -v bun &> /dev/null; then
  bun install
else
  npm install
fi

echo ""
echo "Dependencies installed. Now logging in with Google (a browser window will open)..."
echo ""

if command -v bun &> /dev/null; then
  bun run auth
else
  npm run auth
fi

echo ""
echo "All done! Run this to start the automation:"
echo ""
echo "    bun start"
echo ""
