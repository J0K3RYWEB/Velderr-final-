# VELDERR PLATFORM — FIXED & UPGRADED

Velderr Professional Ushering Services platform for Kampala, Uganda.

## What was fixed from the original upload

1. **Web CSS didn't match the HTML at all.** `styles.css` targeted classes like `.nav`, `.hero-image`, `.about`, `.booking-form` while `index.html`/`admin.html` used a completely different set (`.top`, `.hero-photo`, `.split`, `.form`). The site rendered essentially unstyled. Both files are now rewritten to match.
2. **The package/pricing tiers were missing from the entire product** — web, admin, and mobile only had 5 generic "services," with no trace of the Bronze → Triple Diamond rate card from the original flyer. Added a `/api/public/packages` endpoint, a guest-count calculator on the homepage, a full package grid, and matching screens in the mobile app.
3. **Mobile staff screen was non-functional.** It sent a hardcoded fake bearer token (`Bearer demo`) against the real admin auth, so it *always* failed and only ever showed a canned error. Replaced with a real public endpoint (`/api/public/staff-assignments/:phone`) that looks up a staff member by phone and returns their assignments — no admin login required for on-the-ground staff.
4. **Admin login shipped with the demo password pre-filled in the input.** Removed; credentials are now shown as a hint below the form instead.
5. **Auth was a static, deterministic token** (an HMAC of fixed strings) with no expiry — anyone who guessed the formula and knew the default secret could compute it. Replaced with real random session tokens that expire after 12 hours.
6. **Mobile app was missing required build files** (`babel.config.js`, `expo-constants`, navigation dependencies) that `expo-router` and the tab navigation need to run at all.

## Structure

```
apps/web/      customer website + admin console (fix for both bugs above)
apps/mobile/   Expo/React Native app — builds to both Android and iOS
server/        Express API used by both the website and the mobile app
data/          JSON file storage (see production note below)
docs/          product & deployment notes
```

## Why one mobile app instead of separate Android/iOS projects

Expo compiles a single React Native codebase into a real native Android app and a real native iOS app — this is the standard, professional approach used by apps like Discord and Shopify's own tools, not a shortcut. You still get two separate app store submissions, but you maintain one codebase. Run/build commands for each platform are below.

## Run the backend

```
cd server
npm install
npm start
```
Runs on `http://localhost:4000`. Change `ADMIN_USER` and `ADMIN_PASSWORD` env vars before any real deployment.

## Run the website

Serve `apps/web` with any static server (e.g. `npx serve apps/web`) while the backend is running. It talks to `http://localhost:4000/api` by default — override by setting `window.VELDERR_API_BASE` before `app.js` loads if you deploy the API elsewhere.

## Run the mobile app

```
cd apps/mobile
npm install
npx expo start
```
- Press `a` for Android, `i` for iOS (needs Xcode, macOS only), or scan the QR code with Expo Go on a physical phone.
- **On a physical phone**, `localhost` refers to the phone itself, not your computer. Edit `apiBase` in `app.json` (or `config.js`) to your computer's LAN IP, e.g. `http://192.168.1.20:4000/api`.
- To build real installable binaries for each store: `npx eas build --platform android` and `npx eas build --platform ios` (requires a free Expo/EAS account).

## Demo admin login
`admin@velderr.com` / `VelderrMVP!2026` — shown as a hint on the sign-in screen. Change before going live.

## Contact
+256 770 961 137 · +256 708 068 874 · velderr256@gmail.com · Kampala, Uganda

## Before public launch
This MVP uses JSON files for storage to keep setup simple. Before real customers rely on it: move data to a managed database (PostgreSQL/Supabase/Firebase), hash passwords with bcrypt/argon2 instead of a single shared hash, add role-based access for multiple admins, put the API behind HTTPS, add rate limiting and audit logs, back up the data directory, and integrate a verified mobile-money/card payment provider. Never store payment PINs or card secrets directly.
