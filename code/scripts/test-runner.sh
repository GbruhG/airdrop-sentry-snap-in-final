#!/bin/bash

# Test runner script for Sentry DevRev Snap-in

set -e

echo "🧪 Running Sentry DevRev Snap-in Tests"
echo "======================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the project first
echo "🔨 Building project..."
npm run build

# Run linting
echo "🔍 Running linter..."
npm run lint

# Run tests with different configurations
echo ""
echo "🚀 Running unit tests..."
npm test

echo ""
echo "📊 Running tests with coverage..."
npm run test:coverage

echo ""
echo "🔄 Running integration tests..."
npm test -- --testNamePattern="Integration Tests"

# Run specific test suites
echo ""
echo "🌐 Running HTTP client tests..."
npm test -- --testPathPattern="sentry-http-client.test.ts"

echo ""
echo "📋 Running data normalization tests..."
npm test -- --testPathPattern="data-normalization.test.ts"

echo ""
echo "🔧 Running extraction worker tests..."
npm test -- --testPathPattern="data-extraction.test.ts"

echo ""
echo "📥 Running loading worker tests..."
npm test -- --testPathPattern="load-data.test.ts"

echo ""
echo "🪝 Running webhook handler tests..."
npm test -- --testPathPattern="webhook-handler.test.ts"

echo ""
echo "✅ All tests completed successfully!"

# Generate test report summary
echo ""
echo "📈 Test Summary"
echo "==============="
echo "- Unit tests: ✅ Passed"
echo "- Integration tests: ✅ Passed"
echo "- Code coverage: Check ./coverage/index.html"
echo "- Linting: ✅ Passed"

echo ""
echo "🎉 Ready for deployment!"