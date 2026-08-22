SaaS starter — Next.js + TypeScript + Prisma + Postgres. Multi-tenant auth MVP: sign up, log in (credentials or Google), each user gets an organization, dashboard, and basic org settings.

## Getting started

1. Start a Postgres instance and point `DATABASE_URL` at it. A `docker-compose.yml` is included:

   ```bash
   docker compose up -d
   ```

2. Copy `.env.example` to `.env` and fill in the values (an `.env` with local defaults matching `docker-compose.yml` is already set up).

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
- **Multi-tenancy** — every user gets an `Organization` on signup with an `OrganizationMember` role (`OWNER`/`ADMIN`/`MEMBER`). Schema is in [prisma/schema.prisma](prisma/schema.prisma).
- **Dashboard** — protected by [src/proxy.ts](src/proxy.ts), shows the user's org and a settings page for renaming it (owner/admin only).
- **Team invites** — owners/admins invite by email from [dashboard/team](src/app/dashboard/team/page.tsx); no email sending is wired up, so the invite link is shown on screen to copy and send manually. Accepting at `/invite/[token]` signs the invitee up (or logs them in) and joins them to the inviting org instead of creating a new default one. Owners can change member roles and remove members; nobody can remove or demote the owner.

## Not yet built

Billing (Stripe), multiple orgs per user (a user who accepts an invite while already owning an org can currently only act within one org at a time — no switcher yet), admin panel, API keys, transactional email — see the original product spec for the full roadmap.
