import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpenCheck,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  FileUp,
  GraduationCap,
  LoaderCircle,
  MessageCircle,
  Plus,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import type {
  AppRole,
  InductionModuleStatus,
  Json,
} from "./lib/database.types";
import { supabase } from "./lib/supabase";

type ModuleTopic = {
  id: string;
  title: string;
  summary: string;
  sourceReferences: string[];
  activityPrompt: string;
  activityOptions: string[];
};
type ModuleContent = {
  conversionNote?: string;
  topics: ModuleTopic[];
  poll: { prompt: string; options: string[] };
  assessment: { question: string; options: string[] };
  curriculum?: Json;
};
type InductionModule = {
  id: string;
  created_by: string;
  title: string;
  source_file_name: string;
  source_path: string;
  source_file_size: number;
  source_file_type: string;
  conversion_mode: "metadata_template" | "gemini_ai";
  content: Json;
  status: InductionModuleStatus;
  conversion_stage: "extracting" | "generating" | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  correct_choice?: number;
};
type Assignment = {
  id: string;
  module_id: string;
  employee_id: string;
  assigned_by: string;
  created_at: string;
};
type Progress = {
  assignment_id: string;
  completed_topic_ids: string[];
  activity_answers: Json;
  poll_answers: Json;
  assessment_choice: number | null;
  assessment_passed: boolean;
  completed_at: string | null;
  updated_at: string;
};
type Question = {
  id: string;
  module_id: string | null;
  author_id: string;
  question: string;
  answer: string | null;
  answered_by: string | null;
  created_at: string;
  answered_at: string | null;
  question_type: "hrbp_question" | "quiz" | "knowledge_check";
};
type RosterRow = { line: number; email: string; fullName: string };
type RosterIssue = { line: number; reason: string; value: string };
type AssignmentResult = { email: string; status: string };
type Profile = { full_name: string; role: AppRole };

const EMPTY_CONTENT: ModuleContent = {
  topics: [],
  poll: { prompt: "", options: ["", "", ""] },
  assessment: { question: "", options: ["", "", "", ""] },
};
const STATUS_LABELS: Record<InductionModuleStatus, string> = {
  draft: "Draft",
  review: "In review",
  uploaded: "Uploaded",
  processing: "Converting",
  review_required: "Ready for review",
  generation_failed: "Conversion failed",
  published: "Published",
};
const STATUS_CLASSES: Record<InductionModuleStatus, string> = {
  draft: "border-slate-200 bg-slate-50 text-slate-700",
  review: "border-amber-200 bg-amber-50 text-amber-800",
  uploaded: "border-slate-200 bg-slate-50 text-slate-700",
  processing: "border-blue-200 bg-blue-50 text-blue-800",
  review_required: "border-amber-200 bg-amber-50 text-amber-800",
  generation_failed: "border-rose-200 bg-rose-50 text-rose-800",
  published: "border-emerald-200 bg-emerald-50 text-emerald-800",
};
const controlClass =
  "mt-1.5 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50";
const primaryButton =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

function emptyProgress(assignmentId: string): Progress {
  return {
    assignment_id: assignmentId,
    completed_topic_ids: [],
    activity_answers: {},
    poll_answers: {},
    assessment_choice: null,
    assessment_passed: false,
    completed_at: null,
    updated_at: new Date().toISOString(),
  };
}

function parseContent(value: Json): ModuleContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return EMPTY_CONTENT;
  const content = value as Record<string, Json | undefined>;
  const topics = Array.isArray(content.topics)
    ? content.topics.flatMap((item, index) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const topic = item as Record<string, Json | undefined>;
        return [{
          id: typeof topic.id === "string" ? topic.id : `topic-${index + 1}`,
          title: typeof topic.title === "string" ? topic.title : "",
          summary: typeof topic.summary === "string" ? topic.summary : "",
          sourceReferences: Array.isArray(topic.sourceReferences)
            ? topic.sourceReferences.filter((reference): reference is string => typeof reference === "string")
            : [],
          activityPrompt: typeof topic.activityPrompt === "string" ? topic.activityPrompt : "",
          activityOptions: Array.isArray(topic.activityOptions)
            ? topic.activityOptions.filter((option): option is string => typeof option === "string")
            : ["", ""],
        }];
      })
    : [];
  const poll = content.poll && typeof content.poll === "object" && !Array.isArray(content.poll)
    ? content.poll as Record<string, Json | undefined>
    : {};
  const assessment = content.assessment && typeof content.assessment === "object" && !Array.isArray(content.assessment)
    ? content.assessment as Record<string, Json | undefined>
    : {};
  const readOptions = (options: Json | undefined, count: number) =>
    Array.isArray(options)
      ? options.filter((option): option is string => typeof option === "string")
      : Array.from({ length: count }, () => "");
  return {
    conversionNote: typeof content.conversionNote === "string" ? content.conversionNote : undefined,
    topics,
    poll: {
      prompt: typeof poll.prompt === "string" ? poll.prompt : "",
      options: readOptions(poll.options, 3),
    },
    assessment: {
      question: typeof assessment.question === "string" ? assessment.question : "",
      options: readOptions(assessment.options, 4),
    },
    ...(content.curriculum === undefined ? {} : { curriculum: content.curriculum }),
  };
}

function hasPollResponse(value: Json) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && "onboarding_poll" in value;
}

function csvRecords(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error("The CSV has an unclosed quoted field.");
  row.push(cell.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

function readRosterCsv(source: string): { valid: RosterRow[]; issues: RosterIssue[] } {
  const records = csvRecords(source.replace(/^\uFEFF/, ""));
  if (records.length < 2) throw new Error("Add a header row and at least one employee row.");
  const headers = records[0].map((header) => header.trim().toLowerCase());
  const emailColumn = headers.indexOf("email");
  const nameColumn = headers.findIndex((header) => ["full_name", "full name", "name"].includes(header));
  if (emailColumn < 0 || nameColumn < 0) {
    throw new Error("The CSV needs email and full_name (or name) columns.");
  }

  const valid: RosterRow[] = [];
  const issues: RosterIssue[] = [];
  const seen = new Set<string>();
  records.slice(1).forEach((record, index) => {
    const line = index + 2;
    const email = (record[emailColumn] ?? "").trim().toLowerCase();
    const fullName = (record[nameColumn] ?? "").trim();
    const value = record.join(", ");
    let reason = "";
    if (record.length !== headers.length) reason = "Column count does not match the header.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) reason = "Email address is missing or invalid.";
    else if (!fullName || fullName.length > 160) reason = "Name is required and must be 160 characters or fewer.";
    else if (seen.has(email)) reason = "This email appears more than once.";
    if (reason) issues.push({ line, reason, value });
    else {
      seen.add(email);
      valid.push({ line, email, fullName });
    }
  });
  return { valid, issues };
}

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function csvCell(value: string | number) {
  const text = String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function starterContent(filename: string): ModuleContent {
  const baseName = filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  const title = baseName || "Induction";
  return {
    conversionNote:
      "Starter outline created from the uploaded filename only. No slide text was extracted; replace all prompts with approved organization guidance.",
    topics: [
      {
        id: crypto.randomUUID(),
        title: "Welcome and first days",
        summary: `Add verified welcome guidance from “${title}”.`,
        sourceReferences: [],
        activityPrompt: "Add a realistic first-day scenario and the action you want a new employee to take.",
        activityOptions: ["", "", ""],
      },
      {
        id: crypto.randomUUID(),
        title: "How we work",
        summary: "Add approved information about team practices, tools, and expectations.",
        sourceReferences: [],
        activityPrompt: "Add a work scenario that helps employees apply your team's guidance.",
        activityOptions: ["", "", ""],
      },
      {
        id: crypto.randomUUID(),
        title: "Getting help",
        summary: "Add the correct contacts and support routes for your organization.",
        sourceReferences: [],
        activityPrompt: "Add a scenario about where an employee should go for help.",
        activityOptions: ["", "", ""],
      },
    ],
    poll: {
      prompt: "",
      options: ["", "", ""],
    },
    assessment: {
      question: "",
      options: ["", "", "", ""],
    },
  };
}

function Badge({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900">
      <Award className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

export function InductionDashboard({
  profile,
  userId,
  onNavigateLeave,
}: {
  profile: Profile;
  userId: string;
  onNavigateLeave: () => void;
}) {
  const isHrbp = profile.role === "hr_admin";
  const isEmployee = profile.role === "employee";
  const [tab, setTab] = useState(isHrbp ? "overview" : "learning");
  const [modules, setModules] = useState<InductionModule[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [employeeNames, setEmployeeNames] = useState<Record<string, string>>({});
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionAuthors, setQuestionAuthors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [editingModuleId, setEditingModuleId] = useState("");
  const [aiDisclosureAccepted, setAiDisclosureAccepted] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [conversionPhase, setConversionPhase] = useState<
    "idle" | "uploading" | "extracting" | "generating" | "review_required" | "generation_failed"
  >("idle");
  const [editorTitle, setEditorTitle] = useState("");
  const [editorContent, setEditorContent] = useState<ModuleContent>(EMPTY_CONTENT);
  const [correctChoice, setCorrectChoice] = useState(0);
  const [deckFile, setDeckFile] = useState<File | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [rosterIssues, setRosterIssues] = useState<RosterIssue[]>([]);
  const [rosterResults, setRosterResults] = useState<AssignmentResult[]>([]);
  const [rosterModuleId, setRosterModuleId] = useState("");
  const [reportModuleId, setReportModuleId] = useState("all");
  const [reportStatus, setReportStatus] = useState("all");
  const [courseAssignmentId, setCourseAssignmentId] = useState("");
  const [topicAnswer, setTopicAnswer] = useState<number | null>(null);
  const [pollAnswer, setPollAnswer] = useState<number | null>(null);
  const [assessmentAnswer, setAssessmentAnswer] = useState<number | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [questionModuleId, setQuestionModuleId] = useState("");
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    if (!supabase) {
      setError("Supabase is not configured. Configure the connection and apply the induction migration to use this module.");
      setLoadFailed(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadFailed(false);
    setError("");
    try {
      let assignmentRows: Assignment[] = [];
      const assignmentResult = await supabase
        .from("induction_assignments")
        .select("id, module_id, employee_id, assigned_by, created_at")
        .order("created_at", { ascending: false });
      if (assignmentResult.error) throw new Error(`Unable to load induction assignments: ${assignmentResult.error.message}`);
      assignmentRows = (assignmentResult.data ?? []) as Assignment[];
      if (isEmployee) {
        assignmentRows = assignmentRows.filter((assignment) => assignment.employee_id === userId);
      }

      let moduleRows: InductionModule[] = [];
      const moduleColumns =
        "id, created_by, title, source_file_name, source_path, source_file_size, source_file_type, conversion_mode, content, status, conversion_stage, created_at, updated_at, published_at";
      if (isHrbp) {
        const moduleResult = await supabase
          .from("induction_modules")
          .select(moduleColumns)
          .order("created_at", { ascending: false });
        if (moduleResult.error) throw new Error(`Unable to load induction modules: ${moduleResult.error.message}`);
        moduleRows = (moduleResult.data ?? []) as InductionModule[];
      } else if (assignmentRows.length) {
        const moduleResult = await supabase
          .from("induction_modules")
          .select(moduleColumns)
          .in("id", [...new Set(assignmentRows.map((assignment) => assignment.module_id))]);
        if (moduleResult.error) throw new Error(`Unable to load assigned modules: ${moduleResult.error.message}`);
        moduleRows = (moduleResult.data ?? []) as InductionModule[];
      }

      let keysById: Record<string, number> = {};
      if (isHrbp && moduleRows.length) {
        const keyResult = await supabase
          .from("induction_assessment_keys")
          .select("module_id, correct_choice")
          .in("module_id", moduleRows.map((module) => module.id));
        if (keyResult.error) throw new Error(`Unable to load assessment keys: ${keyResult.error.message}`);
        keysById = Object.fromEntries((keyResult.data ?? []).map((key) => [key.module_id, key.correct_choice]));
      }
      moduleRows = moduleRows.map((module) => ({
        ...module,
        correct_choice: keysById[module.id],
      }));

      let progressRows: Progress[] = [];
      if (assignmentRows.length) {
        const progressResult = await supabase
          .from("induction_progress")
          .select("assignment_id, completed_topic_ids, activity_answers, poll_answers, assessment_choice, assessment_passed, completed_at, updated_at")
          .in("assignment_id", assignmentRows.map((assignment) => assignment.id));
        if (progressResult.error) throw new Error(`Unable to load learner progress: ${progressResult.error.message}`);
        progressRows = (progressResult.data ?? []) as Progress[];
      }

      const questionResult = await supabase
        .from("induction_questions")
        .select("id, module_id, author_id, question, answer, answered_by, created_at, answered_at, question_type")
        .eq("question_type", "hrbp_question")
        .order("created_at", { ascending: false });
      if (questionResult.error) throw new Error(`Unable to load HRBP questions: ${questionResult.error.message}`);
      const questionRows = (questionResult.data ?? []) as Question[];
      let peopleById: Record<string, string> = {};
      if (isHrbp) {
        const ids = [...new Set([
          ...assignmentRows.map((assignment) => assignment.employee_id),
          ...questionRows.map((question) => question.author_id),
        ])];
        if (ids.length) {
          const peopleResult = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", ids);
          if (peopleResult.error) throw new Error(`Unable to load employee names: ${peopleResult.error.message}`);
          peopleById = Object.fromEntries((peopleResult.data ?? []).map((person) => [person.id, person.full_name]));
        }
      }

      setModules(moduleRows);
      setAssignments(assignmentRows);
      setProgress(progressRows);
      setQuestions(questionRows);
      setEmployeeNames(peopleById);
      setQuestionAuthors(peopleById);
      setSelectedModuleId((current) =>
        current && moduleRows.some((module) => module.id === current) ? current : moduleRows[0]?.id ?? "",
      );
      setRosterModuleId((current) =>
        current && moduleRows.some((module) => module.id === current && module.status === "published")
          ? current
          : moduleRows.find((module) => module.status === "published")?.id ?? "",
      );
    } catch (caught) {
      setLoadFailed(true);
      setError(caught instanceof Error ? caught.message : String(caught));
      setModules([]);
      setAssignments([]);
      setProgress([]);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [isEmployee, isHrbp, userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!editingModuleId) return;
    setAiDisclosureAccepted(false);
    const module = modules.find((item) => item.id === editingModuleId);
    if (!module) return;
    setEditorTitle(module.title);
    setEditorContent(parseContent(module.content));
    setCorrectChoice(module.correct_choice ?? 0);
  }, [editingModuleId, modules]);

  const progressByAssignment = useMemo(
    () => Object.fromEntries(progress.map((item) => [item.assignment_id, item])),
    [progress],
  );
  const assignmentCountByModule = useMemo(() => {
    const counts: Record<string, number> = {};
    assignments.forEach((assignment) => {
      counts[assignment.module_id] = (counts[assignment.module_id] ?? 0) + 1;
    });
    return counts;
  }, [assignments]);
  const completedCount = progress.filter((item) => item.completed_at).length;
  const filteredAssignments = useMemo(() => assignments.filter((assignment) => {
    const itemProgress = progressByAssignment[assignment.id];
    if (reportModuleId !== "all" && assignment.module_id !== reportModuleId) return false;
    if (reportStatus === "complete" && !itemProgress?.completed_at) return false;
    if (reportStatus === "in_progress" && (!itemProgress || itemProgress.completed_at)) return false;
    if (reportStatus === "not_started" && itemProgress) return false;
    return true;
  }), [assignments, progressByAssignment, reportModuleId, reportStatus]);
  const courseAssignment = assignments.find((item) => item.id === courseAssignmentId);
  const courseModule = courseAssignment
    ? modules.find((item) => item.id === courseAssignment.module_id)
    : undefined;
  const courseProgress = courseAssignment
    ? progressByAssignment[courseAssignment.id] ?? emptyProgress(courseAssignment.id)
    : undefined;
  const courseContent = courseModule ? parseContent(courseModule.content) : EMPTY_CONTENT;
  const previewableModules = modules.filter((module) =>
    module.status === "review_required" || module.status === "published"
  );

  const setModuleTopic = (topicIndex: number, update: Partial<ModuleTopic>) => {
    setEditorContent((current) => ({
      ...current,
      topics: current.topics.map((topic, index) =>
        index === topicIndex ? { ...topic, ...update } : topic,
      ),
    }));
  };

  const handleDeckSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setDeckFile(null);
    setError("");
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "ppt", "pptx"].includes(extension ?? "")) {
      setError("Choose a PDF, PPT, or PPTX induction deck.");
      event.target.value = "";
      return;
    }
    if (file.size < 1 || file.size > 50 * 1024 * 1024) {
      setError("Deck files must be between 1 byte and 50 MB.");
      event.target.value = "";
      return;
    }
    setDeckFile(file);
  };

  const uploadDeck = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !deckFile) return;
    if (!aiDisclosureAccepted) {
      setError("Confirm that your organization allows the uploaded deck to be analyzed by Google Gemini.");
      return;
    }
    if (!companyName.trim()) {
      setError("Enter the organization name to include in the induction draft context.");
      return;
    }
    const form = event.currentTarget;
    setBusy(true);
    setConversionPhase("uploading");
    setError("");
    setNotice("");
    let sourcePath = "";
    try {
      const extension = deckFile.name.split(".").pop()?.toLowerCase() ?? "bin";
      const mimeType = extension === "pdf"
        ? "application/pdf"
        : extension === "ppt"
          ? "application/vnd.ms-powerpoint"
          : "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      const safeName = deckFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      sourcePath = `${userId}/${crypto.randomUUID()}-${safeName}`;
      const uploadResult = await supabase.storage
        .from("induction-decks")
        .upload(sourcePath, deckFile, { contentType: mimeType, upsert: false });
      if (uploadResult.error) throw new Error(`Unable to upload deck: ${uploadResult.error.message}`);

      const insertResult = await supabase
        .from("induction_modules")
        .insert({
          created_by: userId,
          title: deckFile.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 180),
          source_file_name: deckFile.name.slice(0, 255),
          source_path: sourcePath,
          source_file_size: deckFile.size,
          source_file_type: mimeType,
          conversion_mode: "gemini_ai",
          status: "uploaded",
        })
        .select("id")
        .single();
      if (insertResult.error) {
        const removal = await supabase.storage.from("induction-decks").remove([sourcePath]);
        throw new Error(
          `Unable to save deck details: ${insertResult.error.message}${
            removal.error ? ` The uploaded file also could not be removed: ${removal.error.message}` : ""
          }`,
        );
      }
      setEditingModuleId(insertResult.data.id);
      setTab("studio");
      setDeckFile(null);
      form.reset();
      setConversionPhase("extracting");
      await loadData();
      await convertDeckWithAI(insertResult.data.id, sourcePath, companyName.trim(), true);
    } catch (caught) {
      setConversionPhase("generation_failed");
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const createOutline = () => {
    const module = modules.find((item) => item.id === editingModuleId);
    if (!module) return;
    setError("");
    setEditorTitle(module.title || module.source_file_name.replace(/\.[^.]+$/, ""));
    setEditorContent(starterContent(module.source_file_name));
    setCorrectChoice(0);
    setNotice("Manual starter outline created from the filename only. It contains no extracted deck content.");
  };

  const convertDeckWithAI = async (
    moduleId = editingModuleId,
    filePath?: string,
    organizationName = companyName.trim(),
    consentConfirmed = false,
  ) => {
    if (!supabase || !moduleId) return;
    if (!consentConfirmed && !aiDisclosureAccepted) {
      setError("Confirm that sending this deck to Google Gemini is allowed by your organization's data policy.");
      return;
    }
    const module = modules.find((item) => item.id === moduleId);
    if (!module) {
      if (!filePath) {
        setError("The uploaded deck could not be found. Refresh the module list and try again.");
        return;
      }
    } else if ((assignmentCountByModule[module.id] ?? 0) > 0) {
      setError("This module already has learner assignments. Create a revised module to preserve existing progress.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    setConversionPhase("extracting");
    try {
      const conversionPath = filePath ?? module?.source_path;
      if (!conversionPath) throw new Error("The uploaded deck has no saved storage path.");
      let requestSettled = false;
      const resultPromise = supabase.functions.invoke("convert-induction", {
        body: {
          moduleId,
          filePath: conversionPath,
          companyName: organizationName,
          extractedText: "",
        },
      }).then(
        (result) => ({ result }),
        (caught: unknown) => ({ caught }),
      ).then((value) => {
        requestSettled = true;
        return value;
      });

      while (!requestSettled) {
        await new Promise((resolve) => window.setTimeout(resolve, 1200));
        const stageResult = await supabase
          .from("induction_modules")
          .select("status, conversion_stage")
          .eq("id", moduleId)
          .maybeSingle();
        const conversionStatus = stageResult.data;
        if (!stageResult.error && conversionStatus) {
          setModules((current) => current.map((item) =>
            item.id === moduleId
              ? {
                ...item,
                status: conversionStatus.status,
                conversion_stage: conversionStatus.conversion_stage,
              }
              : item
          ));
          if (conversionStatus.status === "generation_failed") setConversionPhase("generation_failed");
          else if (conversionStatus.status === "review_required") setConversionPhase("review_required");
          else setConversionPhase(conversionStatus.conversion_stage ?? "extracting");
        }
      }
      const invocation = await resultPromise;
      if ("caught" in invocation) {
        throw new Error(invocation.caught instanceof Error ? invocation.caught.message : "The conversion request failed.");
      }
      const { data, error: conversionError } = invocation.result;
      if (conversionError) {
        let message = conversionError.message;
        if (conversionError.context instanceof Response) {
          try {
            const responseBody = await conversionError.context.clone().json() as { error?: string };
            if (responseBody.error) message = responseBody.error;
          } catch {
            // Keep the function client's message if its response is not JSON.
          }
        }
        throw new Error(`AI conversion failed: ${message}`);
      }
      if (!data || data.moduleId !== moduleId || data.status !== "review_required") {
        throw new Error("The conversion service did not confirm that the module is ready for review.");
      }
      setConversionPhase("review_required");
      setNotice("AI-generated modules and activities are ready for review. Verify every policy and source reference before publishing.");
      await loadData();
    } catch (caught) {
      setConversionPhase("generation_failed");
      setError(caught instanceof Error ? caught.message : String(caught));
      await loadData();
    } finally {
      setBusy(false);
    }
  };

  const saveModule = async (status: InductionModuleStatus) => {
    if (!supabase || !editingModuleId) return;
    const module = modules.find((item) => item.id === editingModuleId);
    if (status === "published" && module?.status !== "review_required") {
      setError("Save the module for review before publishing.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await supabase.rpc("save_induction_module", {
        p_module_id: editingModuleId,
        p_title: editorTitle.trim(),
        p_content: JSON.parse(JSON.stringify(editorContent)) as Json,
        p_correct_choice: correctChoice,
        p_status: status === "review" ? "review_required" : status,
      });
      if (result.error) throw new Error(`Unable to save module: ${result.error.message}`);
      setNotice(status === "published" ? "Module published and available for assignment." : status === "review" ? "Module saved for HR review." : "Draft saved.");
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const handleRosterSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setRoster([]);
    setRosterIssues([]);
    setRosterResults([]);
    setError("");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Choose a CSV file with email and full_name columns.");
      input.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Roster CSV files must be 5 MB or smaller.");
      input.value = "";
      return;
    }
    try {
      const parsed = readRosterCsv(await file.text());
      input.value = "";
      if (parsed.valid.length > 500) {
        throw new Error("Roster uploads can contain at most 500 valid employee rows. Split the file and try again.");
      }
      setRoster(parsed.valid);
      setRosterIssues(parsed.issues);
      if (!parsed.valid.length) setError("No valid employee rows were found. Fix the CSV and upload it again.");
    } catch (caught) {
      input.value = "";
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const importRoster = async () => {
    if (!supabase || !rosterModuleId || roster.length === 0) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await supabase.rpc("assign_induction_roster", {
        p_module_id: rosterModuleId,
        p_emails: roster.map((person) => person.email),
      });
      if (result.error) throw new Error(`Unable to assign employees: ${result.error.message}`);
      setRosterResults((result.data ?? []) as AssignmentResult[]);
      setNotice("Roster checked against existing employee accounts. Rows without a matching account were not assigned.");
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const openSourceDeck = async (module: InductionModule) => {
    if (!supabase) return;
    setBusy(true);
    setError("");
    try {
      const result = await supabase.storage
        .from("induction-decks")
        .createSignedUrl(module.source_path, 300);
      if (result.error) throw new Error(`Unable to open the source deck: ${result.error.message}`);
      window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const saveProgress = async (
    next: Progress,
    assessmentChoice: number | null = next.assessment_choice,
  ) => {
    if (!supabase) return false;
    const result = await supabase.rpc("save_induction_progress", {
      p_assignment_id: next.assignment_id,
      p_completed_topic_ids: next.completed_topic_ids,
      p_activity_answers: next.activity_answers,
      p_poll_answers: next.poll_answers,
      p_assessment_choice: assessmentChoice,
    });
    if (result.error) throw new Error(`Unable to save learning progress: ${result.error.message}`);
    await loadData();
    return result.data;
  };

  const askHrbp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !questionText.trim()) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await supabase.from("induction_questions").insert({
        author_id: userId,
        module_id: questionModuleId || null,
        question: questionText.trim(),
      });
      if (result.error) throw new Error(`Unable to send your question: ${result.error.message}`);
      setQuestionText("");
      setNotice("Your question was sent to the HRBP team.");
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const answerQuestion = async (questionId: string) => {
    if (!supabase) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await supabase.rpc("answer_induction_question", {
        p_question_id: questionId,
        p_answer: (answerDrafts[questionId] ?? "").trim(),
      });
      if (result.error) throw new Error(`Unable to send HRBP response: ${result.error.message}`);
      setAnswerDrafts((current) => ({ ...current, [questionId]: "" }));
      setNotice("Response sent to the employee.");
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const startCourse = (assignmentId: string) => {
    setCourseAssignmentId(assignmentId);
    setTopicAnswer(null);
    setPollAnswer(null);
    setAssessmentAnswer(null);
    setTab("learning");
  };

  const completeActivity = async (event: FormEvent<HTMLFormElement>, topic: ModuleTopic) => {
    event.preventDefault();
    if (!courseProgress || topicAnswer === null) return;
    setBusy(true);
    setError("");
    setNotice("");
    const answers = courseProgress.activity_answers && typeof courseProgress.activity_answers === "object"
      ? courseProgress.activity_answers as Record<string, Json | undefined>
      : {};
    const next: Progress = {
      ...courseProgress,
      completed_topic_ids: [...new Set([...courseProgress.completed_topic_ids, topic.id])],
      activity_answers: { ...answers, [topic.id]: topicAnswer },
    };
    try {
      await saveProgress(next);
      setTopicAnswer(null);
      setNotice("Activity saved. Your learning progress is up to date.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const submitPoll = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!courseProgress || pollAnswer === null) return;
    setBusy(true);
    setError("");
    const answers = courseProgress.poll_answers && typeof courseProgress.poll_answers === "object"
      ? courseProgress.poll_answers as Record<string, Json | undefined>
      : {};
    try {
      await saveProgress({
        ...courseProgress,
        poll_answers: { ...answers, onboarding_poll: pollAnswer },
      });
      setNotice("Your poll response was saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const submitAssessment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!courseProgress || assessmentAnswer === null) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const passed = await saveProgress(
        { ...courseProgress, assessment_choice: assessmentAnswer },
        assessmentAnswer,
      );
      setAssessmentAnswer(null);
      setNotice(passed ? "Knowledge check passed. Your completion badge is ready." : "Not quite. Review the module and try another answer.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const exportReport = () => {
    const rows: Array<Array<string | number>> = [
      ["Employee", "Module", "Progress", "Completed at", "Assigned at"],
      ...filteredAssignments.map((assignment) => {
        const module = modules.find((item) => item.id === assignment.module_id);
        const itemProgress = progressByAssignment[assignment.id];
        return [
          employeeNames[assignment.employee_id] ?? "Employee",
          module?.title ?? "Induction module",
          itemProgress?.completed_at ? "Complete" : itemProgress ? "In progress" : "Not started",
          itemProgress?.completed_at ?? "",
          assignment.created_at,
        ];
      }),
    ];
    downloadCsv("induction-progress.csv", rows);
  };

  const navigateTab = (nextTab: string) => {
    setError("");
    setNotice("");
    setTab(nextTab);
  };

  const statusBadge = (status: InductionModuleStatus) => (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );

  const handleLeaveNavigation = () => onNavigateLeave();

  if (profile.role === "manager") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
        <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7">
          <h1 className="text-xl font-semibold">Induction access is role-based</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Induction is currently available to HRBPs and employees. Your manager account cannot access learner or HR administration records.
          </p>
          <button type="button" className={`${secondaryButton} mt-5`} onClick={handleLeaveNavigation}>
            <ArrowLeft className="h-4 w-4" /> Back to leave
          </button>
        </section>
      </main>
    );
  }

  const hrTabs = [
    ["overview", "Overview"],
    ["studio", "Deck studio"],
    ["roster", "Roster & assignments"],
    ["reports", "Reports"],
    ["questions", "HRBP support"],
  ] as const;
  const employeeTabs = [
    ["learning", "My learning"],
    ["help", "Ask HRBP"],
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-7xl px-5 py-6">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {isHrbp ? "Induction workspace" : "Your learning path"}
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              {isHrbp
                ? "Prepare approved onboarding, assign it to existing employee accounts, and follow real learner progress."
                : "Work through your assigned induction, save your activities, and ask HRBP for help when you need it."}
            </p>
          </div>
          <button type="button" onClick={() => void loadData()} className={secondaryButton} disabled={loading}>
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
        </div>

        <nav aria-label="Induction sections" className="-mb-px mt-4 flex gap-1 overflow-x-auto border-b border-slate-200">
          {(isHrbp ? hrTabs : employeeTabs).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-current={tab === id ? "page" : undefined}
              onClick={() => navigateTab(id)}
              className={`min-h-11 shrink-0 border-b-2 px-3 text-sm font-medium transition ${
                tab === id
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {error && !loadFailed && (
          <div role="alert" className="mt-5 flex items-start justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <p>{error}</p>
            <button type="button" aria-label="Dismiss error" onClick={() => setError("")} className="shrink-0 rounded p-1 hover:bg-rose-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {notice && (
          <div role="status" className="mt-5 flex items-start justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <p>{notice}</p>
            <button type="button" aria-label="Dismiss message" onClick={() => setNotice("")} className="shrink-0 rounded p-1 hover:bg-blue-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="mt-6 space-y-4" aria-label="Loading induction records">
            <div className="h-24 animate-pulse rounded-xl bg-slate-200" />
            <div className="h-56 animate-pulse rounded-xl bg-slate-200" />
          </div>
        ) : loadFailed ? (
          <section className="mx-auto mt-8 max-w-xl rounded-xl border border-rose-200 bg-white p-6 text-center">
            <h2 className="font-semibold">Induction records could not be loaded</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{error || "The data service did not return induction records."}</p>
            <button type="button" className={`${secondaryButton} mt-4`} onClick={() => void loadData()}>
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          </section>
        ) : isHrbp && tab === "overview" ? (
          <section className="space-y-6 pt-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Modules", value: modules.length, icon: BookOpenCheck },
                { label: "Published", value: modules.filter((item) => item.status === "published").length, icon: ClipboardList },
                { label: "Assigned learners", value: assignments.length, icon: Users },
                { label: "Completed", value: completedCount, icon: Award },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    {label}<Icon className="h-4 w-4 text-slate-400" />
                  </div>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
                </div>
              ))}
            </div>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="font-semibold">Induction modules</h2>
                  <p className="mt-1 text-sm text-slate-500">Module status and assignments stored in this workspace.</p>
                </div>
                <button type="button" className={primaryButton} onClick={() => { setEditingModuleId(""); navigateTab("studio"); }}>
                  <FileUp className="h-4 w-4" /> Upload deck
                </button>
              </div>
              {modules.length ? (
                <div className="divide-y divide-slate-100">
                  {modules.map((module) => (
                    <div key={module.id} className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-medium">{module.title}</h3>
                          {statusBadge(module.status)}
                        </div>
                        <p className="mt-1 truncate text-sm text-slate-500">
                          {module.source_file_name} · {formatBytes(module.source_file_size)} · {assignmentCountByModule[module.id] ?? 0} assigned
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button type="button" className={secondaryButton} onClick={() => { setEditingModuleId(module.id); navigateTab("studio"); }}>
                          Edit
                        </button>
                        <button type="button" className={secondaryButton} disabled={module.status !== "review_required" && module.status !== "published"} onClick={() => { setSelectedModuleId(module.id); navigateTab("preview"); }}>
                          Preview
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-12 text-center">
                  <BookOpenCheck className="mx-auto h-8 w-8 text-slate-400" />
                  <h3 className="mt-3 font-medium">No induction modules yet</h3>
                  <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-600">
                    Upload your approved PDF or PowerPoint deck to start a draft. Nothing is preloaded as sample content.
                  </p>
                  <button type="button" className={`${primaryButton} mt-4`} onClick={() => navigateTab("studio")}>
                    <FileUp className="h-4 w-4" /> Upload first deck
                  </button>
                </div>
              )}
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="font-semibold">Learner completion</h2>
                {assignments.length ? (
                  <>
                    <p className="mt-2 text-3xl font-semibold tabular-nums">
                      {Math.round((completedCount / assignments.length) * 100)}%
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {completedCount} of {assignments.length} assigned learning paths completed.
                    </p>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Learner completion rate" aria-valuenow={Math.round((completedCount / assignments.length) * 100)} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.round((completedCount / assignments.length) * 100)}%` }} />
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    No learner assignments yet. Publish a module and upload a roster of existing employee accounts to begin tracking progress.
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="font-semibold">Conversion transparency</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  The studio can use the configured Gemini Edge Function to read PDF slides or PPTX slide text and create a cited draft. HR must verify every generated statement against the deck before review or publishing.
                </p>
              </div>
            </section>
          </section>
        ) : isHrbp && tab === "studio" ? (
          <section className="space-y-5 pt-6">
            {!editingModuleId ? (
              <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
                <h2 className="text-lg font-semibold">Upload induction deck</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  Upload a PDF or PowerPoint file to private storage, then generate an editable learning draft from the source. PDFs and PPTX files are supported for AI conversion; legacy PPT files must be converted to PDF or PPTX first.
                </p>
                <form onSubmit={uploadDeck} className="mt-5 space-y-4">
                  <label className="block max-w-xl text-sm font-medium text-slate-700">
                    Organization name
                    <input
                      className={controlClass}
                      maxLength={120}
                      required
                      value={companyName}
                      onChange={(event) => setCompanyName(event.target.value)}
                    />
                    <span className="mt-1 block text-xs font-normal text-slate-500">Used as context only. The converter will not infer policies from the name.</span>
                  </label>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                  <label className="block flex-1 text-sm font-medium text-slate-700">
                    Deck file
                    <input
                      className={controlClass}
                      type="file"
                      accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                      onChange={handleDeckSelection}
                    />
                    <span className="mt-1 block text-xs font-normal text-slate-500">PDF, PPT, or PPTX · 50 MB upload limit · AI conversion up to 20 MB</span>
                  </label>
                  <button type="submit" className={primaryButton} disabled={!deckFile || busy || !aiDisclosureAccepted || !companyName.trim()}>
                    {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                    {conversionPhase === "uploading" ? "Uploading" : conversionPhase === "extracting" ? "Extracting content" : conversionPhase === "generating" ? "Generating activities" : "Upload and convert"}
                  </button>
                  </div>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={aiDisclosureAccepted}
                      onChange={(event) => setAiDisclosureAccepted(event.target.checked)}
                    />
                    <span>I confirm my organization allows this deck to be sent to Google Gemini for analysis. I have removed personal or sensitive employee data that should not be shared with the AI provider.</span>
                  </label>
                </form>
                <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                  <strong>Before publishing:</strong> AI output is a draft, not policy. HR must verify each topic, activity, assessment answer, and source citation against approved materials.
                </div>
              </section>
            ) : (() => {
              const module = modules.find((item) => item.id === editingModuleId);
              if (!module) return (
                <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
                  Module details are not available. <button type="button" className="underline" onClick={() => setEditingModuleId("")}>Return to upload</button>
                </div>
              );
              if ((assignmentCountByModule[module.id] ?? 0) > 0) return (
                <section className="rounded-xl border border-slate-200 bg-white p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">{module.title}</h2>
                      <p className="mt-1 text-sm text-slate-600">{module.source_file_name} · {assignmentCountByModule[module.id]} assigned learner(s)</p>
                    </div>
                    {statusBadge(module.status)}
                  </div>
                  <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                    This module is locked because learners have been assigned. Keeping its content unchanged preserves the accuracy of their saved progress and reports. Upload a revised deck as a new module to make changes.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button type="button" className={secondaryButton} onClick={() => { setSelectedModuleId(module.id); navigateTab("preview"); }}>
                      Preview learner view
                    </button>
                    <button type="button" className={primaryButton} onClick={() => setEditingModuleId("")}>
                      <FileUp className="h-4 w-4" /> Upload revised deck
                    </button>
                  </div>
                </section>
              );
              const contentReady = editorContent.topics.length > 0;
              return (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button type="button" className={secondaryButton} onClick={() => setEditingModuleId("")}>
                      <ArrowLeft className="h-4 w-4" /> Deck studio
                    </button>
                    {statusBadge(module.status)}
                  </div>
                  {!contentReady ? (
                    <section className="rounded-xl border border-slate-200 bg-white p-6">
                      <p className="text-sm text-slate-500">{module.source_file_name} · {formatBytes(module.source_file_size)}</p>
                      <h2 className="mt-2 text-lg font-semibold">{module.status === "generation_failed" ? "Conversion failed" : "Preparing interactive induction"}</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                        {module.status === "generation_failed"
                          ? "The uploaded deck is still available. Review the error, confirm AI data sharing, and retry conversion."
                          : "The uploaded deck is being extracted and converted into lessons, scenarios, quizzes, knowledge checks, and a learner poll."}
                      </p>
                      {module.status === "processing" && (
                        <p role="status" className="mt-4 rounded-lg bg-blue-50 p-4 text-sm text-blue-900">
                          {module.conversion_stage === "generating" ? "Generating activities" : "Extracting content"} · This may take up to two minutes.
                        </p>
                      )}
                      {["generation_failed", "uploaded", "draft"].includes(module.status) && (
                        <>
                          <label className="mt-4 block max-w-xl text-sm font-medium text-slate-700">
                            Organization name
                            <input className={controlClass} maxLength={120} value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
                          </label>
                          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={aiDisclosureAccepted}
                              onChange={(event) => setAiDisclosureAccepted(event.target.checked)}
                            />
                            <span>I confirm this deck may be sent to Google Gemini for retry. Sensitive employee data has been removed.</span>
                          </label>
                        </>
                      )}
                      <div className="mt-5 flex flex-wrap gap-2">
                        {(module.status === "generation_failed" || module.status === "uploaded" || module.status === "draft") && (
                          <button type="button" className={primaryButton} onClick={() => void convertDeckWithAI()} disabled={busy || !aiDisclosureAccepted || !companyName.trim()}>
                            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            {busy ? conversionPhase === "generating" ? "Generating activities" : "Extracting content" : module.status === "generation_failed" ? "Retry conversion" : "Convert deck with AI"}
                          </button>
                        )}
                        <button type="button" className={secondaryButton} onClick={createOutline} disabled={busy || module.status === "processing"}>
                          Create manual outline
                        </button>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-500">
                        AI-generated material is a draft. Verify every policy and source reference against the uploaded file before review or publication.
                      </p>
                    </section>
                  ) : (
                    <>
                      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <h2 className="text-lg font-semibold">Module builder</h2>
                            <p className="mt-1 text-sm text-slate-600">{module.source_file_name} · {formatBytes(module.source_file_size)}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button type="button" className={secondaryButton} disabled={busy} onClick={() => void openSourceDeck(module)}>
                              Open source deck
                            </button>
                            <button type="button" className={secondaryButton} disabled={module.status !== "review_required" && module.status !== "published"} onClick={() => { setSelectedModuleId(module.id); navigateTab("preview"); }}>
                              Preview learner view
                            </button>
                          </div>
                        </div>
                        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                          {editorContent.conversionNote ?? "Content was manually supplied. Confirm all details against approved HR guidance."}
                        </div>
                        <label className="mt-5 block text-sm font-medium text-slate-700">
                          Module title
                          <input className={controlClass} maxLength={180} value={editorTitle} onChange={(event) => setEditorTitle(event.target.value)} />
                        </label>
                      </section>

                      <section className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h2 className="text-lg font-semibold">Topics and activities</h2>
                            <p className="text-sm text-slate-600">Use verified guidance and practical, scenario-based activities.</p>
                          </div>
                          <button
                            type="button"
                            className={secondaryButton}
                            disabled={editorContent.topics.length >= 30}
                            onClick={() => setEditorContent((current) => ({
                              ...current,
                              topics: [...current.topics, {
                                id: crypto.randomUUID(),
                                title: "",
                                summary: "",
                                activityPrompt: "",
                                activityOptions: ["", "", ""],
                              }],
                            }))}
                          >
                            <Plus className="h-4 w-4" /> Add topic
                          </button>
                        </div>
                        {editorContent.topics.map((topic, topicIndex) => (
                          <fieldset key={topic.id} className="rounded-xl border border-slate-200 bg-white p-5">
                            <legend className="px-2 text-sm font-semibold">Topic {topicIndex + 1}</legend>
                            <div className="flex items-start gap-3">
                              <div className="grid flex-1 gap-4 sm:grid-cols-2">
                                <label className="text-sm font-medium text-slate-700">
                                  Topic title
                                  <input className={controlClass} maxLength={180} value={topic.title} onChange={(event) => setModuleTopic(topicIndex, { title: event.target.value })} />
                                </label>
                                <label className="text-sm font-medium text-slate-700">
                                  Learning content
                                  <textarea className={`${controlClass} min-h-24`} maxLength={5000} value={topic.summary} onChange={(event) => setModuleTopic(topicIndex, { summary: event.target.value })} />
                                </label>
                                <label className="text-sm font-medium text-slate-700">
                                  Source pages or slides
                                  <textarea
                                    className={`${controlClass} min-h-20`}
                                    maxLength={1000}
                                    placeholder="For example: PDF page 4, PPTX slide 7"
                                    value={topic.sourceReferences.join(", ")}
                                    onChange={(event) => setModuleTopic(topicIndex, {
                                      sourceReferences: event.target.value.split(",").map((reference) => reference.trim()).filter(Boolean),
                                    })}
                                  />
                                  <span className="mt-1 block text-xs font-normal text-slate-500">AI citations are suggestions; verify against the source deck.</span>
                                </label>
                                <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                                  Scenario or interactive activity
                                  <textarea className={`${controlClass} min-h-20`} maxLength={2000} value={topic.activityPrompt} onChange={(event) => setModuleTopic(topicIndex, { activityPrompt: event.target.value })} />
                                </label>
                                <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
                                  {topic.activityOptions.map((option, optionIndex) => (
                                    <label key={`${topic.id}-activity-${optionIndex}`} className="text-sm font-medium text-slate-700">
                                      Activity choice {optionIndex + 1}
                                      <input className={controlClass} maxLength={300} value={option} onChange={(event) => {
                                        const activityOptions = [...topic.activityOptions];
                                        activityOptions[optionIndex] = event.target.value;
                                        setModuleTopic(topicIndex, { activityOptions });
                                      }} />
                                    </label>
                                  ))}
                                </div>
                              </div>
                              <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700" aria-label={`Remove topic ${topicIndex + 1}`} onClick={() => setEditorContent((current) => ({ ...current, topics: current.topics.filter((item) => item.id !== topic.id) }))}>
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </fieldset>
                        ))}
                        {!editorContent.topics.length && (
                          <p className="rounded-lg border border-dashed border-slate-300 p-5 text-sm text-slate-600">Add at least one topic before review.</p>
                        )}
                      </section>

                      <section className="grid gap-5 lg:grid-cols-2">
                        <fieldset className="rounded-xl border border-slate-200 bg-white p-5">
                          <legend className="px-2 font-semibold">Employee pulse poll</legend>
                          <label className="mt-2 block text-sm font-medium text-slate-700">
                            Prompt
                            <textarea className={`${controlClass} min-h-20`} maxLength={1000} value={editorContent.poll.prompt} onChange={(event) => setEditorContent((current) => ({ ...current, poll: { ...current.poll, prompt: event.target.value } }))} />
                          </label>
                          <div className="mt-3 grid gap-3">
                            {editorContent.poll.options.map((option, index) => (
                              <label key={`poll-${index}`} className="text-sm font-medium text-slate-700">
                                Poll choice {index + 1}
                                <input className={controlClass} maxLength={300} value={option} onChange={(event) => setEditorContent((current) => ({ ...current, poll: { ...current.poll, options: current.poll.options.map((item, itemIndex) => itemIndex === index ? event.target.value : item) } }))} />
                              </label>
                            ))}
                          </div>
                        </fieldset>
                        <fieldset className="rounded-xl border border-slate-200 bg-white p-5">
                          <legend className="px-2 font-semibold">Knowledge check</legend>
                          <label className="mt-2 block text-sm font-medium text-slate-700">
                            Question
                            <textarea className={`${controlClass} min-h-20`} maxLength={1000} value={editorContent.assessment.question} onChange={(event) => setEditorContent((current) => ({ ...current, assessment: { ...current.assessment, question: event.target.value } }))} />
                          </label>
                          <div className="mt-3 grid gap-3">
                            {editorContent.assessment.options.map((option, index) => (
                              <label key={`assessment-${index}`} className="flex items-center gap-2 text-sm text-slate-700">
                                <input type="radio" name="correct-answer" checked={correctChoice === index} onChange={() => setCorrectChoice(index)} aria-label={`Mark answer ${index + 1} as correct`} />
                                <span className="min-w-28 font-medium">Answer {index + 1}</span>
                                <input className={`${controlClass} mt-0`} maxLength={300} value={option} onChange={(event) => setEditorContent((current) => ({ ...current, assessment: { ...current.assessment, options: current.assessment.options.map((item, itemIndex) => itemIndex === index ? event.target.value : item) } }))} />
                              </label>
                            ))}
                          </div>
                          <p className="mt-2 text-xs text-slate-500">The correct choice is stored separately from employee-visible module content.</p>
                        </fieldset>
                      </section>
                      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
                        <button type="button" className={secondaryButton} disabled={busy} onClick={() => void saveModule("draft")}>
                          <Save className="h-4 w-4" /> Save draft
                        </button>
                        <button type="button" className={secondaryButton} disabled={busy} onClick={() => void saveModule("review")}>
                          <ClipboardList className="h-4 w-4" /> Save for review
                        </button>
                        <button type="button" className={primaryButton} disabled={busy || module.status !== "review_required"} onClick={() => void saveModule("published")}>
                          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          Publish module
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
          </section>
        ) : isHrbp && tab === "roster" ? (
          <section className="grid gap-5 pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
            <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Upload employee roster</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Match CSV email addresses to existing employee accounts. Names are used for the import preview only; no account or employee profile is created.
              </p>
              <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                Required headers: <code>email,full_name</code>. Invalid rows are listed and excluded. A valid email is assigned only when it matches a provisioned employee login.
              </p>
              <label className="mt-5 block text-sm font-medium text-slate-700">
                Published module
                <select className={controlClass} value={rosterModuleId} onChange={(event) => setRosterModuleId(event.target.value)}>
                  <option value="">Choose a module</option>
                  {modules.filter((module) => module.status === "published").map((module) => (
                    <option key={module.id} value={module.id}>{module.title}</option>
                  ))}
                </select>
              </label>
              <label className="mt-4 block text-sm font-medium text-slate-700">
                Roster CSV
                <input className={controlClass} type="file" accept=".csv,text/csv" onChange={(event) => void handleRosterSelection(event)} />
              </label>
              {roster.length > 0 && (
                <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
                  <div className="flex justify-between bg-slate-50 px-4 py-3 text-sm">
                    <strong>Import preview</strong>
                    <span>{roster.length} valid · {rosterIssues.length} rejected</span>
                  </div>
                  <div className="max-h-64 overflow-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-white text-xs uppercase text-slate-500">
                        <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Email</th></tr>
                      </thead>
                      <tbody>
                        {roster.map((person) => (
                          <tr key={`${person.line}-${person.email}`} className="border-t border-slate-100">
                            <td className="px-4 py-2">{person.fullName}</td>
                            <td className="px-4 py-2 text-slate-600">{person.email}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {rosterIssues.length > 0 && (
                <details className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <summary className="cursor-pointer text-sm font-medium text-amber-950">
                    {rosterIssues.length} row(s) need correction
                  </summary>
                  <ul className="mt-3 space-y-2 text-sm text-amber-950">
                    {rosterIssues.map((issue) => (
                      <li key={issue.line}><strong>Row {issue.line}:</strong> {issue.reason} <span className="break-all">{issue.value}</span></li>
                    ))}
                  </ul>
                </details>
              )}
              <button type="button" className={`${primaryButton} mt-5`} disabled={!roster.length || !rosterModuleId || busy} onClick={() => void importRoster()}>
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                Assign {roster.length || ""} valid row(s)
              </button>
              {rosterResults.length > 0 && (
                <div className="mt-5 rounded-lg border border-slate-200 p-4">
                  <h3 className="font-medium">Account matching results</h3>
                  <ul className="mt-2 space-y-2 text-sm">
                    {rosterResults.map((result, index) => (
                      <li key={`${result.email}-${index}`} className="flex flex-wrap justify-between gap-2">
                        <span>{result.email}</span>
                        <span className={result.status === "assigned" ? "text-emerald-700" : "text-slate-600"}>
                          {result.status.replace(/_/g, " ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
            <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold">Assignment safeguards</h2>
              <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
                <li className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-emerald-700" /> Only published modules can be assigned.</li>
                <li className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-emerald-700" /> Assignments are matched server-side to existing employee-role accounts.</li>
                <li className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-emerald-700" /> Unknown or invalid accounts are reported, not silently created.</li>
                <li className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-emerald-700" /> Duplicate assignments are reported without creating another record.</li>
              </ul>
            </aside>
          </section>
        ) : isHrbp && tab === "reports" ? (
          <section className="pt-6">
            <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-end">
              <div className="grid flex-1 gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Module
                  <select className={controlClass} value={reportModuleId} onChange={(event) => setReportModuleId(event.target.value)}>
                    <option value="all">All modules</option>
                    {modules.map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Learner status
                  <select className={controlClass} value={reportStatus} onChange={(event) => setReportStatus(event.target.value)}>
                    <option value="all">All statuses</option>
                    <option value="not_started">Not started</option>
                    <option value="in_progress">In progress</option>
                    <option value="complete">Complete</option>
                  </select>
                </label>
              </div>
              <button type="button" className={secondaryButton} disabled={!filteredAssignments.length} onClick={exportReport}>
                Export CSV
              </button>
            </div>
            {(() => {
              const selectedModule = modules.find((module) => module.id === reportModuleId);
              const selectedModuleAssignments = assignments.filter(
                (assignment) => reportModuleId === "all" || assignment.module_id === reportModuleId,
              );
              const selectedContent = selectedModule ? parseContent(selectedModule.content) : null;
              const pollAnswers = selectedModuleAssignments.flatMap((assignment) => {
                const answers = progressByAssignment[assignment.id]?.poll_answers;
                if (!answers || typeof answers !== "object" || Array.isArray(answers)) return [];
                const choice = (answers as Record<string, Json | undefined>).onboarding_poll;
                return typeof choice === "number" ? [choice] : [];
              });
              return selectedContent ? (
                <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-semibold">Employee pulse poll</h2>
                      <p className="mt-1 text-sm text-slate-600">{selectedContent.poll.prompt || "No poll prompt has been added."}</p>
                    </div>
                    <span className="text-xs text-slate-500">{pollAnswers.length} saved response(s)</span>
                  </div>
                  {selectedContent.poll.options.length ? (
                    <div className="mt-4 space-y-3">
                      {selectedContent.poll.options.map((option, index) => {
                        const count = pollAnswers.filter((choice) => choice === index).length;
                        const percentage = pollAnswers.length ? Math.round((count / pollAnswers.length) * 100) : 0;
                        return (
                          <div key={`report-poll-${index}`}>
                            <div className="flex justify-between gap-3 text-sm">
                              <span>{option || `Choice ${index + 1}`}</span>
                              <span className="tabular-nums text-slate-500">{count} · {percentage}%</span>
                            </div>
                            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-blue-600" style={{ width: `${percentage}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">No poll choices have been configured.</p>
                  )}
                </section>
              ) : null;
            })()}
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="font-semibold">Employee learning progress</h2>
                <p className="mt-1 text-sm text-slate-500">{filteredAssignments.length} matching assignment(s), sourced from stored learner records.</p>
              </div>
              {filteredAssignments.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr><th className="px-5 py-3">Employee</th><th className="px-4 py-3">Module</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Topics</th><th className="px-5 py-3">Completed</th></tr>
                    </thead>
                    <tbody>
                      {filteredAssignments.map((assignment) => {
                        const itemProgress = progressByAssignment[assignment.id];
                        const module = modules.find((item) => item.id === assignment.module_id);
                        return (
                          <tr key={assignment.id} className="border-t border-slate-100">
                            <td className="px-5 py-4 font-medium">{employeeNames[assignment.employee_id] ?? "Employee"}</td>
                            <td className="px-4 py-4">{module?.title ?? "Induction module"}</td>
                            <td className="px-4 py-4">{itemProgress?.completed_at ? "Complete" : itemProgress ? "In progress" : "Not started"}</td>
                            <td className="px-4 py-4">{itemProgress?.completed_topic_ids.length ?? 0} / {module ? parseContent(module.content).topics.length : 0}</td>
                            <td className="px-5 py-4 text-slate-600">{itemProgress?.completed_at ? new Date(itemProgress.completed_at).toLocaleDateString() : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-6 py-12 text-center">
                  <ClipboardList className="mx-auto h-8 w-8 text-slate-400" />
                  <h3 className="mt-3 font-medium">No matching learner records</h3>
                  <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-600">
                    {assignments.length ? "Change the filters to include more assignments." : "Publish a module and assign it to existing employee accounts; analytics will appear as real progress is recorded."}
                  </p>
                </div>
              )}
            </div>
          </section>
        ) : isHrbp && tab === "questions" ? (
          <section className="space-y-4 pt-6">
            {questions.length ? questions.map((question) => (
              <article key={question.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{questionAuthors[question.author_id] ?? "Employee"}</p>
                  <time className="text-xs text-slate-500" dateTime={question.created_at}>{new Date(question.created_at).toLocaleString()}</time>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{question.question}</p>
                {question.answer ? (
                  <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm leading-6">
                    <p className="font-medium text-slate-800">HRBP response</p>
                    <p className="mt-1 whitespace-pre-wrap text-slate-600">{question.answer}</p>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="block flex-1 text-sm font-medium text-slate-700">
                      Response
                      <textarea className={`${controlClass} min-h-20`} maxLength={5000} value={answerDrafts[question.id] ?? ""} onChange={(event) => setAnswerDrafts((current) => ({ ...current, [question.id]: event.target.value }))} />
                    </label>
                    <button type="button" className={primaryButton} disabled={busy || !(answerDrafts[question.id] ?? "").trim()} onClick={() => void answerQuestion(question.id)}>
                      <Send className="h-4 w-4" /> Send response
                    </button>
                  </div>
                )}
              </article>
            )) : (
              <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
                <MessageCircle className="mx-auto h-8 w-8 text-slate-400" />
                <h2 className="mt-3 font-medium">No employee questions</h2>
                <p className="mt-1 text-sm text-slate-600">Questions sent through the employee help interface will appear here.</p>
              </div>
            )}
          </section>
        ) : isHrbp && tab === "preview" ? (
          <section className="mx-auto max-w-3xl pt-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-700">Learner preview</p>
                <p className="text-xs text-slate-500">Preview only · No employee identity or progress is represented</p>
              </div>
              <button type="button" className={secondaryButton} onClick={() => navigateTab("overview")}>
                <ArrowLeft className="h-4 w-4" /> Return to HRBP workspace
              </button>
            </div>
            <label className="mb-4 block text-sm font-medium text-slate-700">
              Module
              <select className={controlClass} value={selectedModuleId} onChange={(event) => setSelectedModuleId(event.target.value)}>
                {previewableModules.map((module) => <option key={module.id} value={module.id}>{module.title} · {STATUS_LABELS[module.status]}</option>)}
              </select>
            </label>
            {(() => {
              const module = previewableModules.find((item) => item.id === selectedModuleId);
              const content = module ? parseContent(module.content) : EMPTY_CONTENT;
              return module ? (
                <article className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="bg-slate-900 px-6 py-7 text-white">
                    <p className="text-sm text-slate-300">{content.topics.length} topics · interactive induction</p>
                    <h2 className="mt-2 text-2xl font-semibold">{module.title}</h2>
                  </div>
                  <div className="space-y-5 p-6">
                    {content.topics.map((topic, index) => (
                      <section key={topic.id} className="border-b border-slate-100 pb-5 last:border-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Topic {index + 1}</p>
                        <h3 className="mt-1 text-lg font-semibold">{topic.title || "Untitled topic"}</h3>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{topic.summary || "Learning content has not been added."}</p>
                        {topic.sourceReferences.length > 0 && (
                          <p className="mt-2 text-xs text-slate-500">
                            Source reference: {topic.sourceReferences.join(", ")} · verify against the original deck
                          </p>
                        )}
                        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{topic.activityPrompt || "Scenario activity pending."}</p>
                        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600">
                          {topic.activityOptions.map((option, choiceIndex) => (
                            <li key={`${topic.id}-preview-${choiceIndex}`}>{option || `Choice ${choiceIndex + 1}`}</li>
                          ))}
                        </ul>
                      </section>
                    ))}
                    <section>
                      <h3 className="font-semibold">Pulse poll</h3>
                      <p className="mt-1 text-sm text-slate-600">{content.poll.prompt || "Poll prompt pending."}</p>
                      <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600">
                        {content.poll.options.map((option, index) => <li key={`preview-poll-${index}`}>{option || `Choice ${index + 1}`}</li>)}
                      </ul>
                    </section>
                    <section>
                      <h3 className="font-semibold">Knowledge check</h3>
                      <p className="mt-1 text-sm text-slate-600">{content.assessment.question || "Assessment question pending."}</p>
                      <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600">
                        {content.assessment.options.map((option, index) => <li key={`preview-assessment-${index}`}>{option || `Answer ${index + 1}`}</li>)}
                      </ul>
                    </section>
                  </div>
                </article>
              ) : (
                <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">No module is available to preview.</p>
              );
            })()}
          </section>
        ) : isEmployee && tab === "learning" ? (
          courseAssignment && courseModule && courseProgress ? (
            <section className="mx-auto max-w-3xl pt-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <button type="button" className={secondaryButton} onClick={() => setCourseAssignmentId("")}>
                  <ArrowLeft className="h-4 w-4" /> All learning
                </button>
                {courseProgress.completed_at && <Badge>Induction complete</Badge>}
              </div>
              <article className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="bg-slate-900 px-6 py-7 text-white sm:px-8">
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <GraduationCap className="h-4 w-4" />
                    {courseProgress.completed_topic_ids.length} of {courseContent.topics.length} topics complete
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold">{courseModule.title}</h2>
                  <p className="mt-2 text-sm text-slate-300">A short, activity-based induction learning path.</p>
                </div>
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="flex flex-wrap gap-2">
                    {courseContent.topics.map((topic, index) => (
                      <span key={topic.id} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
                        courseProgress.completed_topic_ids.includes(topic.id)
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        {courseProgress.completed_topic_ids.includes(topic.id) && <Check className="h-3.5 w-3.5" />}
                        {index + 1}. {topic.title || `Topic ${index + 1}`}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="space-y-6 p-5 sm:p-8">
                  {courseProgress.completed_at ? (
                    <div className="py-6 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                        <Award className="h-7 w-7" />
                      </div>
                      <h3 className="mt-4 text-xl font-semibold">You completed this induction</h3>
                      <p className="mt-2 text-sm text-slate-600">Your progress and completion badge are saved to your employee account.</p>
                      <div className="mt-4"><Badge>{courseModule.title} complete</Badge></div>
                    </div>
                  ) : (() => {
                    const nextTopic = courseContent.topics.find((topic) => !courseProgress.completed_topic_ids.includes(topic.id));
                    if (nextTopic) return (
                      <section>
                        <p className="text-sm font-medium text-blue-700">Next topic</p>
                        <h3 className="mt-1 text-xl font-semibold">{nextTopic.title}</h3>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{nextTopic.summary}</p>
                        <form className="mt-6" onSubmit={(event) => void completeActivity(event, nextTopic)}>
                          <fieldset>
                            <legend className="font-semibold">{nextTopic.activityPrompt}</legend>
                            <div className="mt-3 space-y-2">
                              {nextTopic.activityOptions.map((option, index) => (
                                <label key={`${nextTopic.id}-${index}`} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition ${
                                  topicAnswer === index ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
                                }`}>
                                  <input type="radio" name="activity-choice" className="mt-0.5" checked={topicAnswer === index} onChange={() => setTopicAnswer(index)} />
                                  <span>{option}</span>
                                </label>
                              ))}
                            </div>
                          </fieldset>
                          <button type="submit" className={`${primaryButton} mt-5`} disabled={topicAnswer === null || busy}>
                            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            Save activity
                          </button>
                        </form>
                      </section>
                    );
                    if (!hasPollResponse(courseProgress.poll_answers)) {
                      return (
                        <section>
                          <p className="text-sm font-medium text-blue-700">Quick pulse</p>
                          <h3 className="mt-1 text-xl font-semibold">{courseContent.poll.prompt}</h3>
                          <form className="mt-5" onSubmit={(event) => void submitPoll(event)}>
                            <fieldset>
                              <legend className="sr-only">Choose a poll response</legend>
                              <div className="space-y-2">
                                {courseContent.poll.options.map((option, index) => (
                                  <label key={`pulse-${index}`} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition ${
                                    pollAnswer === index ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
                                  }`}>
                                    <input type="radio" name="poll-answer" className="mt-0.5" checked={pollAnswer === index} onChange={() => setPollAnswer(index)} />
                                    <span>{option}</span>
                                  </label>
                                ))}
                              </div>
                            </fieldset>
                            <button type="submit" className={`${primaryButton} mt-5`} disabled={pollAnswer === null || busy}>
                              Submit poll <ArrowRight className="h-4 w-4" />
                            </button>
                          </form>
                        </section>
                      );
                    }
                    return (
                      <section>
                        <p className="text-sm font-medium text-blue-700">Knowledge check</p>
                        <h3 className="mt-1 text-xl font-semibold">{courseContent.assessment.question}</h3>
                        <form className="mt-5" onSubmit={(event) => void submitAssessment(event)}>
                          <fieldset>
                            <legend className="sr-only">Choose an assessment answer</legend>
                            <div className="space-y-2">
                              {courseContent.assessment.options.map((option, index) => (
                                <label key={`assessment-answer-${index}`} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition ${
                                  assessmentAnswer === index ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
                                }`}>
                                  <input type="radio" name="assessment-answer" className="mt-0.5" checked={assessmentAnswer === index} onChange={() => setAssessmentAnswer(index)} />
                                  <span>{option}</span>
                                </label>
                              ))}
                            </div>
                          </fieldset>
                          <button type="submit" className={`${primaryButton} mt-5`} disabled={assessmentAnswer === null || busy}>
                            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            Check answer
                          </button>
                        </form>
                      </section>
                    );
                  })()}
                </div>
              </article>
            </section>
          ) : (
            <section className="space-y-5 pt-6">
              {assignments.length ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {assignments.map((assignment) => {
                    const module = modules.find((item) => item.id === assignment.module_id);
                    const itemProgress = progressByAssignment[assignment.id];
                    const topicCount = module ? parseContent(module.content).topics.length : 0;
                    const doneCount = itemProgress?.completed_topic_ids.length ?? 0;
                    const isComplete = Boolean(itemProgress?.completed_at);
                    return (
                      <article key={assignment.id} className="rounded-xl border border-slate-200 bg-white p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h2 className="font-semibold">{module?.title ?? "Assigned induction"}</h2>
                            <p className="mt-1 text-sm text-slate-600">{topicCount} topics · assigned {new Date(assignment.created_at).toLocaleDateString()}</p>
                          </div>
                          {isComplete ? <Badge>Complete</Badge> : (
                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800">
                              {itemProgress ? "In progress" : "Not started"}
                            </span>
                          )}
                        </div>
                        <div className="mt-5 flex items-center justify-between text-xs text-slate-600">
                          <span>{doneCount} / {topicCount} topics</span>
                          {itemProgress?.assessment_passed && <span className="inline-flex items-center gap-1 text-emerald-700"><Check className="h-3.5 w-3.5" /> Check passed</span>}
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`${module?.title ?? "Induction"} topic progress`} aria-valuenow={topicCount ? Math.round((doneCount / topicCount) * 100) : 0} aria-valuemin={0} aria-valuemax={100}>
                          <div className="h-full rounded-full bg-blue-600" style={{ width: `${topicCount ? Math.round((doneCount / topicCount) * 100) : 0}%` }} />
                        </div>
                        <button type="button" className={`${secondaryButton} mt-5 w-full`} onClick={() => startCourse(assignment.id)}>
                          {isComplete ? "Review learning" : "Continue learning"} <ChevronRight className="h-4 w-4" />
                        </button>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
                  <GraduationCap className="mx-auto h-8 w-8 text-slate-400" />
                  <h2 className="mt-3 font-medium">No induction assigned yet</h2>
                  <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-600">
                    Your assigned learning will appear here once HRBP adds your existing employee account to an induction module.
                  </p>
                </div>
              )}
              {assignments.some((assignment) => progressByAssignment[assignment.id]?.completed_at) && (
                <section className="rounded-xl border border-slate-200 bg-white p-5">
                  <h2 className="font-semibold">Your achievements</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {assignments.filter((assignment) => progressByAssignment[assignment.id]?.completed_at).map((assignment) => (
                      <Badge key={assignment.id}>{modules.find((item) => item.id === assignment.module_id)?.title ?? "Induction"} complete</Badge>
                    ))}
                  </div>
                </section>
              )}
            </section>
          )
        ) : isEmployee && tab === "help" ? (
          <section className="grid gap-5 pt-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <section className="h-fit rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2">
                <CircleHelp className="h-5 w-5 text-blue-700" />
                <h2 className="font-semibold">Ask HRBP</h2>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Send a question about your induction. Replies are visible to you and your authorized HRBP team.
              </p>
              <form className="mt-5" onSubmit={(event) => void askHrbp(event)}>
                <label className="block text-sm font-medium text-slate-700">
                  Related module (optional)
                  <select className={controlClass} value={questionModuleId} onChange={(event) => setQuestionModuleId(event.target.value)}>
                    <option value="">General induction question</option>
                    {modules.map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}
                  </select>
                </label>
                <label className="mt-4 block text-sm font-medium text-slate-700">
                  Your question
                  <textarea className={`${controlClass} min-h-32`} maxLength={3000} required value={questionText} onChange={(event) => setQuestionText(event.target.value)} />
                </label>
                <button type="submit" className={`${primaryButton} mt-4`} disabled={busy || !questionText.trim()}>
                  {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send to HRBP
                </button>
              </form>
            </section>
            <section className="space-y-3">
              <h2 className="font-semibold">Your questions and replies</h2>
              {questions.length ? questions.map((question) => (
                <article key={question.id} className="rounded-xl border border-slate-200 bg-white p-5">
                  <time className="text-xs text-slate-500" dateTime={question.created_at}>{new Date(question.created_at).toLocaleString()}</time>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{question.question}</p>
                  {question.answer ? (
                    <div className="mt-4 rounded-lg bg-blue-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">HRBP reply</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{question.answer}</p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">Waiting for a reply from HRBP.</p>
                  )}
                </article>
              )) : (
                <div className="rounded-xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-600">
                  You have not asked a question yet.
                </div>
              )}
            </section>
          </section>
        ) : (
          <section className="pt-6">
            <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
              This section is not available for the current account.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
