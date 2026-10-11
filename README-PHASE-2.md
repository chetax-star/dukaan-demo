# Dukaan Demo — Phase 2 Admin Panel

## What changed
- Added an admin login at `/admin`.
- Added overview cards, order status management, booking status management, and menu CRUD.
- Added a MongoDB `MenuItem` model and seeds the original 10 demo menu items only when the collection is empty.
- Customer menu now loads available items from `/api/menu`.
- Admin APIs require a signed 8-hour session token.
- `/api/orders` and `/api/bookings` list endpoints now require admin authentication.
- Added `.env.example`; do not commit or upload your real `.env`.

## Required server environment variables
Configure these in `server/.env` for local development and in Render's Environment settings for deployment:

- `MONGODB_URI`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `ADMIN_PASSWORD` — choose a long, unique password.
- `ADMIN_TOKEN_SECRET` — a separate random secret, at least 32 characters.
- `PORT` (optional; Render sets this automatically).

Never expose `ADMIN_PASSWORD`, `ADMIN_TOKEN_SECRET`, `MONGODB_URI`, or `RAZORPAY_KEY_SECRET` in frontend variables, screenshots, or source control.

## Run locally

Terminal 1:
```bash
cd server
npm install
cp .env.example .env
# Fill the values in .env, then:
npm start
```

Terminal 2:
```bash
cd client
npm install
npm run dev
```

Open the Vite URL for the customer site and add `/admin` for the admin panel. In Vite development mode, the frontend now defaults to `http://localhost:5001/api`, so local testing will not send booking/payment requests to the deployed live backend. In production builds it defaults to the existing Render API. To override either default, set `VITE_API_BASE_URL` in `client/.env` (for example, `VITE_API_BASE_URL=http://localhost:5001/api` for local development).

## Deploy
1. Update the existing Render backend service with the `server/` changes and configure the environment variables above.
2. Confirm the backend starts and MongoDB connects.
3. Deploy the `client/` frontend to Vercel. Ensure its API URL points to the intended Render service.
4. Open `/admin`, sign in using `ADMIN_PASSWORD`, and test orders, bookings, and menu changes.

## Important limitations
- This is a learning/demo project, not yet a production-ready payment system. Before taking real payments, the server must calculate prices from trusted menu data, verify the payment amount/currency against the Razorpay order, validate item IDs and quantities, and prevent duplicate payment verification/order creation.
- Add rate limiting and stricter CORS/origin rules before public production use.
- Do not use real customer information in the demo.
