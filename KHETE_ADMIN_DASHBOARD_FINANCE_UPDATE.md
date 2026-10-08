# khetE Admin Dashboard Update

## What this update adds

- A real operational dashboard at `/admin`
- A dedicated Financial overview for marketplace orders and professional activity
- Gross order value, received payments, pending collection and refunded order value
- Professional gross activity, khetE commission, pending payouts and completed payouts
- A separate count for partially refunded orders without estimating an unavailable refund amount
- Order, listing, published-listing and low-stock counts
- Open support, pending review and professional-application counts
- Active professional and public-certificate counts
- Recent orders and recent support activity
- Direct links to the related admin workspaces
- Responsive desktop, laptop and mobile layouts
- Partial loading when an optional module's migration is not installed
- Removal of the misleading empty Settings link

The Settings module is intentionally not included in this update. It should be
added later as a real marketplace-configuration workspace rather than linking
to Categories.

## Installation

1. Stop the khetE development server.
2. Extract `khete-V8-admin-dashboard-update-2026-07-24.zip`.
3. Copy its contents into:

   ```text
   C:\khete-V8
   ```

4. Replace matching files when Windows asks.
5. Restart the website:

   ```powershell
   cd C:\khete-V8
   npm.cmd run dev
   ```

No SQL migration and no `npm install` are required.

## Testing

1. Sign in with an active administration account.
2. Open:

   ```text
   http://localhost:3000/admin
   ```

   Use port `3001` instead if that is the address shown in PowerShell.

3. Confirm that the overview cards and **Financial overview** load real Supabase values.
4. Select Orders, Listings, Support, Reviews, Professional Network,
   Certificates and Professional Finance from the cards.
5. Confirm that **Settings** no longer appears as an empty or duplicated link.
6. Resize the browser to check laptop and mobile layouts.

If the dashboard says a module is unavailable, run that module's previously
supplied Supabase migration. The rest of the dashboard will continue to load.

## Validation completed

- ESLint passed
- TypeScript passed
- Next.js production build passed
- All 46 application routes compiled
