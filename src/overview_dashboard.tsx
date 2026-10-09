import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Building2,
  GraduationCap,
  LoaderCircle,
  RefreshCw,
  UsersRound,
  WalletCards,
} from "lucide-react";
import type { AppRole } from "./lib/database.types";
import {
  loadEmployeeDirectory,
  type EmployeeDirectoryData,
} from "./lib/employee_directory";
import type { HrmsArea } from "./hrms_shell";

const roleCopy: Record<AppRole, string> = {
  hr_admin: "Review the people, leave, and induction records available to your HR role.",
  manager: "Review your authorized team records and leave requests.",
  employee: "Find your employee information and continue to leave or induction.",
};

export function OverviewDashboard({
  fullName,
  onNavigate,
  role,
}: {
  fullName: string;
  onNavigate: (area: HrmsArea) => void;
  role: AppRole;
}) {
  const [data, setData] = useState<EmployeeDirectoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await loadEmployeeDirectory());
    } catch (caught) {
      setData(null);
      setError(
        `Unable to load your people overview: ${
          caught instanceof Error ? caught.message : String(caught)
        }`,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount =
    data?.employees.filter((employee) => employee.employment_status === "active").length ?? 0;
  const representedDepartmentIds = new Set(
    (data?.employees ?? [])
      .map((employee) => employee.department_id)
      .filter((id): id is string => Boolean(id)),
  );

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      <section className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Welcome, {fullName.split(" ")[0]}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{roleCopy[role]}</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60 sm:self-auto"
        >
          {loading ? (
            <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
          )}
          Refresh
        </button>
      </section>

      {error && (
        <div
          role="alert"
          className="flex flex-col justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex min-h-9 shrink-0 items-center gap-2 self-start rounded-lg border border-rose-300 px-3 font-medium hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Try again
          </button>
        </div>
      )}

      <section aria-labelledby="people-snapshot-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="people-snapshot-heading" className="text-lg font-semibold tracking-tight">
            People in your view
          </h2>
          <p className="text-xs text-slate-500">
            Counts include only records your account is authorized to access.
          </p>
        </div>
        <div className="mt-4 grid divide-y divide-slate-200 border-y border-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="py-4 sm:pr-6">
            <p className="text-2xl font-semibold tabular-nums text-slate-900">
              {loading || error ? "—" : data?.employees.length ?? 0}
            </p>
            <p className="mt-1 text-sm text-slate-600">Authorized employee records</p>
          </div>
          <div className="py-4 sm:px-6">
            <p className="text-2xl font-semibold tabular-nums text-slate-900">
              {loading || error ? "—" : activeCount}
            </p>
            <p className="mt-1 text-sm text-slate-600">Active in this view</p>
          </div>
          <div className="py-4 sm:pl-6">
            <p className="text-2xl font-semibold tabular-nums text-slate-900">
              {loading || error ? "—" : representedDepartmentIds.size}
            </p>
            <p className="mt-1 text-sm text-slate-600">Departments represented</p>
          </div>
        </div>
        {!loading && !error && data?.employees.length === 0 && (
          <p className="mt-4 text-sm text-slate-600">
            No employee profiles are available to your account yet. The overview will update when
            authorized records are added in Supabase.
          </p>
        )}
      </section>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
        <section aria-labelledby="workspace-heading">
          <h2 id="workspace-heading" className="text-lg font-semibold tracking-tight">
            Your workspace
          </h2>
          <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
            <button
              type="button"
              onClick={() => onNavigate("people")}
              className="group flex min-h-[72px] w-full items-center gap-4 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <UsersRound aria-hidden="true" className="h-5 w-5 shrink-0 text-blue-700" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-900">People directory</span>
                <span className="mt-1 block text-sm text-slate-600">
                  Search and review the employee records available to you
                </span>
              </span>
              <ArrowRight
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-1"
              />
            </button>
            <button
              type="button"
              onClick={() => onNavigate("leave")}
              className="group flex min-h-[72px] w-full items-center gap-4 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <WalletCards aria-hidden="true" className="h-5 w-5 shrink-0 text-blue-700" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-900">Leave management</span>
                <span className="mt-1 block text-sm text-slate-600">
                  Submit or review leave requests in your authorized scope
                </span>
              </span>
              <ArrowRight
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-1"
              />
            </button>
            {role !== "manager" && (
              <button
                type="button"
                onClick={() => onNavigate("induction")}
                className="group flex min-h-[72px] w-full items-center gap-4 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <GraduationCap aria-hidden="true" className="h-5 w-5 shrink-0 text-blue-700" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-900">Employee induction</span>
                  <span className="mt-1 block text-sm text-slate-600">
                    Continue learning or manage approved onboarding
                  </span>
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-1"
                />
              </button>
            )}
          </div>
        </section>

        <section aria-labelledby="departments-heading">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="departments-heading" className="text-lg font-semibold tracking-tight">
              Company departments
            </h2>
            <Building2 aria-hidden="true" className="h-4 w-4 text-slate-500" />
          </div>
          {loading ? (
            <div className="mt-4 flex items-center gap-2 py-4 text-sm text-slate-500">
              <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
              Loading department catalog…
            </div>
          ) : error ? (
            <p className="mt-4 border-y border-slate-200 py-4 text-sm text-slate-600">
              Department information is unavailable until the overview can be refreshed.
            </p>
          ) : data?.departments.length ? (
            <ul className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
              {data.departments.map((department) => {
                const visibleCount = data.employees.filter(
                  (employee) => employee.department_id === department.id,
                ).length;
                return (
                  <li
                    key={department.id}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-900">
                        {department.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {department.code}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-slate-600">
                      {visibleCount} visible {visibleCount === 1 ? "person" : "people"}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 border-y border-slate-200 py-4 text-sm text-slate-600">
              No department catalog is available.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
