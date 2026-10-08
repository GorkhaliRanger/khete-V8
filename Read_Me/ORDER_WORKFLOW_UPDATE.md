# khetE order workflow update

This update turns the existing cart and checkout screens into a working order-request flow.

## Included

- Secure order creation from Checkout.
- Prices are read again from Supabase during submission; browser prices are not trusted.
- Inventory is checked and reserved in one database transaction.
- Customer order history appears under `/account`.
- Admin order management appears under `/admin/orders`.
- Admins can update order status, payment status, delivery fee, expected delivery date, tracking reference and internal notes.
- Cancelling an order releases its reserved stock.
- Marking a non-variant order delivered finalizes its reserved stock.
- Every status/payment update creates an audit-history entry.

## Install the code

1. Stop the development server with `Ctrl+C`.
2. Extract the update ZIP directly into `C:\khete-V8`.
3. Choose **Replace files in the destination**.
4. Keep the existing `.env.local` file.

## Activate orders in Supabase

This step is required once.

1. Open the Supabase project.
2. Open **SQL Editor** and create a new query.
3. Open this local file:

   `C:\khete-V8\supabase\migrations\202607220001_orders.sql`

4. Copy its complete contents into the Supabase SQL Editor.
5. Click **Run**.

The script is designed to be safe to run again if the first run is interrupted.

## Start and test

```powershell
cd C:\khete-V8
npm.cmd run dev
```

Test the customer flow:

1. Sign in with a customer account.
2. Add a live, priced Supabase listing to the cart.
3. Complete `/checkout` and click **Submit order request**.
4. Open `/account` and confirm the order appears under **My orders**.

Test the admin flow:

1. Sign in using the existing Super Admin account.
2. Open `/admin/orders` or click **Orders** in the admin sidebar.
3. Select the order, change its fulfilment/payment status, and save.
4. Refresh the customer account page to verify the updated status.

## Payment status

No payment gateway is connected in this update. Checkout saves the order with:

- Order status: **Awaiting payment**
- Payment status: **Unpaid**
- Payment method: **Pending gateway**

No money is charged, and cash on delivery remains disabled. eSewa, Khalti or bank/card payment can be connected in a later milestone.
