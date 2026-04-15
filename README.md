# Investment Investigation Dashboard

Educational dashboard for stock and crypto investigation with explainable Buy / Wait / Avoid outputs.

## Disclaimer

Educational tool only. Not financial advice.

## Stack

- Frontend: React + TypeScript + Tailwind + Lightweight Charts
- Backend: Express + TypeScript + Zod validation
- Provider abstraction with mock mode and free-tier adapter
- Tests: Vitest + Supertest (backend)

## Features Included

- Stock and crypto watchlist with seeded defaults
- Analysis endpoint with:
  - Buy zone
  - Sell zone
  - Hold-until conditions
  - Final action and confidence
  - Top reasons and uncertainty notes
- Live quote stream endpoint (SSE)
- Alert rule management with trigger history
- Scores:
  - Technical score
  - News score
  - Risk score
  - Weighted final score (0.5 / 0.3 / 0.2)
- Technical indicators:
  - SMA20/50/200
  - RSI14
  - MACD and signal
  - ATR14
  - Support and resistance
- News intelligence shape:
  - sentiment
  - relevance
  - tags
  - time-decay weighting in score
- Contradiction warning when technical and news conflict strongly
- Data source transparency and delayed data labeling
- Responsive UI with mobile support
- News markers on chart

## Monorepo Structure

- `frontend` React app
- `backend` API and scoring engine

## Provider Modes

Set in backend environment:

- `DATA_PROVIDER=mock`
  - Fully local mock data, no keys required
- `DATA_PROVIDER=free-tier`
  - Crypto quotes/candles from Binance public endpoints
  - Crypto fundamentals context from CoinGecko
  - Crypto news from CryptoPanic when key is present
  - Stocks from Twelve Data when key is present
  - Stocks fall back to Yahoo Finance chart endpoints when no key is configured
  - Stock and crypto news fall back to Google News RSS heuristics when provider keys are missing
  - Graceful fallback to mock-delayed when unavailable

Alert persistence note:

- Alert rules and trigger history are in-memory and reset when backend restarts.

## API

### `GET /api/health`

Health check.

### `GET /api/watchlist`

Seeded watchlist.

### `GET /api/analyze?symbol=AAPL&assetClass=stock&timeframe=1h`

Returns analysis contract:

- action
- buyRange
- sellRange
- holdUntilConditions
- confidence
- reasonsTop3
- uncertaintyNotes
- data source and delay
- timestamp

### `GET /api/stream?symbol=BTCUSDT&assetClass=crypto`

Server-Sent Events stream:

- `quote` event for live quote ticks
- `alert` event when a rule is triggered

### `GET /api/alerts`

Returns active rules and recent triggered alerts.

### `POST /api/alerts`

Creates a rule payload:

- symbol
- assetClass
- direction (`above` or `below`)
- targetPrice

### `DELETE /api/alerts/:id`

Deletes one alert rule.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Backend env:

- Copy `backend/.env.example` to `backend/.env`
- `backend/.env` in this repo already defaults to `DATA_PROVIDER=free-tier`
- Add keys only if you want Twelve Data or CryptoPanic enhancements; Binance, CoinGecko, Yahoo fallback, and RSS fallback work without keys

3. Frontend env:

- Copy `frontend/.env.example` to `frontend/.env`

4. Run backend:

```bash
npm run dev:backend
```

5. Run frontend:

```bash
npm run dev:frontend
```

## Build and Test

```bash
npm run build
npm run test
```

## Deploy (Free): Frontend on Vercel + Backend on Render

This setup keeps the Vite frontend on Vercel and moves the Express backend to Render,
which is more reliable for SSE (`/api/stream`) and long-running Node processes.

### 1) Deploy backend on Render

1. Push this repository to GitHub.
2. In Render, create a new **Web Service** from the repo.
3. Set service configuration:

- Root Directory: `backend`
- Build Command: `npm install && npm run build`
- Start Command: `npm run start`

4. Add environment variables:

- `DATA_PROVIDER=free-tier`
- `TWELVE_DATA_API_KEY` (optional)
- `ALPHA_VANTAGE_API_KEY` (optional)
- `BINANCE_REST_URL=https://api.binance.com`
- `COINGECKO_API_URL=https://api.coingecko.com/api/v3`
- `CRYPTOPANIC_API_KEY` (optional)

5. Deploy and copy backend URL, for example:

- `https://your-backend.onrender.com`

Health check example:

```text
https://your-backend.onrender.com/api/health
```

### 2) Deploy frontend on Vercel

1. Create a Vercel project from the same repo.
2. Set **Root Directory** to `frontend`.
3. Add environment variable:

- `VITE_API_BASE=https://your-backend.onrender.com/api`

4. Deploy frontend.

### 3) Verify integration

- Open frontend URL and confirm watchlist/analyze requests succeed.
- Confirm stream endpoint works from browser/network tab:
  - `https://your-backend.onrender.com/api/stream?symbol=BTCUSDT&assetClass=crypto&timeframe=1h`
- If requests fail, verify `VITE_API_BASE` and redeploy frontend.

## Free-tier Caveats

- Free market data may be delayed, throttled, or unavailable.
- Stock real-time quality depends on provider plan.
- Crypto sentiment feeds can be noisy and incomplete.
- Confidence should be reduced during fallback or delayed states.
- Yahoo and RSS fallbacks are unofficial/best-effort free sources and may change behavior without notice.

## Delivery Checklist Coverage

- Full folder structure
- Working frontend and backend starter
- Sample env files
- Mock mode without API keys
- Seed watchlist
- Sample unit and integration tests
