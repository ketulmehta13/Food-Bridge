# FoodBridge

A surplus food donation network built on the MERN stack. **Donors** (restaurants, caterers, households) post surplus food, nearby **NGOs** claim and pick it up, and **Admins** verify accounts and oversee the platform.

- **Roles:** `USER` (with `userType` `DONOR` or `NGO`) and `ADMIN`
- **Donation lifecycle:** `AVAILABLE → CLAIMED → PICKED_UP → DISTRIBUTED` (or `EXPIRED` / `CANCELLED`)

## Tech stack

| Layer    | Tech                                                         |
| -------- | ------------------------------------------------------------ |
| Backend  | Node.js, Express (ES modules), MongoDB + Mongoose, JWT, Zod  |
| Frontend | React, Vite, React Router, Axios, Tailwind CSS v4            |

## Folder structure

```
Food Bridge/
├── backend/
│   ├── server.js              # Entry: connect DB, start server
│   ├── .env.example
│   └── src/
│       ├── app.js             # Express app (middleware, /api routes, errors)
│       ├── config/            # env.js, db.js
│       ├── constants/         # Roles, statuses, enums
│       ├── controllers/       # Request handlers (per feature)
│       ├── jobs/              # Scheduled jobs (e.g. expiry)
│       ├── middlewares/       # auth, validate, error
│       ├── models/            # Mongoose models
│       ├── routes/            # index.js mounts feature routers at /api
│       ├── services/          # Business logic
│       ├── sockets/           # Real-time (Socket.IO) handlers
│       ├── utils/             # ApiError, ApiResponse, asyncHandler, tokens, geo, otp
│       └── validators/        # Zod schemas
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── vercel.json            # SPA rewrite
    ├── .env.example
    └── src/
        ├── api/               # axiosInstance (refresh-on-401)
        ├── components/
        │   ├── shared/        # ProtectedRoute, StatusBadge
        │   └── ui/            # Reusable UI primitives
        ├── constants/         # Mirrors backend enums + status styles
        ├── features/          # auth, donor, ngo, admin
        ├── hooks/             # useAuth
        ├── layouts/
        ├── pages/             # Home, NotFound
        └── utils/
```

## Getting started

Prerequisites: Node.js 20+, npm, and a MongoDB instance (local or Atlas).

### Backend

```bash
cd backend
cp .env.example .env      # then fill in MONGO_URI, JWT secrets, etc.
npm install
npm run dev               # http://localhost:5000  →  GET /api/health
```

### Frontend

```bash
cd frontend
cp .env.example .env      # VITE_API_URL=http://localhost:5000/api
npm install
npm run dev               # http://localhost:5173
```

## Branching rules

- `main` — stable. **Changes land only via Pull Request**; no direct pushes.
- `ketul-dev` — Ketul's working branch.
- `jay-dev` — Jay's working branch.

Workflow: pull the latest `main` into your branch, build your feature, push, and open a PR into `main`.

## Team conventions (avoiding merge conflicts)

Each feature lives in its own files. Add code inside **your** feature's files only:

| Feature | Owner | Backend | Frontend |
| ------- | ----- | ------- | -------- |
| NGO     | Ketul | `routes/ngo.routes.js` → `/api/ngo/*`, `ngo.*` controllers/services/validators | `features/ngo/` (pages go in `NgoRoutes.jsx`) → `/ngo/*` |
| Donor   | Jay   | `routes/donor.routes.js` → `/api/donor/*`, `donor.*` controllers/services/validators | `features/donor/` (pages go in `DonorRoutes.jsx`) → `/donor/*` |

Shared files have a single owner. Ask them (or open a small separate PR) before changing:

| Shared file(s) | Owner |
| -------------- | ----- |
| `models/User.js`, auth (`/api/auth`, `/api/users`), Login/Register pages | Ketul |
| `models/Donation.js` | Jay |
| `routes/index.js`, `App.jsx`, `constants/`, `components/ui/`, `layouts/`, `index.css` | Agree first, merge early |

Rules of thumb:

- `git pull origin main` into your branch at the start of every session.
- Small PRs, merged one at a time; pull `main` again before opening the next one.
- Tell each other before `npm install`-ing a new package. On a `package-lock.json` conflict, take `main`'s version and re-run `npm install`.

## Commit style

Use [Conventional Commit](https://www.conventionalcommits.org/) prefixes:

| Prefix      | Use for                                    |
| ----------- | ------------------------------------------ |
| `feat:`     | A new feature                              |
| `fix:`      | A bug fix                                  |
| `refactor:` | Code change that is neither feat nor fix   |
| `chore:`    | Tooling, config, dependencies              |
| `docs:`     | Documentation only                         |

Example: `feat: add donation claim endpoint`
