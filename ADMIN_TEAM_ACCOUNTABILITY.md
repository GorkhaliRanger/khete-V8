# Admin team access and activity

## How a new administrator signs in

1. An existing Super Admin opens **Admin Users**, enters the staff member's name, email and phone, chooses the department role or **Super Admin**, and sends an activation link.
2. The recipient opens the link from their email. For email sign-in, they choose and confirm their own password on the verification page. The Super Admin never sees or chooses that password.
3. After activation, the recipient signs in at `/admin/login` with that email and password. Google sign-in can activate the same invitation without creating a password, if Google is configured for the Supabase project.
4. A pending invitation lasts 24 hours. **Resend link** sends a fresh link for an unexpired invitation; an expired invitation must be issued again.

Admin and marketplace profiles and browser sessions are separate. Supabase Auth currently keeps one identity per email, so an email/password change for an address used in both areas changes that address's shared Auth password.

## Super Admin authority

- A Super Admin can invite another Super Admin by selecting that role alone. It grants access to the entire Admin panel.
- A verified, active departmental administrator can be promoted with **Promote to Super Admin** in their Admin Users record. The database checks the caller's live authority and records the actor and target.
- Existing Super Admin records cannot be edited, deleted, demoted or reset from Admin Users. Each owner manages their own profile and password.
- Every person should use their own account. The Admin header shows the active department label, or **Super Admin**. Multiple departments appear in full in the account menu and profile.

## Admin Activity

Only Super Admins can open **Admin Activity**. It shows the authenticated actor, a snapshot of their name/email/roles, Nepal time, area, table, record ID, changed fields, and safe before/after values. The page filters by person or record, area and dates, and loads older events in pages.

The audit is recorded by database triggers for 27 live Admin-managed tables. Clients cannot directly insert, edit or delete events. The legacy account-action log remains, but direct client insertion into it is revoked; account actions also flow into the new trail. Sensitive customer contact data, support message text, documents, credentials and tokens are not copied into event values.

Audit begins when the SQL is activated. Earlier changes cannot be reconstructed. Storage object operations without a related database row change, Supabase service-role/Dashboard changes without an Admin JWT, and failed writes are not captured. The `marketplace_reviews` table is absent in the current project; rerun its trigger-install block if that feature is installed.

## Database rollout

- `20261110140038_enable_multiple_super_admins.sql` was applied through the Supabase migration connector and recorded in its migration history.
- `20261110150000_record_admin_activity_events.sql` was applied manually through `supabase/setup/activate-admin-activity.sql` on 10 November 2026. It is active but is **not** recorded in Supabase migration history. Reconcile the earlier manually applied schema before automated `db push`; do not replay the old Admin activation wrapper, which contains obsolete role functions.
- Live verification reported 27 installed audit triggers, enabled RLS, a working feed, and blocked anonymous/direct inserts. During browser verification, the user completed a new Super Admin invitation: there are now two active Super Admins, and the new account's email is confirmed with a password set. The agent did not create or enter that credential.

The invitation-link parser passed 4 checks; the multiple-Super-Admin SQL passed 23; and the activity SQL passed 37. Updated application files passed TypeScript and targeted ESLint. The user's new Super Admin activation confirms live email-link onboarding; the agent did not handle any password.
