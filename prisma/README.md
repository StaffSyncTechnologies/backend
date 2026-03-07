# StaffSync Database Schema

PostgreSQL database schema using Prisma ORM.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure database

Copy `.env.example` to `.env` and update `DATABASE_URL`:

```bash
cp .env.example .env
```

### 3. Generate Prisma Client

```bash
npm run db:generate
```

### 4. Push schema to database

For development (no migrations):
```bash
npm run db:push
```

For production (with migrations):
```bash
npm run db:migrate
```

### 5. Seed the database

```bash
npm run db:seed
```

### 6. View data (optional)

```bash
npm run db:studio
```

## Schema Overview

### Core Entities (MVP)

| Entity | Description |
|--------|-------------|
| `Organization` | Agency or direct company |
| `User` | Admin, Ops Manager, Coordinator, Worker |
| `WorkerProfile` | Extended worker info, RTW status |
| `ClientCompany` | Client companies (agency mode) |
| `Location` | Work sites with geofencing |
| `Shift` | Individual shifts |
| `Attendance` | Clock in/out records |

### Worker Management

| Entity | Description |
|--------|-------------|
| `Skill` | Skills catalogue (6 categories) |
| `WorkerSkill` | Worker's skills |
| `WorkerDocument` | Uploaded documents/certs |
| `WorkerAvailability` | Weekly availability |
| `WorkerBlock` | Block/ban records |
| `WorkerReliabilityScore` | Performance metrics |

### Scheduling

| Entity | Description |
|--------|-------------|
| `Rota` | Weekly/monthly rotas |
| `RotaShift` | Shifts within a rota |
| `ShiftAssignment` | Worker-to-shift assignments |
| `ShiftBroadcast` | Shift broadcast to workers |

### Payroll & Invoicing (v2.0)

| Entity | Description |
|--------|-------------|
| `PayPeriod` | Pay period (weekly/monthly) |
| `Payslip` | Worker payslips |
| `Invoice` | Client invoices |

## Entity Relationships

```
Organization
├── Users (Admin, Ops, Workers)
├── ClientCompanies (Agency mode)
├── Locations
├── Shifts
├── Rotas
└── PayPeriods

User (Worker)
├── WorkerProfile
├── WorkerSkills
├── WorkerDocuments
├── WorkerAvailability
├── ShiftAssignments
├── Attendances
└── Payslips

Shift
├── ShiftAssignments
├── Attendances
├── RequiredSkills
└── Broadcasts
```

## Skill Categories

- **WAREHOUSE** - Picking, packing, forklift, etc.
- **HEALTHCARE** - Care skills, nursing
- **CLEANING** - Office, industrial cleaning
- **SECURITY** - SIA, door supervision
- **HOSPITALITY** - Waiting, bar, kitchen
- **LABOUR** - General, construction
- **CERTIFICATION** - Formal certifications
