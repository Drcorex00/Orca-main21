# ORCA Navigator

A marine intelligence assistant for fishermen, researchers and coastal authorities:
live waves, tides, wind, sea-surface temperature and potential fishing zones on a
satellite map, plus sea-route planning to the best fishing zone with live hazard
checks (lightning, waves, gusts, visibility, rain) and restricted-area avoidance.

Answers come from a multilingual chat assistant grounded in the live data — it
replies in the language the question was asked in, in that language's own script.

This project was built with [Lovable](https://lovable.dev).

## Running it locally

```sh
git clone <this-repository-url>
cd <repository-name>
npm install
cp .env.example .env      # then fill in one AI key (see below)
npm run dev               # http://localhost:8080
```

### Keys

All marine and map data comes from free, keyless sources (Open-Meteo,
OpenStreetMap, Esri/USGS imagery), so the map and data panels work with no
configuration at all.

The chat assistant needs **one** of these, tried in order with automatic
fallback to the next if a call fails:

| Variable | Where to get it |
| --- | --- |
| `LOVABLE_API_KEY` | set automatically when running on Lovable |
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey |

Optional: `OPENAI_MODEL`, `GEMINI_MODEL` to override the default model, and
`VITE_MAPTILER_KEY` for higher-quality satellite imagery.

### Things to try

- "Is it safe to go out near Chennai tomorrow?"
- "kal samundar safe hai kya" (answers in Hindi)
- "Where can I fish near Kochi?" — draws the sea route, ETA and red hazard dots
- Layer panel → toggle Route, PFZ, SST and restricted areas

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/06ca8ded-c3a7-4f3b-9608-58c8b70780c9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
