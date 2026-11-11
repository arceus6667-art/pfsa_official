# PFSA project setup

Target organisation: PFSA. Target project: `rxiqubmkzqvspnzdasiz`.

The connected Supabase accounts do not currently authorize this project. Do not apply the following schema to another organisation as a substitute.

1. Grant the Supabase connection access to the PFSA organisation / project.
2. Inspect existing tables, then apply `db/pfsa-supabase.sql` once to an empty PFSA application schema. Apply `db/pfsa-domain-tasks.sql` once for the 24 domain tasks.
3. Configure the public Supabase URL and publishable key together in build configuration: `NEXT_PUBLIC_SUPABASE_URL=https://rxiqubmkzqvspnzdasiz.supabase.co` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<project publishable key>`. Never use a service-role key in the browser.
4. In Google Cloud Console create a Web OAuth client. Authorized redirect URI: `https://rxiqubmkzqvspnzdasiz.supabase.co/auth/v1/callback`. Store its Client ID and Client Secret only in the Supabase Google provider settings.
5. Set the Supabase Site URL to `https://pramaan-forensics-academy.arceus6667.chatgpt.site`. Add exact redirect URLs ending in `/auth/callback`, `/login` and `/reset-password` for that origin.
6. Rebuild and deploy. The Google button is enabled only when both public values target the PFSA project. Until the project is provisioned, the existing live database connection remains in place.
7. Grant the academy owner the `pfsa_role: admin` app-metadata claim in the new project. Do not copy passwords or privileged roles from browser storage. Existing users from the old project are not silently migrated.

Six task guides and synthetic data packs are served from `/guides`. Their dates are separate from the PDF content so staff can set actual batch deadlines.

Database checks should cover RLS, private storage, unique application/week constraints, completion gates and published-only verification. Student workflow testing was explicitly excluded from this request.
