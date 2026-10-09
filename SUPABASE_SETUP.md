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
4. The employee-directory migration adds department codes and seeds the supplied
   department/designation catalog. Add any additional departments and optional teams using
   a trusted administrator session.
5. Invite each employee through Supabase Authentication. Using a trusted administrator
   session (for example, the Supabase SQL editor), create a matching
   `public.profiles` row for that auth user with a verified full name, role, department,
   and optional team. Create the first `hr_admin` this way. A corresponding
   `public.employee_profiles` row can then record the employee number, work details, and
   reporting manager. Do not derive roles from user-editable auth metadata or allow public
   sign-up to create profiles.
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

The induction module requires `20261008000000_employee_induction.sql`,
`20261009000000_induction_conversion_statuses.sql`, and
`20261009000100_induction_conversion_data.sql` in addition to the HR leave migration. These
create the private `induction-decks` storage
bucket, role-scoped module and progress tables, and guarded assignment, progress, and
HRBP-answer functions. The existing `hr_admin` role provides the HRBP permission in this
application; learners must have an
`employee` profile and a matching, provisioned Supabase Auth email before a roster row can
be assigned. The roster CSV requires `email` and `full_name` headers. Importing a roster
never provisions an account or creates a profile.

### Configure AI deck conversion

Deploy the authenticated Edge Function and set its Gemini key as a server-side secret:

```powershell
supabase functions deploy convert-induction
```

Add `GEMINI_API_KEY` under the project's Edge Function secrets in the Supabase Dashboard,
or set it with `supabase secrets set --env-file supabase/functions/.env`. For local Edge
Function development, copy `supabase/functions/.env.example` to the ignored
`supabase/functions/.env` and populate the secret there. Never add the key to a frontend
environment variable, browser bundle, or source control. The function independently
validates the signed-in user's JWT and HR role, binds the request to the module's private
Storage file, and calls Gemini from the server.

The upload studio sends `moduleId`, `filePath`, `companyName`, and `extractedText` to the
function after upload. PPTX slide text is extracted in the Edge Function when no extracted
text is supplied; PDF files are sent to Gemini for document analysis. Images and speaker
notes in PPTX are not extracted. AI conversion supports PDF and PPTX files up to 20 MB;
legacy PPT files must be converted to PDF or PPTX first. Generated sections, lessons,
scenarios, quizzes, and knowledge checks are validated and saved to the induction tables
before the module reaches `review_required`. Failures are marked `generation_failed`.
Temporary Gemini PDF uploads are deleted after conversion when possible; if the provider
does not confirm deletion, its service retention policy applies. The HRBP must confirm the
organization's data-sharing policy before each AI conversion; deck content is sent to
Google's Gemini service for processing.

AI output is saved as an editable module with suggested source page/slide references.
These references and generated text can be incomplete or inaccurate: HR must verify all
content before publishing. Preview is limited to modules ready for review or already
published, and publishing requires the `review_required` status. Employee learning progress,
poll responses, assessment results, HRBP questions, and reports are stored under the database
policies and functions introduced by the migration; the dashboard does not seed sample
modules, employees, or analytics.

### Employee directory

`20261009145000_employee_directory.sql` extends the existing `departments` table rather
than replacing it, adds designations, employee profiles, employee role assignments,
manager history, and private employee-import staging. Existing Supabase Auth accounts and
`public.profiles` remain the authentication/authorization source. Each employee-directory
profile links to its provisioned `public.profiles` row through `user_id`; induction
assignments continue to use that same auth user ID. The directory migration seeds only the
organization's department and designation catalog, not employee accounts or employee
profiles. It validates manager cycles and records manager changes. Emergency contact and
phone fields are not granted to browser clients. Import staging is reserved for a future
trusted HR import flow; no employee is imported or invited by this migration.
The current permission checks continue to use `public.profiles.role`; the directory's role
catalog and assignment tables are not yet a replacement for those authorization checks.

The dashboard preview contains no fabricated employee records, leave requests, or metrics.
With no Supabase configuration, the app will not pretend that the preview is connected to
live employee data.

Leave duration is currently inclusive **calendar days**, with a maximum request span of
366 days. Before production use, change and test this rule if the organization counts
business days, handles holidays, or has other leave types/policies.
