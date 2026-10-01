# AGENTS.md — Plataforma ULTEC (Ultra Tecnología)

> Standard AI Agent Guidelines for Plataforma ULTEC.
> For active deployment history, live VPS infrastructure, and roadmap progress, see [memory.md](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/memory.md).

---

## 1. Project Overview & Architecture
Plataforma ULTEC is an enterprise School Management System (ERP + LMS) serving technical training institutes, secondary schools, and high schools across multiple physical branches.

- **Local Root:** `C:\Users\saul_\.gemini\antigravity\scratch\PlataformaULTEC`
- **Frontend App:** `frontend-antigravity/` (SPA / PWA / Android Capacitor)
- **Backend API:** `backend-insforge/` (REST API Node.js + Express + TypeScript)
- **Database:** PostgreSQL 15 (Self-hosted Supabase with PostgREST, GoTrue, Realtime, Storage)
- **Mobile Container:** Capacitor Android 7 (`com.plataformaultec.app`)
- **Production Server:** Oracle Cloud Infrastructure Ubuntu Server (`129.213.56.16`), domain `https://plataformaultec.duckdns.org`

---

## 2. Setup & Build Commands

### Frontend (`frontend-antigravity/`)
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Type check
npx tsc --noEmit

# Production build (outputs to dist/)
npm run build

# Sync web assets to Android Capacitor project
npx cap sync android
```

### Backend (`backend-insforge/`)
```bash
# Install dependencies
npm install

# Start development server with hot-reload
npm run dev

# Type check
npx tsc --noEmit

# Production build (compiles TypeScript to dist/)
npm run build
```

---

## 3. Technology Stack & Key Libraries

### Frontend
- **Framework:** React 19, TypeScript, Vite 7
- **Styling:** TailwindCSS 3 (Dark/Light mode via `isDarkMode` state in `localStorage`)
- **Server Cache & State:** `@tanstack/react-query` v5
- **Icons & Modals:** `lucide-react`, portals with `ConfirmModal`
- **HTTP Client:** Central Axios instance in `src/services/apiClient.ts`
  - Injects `Authorization: Bearer <token>`
  - Injects `X-Branch-Id: <branchId>` from `BranchContext`
  - Contains strict 401/403 loop prevention (`isPublicPath`)

### Backend
- **Framework:** Express 4.x + TypeScript compiled with `tsc`
- **Database Access:** `@supabase/supabase-js`
  - `client`: Authenticated operations with anon key adhering to Postgres RLS
  - `adminClient`: Privileged operations using `service_role` key (SuperAdmin bypass)
- **Security:** `helmet`, dynamic `cors` (allowing `X-Branch-Id`), `express-rate-limit`

---

## 4. Golden Architectural & Security Rules

### 1. Multi-Tenant Branch Isolation (`X-Branch-Id`)
- Every authenticated request carries the active branch scope via `X-Branch-Id` header.
- Use `getEffectiveBranchId(req)` in backend controllers to resolve target branch:
  - If `user.role === 'superadmin'`: Respects `'all'` or specific UUID.
  - If `user.role !== 'superadmin'`: Overrides with `user.branch_id` strictly.
- Never allow non-superadmin users to access or mutate records from other branches.

### 2. Physical Student ID & Document Security (Carnets)
- **NO Student/Parent Printing:** Students (`student`) and parents/guardians (`parent`) are **strictly forbidden** from directly downloading or printing physical credentials/carnets or official certificates.
- Official IDs are requested via the portal (`document_authorizations`) and issued **physically and in-person** by administrative staff (`superadmin`, `admin`, `secretary`) using CR80 PVC printing.
- Public QR verification at `/verify-student/:code` and `/verify-receipt/:receiptNumber` allows access-control validation without exposing sensitive private records.

### 3. Express Route Mounting Order in `app.ts` (CRITICAL)
- Public and semi-public routes (e.g. `/api/branches`, `/api/app-version`, `/api/verify-receipt`, `/api/verify-student`) **MUST** be mounted in `app.ts` **BEFORE** routers that apply `router.use(requireAuth)`.
- If mounted afterwards, Express will enforce the auth middleware and block unauthenticated users from seeing landing pages, login selectors, or public QR validations.

### 4. Auth Redirection Guard
- In `apiClient.ts`, never trigger `window.location.href = '/login'` on 401/403 if the user is already on a public route (`/login`, `/reset-password`, `/verify-receipt`, `/verify-student`). This prevents infinite browser refresh loops.

### 5. Multi-File Version Synchronization Protocol
When performing a version bump (e.g., from `v1.2.0` to `v1.3.0`), the following **5 files** must be updated simultaneously:
1. `frontend-antigravity/package.json` (`"version"`)
2. `frontend-antigravity/src/features/system/SystemDashboard.tsx` (version badge)
3. `frontend-antigravity/android/app/build.gradle` (`versionCode` + 1, `versionName`)
4. `backend-insforge/package.json` (`"version"`)
5. `memory.md` (Update current active version and changelog)

---

## 5. Prohibited Operations & Operational Boundaries
- **Destructive SQL:** NEVER run `DROP TABLE`, `DROP DATABASE`, `TRUNCATE`, or unconstrained `DELETE` without prior explicit approval.
- **PostgreSQL Internal Credentials:** NEVER modify or alter the password of internal Postgres user `supabase_admin` (must remain `ULTECpostgres2026!Secure`). Changing it causes infinite container crash loops in `supabase-pooler` and `supabase-realtime`.
- **VPS CPU Telemetry:** Never divide `os.loadavg()[0]` by CPU cores on a 1-core VPS (uninterruptible disk I/O skews Linux loadavg). Use the tick-sampling method in `devops.service.ts`.
- **Do not introduce redundant state stores:** Use `@tanstack/react-query` for server state and existing React Contexts for UI state.

---

## 6. Directory Map

```
PlataformaULTEC/
├── AGENTS.md                  # This file (Immediate instructions & standards for AI Agents)
├── memory.md                  # Operational memory, changelog, VPS layout & roadmap
├── frontend-antigravity/       # React 19 + Vite + Tailwind SPA & Capacitor Android
│   ├── src/
│   │   ├── components/        # Reusable UI components & modals
│   │   ├── context/           # Auth, Branch, Theme, Update, Idle contexts
│   │   ├── features/          # Feature domains (academic, finance, credentials, etc.)
│   │   ├── services/          # apiClient.ts, pushService, offlineSync
│   │   └── types/             # Shared frontend TypeScript interfaces
│   └── android/               # Capacitor Android native project
└── backend-insforge/          # Express + TypeScript API
    └── src/
        ├── controllers/       # HTTP route handlers
        ├── middleware/        # Auth, audit, rate-limit, branch guards
        ├── routes/            # Express route declarations
        ├── services/          # Business logic, backups, devops telemetría
        └── utils/             # Database clients (client, adminClient) & branch helpers
```
