# khetE Legal Policies & Site Content update

This overlay adds bilingual public policy pages and a protected admin workspace
for editing, drafting, publishing and reviewing policy revisions.

## Install

1. Stop the development server with `Ctrl+C`.
2. Extract `khete-V8-site-policies-update-2026-07-24.zip` directly into:

   ```text
   C:\khete-V8
   ```

3. Allow Windows to replace matching files.
4. Open this file:

   ```text
   C:\khete-V8\supabase\migrations\202607240013_site_policies.sql
   ```

5. Copy the SQL contents into **Supabase Dashboard → SQL Editor → New query**,
   then choose **Run**.
6. Restart khetE:

   ```powershell
   cd C:\khete-V8
   npm.cmd run dev
   ```

No `npm install` is required.

## Public pages

Replace port `3000` with the active port shown in PowerShell when necessary.

```text
http://localhost:3000/policies/terms
http://localhost:3000/policies/privacy
http://localhost:3000/policies/returns
http://localhost:3000/policies/delivery
http://localhost:3000/policies/payment
```

The footer and account registration notice now link to the published policy
pages. Each page has an English/Nepali switch and displays its current version
and publication date.

## Admin workspace

Open:

```text
http://localhost:3000/admin/content
```

Access is available to:

- Super Admin
- Content & Promotion Manager

For every policy, an authorised user can:

- edit the English and Nepali title, summary and full content;
- save a private draft;
- publish a new public version;
- unpublish a live policy by saving it as a draft;
- open the public page for checking; and
- review the automatic revision history.

Use `## Heading` to begin a section and `- Item` for bullet points. Leave a
blank line between content blocks.

## Important review note

The migration includes useful operational starting templates, but the final
wording should be reviewed for khetE's registered legal entity, seller model,
product restrictions, delivery coverage, enabled payment methods and tax
position before public launch.

Relevant official references include:

- Nepal Consumer Protection Act, 2075:
  https://lawcommission.gov.np/content/12167/12167-the-consumer-protection-act-2/
- Nepal Privacy Act, 2075:
  https://lawcommission.gov.np/content/12261/12261-the-privacy-act-2075/
- Electronic Transactions Act, 2063:
  https://lawcommission.gov.np/content/13397/
- Inland Revenue Department e-billing notice:
  https://ird.gov.np/content/8070/notice-16542603731/

## Suggested test

1. Run migration `013`.
2. Open all five footer policy links as a signed-out visitor.
3. Switch a policy between English and Nepali.
4. Sign in as Super Admin and open `/admin/content`.
5. Edit one sentence and publish it.
6. Refresh the public policy page and verify the new version/date.
7. Confirm the previous version appears in Revision history.
8. Save the document as a draft and confirm its public page becomes
   unavailable until it is published again.

## Checks completed

- ESLint
- TypeScript
- Next.js production build
- Migration structure check
- Archive integrity check

Payment-gateway collection, COD, automatic email and SMS remain unchanged.
