#!/bin/bash

# SiteProof v2 - Civil Execution and Conformance Platform
# Environment Setup Script
# ==============================================================================

set -e

echo "=============================================="
echo "  SiteProof v2 - Environment Setup"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print status messages
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."

    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 20+ from https://nodejs.org/"
        exit 1
    fi

    NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
    if [ "$NODE_VERSION" -lt 20 ]; then
        print_error "Node.js version 20+ is required. Current version: $(node -v)"
        exit 1
    fi
    print_success "Node.js $(node -v) detected"

    # Check npm or pnpm
    if command -v pnpm &> /dev/null; then
        PKG_MANAGER="pnpm"
        print_success "pnpm detected - using pnpm as package manager"
    elif command -v npm &> /dev/null; then
        PKG_MANAGER="npm"
        print_success "npm detected - using npm as package manager"
    else
        print_error "No package manager found. Please install npm or pnpm"
        exit 1
    fi

    # Check Git
    if ! command -v git &> /dev/null; then
        print_warning "Git is not installed. Version control features will be limited."
    else
        print_success "Git $(git --version | cut -d ' ' -f 3) detected"
    fi

    echo ""
}

# Setup environment files
setup_env_files() {
    print_status "Setting up environment files..."

    # Backend .env
    if [ ! -f "backend/.env" ]; then
        if [ -f "backend/.env.example" ]; then
            cp backend/.env.example backend/.env
            print_success "Created backend/.env from template"
        else
            cat > backend/.env << 'EOF'
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/siteproof"

# Supabase
SUPABASE_URL="your-supabase-url"
SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"

# Auth
JWT_SECRET="your-jwt-secret-change-in-production"
SESSION_TIMEOUT_HOURS=24

# External Services
RESEND_API_KEY="your-resend-api-key"
ANTHROPIC_API_KEY="your-anthropic-api-key"
BOM_API_KEY="your-bom-api-key"

# Server
PORT=3001
NODE_ENV=development
EOF
            print_success "Created backend/.env with template values"
            print_warning "Please update backend/.env with your actual credentials"
        fi
    else
        print_status "backend/.env already exists, skipping"
    fi

    # Frontend .env
    if [ ! -f "frontend/.env" ]; then
        if [ -f "frontend/.env.example" ]; then
            cp frontend/.env.example frontend/.env
            print_success "Created frontend/.env from template"
        else
            cat > frontend/.env << 'EOF'
# API
VITE_API_URL="http://localhost:3001"

# Supabase
VITE_SUPABASE_URL="your-supabase-url"
VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"

# Feature Flags
VITE_ENABLE_AI_FEATURES=true
VITE_ENABLE_OFFLINE_MODE=true
EOF
            print_success "Created frontend/.env with template values"
            print_warning "Please update frontend/.env with your actual credentials"
        fi
    else
        print_status "frontend/.env already exists, skipping"
    fi

    echo ""
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."

    # Root dependencies (if monorepo)
    if [ -f "package.json" ]; then
        print_status "Installing root dependencies..."
        $PKG_MANAGER install
    fi

    # Backend dependencies
    if [ -d "backend" ] && [ -f "backend/package.json" ]; then
        print_status "Installing backend dependencies..."
        cd backend
        $PKG_MANAGER install
        cd ..
    fi

    # Frontend dependencies
    if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
        print_status "Installing frontend dependencies..."
        cd frontend
        $PKG_MANAGER install
        cd ..
    fi

    print_success "Dependencies installed"
    echo ""
}

# Setup database
setup_database() {
    print_status "Setting up database..."

    if [ -d "backend" ] && [ -f "backend/prisma/schema.prisma" ]; then
        cd backend

        # Generate Prisma client
        print_status "Generating Prisma client..."
        npx prisma generate

        # Run migrations
        print_status "Running database migrations..."
        npx prisma migrate dev --name init 2>/dev/null || {
            print_warning "Migration failed - this is expected if database is not configured"
            print_warning "Make sure your DATABASE_URL is set correctly in backend/.env"
        }

        cd ..
    fi

    echo ""
}

# Start development servers
start_dev_servers() {
    print_status "Starting development servers..."

    echo ""
    echo "=============================================="
    echo "  To start the development servers:"
    echo "=============================================="
    echo ""
    echo "  Option 1: Start both servers (requires two terminals)"
    echo "    Terminal 1: cd backend && $PKG_MANAGER run dev"
    echo "    Terminal 2: cd frontend && $PKG_MANAGER run dev"
    echo ""
    echo "  Option 2: Use the start script"
    echo "    $PKG_MANAGER run dev (from root directory)"
    echo ""
    echo "=============================================="
    echo "  Access the application:"
    echo "=============================================="
    echo ""
    echo "    Frontend: http://localhost:5173"
    echo "    Backend API: http://localhost:3001"
    echo "    API Docs: http://localhost:3001/api-docs (if configured)"
    echo ""
    echo "=============================================="
    echo ""
}

# Main execution
main() {
    echo ""

    # Change to script directory
    cd "$(dirname "$0")"

    check_prerequisites
    setup_env_files
    install_dependencies
    setup_database
    start_dev_servers

    print_success "Setup complete!"
    echo ""
    echo "Next steps:"
    echo "  1. Update .env files with your actual credentials"
    echo "  2. Set up a Supabase project at https://supabase.com"
    echo "  3. Run the database migrations: cd backend && npx prisma migrate dev"
    echo "  4. Start the development servers (see instructions above)"
    echo ""
}

main "$@"
