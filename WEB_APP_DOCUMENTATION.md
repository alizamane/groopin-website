# Groopin Web App Documentation

This document explains the web app . It maps routes to files, lists the reusable components, and documents the API calls the UI depends on.

## 1) Quick start

- Install: `npm install` or `pnpm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Start: `npm run start`

Required environment variables (from code usage):
- `NEXT_PUBLIC_API_URL` (Groopin backend base URL)
- `NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY` (Web Push VAPID public key)
- `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`, `NEXT_PUBLIC_PUSHER_HOST`, `NEXT_PUBLIC_PUSHER_PORT`, `NEXT_PUBLIC_PUSHER_SCHEME` (Pusher realtime)
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (waitlist API)
- `LANDING_PAGE` or `landing_page` (if not "true", `/` redirects to `/app`)

## 2) How routing works:

This is a Next.js App Router project. The routing folders live under `app/`:

- `/` is the marketing landing page (separate from the logged-in app).
- `/app/*` is the web app experience.
- `app/layout.js` is the root layout (fonts, analytics, i18n provider, global styles).
- `app/app/layout.jsx` wraps all `/app` routes.
- `app/app/guest/layout.jsx` wraps all guest (auth) screens.
- `app/app/auth/layout.jsx` wraps all authenticated screens and injects `AppShell`.

## 3) Screen map (routes -> files -> UI)

Use this map to find where a screen lives and which components it uses.

### Marketing landing

- Route: `/`
  - File: `app/page.jsx`
  - Purpose: marketing landing page, visuals only
  - Main UI: `components/ui/animated-logo.jsx`, `public/assets/images/*`
  - Data: none (no API calls)
  - Notes: set `LANDING_PAGE=true` to show this instead of redirecting to `/app`

### App entry

- Route: `/app`
  - File: `app/app/page.jsx`
  - Purpose: simple entry screen that redirects based on token
  - Data: `getToken()` from `app/lib/session.js`

### Guest screens (no auth)

- Route: `/app/guest/login`
  - File: `app/app/guest/login/page.jsx`
  - Purpose: email + password login; social login entry
  - UI: `components/ui/button.jsx`, `components/ui/input.jsx`
  - APIs: `POST login`, `GET auth/{provider}/redirect`

- Route: `/app/guest/register`
  - File: `app/app/guest/register/page.jsx`
  - Purpose: registration form
  - UI: `Button`, `Input`, `Checkbox`, `RadioGroup`
  - APIs: `POST register`

- Route: `/app/guest/forgot-password`
  - File: `app/app/guest/forgot-password/page.jsx`
  - Purpose: request password reset
  - APIs: `POST forgot-password`

- Route: `/app/guest/otp-forgot-password-verification`
  - File: `app/app/guest/otp-forgot-password-verification/page.jsx`
  - Purpose: verify OTP code for reset
  - APIs: `POST otp/verify`, `POST forgot-password` (resend)

- Route: `/app/guest/reset-password`
  - File: `app/app/guest/reset-password/page.jsx`
  - Purpose: set new password using token
  - APIs: `POST reset-password/{token}`

- Route: `/app/guest/social-callback`
  - File: `app/app/guest/social-callback/page.jsx`
  - Purpose: handles social auth redirect
  - UI logic: `app/app/guest/social-callback/social-callback-client.jsx`
  - APIs: `GET user`

- Route: `/app/guest/social-login-info`
  - File: `app/app/guest/social-login-info/page.jsx`
  - Purpose: collect name + real email after social login (Apple relay), trigger OTP

- Route: `/app/guest/terms-and-conditions`
  - File: `app/app/guest/terms-and-conditions/page.jsx`
  - Purpose: terms content for guest flow

### Authenticated screens (require token)

These pages render inside `components/app-shell.jsx` which provides:
- top navigation with notifications
- left drawer menu
- bottom tabs

#### Home tabs and feeds

- Route: `/app/auth/drawer/tabs`
  - File: `app/app/auth/drawer/tabs/page.jsx`
  - Purpose: main offers feed with filters + recommended/trending sections
  - UI: `OfferCard`, `Modal`, filters
  - APIs: `GET parameters`, `GET offers/recommended?lite=1`, `GET offers?lite=1` (with filters)
  - Notes: recommended/trending render only when no search or filters are active

- Route: `/app/auth/drawer/tabs/my-offers`
  - File: `app/app/auth/drawer/tabs/my-offers/page.jsx`
  - Purpose: list of offers created by user
  - APIs: `GET my-offers?filter[status]=...&lite=1`

- Route: `/app/auth/drawer/tabs/requests`
  - File: `app/app/auth/drawer/tabs/requests/page.jsx`
  - Purpose: pending/accepted/closed requests
  - APIs: `GET requests?lite=1`, `GET my-offers/participated?filter[status]=...&lite=1`

- Route: `/app/auth/drawer/tabs/groops`
  - File: `app/app/auth/drawer/tabs/groops/page.jsx`
  - Purpose: conversations list
  - APIs: `GET conversations?lite=1`

- Route: `/app/auth/drawer/tabs/profile`
  - File: `app/app/auth/drawer/tabs/profile/page.jsx`
  - Purpose: profile summary + history
  - APIs: `GET my-offers?filter[status]=closed&lite=1`, `GET participating?filter[status]=closed&filter[isowner]=0&lite=1`

#### Offers

- Route: `/app/auth/offers/[id]`
  - File: `app/app/auth/offers/[id]/page.jsx`
  - Purpose: public offer details
  - APIs: `GET offers/{id}`, `POST requests/{id}`, `DELETE requests/{id}`, `DELETE participating/{id}`, `POST offers/{id}/favorite`, `POST signal-offer`, `GET offers/{id}/ticket`, `POST tickets/scan`
  - UI: `OfferMainDetails`, QR code components

- Route: `/app/auth/offers/[id]/participants`
  - File: `app/app/auth/offers/[id]/participants/page.jsx`
  - Purpose: list of participants for offer
  - APIs: `GET offers/{id}`

#### My offers (owner)

- Route: `/app/auth/my-offers/create`
  - File: `app/app/auth/my-offers/create/page.jsx`
  - Purpose: create offer form
  - APIs: `GET parameters`, `POST my-offers`, `POST my-offers/{id}/publish`

- Route: `/app/auth/my-offers/[id]`
  - File: `app/app/auth/my-offers/[id]/page.jsx`
  - Purpose: owner detail page, requests, checkins, tickets
  - APIs: `GET my-offers/{id}`, `GET offer-requests?offer_id=...`, `GET offers/{id}/checkins?limit=15`, `POST offer-requests/{id}/accept`, `DELETE offer-requests/{id}`, `POST my-offers/{id}/publish`, `DELETE my-offers/{id}`, `POST tickets/scan`, `GET parameters`

- Route: `/app/auth/my-offers/[id]/edit`
  - File: `app/app/auth/my-offers/[id]/edit/page.jsx`
  - Purpose: edit offer form
  - APIs: `GET parameters`, `GET my-offers/{id}`, `POST my-offers/{id}` (update)

- Route: `/app/auth/my-offers/[id]/participants`
  - File: `app/app/auth/my-offers/[id]/participants/page.jsx`
  - Purpose: owner view of requests and participants
  - APIs: `GET my-offers/{id}`, `GET offer-requests?offer_id=...`, `POST offer-requests/{id}/accept`, `DELETE offer-requests/{id}`, `DELETE offers/{id}/participants/{participantId}`

#### Conversations and notifications

- Route: `/app/auth/conversations/[id]`
  - File: `app/app/auth/conversations/[id]/page.jsx`
  - Purpose: chat screen
  - APIs: `GET conversations/{id}/messages?lite=1`, `POST conversations/{id}/typing`, `POST conversations/{id}/read`, `POST conversations/{id}/messages/{messageId}/reactions`
  - Realtime: uses `app/lib/realtime-client.js` (Pusher + Laravel Echo)

- Route: `/app/auth/drawer/notifications`
  - File: `app/app/auth/drawer/notifications/page.jsx`
  - Purpose: notifications list
  - APIs: `POST notifications/{id}/mark-as-read`

#### User profile and settings

- Route: `/app/auth/profile/edit`
  - File: `app/app/auth/profile/edit/page.jsx`
  - Purpose: edit profile info
  - APIs: `GET user`, `GET parameters`, `POST profile/profile-information`

- Route: `/app/auth/profile/survey`
  - File: `app/app/auth/profile/survey/page.jsx`
  - Purpose: profile survey (interests, etc.)

- Route: `/app/auth/profile/offer-rating/[id]`
  - File: `app/app/auth/profile/offer-rating/[id]/page.jsx`
  - Purpose: rate users after offer
  - APIs: `GET users/rates?offer_id=...`, `POST users/rates`

- Route: `/app/auth/users/[id]`
  - File: `app/app/auth/users/[id]/page.jsx`
  - Purpose: view other user profile
  - APIs: `GET users/{id}`, `POST block-user`, `DELETE block-user/{id}`, `POST signal-user`

- Route: `/app/auth/drawer/settings`
  - File: `app/app/auth/drawer/settings/page.jsx`
  - Purpose: settings and blocked users
  - APIs: `GET blocked-users`, `DELETE block-user/{id}`, `POST profile/locale`

- Route: `/app/auth/drawer/settings/account`
  - File: `app/app/auth/drawer/settings/account/page.jsx`
  - Purpose: account actions (password, logout, delete)
  - APIs: `GET user`, `POST profile/password`, `POST logout`, `DELETE user/delete`

#### Static info pages

- Route: `/app/auth/onboarding`
  - File: `app/app/auth/onboarding/page.jsx`
  - Purpose: onboarding flow
  - APIs: `GET parameters`

- Route: `/app/auth/participating`
  - File: `app/app/auth/participating/page.jsx`
  - Purpose: list offers user is participating in
  - APIs: `GET participating?lite=1`

- Route: `/app/auth/favorites`
  - File: `app/app/auth/favorites/page.jsx`
  - Purpose: list favorite offers
  - APIs: `GET offers/favorites?lite=1`

- Route: `/app/auth/success-registration`
  - File: `app/app/auth/success-registration/page.jsx`
  - Purpose: success screen after email verification

- Route: `/app/auth/policy-of-use`
  - File: `app/app/auth/policy-of-use/page.jsx`
  - Purpose: policy content

- Route: `/app/auth/terms-and-conditions`
  - File: `app/app/auth/terms-and-conditions/page.jsx`
  - Purpose: terms content for logged-in users

- Route: `/app/auth/drawer/us`
  - File: `app/app/auth/drawer/us/page.jsx`
  - Purpose: about us content

- Route: `/app/auth/drawer/faq`
  - File: `app/app/auth/drawer/faq/page.jsx`
  - Purpose: FAQ content

## 4) Component catalog (where to edit visuals)

### Layout and navigation

- `components/app-shell.jsx`
  - Main layout for all authenticated pages
  - Controls drawer menu, header, tab bar, unread counts
  - If you change navigation or global app layout, edit here

- `components/auth-header.jsx`
  - Header for guest screens (logo + back on terms pages)

- `components/i18n-provider.jsx`
  - Provides `t()` and locale selection

### Offer UI

- `components/offers/offer-card.jsx`
  - Offer card used in most lists
  - Handles favorite and participation request actions
  - If offer card visuals change, edit here

- `components/offers/offer-main-details.jsx`
  - Date, time, price, address block inside offer card

- `components/offers/offer-text.js`
  - Helper to render localized strings stored as object

### User UI

- `components/user/user-avatar.jsx`
  - Avatar with fallback initials

- `components/user/users-avatars-list.jsx`
  - Small row of participant avatars

### Base UI components

- `components/ui/button.jsx`
  - Shared button styles and loading state

- `components/ui/input.jsx`
  - Shared input component with date/time fallbacks

- `components/ui/input-support.js`
  - Detects iOS WebView input limitations

- `components/ui/checkbox.jsx`
- `components/ui/radio-group.jsx`
- `components/ui/modal.jsx`
- `components/ui/confirm-modal.jsx`

### Icons and graphics

- `components/ui/animated-logo.jsx` (used in landing and app header)
- `components/ui/heroicons.jsx` (SVG icon factory)

### QR code

- `components/ui/qr-code.jsx`
  - Canvas QR generator used on ticket screens

- `components/ui/qr-generator.js`
  - QR generator library (vendored)

## 5) API layer and expected responses

### How the client works

- File: `app/lib/api-client.js`
  - Adds `Accept` and `Accept-Language` headers
  - Adds `Authorization: Bearer <token>` if a token exists
  - Uses `NEXT_PUBLIC_API_URL` as base
  - Caches GET responses for 15s (per user + locale + URL)
  - Throws an error if response is not ok

Typical response shape used by the UI:
- `payload.data` holds the main data
- `payload.meta` contains extra fields (ex: auth token, unread counts)

### Internal Next.js API routes

- `POST /api/waitlist`
  - File: `app/api/waitlist/route.js`
  - Body: `{ name, email }`
  - Response:
    - `{ ok: true }` on success
    - `{ ok: true, duplicate: true }` if email already exists
    - `{ error: "..." }` on error

- `GET /api/proxy-image?url=...`
  - File: `app/api/proxy-image/route.js`
  - Response: image stream with proper content-type
  - Used for safe image proxying

### External Groopin API endpoints (via `apiRequest`)

Base URL: `NEXT_PUBLIC_API_URL`

Auth endpoints
- `POST login` (guest login)
  - Used in: `/app/guest/login`
  - Response used: `meta.token`, `data` (user object), `data.is_verified`

- `POST register`
  - Used in: `/app/guest/register`
  - Response used: `meta.token`, `data` (user object)

- `POST forgot-password`
  - Used in: `/app/guest/forgot-password`, `/app/guest/otp-forgot-password-verification`
  - Response used: no data required, only success/fail

- `POST otp/verify`
  - Used in: `/app/guest/otp-forgot-password-verification`
  - Response used: `token` (reset token)

- `POST reset-password/{token}`
  - Used in: `/app/guest/reset-password`
  - Response used: no data required, only success/fail

- `POST verify-email`
  - Used in: `/app/auth/otp-verify-email-verification`
  - Response used: success only

- `POST email/verification-notification`
  - Used in: `/app/auth/otp-verify-email-verification`
  - Response used: success only

- `POST email/change`
  - Used in: `/app/guest/social-login-info`
  - Body: `{ email }`
  - Response used: success only

- `POST logout`
  - Used in: `components/app-shell.jsx`, `/app/auth/drawer/settings/account`

- `GET auth/{provider}/redirect`
  - Used in: `/app/guest/login`
  - Response used: `{ redirect_url }`

User endpoints
- `GET user`
  - Used in: `components/app-shell.jsx`, `/app/auth/profile/edit`, `/app/auth/drawer/settings/account`, social callback
  - Response used: `data` user object

- `GET users/{id}`
  - Used in: `/app/auth/users/[id]`
  - Response used: `data` user profile

- `POST block-user`
  - Used in: `/app/auth/users/[id]`
  - Body: `{ user_id }`

- `DELETE block-user/{id}`
  - Used in: `/app/auth/users/[id]`, `/app/auth/drawer/settings`

- `POST signal-user`
  - Used in: `/app/auth/users/[id]`
  - Body: `{ user_id, message }`

- `POST profile/profile-information`
  - Used in: `/app/auth/profile/edit`
  - Body: profile fields from form

- `POST profile/password`
  - Used in: `/app/auth/drawer/settings/account`

- `POST profile/locale`
  - Used in: `/app/auth/drawer/settings`
  - Body: `{ locale }`

- `DELETE user/delete`
  - Used in: `/app/auth/drawer/settings/account`

Parameters
- `GET parameters`
  - Used in: `/app/auth/drawer/tabs`, `/app/auth/onboarding`, `/app/auth/my-offers/create`, `/app/auth/my-offers/[id]`, `/app/auth/offers/[id]`, `/app/auth/profile/edit`
  - Response used: `categories`, `cities`, `dynamic_questions`

Offers and lists
- `GET offers?lite=1` (and filters)
  - Used in: `/app/auth/drawer/tabs`
  - Response used: `data` list of lite offer objects (see `API_LITE_CHANGES.md`)

- `GET offers/recommended?lite=1&limit=6&trending_limit=6`
  - Used in: `/app/auth/drawer/tabs`
  - Response used: `data.recommended`, `data.trending` (lite offer objects), `meta`

- `GET offers/{id}`
  - Used in: `/app/auth/offers/[id]`, `/app/auth/offers/[id]/participants`
  - Response used: full offer details

- `POST offers/{id}/favorite` / `DELETE offers/{id}/favorite`
  - Used in: `components/offers/offer-card.jsx`, `/app/auth/offers/[id]`

- `GET offers/{id}/ticket`
  - Used in: `/app/auth/offers/[id]` (QR ticket view)

- `GET offers/{id}/checkins?limit=15`
  - Used in: `/app/auth/my-offers/[id]`

- `DELETE offers/{id}/participants/{participantId}`
  - Used in: `/app/auth/my-offers/[id]/participants`

My offers and requests
- `GET my-offers?filter[status]=...&lite=1`
  - Used in: `/app/auth/drawer/tabs/my-offers`, `/app/auth/drawer/tabs/profile`

- `GET my-offers/{id}`
  - Used in: `/app/auth/my-offers/[id]`, `/app/auth/my-offers/[id]/edit`, `/app/auth/my-offers/[id]/participants`

- `POST my-offers`
  - Used in: `/app/auth/my-offers/create`

- `POST my-offers/{id}` (update)
  - Used in: `/app/auth/my-offers/[id]/edit`

- `POST my-offers/{id}/publish`
  - Used in: `/app/auth/my-offers/create`, `/app/auth/my-offers/[id]`

- `DELETE my-offers/{id}`
  - Used in: `/app/auth/my-offers/[id]`

- `GET offer-requests?offer_id=...`
  - Used in: `/app/auth/my-offers/[id]`, `/app/auth/my-offers/[id]/participants`

- `POST offer-requests/{id}/accept`
  - Used in: `/app/auth/my-offers/[id]`, `/app/auth/my-offers/[id]/participants`

- `DELETE offer-requests/{id}`
  - Used in: `/app/auth/my-offers/[id]`, `/app/auth/my-offers/[id]/participants`

Requests and participation
- `POST requests/{offerId}`
  - Used in: `components/offers/offer-card.jsx`, `/app/auth/offers/[id]`
  - Body: `{ message }`

- `DELETE requests/{offerId}`
  - Used in: `/app/auth/offers/[id]`

- `GET requests?lite=1`
  - Used in: `/app/auth/drawer/tabs/requests`
  - Response used: array of request objects containing `offer`

- `GET my-offers/participated?filter[status]=...&lite=1`
  - Used in: `/app/auth/drawer/tabs/requests`

- `GET participating?lite=1`
  - Used in: `/app/auth/participating`

- `DELETE participating/{offerId}`
  - Used in: `/app/auth/offers/[id]`

Conversations
- `GET conversations?lite=1`
  - Used in: `components/app-shell.jsx`, `/app/auth/drawer/tabs/groops`
  - Response used: `data` list with `last_message`, unread counts

- `GET conversations/{id}/messages?lite=1`
  - Used in: `/app/auth/conversations/[id]`

- `POST conversations/{id}/typing`
  - Used in: `/app/auth/conversations/[id]`

- `POST conversations/{id}/read`
  - Used in: `/app/auth/conversations/[id]`

- `POST conversations/{id}/messages/{messageId}/reactions`
  - Used in: `/app/auth/conversations/[id]`

Notifications
- `GET notifications?lite=1`
  - Used in: `components/app-shell.jsx` for unread count

- `POST notifications/{id}/mark-as-read`
  - Used in: `/app/auth/drawer/notifications`

Tickets
- `POST tickets/scan`
  - Used in: `/app/auth/offers/[id]` and `/app/auth/my-offers/[id]`
  - Body: usually `{ code }` or QR data (see file usage)

Signals
- `POST signal-offer`
  - Used in: `/app/auth/offers/[id]`
  - Body: `{ offer_id, reason, message }` (see page for exact fields)

Ratings
- `GET users/rates?offer_id=...`
  - Used in: `/app/auth/profile/offer-rating/[id]`

- `POST users/rates`
  - Used in: `/app/auth/profile/offer-rating/[id]`

### Lite endpoints and cache notes

See `API_LITE_CHANGES.md` for details on lite payloads. The UI relies on:
- Offers list fields (id, title, dates, owner, participants, category, city, status)
- Requests list includes an `offer` object
- Conversations list includes `last_message` and unread counts

## 6) Realtime and web push

- `app/lib/realtime-client.js` creates a Laravel Echo + Pusher client
  - Uses `NEXT_PUBLIC_PUSHER_*` env vars
  - Auth headers include the Bearer token

- `app/lib/web-push.js` manages browser push subscriptions
  - Saves subscription to `web-push/subscriptions`
  - Uses service worker `public/sw.js`

## 7) Localization

- `app/lib/i18n.js` loads translations from `translations/*.json`
- `components/i18n-provider.jsx` exposes `t()` and locale switching
- Translations live in:
  - `translations/en.json`
  - `translations/fr.json`
  - `translations/ar.json`

If you change UI text, update `translations/*.json` and use `t("...")` keys.

## 8) Styles and theme

- Global styles: `app/globals.css`
- App-specific styles: `app/app/app.css`
- Tailwind theme and colors: `tailwind.config.js`
- PostCSS: `postcss.config.js`

If you need to change colors or typography, start in `tailwind.config.js`.

## 9) Assets

- App images and logos: `public/assets/images/*`
- Favicons: `public/assets/favicon/*`
- Service worker: `public/sw.js`

## 10) File index (all files in this project)

### Root and config
- `package.json` - scripts and dependencies
- `pnpm-lock.yaml` - lockfile
- `package-lock.json` - lockfile (npm)
- `next.config.js` - Next image domains and settings
- `tailwind.config.js` - theme colors and fonts
- `postcss.config.js` - Tailwind + autoprefixer
- `README.md` - project notes
- `API_LITE_CHANGES.md` - API lite + cache documentation
- `.env.local` - local env vars (not committed)

### App router files
- `app/layout.js` - root layout, fonts, analytics, i18n provider
- `app/globals.css` - global CSS, animations
- `app/page.jsx` - marketing landing screen
- `app/app/layout.jsx` - base wrapper for `/app`
- `app/app/app.css` - app theme styles
- `app/app/page.jsx` - app entry (redirect based on token)

### Guest routes
- `app/app/guest/layout.jsx` - guest layout + header
- `app/app/guest/login/page.jsx` - login screen
- `app/app/guest/register/page.jsx` - registration
- `app/app/guest/forgot-password/page.jsx` - request reset
- `app/app/guest/otp-forgot-password-verification/page.jsx` - OTP verify
- `app/app/guest/reset-password/page.jsx` - new password
- `app/app/guest/social-callback/page.jsx` - social auth callback (wrapper)
- `app/app/guest/social-callback/social-callback-client.jsx` - social auth logic
- `app/app/guest/social-login-info/page.jsx` - social login email capture + OTP trigger
- `app/app/guest/terms-and-conditions/page.jsx` - terms page

### Auth routes
- `app/app/auth/layout.jsx` - authenticated layout (AppShell)
- `app/app/auth/onboarding/page.jsx` - onboarding flow
- `app/app/auth/participating/page.jsx` - participating offers
- `app/app/auth/favorites/page.jsx` - favorites list
- `app/app/auth/otp-verify-email-verification/page.jsx` - verify email OTP
- `app/app/auth/success-registration/page.jsx` - success screen
- `app/app/auth/terms-and-conditions/page.jsx` - terms for logged-in users
- `app/app/auth/policy-of-use/page.jsx` - policy page
- `app/app/auth/users/[id]/page.jsx` - user profile
- `app/app/auth/profile/edit/page.jsx` - edit profile
- `app/app/auth/profile/survey/page.jsx` - survey
- `app/app/auth/profile/offer-rating/[id]/page.jsx` - rating form
- `app/app/auth/conversations/[id]/page.jsx` - conversation screen

### Drawer and tabs
- `app/app/auth/drawer/layout.jsx` - drawer layout (no extra UI)
- `app/app/auth/drawer/notifications/page.jsx` - notifications list
- `app/app/auth/drawer/faq/page.jsx` - FAQ
- `app/app/auth/drawer/us/page.jsx` - About us
- `app/app/auth/drawer/settings/layout.jsx` - settings layout wrapper
- `app/app/auth/drawer/settings/page.jsx` - settings page
- `app/app/auth/drawer/settings/account/page.jsx` - account settings
- `app/app/auth/drawer/tabs/layout.jsx` - tabs layout wrapper
- `app/app/auth/drawer/tabs/page.jsx` - home feed
- `app/app/auth/drawer/tabs/my-offers/page.jsx` - my offers list
- `app/app/auth/drawer/tabs/requests/page.jsx` - requests list
- `app/app/auth/drawer/tabs/groops/page.jsx` - conversations list
- `app/app/auth/drawer/tabs/profile/page.jsx` - profile summary

### Offers (owner and participant)
- `app/app/auth/offers/[id]/page.jsx` - offer detail (participant view)
- `app/app/auth/offers/[id]/participants/page.jsx` - offer participants
- `app/app/auth/my-offers/create/page.jsx` - create offer
- `app/app/auth/my-offers/[id]/page.jsx` - offer detail (owner view)
- `app/app/auth/my-offers/[id]/edit/page.jsx` - edit offer
- `app/app/auth/my-offers/[id]/participants/page.jsx` - owner participants view

### API routes
- `app/api/waitlist/route.js` - waitlist signup
- `app/api/proxy-image/route.js` - image proxy

### Libraries and utilities
- `app/lib/api-client.js` - HTTP client, caching, auth headers
- `app/lib/session.js` - token + user local storage
- `app/lib/i18n.js` - translations and `t()`
- `app/lib/i18n-storage.js` - locale storage key
- `app/lib/web-push.js` - web push subscription
- `app/lib/realtime-client.js` - Pusher/Laravel Echo
- `app/lib/supabase-server.js` - Supabase server client (waitlist)

### Components
- `components/app-shell.jsx` - layout + nav for auth screens
- `components/auth-header.jsx` - guest header
- `components/i18n-provider.jsx` - i18n context
- `components/offers/offer-card.jsx` - offer list card
- `components/offers/offer-main-details.jsx` - offer details block
- `components/offers/offer-text.js` - localized text helper
- `components/user/user-avatar.jsx` - avatar
- `components/user/users-avatars-list.jsx` - avatar stack
- `components/ui/button.jsx` - shared button
- `components/ui/input.jsx` - shared input
- `components/ui/input-support.js` - input type detection
- `components/ui/checkbox.jsx` - checkbox
- `components/ui/radio-group.jsx` - radio group
- `components/ui/modal.jsx` - modal
- `components/ui/confirm-modal.jsx` - confirm modal
- `components/ui/animated-logo.jsx` - logo animation
- `components/ui/heroicons.jsx` - icon set
- `components/ui/qr-code.jsx` - QR canvas
- `components/ui/qr-generator.js` - QR library

### Translations
- `translations/en.json` - English strings
- `translations/fr.json` - French strings
- `translations/ar.json` - Arabic strings

### Public assets
- `public/sw.js` - service worker for push
- `public/assets/images/*` - logos and images
- `public/assets/favicon/*` - favicon set

## 11) Common UI change recipes

- Change navigation or tabs: `components/app-shell.jsx`
- Change landing page visuals: `app/page.jsx` and `app/globals.css`
- Change offer card: `components/offers/offer-card.jsx`
- Change offer details block: `components/offers/offer-main-details.jsx`
- Change button style everywhere: `components/ui/button.jsx`
- Change input style everywhere: `components/ui/input.jsx`
- Change colors or fonts: `tailwind.config.js`
- Change any user-facing text: `translations/*.json`
