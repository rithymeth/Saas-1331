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

- **Auth** — email/password (credentials) and optional Google OAuth via NextAuth (Auth.js v5). Set `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` in `.env` to enable Google sign-in.
- **Multi-tenancy** — every user gets an `Organization` on signup with an `OrganizationMember` role (`OWNER`/`ADMIN`/`MEMBER`). A user can belong to multiple orgs (e.g. by accepting an invite into a second one) and switch between them from the sidebar — the active org is remembered in an `activeOrgId` cookie. Schema is in [prisma/schema.prisma](prisma/schema.prisma).
- **Dashboard** — protected by [src/proxy.ts](src/proxy.ts), shows the active org and a settings page for renaming it (owner/admin only).
- **Team invites** — owners/admins invite by email from [dashboard/team](src/app/dashboard/team/page.tsx). If `RESEND_API_KEY` is set the invite is emailed via [Resend](https://resend.com); either way the link is also shown on screen to copy/send manually. Accepting at `/invite/[token]` signs the invitee up (or logs them in) and joins them to the inviting org instead of creating a new default one. Owners can change member roles and remove members; nobody can remove or demote the owner.
- **Billing** — Stripe subscriptions per organization ([dashboard/billing](src/app/dashboard/billing/page.tsx)). Owners/admins can start a Checkout session and manage their subscription via the Stripe customer portal; `/api/webhooks/stripe` keeps subscription status in sync. Requires `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, and `STRIPE_WEBHOOK_SECRET` — without them the billing page shows as unconfigured instead of erroring.
- **API keys** — owners/admins can generate per-organization API keys from [dashboard/api-keys](src/app/dashboard/api-keys/page.tsx) (shown once at creation, stored as a SHA-256 hash) and revoke them. `/api/v1/me` is a sample route showing how to authenticate a request with `Authorization: Bearer <key>` via [src/lib/api-keys.ts](src/lib/api-keys.ts).
- **Platform admin** — a read-only `/admin` panel (organizations + users, gated in [src/proxy.ts](src/proxy.ts)) for anyone whose email is listed in `SUPER_ADMIN_EMAILS` (comma-separated). Unset by default, so nobody has access until you configure it.

## Not yet built

Multiple pricing tiers / seat-based billing, API-key scopes/rate limiting, and inviting a user directly from the admin panel — see the original product spec for the full roadmap.
