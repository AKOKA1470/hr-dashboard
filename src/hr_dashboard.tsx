import React, { useState, useMemo, createContext, useContext, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users,
  UserPlus,
  UserMinus,
  CalendarDays,
  Search,
  Download,
  BriefcaseBusiness,
  Clock3,
  ChevronDown,
  Check
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// --- UI Component Shims (replacing @/components/ui) ---

const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={`rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm ${className}`} {...props} />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={`flex flex-col space-y-1.5 p-6 ${className}`} {...props} />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h3 ref={ref} className={`font-semibold leading-none tracking-tight ${className}`} {...props} />
));
CardTitle.displayName = "CardTitle";

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={`p-6 pt-0 ${className}`} {...props} />
));
CardContent.displayName = "CardContent";

const Button = React.forwardRef(({ className, variant = "default", size = "default", ...props }, ref) => {
  const variants = {
    default: "bg-slate-900 text-slate-50 hover:bg-slate-900/90",
    outline: "border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900",
  };
  const sizes = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8",
    icon: "h-10 w-10",
  };
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
});
Button.displayName = "Button";

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={`flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

const Badge = React.forwardRef(({ className, variant = "default", ...props }, ref) => {
  const variants = {
    default: "border-transparent bg-slate-900 text-slate-50 hover:bg-slate-900/80",
    outline: "text-slate-950",
  };
  return (
    <div
      ref={ref}
      className={`inline-flex items-center rounded-full border border-slate-200 px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 ${variants[variant]} ${className}`}
      {...props}
    />
  );
});
Badge.displayName = "Badge";

// --- Custom Select Dropdown Implementation ---

const SelectContext = createContext();

const Select = ({ value, onValueChange, children }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div ref={containerRef} className="relative inline-block w-full text-left">
        {children}
      </div>
    </SelectContext.Provider>
  );
};

const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => {
  const { open, setOpen } = useContext(SelectContext);
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => setOpen(!open)}
      className={`flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  );
});
SelectTrigger.displayName = "SelectTrigger";

const SelectValue = ({ placeholder }) => {
  const { value } = useContext(SelectContext);
  return <span className="truncate">{value || placeholder}</span>;
};

const SelectContent = ({ children, className }) => {
  const { open } = useContext(SelectContext);
  if (!open) return null;
  return (
    <div className={`absolute z-50 mt-1 max-h-60 w-full min-w-[8rem] overflow-auto rounded-md border border-slate-200 bg-white p-1 text-slate-950 shadow-md ${className}`}>
      {children}
    </div>
  );
};

const SelectItem = React.forwardRef(({ value, children, className, ...props }, ref) => {
  const { value: selectedValue, onValueChange, setOpen } = useContext(SelectContext);
  const isSelected = selectedValue === value;
  
  return (
    <div
      ref={ref}
      onClick={() => {
        onValueChange(value);
        setOpen(false);
      }}
      className={`relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-slate-100 focus:bg-slate-100 ${className}`}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        {isSelected && <Check className="h-4 w-4" />}
      </span>
      {children}
    </div>
  );
});
SelectItem.displayName = "SelectItem";

// --- Data Constants ---

const headcountTrend = [
  { month: "Apr", employees: 1130 },
  { month: "May", employees: 1148 },
  { month: "Jun", employees: 1164 },
  { month: "Jul", employees: 1187 },
  { month: "Aug", employees: 1211 },
  { month: "Sep", employees: 1248 },
];

const departmentData = [
  { department: "Technology", employees: 412 },
  { department: "Operations", employees: 296 },
  { department: "Creative", employees: 214 },
  { department: "Finance", employees: 126 },
  { department: "HR", employees: 88 },
  { department: "Sales", employees: 112 },
];

const hiringFunnel = [
  { name: "Applications", value: 640, color: "#2563eb" },
  { name: "Screened", value: 282, color: "#0ea5e9" },
  { name: "Interviewed", value: 126, color: "#14b8a6" },
  { name: "Offered", value: 48, color: "#8b5cf6" },
  { name: "Joined", value: 36, color: "#22c55e" },
];

const leaveRequests = [
  { employee: "Ananya Rao", department: "Technology", type: "Earned leave", dates: "25–27 Sep", days: 3, status: "Pending" },
  { employee: "Rohan Mehta", department: "Creative", type: "Sick leave", dates: "24 Sep", days: 1, status: "Approved" },
  { employee: "Nisha Thomas", department: "Finance", type: "Casual leave", dates: "30 Sep", days: 1, status: "Pending" },
  { employee: "Vikram Singh", department: "Operations", type: "Earned leave", dates: "2–4 Oct", days: 3, status: "Approved" },
  { employee: "Sara Khan", department: "HR", type: "Casual leave", dates: "26 Sep", days: 1, status: "Rejected" },
];

const statusStyles = {
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  Rejected: "bg-rose-50 text-rose-700 border-rose-200",
};

function KpiCard({ title, value, detail, icon: Icon, accent }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">{title}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
              <p className="mt-1 text-xs text-slate-500">{detail}</p>
            </div>
            <div className={`rounded-2xl p-3 ${accent}`}>
              <Icon className="h-5 w-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function HRDashboard() {
  const [department, setDepartment] = useState("All departments");
  const [period, setPeriod] = useState("Last 6 months");
  const [query, setQuery] = useState("");

  const filteredRequests = useMemo(() => {
    return leaveRequests.filter((request) => {
      const matchesDepartment = department === "All departments" || request.department === department;
      const text = `${request.employee} ${request.department} ${request.type} ${request.status}`.toLowerCase();
      return matchesDepartment && text.includes(query.toLowerCase());
    });
  }, [department, query]);

  const exportCsv = () => {
    const rows = [
      ["Employee", "Department", "Leave Type", "Dates", "Days", "Status"],
      ...filteredRequests.map((r) => [r.employee, r.department, r.type, r.dates, r.days, r.status]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "hr-leave-requests.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 w-full overflow-hidden">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-blue-600 p-2 text-white">
                <BriefcaseBusiness className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">People Pulse</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">HR overview • Sample data</p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="w-[180px] rounded-xl bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["All departments", "Technology", "Operations", "Creative", "Finance", "HR", "Sales"].map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[165px] rounded-xl bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Last 30 days", "Last 3 months", "Last 6 months", "This year"].map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {}
      <main className="mx-auto max-w-7xl space-y-6 px-5 py-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard title="Total employees" value="1,248" detail="+37 this month" icon={Users} accent="bg-blue-50 text-blue-700" />
          <KpiCard title="Open positions" value="26" detail="8 priority roles" icon={UserPlus} accent="bg-violet-50 text-violet-700" />
          <KpiCard title="Attrition rate" value="8.4%" detail="Rolling 12 months" icon={UserMinus} accent="bg-rose-50 text-rose-700" />
          <KpiCard title="Average attendance" value="94.7%" detail="Current month" icon={CalendarDays} accent="bg-emerald-50 text-emerald-700" />
        </section>

        <section className="grid gap-6 lg:grid-cols-5">
          <Card className="rounded-2xl border-slate-200 shadow-sm lg:col-span-3">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Headcount trend</CardTitle>
                <Badge variant="outline" className="rounded-full">{period}</Badge>
              </div>
            </CardHeader>
            <CardContent className="h-[300px] p-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={headcountTrend} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="headcountFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} domain={[1080, 1280]} />
                  <Tooltip contentStyle={{ borderRadius: 14, borderColor: "#e2e8f0" }} />
                  <Area type="monotone" dataKey="employees" stroke="#2563eb" strokeWidth={3} fill="url(#headcountFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 shadow-sm lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Employees by department</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentData} layout="vertical" margin={{ top: 0, right: 16, left: 14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="department" width={82} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                  <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={{ borderRadius: 14, borderColor: "#e2e8f0" }} />
                  <Bar dataKey="employees" fill="#0ea5e9" radius={[0, 8, 8, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>

        {}
        <section className="grid gap-6 lg:grid-cols-3">
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Recruitment funnel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mx-auto h-[220px] max-w-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={hiringFunnel} dataKey="value" nameKey="name" innerRadius={55} outerRadius={92} paddingAngle={3}>
                      {hiringFunnel.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 14, borderColor: "#e2e8f0" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                {hiringFunnel.map((item) => (
                  <div key={item.name} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
                    <span className="flex items-center gap-2 text-slate-600">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.name}
                    </span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 shadow-sm lg:col-span-2 overflow-hidden flex flex-col">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base">Recent leave requests</CardTitle>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search requests"
                      className="w-full rounded-xl pl-9 sm:w-[210px]"
                    />
                  </div>
                  <Button onClick={exportCsv} variant="outline" size="icon" className="rounded-xl shrink-0" aria-label="Export CSV">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0 flex-1">
              <table className="w-full min-w-[660px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 font-medium">Employee</th>
                    <th className="px-4 py-3 font-medium">Leave</th>
                    <th className="px-4 py-3 font-medium">Dates</th>
                    <th className="px-4 py-3 font-medium">Days</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((request) => (
                    <tr key={`${request.employee}-${request.dates}`} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-900">{request.employee}</p>
                        <p className="text-xs text-slate-500">{request.department}</p>
                      </td>
                      <td className="px-4 py-4 text-slate-600">{request.type}</td>
                      <td className="px-4 py-4 text-slate-600">
                        <span className="flex items-center gap-2">
                          <Clock3 className="h-3.5 w-3.5" />
                          {request.dates}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-600">{request.days}</td>
                      <td className="px-5 py-4">
                        <Badge variant="outline" className={`rounded-full ${statusStyles[request.status]}`}>
                          {request.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredRequests.length === 0 && (
                <div className="p-8 text-center text-sm text-slate-500 bg-white">
                  No requests match your filters.
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}