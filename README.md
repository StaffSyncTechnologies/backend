# StaffSync Backend API

Node.js Express TypeScript backend for StaffSync workforce management platform.

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** JWT (jsonwebtoken)
- **Validation:** Zod

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment

```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 3. Set up database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed initial data
npm run db:seed
```

### 4. Run development server

```bash
npm run dev
```

Server runs at `http://localhost:3001`

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register organization + admin |
| POST | `/api/v1/auth/login` | Login |
| GET | `/api/v1/auth/me` | Get current user |
| PUT | `/api/v1/auth/me` | Update profile |
| POST | `/api/v1/auth/change-password` | Change password |

### Organizations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/organizations/current` | Get current org |
| PUT | `/api/v1/organizations/current` | Update org |
| PUT | `/api/v1/organizations/current/branding` | Update logo/colors |
| GET | `/api/v1/organizations/current/clients` | List clients |
| POST | `/api/v1/organizations/current/clients` | Add client |

### Users (Team)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/users` | List team members |
| POST | `/api/v1/users` | Create team member |
| PUT | `/api/v1/users/:id` | Update user |
| POST | `/api/v1/users/:id/suspend` | Suspend user |

### Workers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/workers` | List workers |
| GET | `/api/v1/workers/:id` | Get worker details |
| PUT | `/api/v1/workers/:id/skills` | Update skills |
| POST | `/api/v1/workers/:id/documents` | Upload document |
| POST | `/api/v1/workers/invite` | Invite worker |

### Shifts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/shifts` | List shifts |
| POST | `/api/v1/shifts` | Create shift |
| POST | `/api/v1/shifts/:id/assignments` | Assign worker |
| POST | `/api/v1/shifts/:id/clock-in` | Clock in |
| POST | `/api/v1/shifts/:id/clock-out` | Clock out |

### Skills
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/skills` | List all skills |
| GET | `/api/v1/skills/categories` | Get categories |

### Locations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/locations` | List locations |
| POST | `/api/v1/locations` | Create location |

### Onboarding
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/onboarding/status` | Get progress |
| PUT | `/api/v1/onboarding/branding` | Save branding |
| POST | `/api/v1/onboarding/location` | Add location |
| POST | `/api/v1/onboarding/shift` | Create shift |
| POST | `/api/v1/onboarding/worker/invite` | Invite worker |
| POST | `/api/v1/onboarding/client` | Add client |
| POST | `/api/v1/onboarding/team/invite` | Invite team |

## Project Structure

```
src/
├── index.ts              # Entry point
├── config/               # Configuration
├── controllers/          # Route handlers
├── lib/                  # Shared libraries (Prisma)
├── middleware/           # Express middleware
├── routes/               # Route definitions
└── utils/                # Utilities

prisma/
├── schema.prisma         # Database schema
└── seed.ts               # Seed data
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm start` | Run production build |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to DB |
| `npm run db:seed` | Seed database |
| `npm run db:studio` | Open Prisma Studio |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3001 |
| `NODE_ENV` | Environment | development |
| `DATABASE_URL` | PostgreSQL URL | - |
| `JWT_SECRET` | JWT signing key | - |
| `JWT_EXPIRES_IN` | Token expiry | 7d |
| `CORS_ORIGIN` | Allowed origin | http://localhost:3000 |
# backend
