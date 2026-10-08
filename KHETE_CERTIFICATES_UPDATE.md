# khetE Certificates & SQL Repair Update

This update repairs the failed Verified Reviews migration and adds the complete Certificates & Verification module.

## Installation

1. Stop the khetE development server with `Ctrl+C`.
2. Extract `khete-V8-certificates-update-2026-07-24.zip` directly into:

   ```text
   C:\khete-V8
   ```

3. Replace the matching files when Windows asks.

## Run the SQL in this order

### 1. Rerun the corrected Reviews migration

Open:

```text
C:\khete-V8\supabase\migrations\202607240014_verified_reviews.sql
```

Copy the complete SQL contents into **Supabase Dashboard → SQL Editor → New query**, then click **Run**.

This corrected file wraps the combined review-opportunity query in a named result set and sorts with:

```sql
order by opportunities.completed_at desc nulls last
```

The migration is designed to be safely rerun after the earlier `completed_at` error.

### 2. Run the Certificates migration

Open:

```text
C:\khete-V8\supabase\migrations\202607240015_certificates.sql
```

Copy the complete SQL contents into a new Supabase SQL Editor query and click **Run**.

This creates:

- Certificates
- Standalone certified farms and people
- Links to professional profiles
- Links to products, produce, livestock, services and rentals
- Links to professional-service offerings
- Public/private certificate access rules
- A certificate-document storage bucket
- PDF and image upload permissions

## Restart khetE

```powershell
cd C:\khete-V8
npm.cmd run dev
```

Use the exact port shown in PowerShell, normally `3000` or `3001`.

## New pages

Public:

```text
http://localhost:3000/certificates
http://localhost:3000/certificates/[certificate-slug]
http://localhost:3000/certificates/subjects/[subject-slug]
```

Administrator:

```text
http://localhost:3000/admin/certificates
```

## Create and link a certificate

1. Sign in using the Super Admin account.
2. Open **Admin → Certificates**.
3. If the certificate belongs to a farm or person without an existing khetE profile, first open **Standalone farms & people** and create that subject.
4. Return to **Certificates** and select **New certificate**.
5. Enter the title, issuing authority, certificate number, dates, summary and status.
6. Upload the complete PDF/JPG/PNG/WebP certificate, or enter its full text.
7. Select any linked records:
   - Advisors, Experts or Associate Partners
   - Products, produce, livestock, service listings or rentals
   - Professional-service offerings
   - Standalone farms or people
8. Set the status to **Verified** and enable **Publish**.
9. Save.

A certificate may have no links, one link, or several links. The complete certificate is stored once even when it applies to several records.

## Test the public flow

1. Open `/certificates`.
2. Search by title, issuer, certificate number or linked record.
3. Open **Read full certificate**.
4. Confirm that the complete PDF/image or text record is visible.
5. Open one of its linked products, rentals, services or professional profiles.
6. Confirm that **Certificates & verification** appears on that page.

## File requirements

- PDF, JPG, PNG or WebP
- Maximum 10 MB
- Public certificates must have either a complete uploaded document or a full text record

No `npm install` is required. Payment functionality and the khetE logo are unchanged.
