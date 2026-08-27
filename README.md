SaaS starter — Next.js + TypeScript + Prisma + Postgres. Multi-tenant auth MVP: sign up, log in (credentials or Google), each user gets an organization, dashboard, and basic org settings.

## Getting started

1. Start a Postgres instance and point `DATABASE_URL` at it. A `docker-compose.yml` is included:

   ```bash
   docker compose up -d
   ```

2. Copy `.env.example` to `.env` and fill in the values. `DATABASE_URL` and `AUTH_SECRET` are required; everything else (Google OAuth, Resend, Stripe) is optional and the app degrades gracefully when unset.

3. Run migrations:

   ```bash
   npx prisma migrate dev --name init
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## What's here

- **Auth** — email/password (credentials) and optional Google OAuth via NextAuth (Auth.js v5). Set `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` in `.env` to enable Google sign-in. Credentials signups get a verification email (Google sign-ins are trusted immediately); a dashboard banner offers to resend it until you verify, but verification isn't required to use the app. `/forgot-password` → `/reset-password/[token]` covers password recovery, and resetting a password invalidates any other active session for that account (checked on every request in `jwtCallback`, [src/lib/session.ts](src/lib/session.ts)) — a password reset is meant to lock out anyone else with access, not just add a new valid credential alongside the old session. Both flows share a single-use, SHA-256-hashed token helper ([src/lib/tokens.ts](src/lib/tokens.ts)) built on the existing `VerificationToken` model. Login, signup, and password-reset requests are all rate-limited per IP (`AUTH_RATE_LIMIT_PER_HOUR`, default 10/hour — see [src/lib/rate-limit.ts](src/lib/rate-limit.ts)).
- **Multi-tenancy** — every user gets an `Organization` on signup with an `OrganizationMember` role (`OWNER`/`ADMIN`/`MEMBER`). A user can belong to multiple orgs (e.g. by accepting an invite into a second one) and switch between them from the sidebar — the active org is remembered in an `activeOrgId` cookie. Schema is in [prisma/schema.prisma](prisma/schema.prisma).
- **Dashboard** — protected by [src/proxy.ts](src/proxy.ts), shows the active org and a settings page for renaming it (owner/admin only).
- **Team invites** — owners/admins invite by email from [dashboard/team](src/app/dashboard/team/page.tsx). If `RESEND_API_KEY` is set the invite is emailed via [Resend](https://resend.com); either way the link is also shown on screen to copy/send manually. Accepting at `/invite/[token]` signs the invitee up (or logs them in) and joins them to the inviting org instead of creating a new default one. Owners can change member roles and remove members; nobody can remove or demote the owner.
- **Billing** — Stripe subscriptions per organization ([dashboard/billing](src/app/dashboard/billing/page.tsx)), seat-based: the Checkout line item and, after invites/removals, the live subscription quantity (via `syncSeatCount()` in [src/lib/seats.ts](src/lib/seats.ts)) track the org's member count. Supports multiple plans: set `STRIPE_PRICE_STARTER`/`STRIPE_PRICE_PRO` (or just `STRIPE_PRICE_ID` for a single plan) and the billing page renders one Checkout button per plan (see [src/lib/plans.ts](src/lib/plans.ts)). Owners/admins can start Checkout for any plan and manage their subscription via the Stripe customer portal; `/api/webhooks/stripe` keeps subscription status in sync. Requires `STRIPE_SECRET_KEY` and at least one price — without them the billing page shows as unconfigured instead of erroring.
- **API keys** — owners/admins can generate per-organization API keys from [dashboard/api-keys](src/app/dashboard/api-keys/page.tsx) (shown once at creation, stored as a SHA-256 hash), scoped to `read` and/or `write`, and revoke them. Each scope is rate-limited independently (`API_KEY_RATE_LIMIT_READ_PER_MINUTE`/`_WRITE_PER_MINUTE`, falling back to `API_KEY_RATE_LIMIT_PER_MINUTE`, default 60/min). `/api/v1/me` is a sample route showing how to authenticate a request and enforce a scope via `authenticateApiKey()` in [src/lib/api-keys.ts](src/lib/api-keys.ts).
- **Platform admin** — a `/admin` panel (gated in [src/proxy.ts](src/proxy.ts)) for anyone whose email is listed in `SUPER_ADMIN_EMAILS` (comma-separated; unset by default, so nobody has access until configured). Lists organizations and users; each organization's detail page (`/admin/organizations/[id]`) lets a super admin invite someone into that org directly (via the same [src/lib/invitations.ts](src/lib/invitations.ts) helper the team page uses, without needing to be a member) and suspend/unsuspend it — a suspended org's members are locked out of the dashboard and its API keys stop working until it's unsuspended.
- **Tests + CI** — `npm test` runs the [Vitest](https://vitest.dev) suite (`src/**/*.test.ts`, 35 tests): pure unit tests for `lib/plans.ts`/`lib/admin.ts`, and integration tests against a real Postgres via Prisma for everything else — API keys, invitations, tokens, rate limiting, and the session-invalidation/fail-closed-URL security properties described above. [.github/workflows/ci.yml](.github/workflows/ci.yml) runs build, lint, and the test suite (against a Postgres service container) on every push to `main` and every pull request.

## Not yet built

An admin ability to remove/delete an organization outright (suspend is reversible; delete isn't, so it's intentionally left out) — see the original product spec for the full roadmap.
