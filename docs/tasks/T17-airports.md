# T17 — Airport lookup

**Tier:** B · **Model:** Sonnet · **Effort:** low · **Size:** S
**Depends on:** nothing (can run any time before T18) · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
The app can turn an airport code into a city, country and map position, so pasted flights can name destinations and place them on the map with no typing.

## Read (only these)
- `docs/V4.md` §4.3
- `js/lookup.js`

## Files you may change
- **new** `js/data/airports.json`, **new** `js/lib/airports.js`, **new** `tests/airports.test.js`, `js/lookup.js`

## Do
1. Build `airports.json` from OurAirports `airports.csv` (`https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv`): keep rows with an IATA code, `scheduled_service` = yes, and type large, medium or small airport. Shape: `{ "FCO": ["Rome", "IT", 41.8, 12.25], … }` with 2-decimal coordinates. Write it with a throwaway script; don't commit the script or the CSV.
2. `airports.js` (pure): `createAirportIndex(data)` returning `{ info(code), cityKey(code), cityName(code) }`. `cityKey` is `"City, CC"`; an unknown code returns the code itself for all three.
3. `lookup.js`: `loadAirports()` fetches the JSON once and caches the promise.

## Don't
- Hand-type airport data or trim to "popular" airports.

## Tests
FCO and CIA share a city key; LHR and LGW share one; DEN resolves to Denver, US; unknown "ZZZ" falls back; lower-case input works.

## Done when
Tests pass and the JSON is under 400 KB. If the download is blocked, stop and ask the owner to upload the CSV.

## Owner check
Nothing to click yet. This is used from T18 on.
