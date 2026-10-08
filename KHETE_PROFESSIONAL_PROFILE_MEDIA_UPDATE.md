# khetE V8 — Professional Profile & Brand Images

This update adds real image upload and display support to the existing
Professional Network module.

## Install

1. Stop the development server with `Ctrl+C`.
2. Extract `khete-V8-professional-profile-media-update-2026-07-23.zip`
   directly into:

   ```text
   C:\khete-V8
   ```

3. Choose **Replace the files in the destination**.
4. Open this file in Notepad or VS Code:

   ```text
   C:\khete-V8\supabase\migrations\202607230008_professional_profile_media.sql
   ```

5. Copy the complete SQL code inside the file. Paste the SQL code—not the
   Windows file path—into the Supabase SQL Editor and click **Run**.
6. Restart the website:

   ```powershell
   cd C:\khete-V8
   npm.cmd run dev
   ```

No `npm install` is required.

## Image rules

- Advisors and Expert Professionals use a **profile photo**.
- Associate Partners use a **brand or organisation logo**.
- The image must be exactly **1254 × 1254 px**.
- Accepted formats: JPG, PNG and WebP.
- Maximum file size: 5 MB.
- An image is required before a profile can be saved as **Active**.

## Test

1. Sign in as Super Admin.
2. Open `http://localhost:3000/admin/network`.
3. Choose **Public profiles** and open a profile.
4. Upload a profile photo or brand logo and save.
5. Confirm the image appears in the admin list, `/experts`, the homepage
   Professional Network section, and the public profile page.

Payment, Support, Cart, Wishlist, Offers, Listings and Orders are unchanged.
