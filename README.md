# Boxing Fight Calendar

An iPhone-friendly Progressive Web App for professional boxing schedules, displayed in UK local time.

## Main screens
- **Home** — upcoming fight dates, scheduled bouts and last data refresh.
- **Calendar** — monthly view with dates marked; selecting a date shows its scheduled bouts.
- **Fight Cards** — available bout listings grouped by date.

## Hosting
- Static PWA: GitHub Pages.
- Automatic data refresh: GitHub Actions.
- API credentials: GitHub Actions repository secret named `BOXING_API_KEY`.
- No Render service is required for this initial free-tier architecture.

## Boxing Data API free-tier limitations
The free key supplies upcoming individual bouts for up to 30 days, yesterday/today's results and current rankings. It does not provide the paid-tier full card, fighter-profile or webhook features. The app therefore groups available bouts by UTC date. These date groups must not be mistaken for official promoter event cards. Venues, broadcasters, confirmed undercards and weight divisions will only be shown when a reliable source supplies them.

API reference: https://boxingapi.net/documentation/fights-upcoming

## Automatic refresh
The workflow at `.github/workflows/sync-fights.yml` runs every two hours (12 scheduled API calls per day) and can also be started manually from the Actions tab. It fetches up to 30 days of upcoming bouts and updates `data/fights.json` only when the data changes.

## Setup
1. In GitHub, open **Settings → Secrets and variables → Actions**.
2. Create a repository secret named `BOXING_API_KEY` and paste the API key value into the secret field.
3. Open **Settings → Pages** and set **Deploy from a branch**, branch `main`, folder `/ (root)`.
4. Open **Actions → Refresh boxing schedule** and run the workflow once manually.
5. After the first successful sync, the app will read the published `data/fights.json` file.

Never commit the API key to the repository or place it in browser JavaScript.

## Local testing
Serve the repository root with any static HTTP server. Opening `index.html` directly as a file may prevent service-worker and fetch features from working.
