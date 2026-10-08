# khetE admin access, listing and product-selection update

This update corrects the Promotions access flow and improves both listing entry
and multi-option product selection.

## Install

1. Stop the local website server.
2. Extract the update ZIP directly into `C:\khete-V8`.
3. Choose **Replace files in the destination**.
4. In the Supabase SQL Editor, run:

   `C:\khete-V8\supabase\migrations\202607230002_promotions_access_repair.sql`

   This repair is safe to run if the earlier promotions migration already
   succeeded.
5. Restart the website:

   `npm.cmd run dev`

## Promotions and login

- A confirmed Super Admin or Content & Promotion Manager now enters the
  Promotions admin layout even when campaign data has a problem.
- The page displays the exact repair/error message instead of incorrectly
  showing an authorization failure.
- Signing in from a protected admin page returns to that admin page rather than
  leaving the user in the customer account.

## Listing a product

- **Save & publish** now opens a clear error dialog when a required value or
  invalid value is found.
- **Go to problem section** opens and scrolls to the relevant section.
- A successful save or publication displays a confirmation dialog.
- **Add another product** opens a fresh empty listing form.

## Product selection

- Every product option keeps its own minus and plus quantity buttons.
- Every option shows its current line amount.
- The **Purchase total** updates immediately across all selected options.

Payment-gateway behavior is unchanged.
