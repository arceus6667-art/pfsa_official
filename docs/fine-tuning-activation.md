# PFSA fine-tuning activation

The website update restores the approved offer layout, keeps offer record IDs unchanged, makes batch/start date read-only for students, and adds scoped responsive CSS.

## Required Supabase settings

Project: rxiqubmkzqvspnzdasiz.

1. Run db/pfsa-batch-permissions.sql in SQL Editor. It adds database enforcement against student changes to cohort/start_date, defaults new student profiles to A1/2026, and preserves valid admin-created assignments. Expected result: PFSA batch protection active.
2. Authentication > Email Templates (or Emails > Templates) > Magic Link:
   - Subject: Your secure PFSA sign-in link
   - Body: the complete contents of emails/magic-link.html
   - Preserve every {{ .ConfirmationURL }} expression and Save.

Changing the website alone does not apply either of these Supabase settings. The template uses the existing secure link, a hosted academy logo, one primary button and a fallback link.

## Verification

- tests/profile-permissions.mjs checks protected fields are excluded from student update payloads.
- tests/auth-offer-flow.mjs checks onboarding and stable offer downloads.
- tests/admin-reports.mjs checks reports, batches, CSV safety and pagination.
- Real Canvas PDF rendering was checked for all six domains with long names. The standard record fills one A4 page using the approved letterhead and paragraph structure.
- Visual browser checks and live email preview require an unlocked desktop / Supabase dashboard access.
