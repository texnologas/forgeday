# ForgeDay — Homestead & Potential OS (Offline Android PWA)

A zero-cost, 100% offline-first Progressive Web App built for planning, tracking, and adjusting your daily routine around:
- **Weekday Anchors**: 07:00–16:00 work + 1h each-way driving commute (hands-free audio focus), work cafeteria lunch (no lunch prep), sleep protection lock.
- **Weekend Execution**: Full Saturday & Sunday blocks dedicated to Homestead, Food batch prep, Cars/Transport, and Skill/Income leverage.
- **Health & Food Priority**: Sleep protection guard, 7-day sleep chart, fast weekday meals, weekend batch-prep queue, and Root Cellar/Garden ($0) vs Cash grocery tracking.
- **Scarcity-Aware Backlog**: Area-tagged tasks (`Tiny House`, `Cars`, `Well`, `Garden`, `Root Cellar`, `Workshop`, `Skill & Income`, `Abandoned House`), `$0 On-Hand` prioritization, ROI scoring, and WIP limit guard.
- **Slip Recovery ("Adjust Day")**: Automatically re-packs remaining evening/weekend blocks without stealing your sleep window.

## Run Locally on PC
```powershell
cd homestead-os
python -m http.server 8080
```
Open `http://localhost:8080`.

## Install on Your Android Phone ($0, Offline Forever)
Android Chrome requires HTTPS (or `localhost`) to install a PWA and activate the offline Service Worker:

1. **Free HTTPS Hosting (Recommended)**: Upload the `homestead-os` folder to **GitHub Pages** or **Cloudflare Pages** (free tier). Open that HTTPS URL in Android Chrome and tap **⋮ Menu → Install app** (or the **Install ForgeDay** button inside the **Setup** tab). Once installed, turn on Airplane Mode — it opens and saves locally forever.
2. **USB Cable via ADB (`localhost` on phone)**:
   ```powershell
   python -m http.server 8080
   adb reverse tcp:8080 tcp:8080
   ```
   Then open `http://localhost:8080` in Android Chrome and tap **Install app**.