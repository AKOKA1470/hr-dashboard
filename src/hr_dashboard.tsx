import { ArrowRight, BriefcaseBusiness, Database } from "lucide-react";

export default function HRDashboard({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-blue-600 p-2 text-white">
                <BriefcaseBusiness className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">People Pulse</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">Dashboard preview · No employee data</p>
          </div>
          <button
            type="button"
            onClick={onSignIn}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            Sign in for live data
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl items-center justify-center px-5 py-16">
        <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <Database className="h-7 w-7" />
          </div>
          <h2 className="mt-6 text-xl font-semibold tracking-tight text-slate-900">
            No dashboard data loaded
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            This preview contains no sample employees, workforce metrics, recruitment figures,
            or leave requests. Configure Supabase and sign in to see only the live records
            permitted for your role.
          </p>
          <button
            type="button"
            onClick={onSignIn}
            className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Go to sign in
            <ArrowRight className="h-4 w-4" />
          </button>
        </section>
      </main>
    </div>
  );
}
