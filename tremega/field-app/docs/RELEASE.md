# Tremega Field Worker — Release Runbook (Slice 7)

Code-side release prep is **done** (theme audit, skeletons, tap targets, a11y,
app.json + eas.json). The steps below need **your accounts** and can't be
automated from the repo.

---

## 1. One-time setup (your accounts)

```powershell
npm install -g eas-cli
eas login                      # your Expo account (free tier works)
cd field-app
eas init                       # creates EAS project, writes projectId into app.json extra.eas
```

- **Apple**: Apple Developer Program membership ($99/yr) — developer.apple.com
- **Android**: Google Play Console account ($25 one-time) — play.google.com/console

## 2. Build

```powershell
eas build --platform all --profile production
```

- First iOS build: EAS walks you through bundle id registration + signing certs (managed creds recommended — let EAS handle them).
- First Android build: EAS generates the upload key (keep "Let EAS manage" = yes).
- ~15-25 min per platform, runs in the cloud.

## 3. iOS → TestFlight

```powershell
eas submit --platform ios --profile production
```

1. App Store Connect → your app appears after first submit.
2. TestFlight tab → create group **"Pilot GCs"**.
3. Add testers by email (their Apple IDs). 5–10 pilots.
4. Release notes (paste):

   > Beta 1 — Field worker MVP: GPS check-in, time logging by phase,
   > crew locations, material requests via Claude with approvals,
   > bid history, offline queue, push notifications. Same backend as web.

## 4. Android → internal track

```powershell
eas build --platform android --profile preview   # produces an APK
```

Or submit the AAB from the production build:

1. Play Console → create app "Tremega Field Worker".
2. Testing → Internal testing → create release → upload AAB/APK.
3. Add tester emails → share the opt-in link with the same pilots.

## 5. Backend the beta points at

`app.json → extra.apiUrl` is `null`, so the app uses the default in
`src/lib/api.ts`. **Before shipping to pilots**, point it at the always-on
backend (LAN IP dies with this laptop):

- [ ] Deploy backend to a public URL (Railway/Fly/Render) OR keep this laptop
      running with a tunnel (cloudflared/ngrok) for the pilot window.
- [ ] Set `EXPO_PUBLIC_API_URL` in an EAS env profile, or edit `extra.apiUrl`
      and rebuild.
- [ ] Add the `push_tokens` table in Supabase so device tokens persist
      (backend works without it — memory registry — but loses tokens on restart):

```sql
create table if not exists push_tokens (
  token text primary key,
  user_id uuid not null,
  platform text default 'unknown',
  updated_at timestamptz default now()
);
```

- [ ] Get a real EAS `projectId` from `eas init` — required for push token
      minting on device builds.

## 6. Device QA checklist (run on a physical phone before inviting pilots)

**Flow 1 — job day:** select job → Activity clock in (framing) → clock out →
verify duration → Orders → chat "I need 50ft wire" → approve → order appears →
Crew (7 members, distances) → Estimates (Kitchen Remodel, expandable).

**Flow 2 — offline:** airplane mode → chat send → ⌛ queued → airplane off →
auto-sends → ✓. Crew tab offline → cached data + amber banner → reconnect →
banner clears.

**Flow 3 — push (physical device):** register happens on launch → approve a
material in the web app → push arrives → tap → lands on Orders tab.

**Crash pass:** rapid-tap clock in/out ×10 (busy lock), kill network mid-send
(error note, no freeze), force-close mid-sync (queue survives, resumes).

**Polish pass:** skeletons on first load (Activity/Orders/Crew/Estimates),
no white flashes, all buttons respond at ≥48px, dark theme everywhere.

## 7. After beta

- Crash/analytics: add Sentry (`npx expo install sentry-expo`) before GA.
- Feedback loop with pilots (1–2 weeks) → slice 8 = fixes.
- GA checklist: privacy policy, terms, Stripe, store screenshots.
