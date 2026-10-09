import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowLeft, BriefcaseBusiness, LoaderCircle, LockKeyhole } from "lucide-react";
import HRDashboard from "./hr_dashboard";
import { InductionDashboard } from "./induction_dashboard";
import { LeaveDashboard } from "./leave_dashboard";
import type { AppRole } from "./lib/database.types";
import { supabase, supabaseConfiguration } from "./lib/supabase";

type Profile = {
  full_name: string;
  role: AppRole;
};

const roleDescriptions: { role: string; description: string }[] = [
  { role: "HR administrator", description: "Manage organization-wide leave decisions" },
  { role: "Manager", description: "Review requests in explicitly assigned teams" },
  { role: "Employee", description: "Submit leave and view only your own requests" },
];

function AuthScreen({
  onDemo,
  configured,
}: {
  onDemo: () => void;
  configured: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) setError(signInError.message);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm md:grid md:grid-cols-2">
        <section className="p-8 md:p-10">
          <div className="mb-8 flex items-center gap-3">
            <div className="rounded-xl bg-blue-600 p-2.5 text-white">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">People Pulse</h1>
              <p className="text-sm text-slate-500">Secure employee access</p>
            </div>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Sign in</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Your access level is assigned by your organization. Roles cannot be selected or
            changed from this sign-in screen.
          </p>

          {configured ? (
            <form onSubmit={signIn} className="mt-7 space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Work email
                <input
                  autoComplete="username"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Password
                <input
                  autoComplete="current-password"
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              {error && (
                <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
              >
                {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
                Sign in securely
              </button>
            </form>
          ) : (
            <div className="mt-7 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              {supabaseConfiguration === "incomplete"
                ? "Supabase is only partially configured. Set both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before signing in."
                : supabaseConfiguration === "invalid"
                  ? "VITE_SUPABASE_URL must be a valid HTTPS URL (or an HTTP localhost URL for local development)."
                  : "Supabase is not configured. Follow the Supabase setup guide before enabling employee sign-in."}
            </div>
          )}

          <div className="mt-7 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={onDemo}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              View the empty dashboard preview
            </button>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              The preview contains no employee records or fabricated metrics.
            </p>
          </div>
        </section>

        <aside className="bg-slate-900 p-8 text-white md:p-10">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <h2 className="mt-6 text-xl font-semibold">Access follows your role</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            PostgreSQL policies scope records to the signed-in employee, assigned manager
            teams, or authorized HR administrators.
          </p>
          <div className="mt-7 space-y-4">
            {roleDescriptions.map((item) => (
              <div key={item.role} className="border-t border-white/10 pt-4">
                <p className="text-sm font-medium">{item.role}</p>
                <p className="mt-1 text-sm text-slate-300">{item.description}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(Boolean(supabase));
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [showDemo, setShowDemo] = useState(false);
  const [activeArea, setActiveArea] = useState<"leave" | "induction">("leave");

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSessionLoading(false);
      setProfile(null);
      setProfileError("");
    });
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setProfileError(`Unable to restore your sign-in: ${error.message}`);
        setSession(data.session);
        setSessionLoading(false);
      })
      .catch((error: Error) => {
        if (!active) return;
        setProfileError(`Unable to restore your sign-in: ${error.message}`);
        setSessionLoading(false);
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user.id) {
      setProfile(null);
      return;
    }
    let active = true;
    setProfileLoading(true);
    supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        setProfile(data);
        setProfileError(
          error
            ? `Unable to load your access profile: ${error.message}`
            : data
              ? ""
              : "Your account has no assigned HR role. Ask your HR administrator to provision your profile.",
        );
        setProfileLoading(false);
      })
      .catch((error: Error) => {
        if (!active) return;
        setProfileError(`Unable to load your access profile: ${error.message}`);
        setProfileLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session?.user.id]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) setProfileError(`Unable to sign out: ${error.message}`);
    } catch (error) {
      setProfileError(
        `Unable to sign out: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }, []);

  if (showDemo && !session) {
    return <HRDashboard onSignIn={() => setShowDemo(false)} />;
  }

  if (!session) {
    if (sessionLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          Checking sign-in…
        </div>
      );
    }
    return <AuthScreen onDemo={() => setShowDemo(true)} configured={Boolean(supabase)} />;
  }

  if (profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
        Loading your access profile…
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Account setup required</h1>
          <p role="alert" className="mt-3 text-sm leading-6 text-rose-700">
            {profileError || "No role profile is assigned to this account."}
          </p>
          <button
            onClick={signOut}
            className="mt-6 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Sign out
          </button>
        </div>
      </main>
    );
  }

  return activeArea === "induction" ? (
    <InductionDashboard
      profile={profile}
      email={session.user.email ?? ""}
      userId={session.user.id}
      onSignOut={signOut}
      onNavigateLeave={() => setActiveArea("leave")}
    />
  ) : (
    <LeaveDashboard
      profile={profile}
      email={session.user.email ?? ""}
      onSignOut={signOut}
      onNavigateInduction={() => setActiveArea("induction")}
    />
  );
}
