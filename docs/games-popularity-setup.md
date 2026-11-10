# Games Calendar popularity refresh

The Games Calendar ticker displays up to four upcoming PC/console releases, ordered by a daily cross-platform popularity score.

## Data and ranking

The scheduled updater uses IGDB PopScore primitives:
- Want to Play — 40%
- IGDB Visits — 30%
- Playing — 15%
- Played — 5%
- Twitch Hours Watched — 10%

Steam-only player counts, reviews and sales signals are deliberately excluded. This prevents games without a PC/Steam release (for example, console exclusives) from being penalised.

Scores are normalised against the current upcoming release list. They are a relative ranking of titles in this calendar, not a claim to represent the entire global games market. If a title has no available metric, that metric is omitted and the remaining weights are renormalised. A title with no usable metrics is shown without a score and falls behind scored titles.

The updater reads upcoming PC and console releases from the Games Calendar Supabase database, matches each title to IGDB, fetches its available popularity primitives, and writes `data/games-popularity.json`. The browser reads this cached snapshot; it never calls IGDB directly.

## One-time setup

IGDB requires a Twitch developer application. The client secret must never be placed in the website code or committed to the repository.

1. Sign in to Twitch and enable two-factor authentication.
2. Open the [Twitch Developer Console](https://dev.twitch.tv/console/apps) and register a new application.
3. Set the client type to **Confidential** and use `localhost` as the OAuth redirect URL (IGDB does not use the redirect URL).
4. Generate a client secret and copy the Client ID and Client Secret.
5. In this GitHub repository, open **Settings → Secrets and variables → Actions → New repository secret**.
6. Add these two secrets:
   - `IGDB_CLIENT_ID`
   - `IGDB_CLIENT_SECRET`
7. Open **Actions → Refresh Games Calendar popularity → Run workflow** to run the first refresh.

The workflow then refreshes daily at 06:17 UTC. It commits the new snapshot only when the data changes.

The Supabase publishable key used to read the public release catalogue is already public and is included in the updater as a fallback; no database service-role key is required.

## Attribution and terms

The Games Calendar labels the ticker as IGDB cross-platform trending. IGDB states that API access is free for non-commercial use under the Twitch Developer Service Agreement. Commercial use requires contacting IGDB for a partnership. Review the current [IGDB API documentation](https://api-docs.igdb.com/) and [Twitch Developer Service Agreement](https://www.twitch.tv/p/en/legal/developer-agreement/) before using this in a commercial service.
