# Boxing Fight Calendar

An iPhone-friendly Progressive Web App for professional boxing schedules, event calendars and full fight cards, displayed in UK local time.

## Main screens
- **Home** — upcoming fight nights, headline bouts and last data refresh.
- **Calendar** — monthly view with scheduled event dates.
- **Full Fight Cards** — event-by-event bout listings, divisions and broadcaster details when supplied by the data source.

## Project status
Initial interface scaffold has been committed. No sample or unverified fight listings are included. Live data integration is pending API-key setup and provider-schema verification.

## Hosting plan
- Static PWA hosted with GitHub Pages.
- Scheduled data refresh through GitHub Actions, using a repository secret for the API key.
- The API key must never be committed to the repository or exposed in browser JavaScript.
- Render is not required for the initial static architecture; this avoids relying on a sleeping free web service for scheduled updates.

## Local testing
Serve the repository root with any static HTTP server. Opening index.html directly as a file may prevent service-worker and fetch features from working.

## Data
The front end reads `data/fights.json`. The sync workflow will populate this file after the Boxing Data API integration is verified.