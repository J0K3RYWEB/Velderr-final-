# Deployment checklist

1. API: deploy `server` to a Node hosting service; set `ADMIN_USER`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `PORT` and enable HTTPS.
2. Database: replace JSON storage with PostgreSQL/Supabase before real customer traffic.
3. Web: host `apps/web` as a static site and set `window.VELDERR_API_BASE` to the HTTPS API URL.
4. Android/iOS: install Expo dependencies, set the API URL to production, then use Expo/EAS or native build tooling for signed release builds.
5. Domain/email: connect Velderr's chosen domain and business email when available.
6. Payments: integrate a verified provider and keep payment credentials out of the application database.
