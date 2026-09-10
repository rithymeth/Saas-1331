SaaS starter — Next.js + TypeScript + Prisma + Postgres. Multi-tenant: sign up, log in (credentials or Google), each user gets an organization with teammates, billing, API keys — and a Trello/Linear-style project board to actually get work done in.

## Getting started

1. Start a Postgres instance and point `DATABASE_URL` at it. A `docker-compose.yml` is included:

   ```bash
   docker compose up -d
   ```

2. Copy `.env.example` to `.env` and fill in the values. `DATABASE_URL` and `AUTH_SECRET` are required; everything else (Google OAuth, Resend, Stripe) is optional and the app degrades gracefully when unset. In production, also set `NEXT_PUBLIC_APP_URL`; if you enable Google OAuth, set both Google variables; if you enable Stripe, set `STRIPE_WEBHOOK_SECRET` too.

3. Run migrations:

   ```bash
   npx prisma migrate dev --name init
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

### Toolchain

- Node.js 22.x is the supported runtime for local development and CI.
- Dependency updates are automated through [Dependabot](.github/dependabot.yml), grouped by framework/auth, database, billing/email, and dev tooling.

## What's here

- **Auth** — email/password (credentials) and optional Google OAuth via NextAuth (Auth.js v5 beta; there is no stable v5-compatible replacement on npm yet, so this repo tracks the beta line intentionally). Set `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` in `.env` to enable Google sign-in. Credentials signups get a verification email (Google sign-ins are trusted immediately); a dashboard banner offers to resend it until you verify, but verification isn't required to use the app. `/forgot-password` → `/reset-password/[token]` covers password recovery, and resetting a password invalidates any other active session for that account (checked on every request in `jwtCallback`, [src/lib/session.ts](src/lib/session.ts)) — a password reset is meant to lock out anyone else with access, not just add a new valid credential alongside the old session. Both flows share a single-use, SHA-256-hashed token helper ([src/lib/tokens.ts](src/lib/tokens.ts)) built on the existing `VerificationToken` model. Login, signup, and password-reset requests are all rate-limited per IP (`AUTH_RATE_LIMIT_PER_HOUR`, default 10/hour — see [src/lib/rate-limit.ts](src/lib/rate-limit.ts)). Production auth now fails loudly for incomplete env setup such as a missing `AUTH_SECRET` or only one Google OAuth credential.
- **Multi-tenancy** — every user gets an `Organization` on signup with an `OrganizationMember` role (`OWNER`/`ADMIN`/`MEMBER`). A user can belong to multiple orgs (e.g. by accepting an invite into a second one) and switch between them from the sidebar — the active org is remembered in an `activeOrgId` cookie. Schema is in [prisma/schema.prisma](prisma/schema.prisma).
- **Dashboard** — protected by [src/proxy.ts](src/proxy.ts), shows the active org and a settings page for renaming it (owner/admin only).
- **Projects** — a simple Kanban board per organization ([dashboard/projects](src/app/dashboard/projects/page.tsx)): any visible member can create a project, add tasks (title, description, assignee, due date) to it, edit a task's details after creation, and move tasks between Todo/In Progress/Done by dragging a card between columns (or via the status dropdown on each card, which still works as a non-drag fallback) — see [src/components/task-board.tsx](src/components/task-board.tsx). By default a project is open to the whole organization; an owner/admin can restrict it to specific members from the project's "Access" section, in which case everyone else — including the projects list and dashboard home — stops seeing it exists (owners/admins always keep access). Every project/task lookup — including the edit page — goes through `getProjectForOrg()`/`getTaskForOrg()` ([src/lib/projects.ts](src/lib/projects.ts)), which returns `null` for anything belonging to a different organization *or* a project the requester isn't allowed to see — the same pattern the rest of the app uses to keep tenants isolated even when someone has (or guesses) another org's ID. Assigning a task to someone else emails them (`notifyTaskAssignment()` in [src/lib/notifications.ts](src/lib/notifications.ts), same console-log fallback as the rest of the app's email when `RESEND_API_KEY` is unset); assigning to yourself, or saving a task without changing its assignee, doesn't send anything.
- **Team invites** — owners/admins invite by email from [dashboard/team](src/app/dashboard/team/page.tsx). If `RESEND_API_KEY` is set the invite is emailed via [Resend](https://resend.com); either way the link is also shown on screen to copy/send manually. Invite, verification, password-reset, task-assignment, and Stripe return URLs all use the configured `NEXT_PUBLIC_APP_URL` in production rather than trusting request headers. Accepting at `/invite/[token]` signs the invitee up (or logs them in) and joins them to the inviting org instead of creating a new default one. Owners can change member roles and remove members; nobody can remove or demote the owner.
- **Billing** — Stripe subscriptions per organization ([dashboard/billing](src/app/dashboard/billing/page.tsx)), seat-based: the Checkout line item and, after invites/removals, the live subscription quantity (via `syncSeatCount()` in [src/lib/seats.ts](src/lib/seats.ts)) track the org's member count. Supports multiple plans: set `STRIPE_PRICE_STARTER`/`STRIPE_PRICE_PRO` (or just `STRIPE_PRICE_ID` for a single plan) and the billing page renders one Checkout button per plan (see [src/lib/plans.ts](src/lib/plans.ts)). Owners/admins can start Checkout for any plan and manage their subscription via the Stripe customer portal; `/api/webhooks/stripe` keeps subscription status in sync. Requires `STRIPE_SECRET_KEY` and at least one price — without them the billing page shows as unconfigured instead of erroring.
- **API keys** — owners/admins can generate per-organization API keys from [dashboard/api-keys](src/app/dashboard/api-keys/page.tsx) (shown once at creation, stored as a SHA-256 hash), scoped to `read` and/or `write`, and revoke them. Each scope is rate-limited independently (`API_KEY_RATE_LIMIT_READ_PER_MINUTE`/`_WRITE_PER_MINUTE`, falling back to `API_KEY_RATE_LIMIT_PER_MINUTE`, default 60/min). `/api/v1/me` is a sample route showing how to authenticate a request and enforce a scope via `authenticateApiKey()` in [src/lib/api-keys.ts](src/lib/api-keys.ts).
- **Platform admin** — a `/admin` panel (gated in [src/proxy.ts](src/proxy.ts)) for anyone whose email is listed in `SUPER_ADMIN_EMAILS` (comma-separated; unset by default, so nobody has access until configured). Lists organizations and users; each organization's detail page (`/admin/organizations/[id]`) lets a super admin invite someone into that org directly (via the same [src/lib/invitations.ts](src/lib/invitations.ts) helper the team page uses, without needing to be a member), suspend/unsuspend it, and permanently delete it. Deletion is intentionally guarded: the org must already be suspended, the admin must re-type the org slug, and any active or delinquent subscription must be resolved first.
- **Tests + CI** — `npm test` runs the [Vitest](https://vitest.dev) suite (`src/**/*.test.ts`) covering unit, route-handler, and Postgres-backed integration behavior — including org switching, Stripe webhook sync, admin deletion safeguards, API keys, invitations, tokens, rate limiting, cross-org isolation for projects/tasks, and the session-invalidation/fail-closed-URL security properties described above. [.github/workflows/ci.yml](.github/workflows/ci.yml) now splits dependency review, quality, test, and build stages so dependency/security issues, Prisma validation, lint failures, test failures, and build regressions are isolated.
