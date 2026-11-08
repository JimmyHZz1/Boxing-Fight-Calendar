# Boxing Fight Calendar

An iPhone-friendly Progressive Web App for professional boxing schedules, displayed in UK local time.

## Main screens
- **Home** — upcoming fight dates, scheduled bouts and last data refresh.
- **Calendar** — monthly view with dates marked; selecting a date shows that date's fights.
- **Fight Cards** — event-based cards with available bouts, weight divisions, scheduled rounds and broadcaster details.

## Data sources
- **Boxerbook** supplies real event groupings, bout lists, event links, fighter names, divisions, scheduled rounds and broadcaster information where published.
- **Boxing Data API** remains a secondary source for additional individual bouts over the next 30 days. Where Boxerbook already has an event on a date, the fallback date-group is suppressed to avoid mixing unrelated bouts into a confirmed card.
- Missing start times, broadcasters and divisions are not guessed. Venue information is intentionally not displayed.
- Boxerbook attribution is shown in the app footer and event links point to the relevant Boxerbook pages.

## Hosting and refresh
- Static PWA: GitHub Pages.
- Automatic data refresh: GitHub Actions, every two hours.
- Manual refresh: Home screen button opens the **Refresh boxing schedule** workflow; run it in GitHub Actions, then return to the app and reload the schedule.
- API credentials are stored only as GitHub Actions secrets: `BOXERBOOK_API_KEY` and `BOXING_API_KEY`. Never commit keys or put them in browser JavaScript.
- No Render service is required for this architecture.

## Important Boxerbook usage terms
The free Boxerbook API key is for personal, non-commercial and testing use. Commercial use of Boxerbook data in an app or website requires a paid plan or separate agreement. The app credits Boxerbook and links to its source pages. Check the current terms before making the app a commercial/public service.

Official docs: https://boxerbook.com/developers  
Terms: https://boxerbook.com/terms  
Boxing Data API docs: https://boxingapi.net/documentation/fights-upcoming

## Setup
1. In GitHub, open **Settings → Secrets and variables → Actions**.
2. Add `BOXERBOOK_API_KEY` and `BOXING_API_KEY` as repository secrets.
3. Open **Settings → Pages** and set **Deploy from a branch**, branch `main`, folder `/ (root)`.
4. Open **Actions → Refresh boxing schedule** and run the workflow once manually.
5. After a successful sync, the app reads the published `data/fights.json` snapshot.

## Local testing
Serve the repository root with any static HTTP server. Opening `index.html` directly as a file may prevent service-worker and fetch features from working.


## Version 1.1
- Adds the Live Sports Centre on the home screen with a five-sport live-status view and a combined seven-day upcoming list.
- Adds a discreet Version History link in the footer.
- Retains the established dark charcoal and gold theme, individual sport pages, calendar, event cards and UK-local time formatting.
