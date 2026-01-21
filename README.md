# SiteProof

Construction quality management platform for tracking inspections, hold points, and compliance documentation.

## Quick Start

### Prerequisites

- Node.js 20+
- SQLite (development) or PostgreSQL (production)

### Environment Variables

Create a `.env` file in the `backend` directory:

```env
# Required
JWT_SECRET=your-secure-secret-key-here

# Optional
ENCRYPTION_KEY=your-32-byte-hex-key  # For 2FA secret encryption
DATABASE_URL=file:./dev.db           # SQLite default, or PostgreSQL connection string
JWT_EXPIRY=24h                        # Token expiration time
```

### Installation

#### Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

The application will be available at `http://localhost:5173` with the API at `http://localhost:3001`.

## Architecture

### Frontend
- **React 18** - UI framework
- **Zustand** - State management
- **TailwindCSS** - Styling
- **React Query** - Server state management
- **React Router** - Client-side routing

### Backend
- **Express** - HTTP server
- **Prisma** - Database ORM
- **SQLite/PostgreSQL** - Database
- **JWT** - Authentication tokens
- **bcrypt** - Password hashing

### Authentication
- JWT-based authentication with configurable expiry
- bcrypt password hashing (12 rounds)
- Optional two-factor authentication (TOTP)

## Security

See [SECURITY.md](./SECURITY.md) for detailed security documentation.

## License

Proprietary - All rights reserved.
