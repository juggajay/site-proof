# SiteProof v2

**Civil Execution and Conformance Platform**

SiteProof v2 is a purpose-built platform for Australian Tier 2-3 civil contractors handling $10M-$100M projects. It eliminates the "Excel Parallel Universe" by making the **Lot** the atomic unit of the system - every photo, test result, checklist, docket, and claimed dollar traces back to a spatial container defined by chainage, offset, and layer.

## Features

### Core Modules

1. **Project Setup** - Project creation, configuration, team management, and ITP template setup
2. **Lot Management** - The heart of the system - lot register, status tracking, linear map visualization
3. **ITP Inspections** - Inspection and Test Plan templates and completion workflow
4. **Hold Points** - Hold point notification, tracking, and release workflow
5. **Test Results** - Test result entry, AI extraction, verification, and tracking
6. **NCR Lifecycle** - Non-conformance report creation, workflow, and closure
7. **Daily Diary** - Daily site diary with weather, personnel, plant, activities, and delays
8. **Progress Claims** - Progress claim preparation, evidence packages, and SOPA compliance
9. **Documents & Photos** - Document and photo storage, organization, and retrieval
10. **Subcontractor Portal** - Subcontractor onboarding, docket submission, and cost tracking
11. **Reporting & Dashboards** - Role-based dashboards, reports, and notifications

### Key Capabilities

- **Lot-Centric Quality Management** - Everything traces back to the lot
- **ITP Workflows** - Complete inspection and test plan management
- **Hold Point Tracking** - Digital hold point release with evidence packages
- **NCR Management** - Full non-conformance lifecycle
- **Offline Support** - PWA with offline-first architecture
- **AI Features** - Test certificate parsing, photo classification, voice-to-text
- **SOPA Compliance** - Progress claims with proper evidence packages
- **Role-Based Access** - 10 distinct roles with appropriate permissions

## Technology Stack

### Frontend
- **Framework:** React 18+ with TypeScript
- **Styling:** Tailwind CSS with shadcn/ui components
- **State Management:** TanStack Query (server state), Zustand (client state)
- **Forms:** React Hook Form with Zod validation
- **Routing:** React Router v6
- **Charts:** Recharts
- **PDF:** React-PDF for viewing, jsPDF for generation

### Backend
- **Runtime:** Node.js 20+ with TypeScript
- **Framework:** Express.js with tRPC for type-safe APIs
- **Database:** PostgreSQL via Supabase
- **ORM:** Prisma
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage
- **Realtime:** Supabase Realtime
- **Email:** Resend
- **AI:** Anthropic Claude API

### Offline Support
- **Web:** IndexedDB via Dexie.js
- **Mobile:** SQLite for React Native
- **Sync:** Custom sync engine with conflict resolution

## Getting Started

### Prerequisites

- Node.js 20+
- npm or pnpm
- PostgreSQL (via Supabase)
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd site-proofv3
   ```

2. Run the setup script:
   ```bash
   chmod +x init.sh
   ./init.sh
   ```

3. Configure environment variables:
   - Update `backend/.env` with your Supabase and API credentials
   - Update `frontend/.env` with your Supabase public credentials

4. Set up the database:
   ```bash
   cd backend
   npx prisma migrate dev
   ```

5. Start the development servers:
   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev

   # Terminal 2 - Frontend
   cd frontend && npm run dev
   ```

6. Access the application:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

### External Services Required

- **Supabase** - Auth, database, storage, realtime
- **Resend** - Transactional emails
- **Anthropic Claude** - AI features (test extraction, classification)
- **BOM API** - Weather data (optional)

## Project Structure

```
site-proofv3/
├── frontend/           # React frontend application
│   ├── src/
│   │   ├── components/ # Reusable UI components
│   │   ├── features/   # Feature-specific modules
│   │   ├── hooks/      # Custom React hooks
│   │   ├── lib/        # Utility functions and configs
│   │   ├── pages/      # Page components
│   │   ├── stores/     # Zustand stores
│   │   └── types/      # TypeScript types
│   └── public/         # Static assets
├── backend/            # Node.js backend application
│   ├── src/
│   │   ├── routes/     # API route handlers
│   │   ├── services/   # Business logic
│   │   ├── middleware/ # Express middleware
│   │   ├── utils/      # Utility functions
│   │   └── types/      # TypeScript types
│   └── prisma/         # Database schema and migrations
├── prompts/            # AI agent prompts and specs
├── features.db         # Feature tracking database
├── init.sh             # Setup script
└── README.md           # This file
```

## User Roles

| Role | Description |
|------|-------------|
| **Owner** | Company owner with full access |
| **Admin** | Project administrator with full project access |
| **Project Manager** | Full project access with commercial visibility |
| **Site Engineer** | Full operational access, no commercial visibility |
| **Quality Manager** | Quality focused, NCR and conformance management |
| **Foreman** | Limited access for daily operations |
| **Viewer** | Read-only access |
| **Subcontractor Admin** | Subcontractor company administrator |
| **Subcontractor User** | Subcontractor worker/supervisor |
| **Superintendent** | External client representative |

## License

Proprietary - All rights reserved.

## Support

For support, please contact the development team.
