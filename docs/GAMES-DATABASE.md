# Games Calendar release database

## Phase 1 scope
The catalogue covers full PC and console game releases only. Mobile games are explicitly excluded and will remain a separate future section. One canonical game record powers both the Upcoming Releases list and the Up Next ticker.

## Files
- `data/games-featured.json` — versioned JSON seed/feed consumed by the existing browser UI. The legacy fields `title`, `release_date`, `platforms`, `source_url`, `logo_url`, and `short_name` are retained for compatibility.
- `data/games-database.schema.json` — JSON Schema for validating the feed and future imported records.

## Record model
Each game has a stable slug ID, title, developer/publisher, platform list, region-specific release dates, release precision, release status, release type, artwork/logo, source evidence, verification state, and audit timestamps. Dates are stored as ISO 8601 calendar dates (`YYYY-MM-DD`) and interpreted in the UK calendar for display. A game may have different dates by platform or region, so `release_dates` is the authoritative detailed field; `release_date` remains the compatibility/display date.

Allowed verification states:
- `verified` — checked against a primary publisher/developer/platform announcement.
- `needs_review` — imported or carried forward but not yet confirmed against a primary source.
- `conflicting` — sources disagree; do not present as confirmed.
- `unverified` — no reliable date evidence yet.

Allowed release states include confirmed, estimated, TBA, delayed, cancelled, and released. Never turn a month/quarter/year/TBA announcement into a made-up day.

## Source policy
1. IGDB is the preferred structured discovery/import source for game metadata, platforms, release-date records, artwork and involved companies. Use its Games and Release Dates endpoints; the release-date endpoint provides date, platform, region, human-readable date and status fields.
2. Publisher/developer announcements are the primary verification source. A record is only `verified` when a primary source supports the date and platform.
3. Steam/SteamDB may be used as a PC release cross-check, not as the sole source for console dates.
4. Secondary release calendars can help discover changes, but must remain `needs_review` until confirmed.
5. Keep source URLs and check timestamps on each record. When sources conflict, flag the record rather than silently choosing a date.

## Update pipeline
1. Import or refresh candidate records from IGDB on the server side (credentials must never be exposed in browser JavaScript).
2. Normalize platform names and map release regions to the GB/UK view.
3. Deduplicate by IGDB ID where available, otherwise by stable slug plus platform/date identity.
4. Verify date changes against publisher/developer sources; store source and check timestamp.
5. Validate the resulting JSON against `games-database.schema.json`.
6. Publish the same validated feed to the Upcoming Releases list and Up Next ticker.
7. Keep an audit trail for date/status changes; do not overwrite a verified record with a weaker source.

## Current seed status
The three records migrated from the original feed are intentionally marked `needs_review`. Their dates and platform coverage have not yet been re-verified against primary publisher sources. They should not be described as confirmed until that review is complete.

## Future backend
This JSON feed is the initial database contract, not a claim that a live relational database or scheduled IGDB importer is already deployed. The next backend step is a server-side importer and persistent store with change history, followed by a scheduled refresh. The browser should continue reading only the published feed.
