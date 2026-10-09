import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  Clock3,
  GraduationCap,
  LoaderCircle,
  LogOut,
  X,
} from "lucide-react";
import type { AppRole, LeaveStatus, LeaveType } from "./lib/database.types";
import { supabase } from "./lib/supabase";

type Profile = { full_name: string; role: AppRole };
type LeaveRequest = {
  id: string;
  employee_id: string;
  department_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: LeaveStatus;
  created_at: string;
};
type Employee = { id: string; full_name: string };
type Department = { id: string; name: string };

const roleLabels: Record<AppRole, string> = {
  hr_admin: "HR administrator",
  manager: "Manager",
  employee: "Employee",
};
const leaveLabels: Record<LeaveType, string> = {
  earned: "Earned leave",
  sick: "Sick leave",
  casual: "Casual leave",
};
const statusClasses: Record<LeaveStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  declined: "border-rose-200 bg-rose-50 text-rose-700",
};

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function LeaveDashboard({
  profile,
  email,
  onSignOut,
  onNavigateInduction,
}: {
  profile: Profile;
  email: string;
  onSignOut: () => void;
  onNavigateInduction: () => void;
}) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Record<string, string>>({});
  const [departments, setDepartments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyRequest, setBusyRequest] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>("earned");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const loadRequests = useCallback(async () => {
    if (!supabase) return;
    try {
      setError("");
      const { data, error: requestError } = await supabase
        .from("leave_requests")
        .select(
          "id, employee_id, department_id, leave_type, start_date, end_date, days, reason, status, created_at",
        )
        .order("created_at", { ascending: false });
      if (requestError) {
        setError(`Unable to load leave requests: ${requestError.message}`);
        setRequests([]);
        return;
      }
      const rows = data ?? [];
      const employeeIds = [...new Set(rows.map((row) => row.employee_id))];
      const departmentIds = [...new Set(rows.map((row) => row.department_id))];
      const [employeeResult, departmentResult] = await Promise.all([
        employeeIds.length
          ? supabase.from("profiles").select("id, full_name").in("id", employeeIds)
          : Promise.resolve({ data: [], error: null }),
        departmentIds.length
          ? supabase.from("departments").select("id, name").in("id", departmentIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (employeeResult.error || departmentResult.error) {
        setError(
          `Unable to load request details: ${
            employeeResult.error?.message ?? departmentResult.error?.message
          }`,
        );
        setRequests([]);
        return;
      }
      setEmployees(
        Object.fromEntries(
          ((employeeResult.data ?? []) as Employee[]).map((employee) => [
            employee.id,
            employee.full_name,
          ]),
        ),
      );
      setDepartments(
        Object.fromEntries(
          ((departmentResult.data ?? []) as Department[]).map((department) => [
            department.id,
            department.name,
          ]),
        ),
      );
      setRequests(rows);
    } catch (error) {
      setError(
        `Unable to load leave requests: ${error instanceof Error ? error.message : String(error)}`,
      );
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const decide = async (requestId: string, decision: "approved" | "declined") => {
    if (!supabase) return;
    setBusyRequest(requestId);
    setActionError("");
    try {
      const { error: decisionError } = await supabase.rpc("decide_leave_request", {
        p_request_id: requestId,
        p_decision: decision,
      });
      if (decisionError) {
        setActionError(`Unable to ${decision} request: ${decisionError.message}`);
      } else {
        await loadRequests();
      }
    } catch (error) {
      setActionError(
        `Unable to ${decision} request: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setBusyRequest("");
    }
  };

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setSubmitting(true);
    setActionError("");
    try {
      const { error: submitError } = await supabase.rpc("submit_leave_request", {
        p_leave_type: leaveType,
        p_start_date: startDate,
        p_end_date: endDate,
        p_reason: reason.trim() || null,
      });
      if (submitError) {
        setActionError(`Unable to submit your request: ${submitError.message}`);
      } else {
        setStartDate("");
        setEndDate("");
        setReason("");
        await loadRequests();
      }
    } catch (error) {
      setActionError(
        `Unable to submit your request: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const canDecide = profile.role === "hr_admin" || profile.role === "manager";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-600 p-2.5 text-white">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">People Pulse</h1>
              <p className="text-xs text-slate-500">Live leave management</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-800">{profile.full_name}</p>
              <p className="text-xs text-slate-500">
                {roleLabels[profile.role]} · {email}
              </p>
            </div>
            {profile.role !== "manager" && (
              <button
                type="button"
                onClick={onNavigateInduction}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
              >
                <GraduationCap className="h-4 w-4" />
                Induction
              </button>
            )}
            <button
              onClick={onSignOut}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-5 py-7">
        <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
          <h2 className="font-semibold text-slate-900">
            {profile.role === "employee"
              ? "Your leave requests"
              : profile.role === "manager"
                ? "Requests in your assigned teams"
                : "Organization leave requests"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Records and decisions are authorized by database policies for your signed-in account.
          </p>
        </section>

        {profile.role === "employee" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Submit a leave request</h2>
            <form
              onSubmit={submitRequest}
              className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              <label className="text-sm font-medium text-slate-700">
                Leave type
                <select
                  value={leaveType}
                  onChange={(event) => setLeaveType(event.target.value as LeaveType)}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3"
                >
                  <option value="earned">Earned leave</option>
                  <option value="sick">Sick leave</option>
                  <option value="casual">Casual leave</option>
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                From
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Through
                <input
                  type="date"
                  required
                  min={startDate || undefined}
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3"
                />
              </label>
              <label className="text-sm font-medium text-slate-700 sm:col-span-2 lg:col-span-3">
                Reason (optional)
                <input
                  maxLength={2000}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-60"
                >
                  {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  Submit request
                </button>
              </div>
            </form>
          </section>
        )}

        {actionError && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {actionError}
          </p>
        )}
        {error && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
            <button onClick={() => void loadRequests()} className="ml-3 underline">
              Retry
            </button>
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold">Leave requests</h2>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading authorized requests…
            </div>
          ) : requests.length === 0 && !error ? (
            <p className="p-10 text-center text-sm text-slate-500">No leave requests to show.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Employee</th>
                    <th className="px-4 py-3 font-medium">Leave</th>
                    <th className="px-4 py-3 font-medium">Dates</th>
                    <th className="px-4 py-3 font-medium">Reason</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    {canDecide && <th className="px-5 py-3 font-medium">Decision</th>}
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id} className="border-t border-slate-100 align-top">
                      <td className="px-5 py-4">
                        <p className="font-medium">{employees[request.employee_id] ?? "Employee"}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {departments[request.department_id] ?? "Department"}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {leaveLabels[request.leave_type]}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        <span className="flex items-start gap-2">
                          <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>
                            {formatDate(request.start_date)}
                            {request.end_date !== request.start_date && (
                              <> – {formatDate(request.end_date)}</>
                            )}
                            <span className="block text-xs">{request.days} day(s)</span>
                          </span>
                        </span>
                      </td>
                      <td className="max-w-[220px] whitespace-pre-wrap px-4 py-4 text-slate-600">
                        {request.reason || "—"}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses[request.status]}`}
                        >
                          {request.status[0].toUpperCase() + request.status.slice(1)}
                        </span>
                      </td>
                      {canDecide && (
                        <td className="px-5 py-4">
                          {request.status === "pending" ? (
                            <div className="flex gap-2">
                              <button
                                aria-label={`Approve request for ${employees[request.employee_id] ?? "employee"}`}
                                disabled={busyRequest === request.id}
                                onClick={() => void decide(request.id, "approved")}
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                              >
                                {busyRequest === request.id ? (
                                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                                Approve
                              </button>
                              <button
                                aria-label={`Decline request for ${employees[request.employee_id] ?? "employee"}`}
                                disabled={busyRequest === request.id}
                                onClick={() => void decide(request.id, "declined")}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                              >
                                <X className="h-3.5 w-3.5" />
                                Decline
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">Decision recorded</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="flex items-center gap-1 text-xs text-slate-500">
          <ArrowUpRight className="h-3.5 w-3.5" />
          Leave days are counted as calendar days. Confirm this matches your organization policy.
        </p>
      </main>
    </div>
  );
}
