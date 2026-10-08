# My GGITS — Frontend Deployment Guide

Covers the **Admin Panel** (Next.js) and the **Mobile App** (Expo / EAS Build).

---

## Admin Panel (Next.js)

### What goes in `.env.production.local`

Create this file in `apps/admin-panel/` on your deployment machine (or in Vercel / your hosting env):

```dotenv
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

That's it — one variable. Next.js bakes `NEXT_PUBLIC_*` variables into the build at build-time.

> **Never commit this file.** Add `apps/admin-panel/.env*.local` to `.gitignore` if not already there.

### Deploying on Vercel (recommended)

1. Connect your GitHub repo to Vercel
2. Set the **Root Directory** to `apps/admin-panel`
3. In **Settings → Environment Variables**, add:

   | Name | Value | Environment |
   |------|-------|-------------|
   | `NEXT_PUBLIC_API_URL` | `https://api.yourdomain.com` | Production |

4. Deploy — Vercel injects the variable at build time automatically. No `.env` file needed on Vercel at all.

### Deploying manually (VPS / self-hosted)

```bash
# On the server, inside apps/admin-panel/
echo "NEXT_PUBLIC_API_URL=https://api.yourdomain.com" > .env.production.local

npm install
npm run build
npm start     # or use PM2: pm2 start npm --name admin-panel -- start
```

---

## Mobile App (Expo)

### What goes in `.env`

Create `apps/mobile/.env` locally for development (already gitignored via `.gitignore`):

```dotenv
# Local dev only — in production EAS handles this (see below)
EXPO_PUBLIC_API_URL=http://192.168.x.x:3001   # your Mac's LAN IP
```

> For local dev you actually don't even need this — `config.ts` auto-detects the Metro bundler host and appends `:3001`, so a physical device on the same Wi-Fi just works.

### Production — EAS Secrets (the right way, no git commit)

The thing you're thinking of is **EAS environment variables / secrets**. You set them once on the EAS dashboard or CLI and they are automatically injected at build time — nothing goes in git.

#### One-time setup

```bash
# Install EAS CLI if you haven't
npm install -g eas-cli

# Login
eas login

# Set the production secret (run once, never again unless it changes)
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://api.yourdomain.com"
```

That's it. EAS stores it encrypted on their servers.

#### Verify it's set

```bash
eas secret:list
```

#### Trigger a production build

```bash
cd apps/mobile

# Android
eas build --platform android --profile production

# iOS
eas build --platform ios --profile production

# Both at once
eas build --platform all --profile production
```

EAS automatically injects `EXPO_PUBLIC_API_URL` into the build — your `config.ts` picks it up via `process.env.EXPO_PUBLIC_API_URL` and all API calls go to your production backend.

### How the app decides which API URL to use

From `src/lib/config.ts`:

```
EXPO_PUBLIC_API_URL set?  →  use it  (production EAS build)
        ↓ no
__DEV__ = true?           →  use Metro host IP + :3001  (local dev, auto-detected)
        ↓ no
                          →  empty string (this shouldn't happen in prod)
```

So in summary:
- **Local dev** → nothing needed, it auto-detects
- **EAS production build** → `eas secret:create` once, done

---

## Quick Reference

| App | Where env lives | How to set for prod |
|-----|----------------|---------------------|
| Admin Panel (Next.js) | Vercel env vars dashboard | Add `NEXT_PUBLIC_API_URL` in Vercel UI |
| Admin Panel (self-host) | `apps/admin-panel/.env.production.local` | Create file on server, never commit |
| Mobile (Expo) | EAS Secrets | `eas secret:create --name EXPO_PUBLIC_API_URL --value https://...` |
| Mobile (local dev) | Auto-detected | Nothing needed |

---

*Last updated: October 2026*
