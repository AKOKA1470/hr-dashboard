import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LoaderCircle,
  Mail,
  MapPin,
  RefreshCw,
  Search,
  UserRound,
  X,
} from "lucide-react";
import type { AppRole } from "./lib/database.types";
import {
  loadEmployeeDirectory,
  type DirectoryEmployee,
  type EmployeeDirectoryData,
} from "./lib/employee_directory";

const statusLabels: Record<string, string> = {
  draft: "Draft",
  preboarding: "Preboarding",
  active: "Active",
  on_leave: "On leave",
  suspended: "Suspended",
  exited: "Exited",
};

const employmentTypeLabels: Record<string, string> = {
  full_time: "Full time",
  part_time: "Part time",
  contract: "Contract",
  intern: "Intern",
  consultant: "Consultant",
};

const statusClasses: Record<string, string> = {
  draft: "border-slate-200 bg-slate-100 text-slate-700",
  preboarding: "border-blue-200 bg-blue-50 text-blue-800",
  active: "border-emerald-200 bg-emerald-50 text-emerald-800",
  on_leave: "border-amber-200 bg-amber-50 text-amber-800",
  suspended: "border-rose-200 bg-rose-50 text-rose-800",
  exited: "border-slate-200 bg-slate-100 text-slate-700",
};

const statusOptions = [
  "draft",
  "preboarding",
  "active",
  "on_leave",
  "suspended",
  "exited",
];

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function accessDescription(role: AppRole) {
  if (role === "hr_admin") {
    return "Employee profiles available to your HR role. Access is enforced by Supabase policies.";
  }
  if (role === "manager") {
    return "Only employees in your authorized reporting scope are shown.";
  }
  return "Only your own employee profile is available to your account.";
}

function EmployeeDetails({ employee }: { employee: DirectoryEmployee }) {
  const details: { label: string; value: string }[] = [
    { label: "Employee number", value: employee.employee_number },
    { label: "Work email", value: employee.work_email },
    { label: "Department", value: employee.department_name ?? "Not listed" },
    { label: "Designation", value: employee.designation_title ?? "Not listed" },
    {
      label: "Reporting manager",
      value: employee.manager_id
        ? employee.manager_name ?? "Not available in your authorized records"
        : "Not assigned",
    },
    { label: "Employment type", value: employmentTypeLabels[employee.employment_type] ?? employee.employment_type },
    { label: "Date joined", value: formatDate(employee.date_of_joining) },
    ...(employee.date_of_leaving
      ? [{ label: "Date left", value: formatDate(employee.date_of_leaving) }]
      : []),
    { label: "Work location", value: employee.location ?? "Not recorded" },
    { label: "Time zone", value: employee.time_zone },
    { label: "Account", value: employee.account_status.replace(/_/g, " ") },
    { label: "Induction", value: employee.induction_status.replace(/_/g, " ") },
  ];

  return (
    <aside
      aria-labelledby="employee-details-heading"
      className="min-w-0 border-t border-slate-200 pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-800">
          {initials(employee.display_name)}
        </div>
        <div className="min-w-0">
          <h2 id="employee-details-heading" className="break-words text-lg font-semibold text-slate-950">
            {employee.display_name}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {employee.designation_title ?? "Employee"}
          </p>
          <span
            className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
              statusClasses[employee.employment_status] ??
              "border-slate-200 bg-slate-100 text-slate-700"
            }`}
          >
            {statusLabels[employee.employment_status] ?? employee.employment_status}
          </span>
        </div>
      </div>
      <dl className="mt-6 divide-y divide-slate-200 border-y border-slate-200">
        {details.map((item) => (
          <div key={item.label} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 py-3">
            <dt className="text-xs font-medium text-slate-500">{item.label}</dt>
            <dd className="break-words text-sm text-slate-800">{item.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

export function EmployeeDirectory({ role }: { role: AppRole }) {
  const [data, setData] = useState<EmployeeDirectoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState("");
  const [selectedId, setSelectedId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const nextData = await loadEmployeeDirectory();
      setData(nextData);
      setSelectedId((currentId) =>
        nextData.employees.some((employee) => employee.id === currentId)
          ? currentId
          : nextData.employees[0]?.id ?? "",
      );
    } catch (caught) {
      setData(null);
      setSelectedId("");
      setError(
        `Unable to load the employee directory: ${
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

  const filteredEmployees = useMemo(() => {
    if (!data) return [];
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return data.employees.filter((employee) => {
      const matchesQuery =
        !normalizedQuery ||
        [
          employee.display_name,
          employee.work_email,
          employee.employee_number,
          employee.department_name ?? "",
          employee.designation_title ?? "",
        ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
      const matchesDepartment =
        !departmentId || employee.department_id === departmentId;
      const matchesStatus =
        !employmentStatus || employee.employment_status === employmentStatus;
      return matchesQuery && matchesDepartment && matchesStatus;
    });
  }, [data, departmentId, employmentStatus, query]);

  const selectedEmployee = filteredEmployees.find((employee) => employee.id === selectedId) ?? null;
  const hasFilters = Boolean(query || departmentId || employmentStatus);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <section className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Employee directory
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {accessDescription(role)}
          </p>
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

      <section
        aria-label="Search and filter employees"
        className="grid gap-3 sm:grid-cols-[minmax(15rem,1fr)_minmax(12rem,0.45fr)_minmax(12rem,0.45fr)]"
      >
        <label className="relative block">
          <span className="sr-only">Search by name, email, employee number, department, or title</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people"
            className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <label className="block">
          <span className="sr-only">Filter by department</span>
          <select
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">All departments</option>
            {(data?.departments ?? []).map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Filter by employment status</span>
          <select
            value={employmentStatus}
            onChange={(event) => setEmploymentStatus(event.target.value)}
            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">All statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </label>
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

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p aria-live="polite" className="text-slate-600">
          {error
            ? "Directory unavailable"
            : loading
            ? "Loading authorized employee records…"
            : `${filteredEmployees.length} ${filteredEmployees.length === 1 ? "person" : "people"}`}
          {!loading && !error && hasFilters ? " matching your filters" : ""}
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setDepartmentId("");
              setEmploymentStatus("");
            }}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 font-medium text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <X aria-hidden="true" className="h-4 w-4" />
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex min-h-56 items-center justify-center gap-2 border-y border-slate-200 text-sm text-slate-600">
          <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
          Loading your authorized directory…
        </div>
      ) : !error && data?.employees.length === 0 ? (
        <section className="border-y border-slate-200 py-12 text-center">
          <UserRound aria-hidden="true" className="mx-auto h-8 w-8 text-slate-400" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">
            No employee profiles yet
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
            There are no employee records available to your account. Profiles appear here after
            they are provisioned in Supabase.
          </p>
        </section>
      ) : !error && filteredEmployees.length === 0 ? (
        <section className="border-y border-slate-200 py-12 text-center">
          <Search aria-hidden="true" className="mx-auto h-7 w-7 text-slate-400" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No matching people</h2>
          <p className="mt-2 text-sm text-slate-600">
            Change your search or filters to see other authorized records.
          </p>
        </section>
      ) : !error ? (
        <div className="grid gap-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(19rem,0.75fr)] lg:gap-6">
          <section aria-labelledby="directory-list-heading" className="min-w-0">
            <h2 id="directory-list-heading" className="sr-only">
              Employee records
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-3 py-3 font-medium">Employee</th>
                    <th scope="col" className="px-3 py-3 font-medium">Department</th>
                    <th scope="col" className="px-3 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.map((employee) => (
                    <tr
                      key={employee.id}
                      className={selectedId === employee.id ? "bg-blue-50/60" : ""}
                    >
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          aria-pressed={selectedId === employee.id}
                          onClick={() => setSelectedId(employee.id)}
                          className="flex min-h-10 w-full min-w-0 items-center gap-3 rounded-md text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                            {initials(employee.display_name)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-slate-900">
                              {employee.display_name}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-600">
                              <Mail aria-hidden="true" className="h-3 w-3 shrink-0" />
                              {employee.work_email}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        <span className="block">{employee.department_name ?? "Not listed"}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {employee.designation_title ?? employee.employee_number}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${
                            statusClasses[employee.employment_status] ??
                            "border-slate-200 bg-slate-100 text-slate-700"
                          }`}
                        >
                          {statusLabels[employee.employment_status] ??
                            employee.employment_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {selectedEmployee ? (
            <EmployeeDetails employee={selectedEmployee} />
          ) : (
            <aside className="flex min-h-36 items-center border-t border-slate-200 pt-5 text-sm text-slate-600 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              Select a person to review their work profile.
            </aside>
          )}
        </div>
      ) : null}

      {!loading && data?.employees.length ? (
        <p className="flex items-center gap-2 text-xs leading-5 text-slate-500">
          <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          Personal phone numbers and emergency contacts are not exposed in this directory.
        </p>
      ) : null}
    </main>
  );
}
