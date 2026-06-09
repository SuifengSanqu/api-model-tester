#!/bin/bash

echo "Starting proxy server..."
node server.js &
PROXY_PID=$!

echo "Proxy server started with PID: $PROXY_PID"
echo ""
echo "Now starting frontend dev server..."
echo "Frontend: http://localhost:5173"
echo "Proxy: http://localhost:3001"
echo ""

npm run dev

# Cleanup on exit
trap "kill $PROXY_PID" EXIT
