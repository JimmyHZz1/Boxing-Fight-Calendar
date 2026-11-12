# Sports Calendar API setup

The four-hour GitHub Actions sync keeps API credentials on GitHub. Do not put API keys in app files or paste them into the public repository.

## Formula 1
No API key is required. The app uses the community-maintained Jolpica F1 API for the season calendar, practice/qualifying/sprint session times, and race, qualifying and sprint results.

## PDC darts
1. Create a free key at https://dartsapi.com/
2. In the GitHub repository, open Settings -> Secrets and variables -> Actions.
3. Select New repository secret.
4. Name it exactly: DARTS_API_KEY
5. Paste the key as its value and save.

The sync requests PDC, PDC Development Tour and PDC Affiliate calendar entries. MODUS and non-PDC events are excluded. The free API calendar is marked as up to seven days behind its live data feed; this is a calendar feed, not live match scoring.

## UFC
1. Create a free API key at https://www.ufcalendar.com/account/api
2. In the GitHub repository, open Settings -> Secrets and variables -> Actions.
3. Select New repository secret.
4. Name it exactly: UFCALENDAR_API_KEY
5. Paste the key as its value and save.

The free plan includes 1,000 requests per month. The scheduled sync is designed for up to five calls per four-hour run (two event lists and up to three full event cards), approximately 900 calls in a 30-day month if every run fetches all three cards. Extra manual workflow runs also use the allowance.

## Start the sync
Once both secrets are saved, open Actions -> Refresh sports schedules -> Run workflow. The normal schedule also runs every four hours.

The keys remain in GitHub Actions secrets and are never sent to the public PWA.
