# Supabase setup and security notes

The application is **not production-ready** until a Supabase project is configured, all
migrations and authorization tests have been applied and reviewed, and the organization
has validated its role assignments, leave rules, and operational controls. No production
project, credentials, or employee records are included here.

## Configure a project

1. Create a Supabase project and enable email/password sign-in. Require verified work
   email addresses and configure production redirect URLs, password policy, MFA, backups,
   and log retention to match your organization's security requirements.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` from the project API settings. The URL and publishable/anon
   key are public client configuration; never add a `service_role` or secret key to a
   `VITE_` variable, browser bundle, repository, or employee device.
3. Apply the migrations under `supabase/migrations/` in timestamp order using the Supabase
   CLI (`supabase db push`) or the SQL editor. Treat migration access as privileged.
4. Add the organization's departments and optional teams to `public.departments` and
   `public.teams`. The migration intentionally inserts no organization or employee data.
5. Invite each employee through Supabase Authentication. Using a trusted administrator
   session (for example, the Supabase SQL editor), create a matching
   `public.profiles` row for that auth user with a verified full name, role, department,
   and optional team. Create the first `hr_admin` this way. Do not derive roles from
   user-editable auth metadata or allow public sign-up to create profiles.
6. Add each manager's permitted department/team rows to `public.manager_scopes`. A
   `NULL` team grants that manager the whole department; a team ID grants only that
   team. Use one row per explicitly authorized scope, and periodically audit and remove
   stale scopes. Assigning a `manager` profile alone grants no decision scope.
7. Run `supabase test db` with the included SQL security tests (after installing and
   linking the Supabase CLI/project as needed). Review the generated
   schema and RLS behavior against the real org's identity lifecycle, retention,
   availability, and compliance requirements before exposing employee records.

Profiles and manager scopes have no client-side insert/update/delete permissions.
Provisioning or changing roles and manager scope requires a trusted Supabase
administrator. HR administrators can view all rows allowed by the migration and decide
any pending leave request; managers can only view and decide requests whose department
and team match a configured scope; employees can only read their own requests and submit
requests attributed to their provisioned department/team. Every decision is rechecked in
the database, is limited to a pending request, and is recorded in an append-only decision
table. Requests and decisions cannot be modified directly through the browser API.

## Employee induction

The induction module requires the `20261008000000_employee_induction.sql` migration in
addition to the HR leave migration. It creates the private `induction-decks` storage bucket,
role-scoped module and progress tables, and guarded assignment, progress, and HRBP-answer
functions. HR users must have the existing `hr_admin` role; learners must have an
`employee` profile and a matching, provisioned Supabase Auth email before a roster row can
be assigned. The roster CSV requires `email` and `full_name` headers. Importing a roster
never provisions an account or creates a profile.

### Configure AI deck conversion

Deploy the authenticated Edge Function and set its Gemini key as a server-side secret:

```powershell
supabase functions deploy convert-induction-deck
```

In the Supabase Dashboard, add `GEMINI_API_KEY` under the project's Edge Function secrets.
Optionally add `GEMINI_MODEL` to select another supported Gemini model; the default is
`gemini-2.5-flash`. Never add the key to `.env.local`, a `VITE_` variable, the browser
bundle, or source control. The function verifies the signed-in HR administrator, reads the
uploaded deck from private Supabase Storage, and calls Gemini from the server.

PDF files are sent to Gemini for document analysis. PPTX slide text is extracted in the Edge
Function and sent for analysis; images and speaker notes in PPTX are not extracted. AI
conversion supports PDF and PPTX files up to 20 MB. Legacy PPT files must be converted to
PDF or PPTX first. The function requests deletion of temporary Gemini PDF uploads after
conversion; if the provider does not confirm deletion, its service retention policy applies.
If the function or secret is not deployed, the app reports that AI conversion is not
configured; HR can still create a clearly labeled, filename-only manual outline.
The HRBP must confirm the organization's data-sharing policy before each AI conversion;
deck content is sent to Google's Gemini service for processing.

AI output is saved as an editable draft and includes suggested source page/slide references.
These references and generated text can be incomplete or inaccurate: HR must verify all
content against approved materials before review or publishing. Employee learning progress,
poll responses, assessment results, HRBP questions, and reports are stored under the database
policies and functions introduced by the migration; the dashboard does not seed sample
modules, employees, or analytics.

The dashboard preview contains no fabricated employee records, leave requests, or metrics.
With no Supabase configuration, the app will not pretend that the preview is connected to
live employee data.

Leave duration is currently inclusive **calendar days**, with a maximum request span of
366 days. Before production use, change and test this rule if the organization counts
business days, handles holidays, or has other leave types/policies.
