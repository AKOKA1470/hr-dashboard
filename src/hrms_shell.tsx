import {
  BriefcaseBusiness,
  Compass,
  GraduationCap,
  LogOut,
  UsersRound,
  WalletCards,
} from "lucide-react";
import type { ReactNode } from "react";
import type { AppRole } from "./lib/database.types";

export type HrmsArea = "overview" | "people" | "leave" | "induction";

const roleLabels: Record<AppRole, string> = {
  hr_admin: "HR administrator",
  manager: "Manager",
  employee: "Employee",
};

const areaItems: {
  id: HrmsArea;
  label: string;
  icon: typeof Compass;
}[] = [
  { id: "overview", label: "Overview", icon: Compass },
  { id: "people", label: "People", icon: UsersRound },
  { id: "leave", label: "Leave", icon: WalletCards },
  { id: "induction", label: "Induction", icon: GraduationCap },
];

export function HrmsShell({
  activeArea,
  children,
  email,
  fullName,
  onNavigate,
  onSignOut,
  role,
}: {
  activeArea: HrmsArea;
  children: ReactNode;
  email: string;
  fullName: string;
  onNavigate: (area: HrmsArea) => void;
  onSignOut: () => void;
  role: AppRole;
}) {
  const visibleAreas = areaItems.filter(
    (area) => area.id !== "induction" || role !== "manager",
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex min-h-[76px] items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="shrink-0 rounded-xl bg-blue-600 p-2.5 text-white">
                <BriefcaseBusiness aria-hidden="true" className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold tracking-tight">People Pulse</p>
                <p className="text-xs text-slate-500">HR workspace</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="max-w-52 truncate text-sm font-medium text-slate-800">{fullName}</p>
                <p className="max-w-64 truncate text-xs text-slate-500">
                  {roleLabels[role]} · {email}
                </p>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <LogOut aria-hidden="true" className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
                <span className="sr-only sm:hidden">Sign out</span>
              </button>
            </div>
          </div>
          <nav
            aria-label="HR workspace"
            className="-mb-px flex gap-1 overflow-x-auto"
          >
            {visibleAreas.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-current={activeArea === id ? "page" : undefined}
                onClick={() => onNavigate(id)}
                className={`inline-flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                  activeArea === id
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
