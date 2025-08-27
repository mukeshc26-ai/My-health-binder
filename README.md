# My Health Binder (PWA) — v4
**New in v4**
- 🩺 **Medicines checklist** (editable list, daily adherence %).
- 🏋️ **Workouts with calories** (plus BetterMe streak, steps).
- ⚖️ **Weight tracker**.
- 📊 **Vitals & Sleep** import (CSV/JSON) + quick entry.
- 🤖 **Daily Insights** (last 24h & 7d analysis: sleep, RHR, HRV, SpO₂, energy, steps, calories, BetterMe status).
- ✅ Charts, passcode lock, docs vault, reminders preserved.

## CSV Template for Metrics
Download from the app (Metrics → Download CSV Template). Columns expected:
```
timestamp,weight,resting_hr,spo2,hrv,bp,sleep_minutes
```
- `timestamp` is **milliseconds since epoch** (most export tools include this) — if missing, the app uses "now".
- For Mi Fitness/Apple Health, export to CSV and **rename headers** to match above, then import.

## Install on iPhone 15 (best way)
1. Host the `health-pwa-v4` folder on **GitHub Pages** or **Netlify** (HTTPS).
2. Open the URL in **Safari** → **Share** → **Add to Home Screen**.
3. Open app → **Enable Notifications** (for 10‑hour reminders in-app).
4. Also tap **Download 10‑hour .ics** and add to Calendar for background alerts when the app is closed.

## Privacy & Sync
- All data stays **local on your device**.
- Export JSON/CSV to move data to another device and import there.
- PIN is stored as a local SHA‑256 hash (good for casual privacy).
