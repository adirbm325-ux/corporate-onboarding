/* שכבת שמירה/טעינה מרכזית לכל האפליקציה. src/lib/dataStore.js

   עקרון העל: localStorage הוא תמיד מקור האמת התפעולי המיידי — הוא נכתב
   סינכרונית, ללא תלות ברשת, בכל שינוי state. Supabase הוא יעד סנכרון
   נוסף, "best effort": אם הוא מוגדר ונגיש, אנחנו כותבים אליו גם, ואם
   לא (מפתחות חסרים, אין רשת, השרת נופל) — האפליקציה ממשיכה לעבוד בדיוק
   כפי שעבדה קודם, מול localStorage בלבד. שום מסך, כפתור או התנהגות לא
   תלויים בזה שהחיבור ל-Supabase יצליח.
*/

import { supabase, isSupabaseConfigured } from "./supabaseClient.js";

export const LOCAL_STORAGE_KEY = "corp-onboarding-mock-v1";

let backendMode = isSupabaseConfigured ? "checking" : "local"; // 'checking' | 'supabase' | 'local'
let lastFailureAt = 0;
let inFlightDetection = null; // מונע ריבוי בדיקות מקבילות שכל אחת "מאפסת" את שעון ה-cooldown
const RETRY_COOLDOWN_MS = 15000; // אחרי כשל, לא מנסים שוב לפני 15 שניות — נמנעים מהצפת בקשות

export function getBackendMode() {
  return backendMode;
}

/* בודק אם Supabase נגיש בפועל (לא רק אם המפתחות קיימים) — שאילתה קלה
   וזולה לטבלה שתמיד קיימת אחרי הרצת schema.sql. מוגבלת בזמן (8 שניות)
   כדי שבעיית רשת איטית (למשל DNS שלא נפתר) לא תשאיר את הבדיקה "תלויה"
   זמן רב מבלי לעדכן את מנגנון ה-retry. אם כבר רצה בדיקה, קריאות נוספות
   ממתינות לתוצאה שלה במקום ליזום עוד בדיקה מקבילה. */
export async function detectBackend() {
  if (!isSupabaseConfigured) {
    backendMode = "local";
    return backendMode;
  }
  if (inFlightDetection) return inFlightDetection;
  inFlightDetection = (async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const { error } = await supabase.from("branch_settings").select("id").limit(1).abortSignal(controller.signal);
      clearTimeout(timeoutId);
      backendMode = error ? "local" : "supabase";
      if (error) lastFailureAt = Date.now();
    } catch {
      backendMode = "local";
      lastFailureAt = Date.now();
    } finally {
      inFlightDetection = null;
    }
    return backendMode;
  })();
  return inFlightDetection;
}

/* ================= localStorage — סינכרוני, תמיד זמין ================= */

export function loadLocalState() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* אחסון מקומי לא זמין — ממשיכים עם ברירות מחדל */
  }
  return null;
}

export function saveLocalState(state) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/* ================= מיפוי camelCase (state ב-JS) <-> snake_case (עמודות Supabase) ================= */

function caseToRow(c) {
  return {
    id: c.id,
    name: c.name,
    company_number: c.companyNumber,
    field: c.field,
    address: c.address,
    contact_name: c.contactName,
    contact_phone: c.contactPhone,
    contact_email: c.contactEmail,
    service_type: c.serviceType,
    courier_involved: !!c.courierInvolved,
    status: c.status,
    assignee: c.assignee,
    updated_at: c.updatedAt,
    documents: c.documents || [],
    ai_suggestions: c.aiSuggestions || [],
    remote_id: c.remoteId || {},
    portal_token: c.portalToken || null,
  };
}

function rowToCaseBase(row) {
  return {
    id: row.id,
    name: row.name,
    companyNumber: row.company_number,
    field: row.field,
    address: row.address,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    serviceType: row.service_type,
    courierInvolved: !!row.courier_involved,
    status: row.status,
    assignee: row.assignee,
    updatedAt: row.updated_at,
    documents: row.documents || [],
    aiSuggestions: row.ai_suggestions || [],
    remoteId: row.remote_id || {},
    portalToken: row.portal_token || null,
    people: [],
    couriers: [],
    forms: [],
  };
}

function personToRow(p, caseId) {
  return {
    id: p.id,
    case_id: caseId,
    full_name: p.fullName,
    role: p.role,
    partial_id: p.partialId,
    phone: p.phone,
    email: p.email,
    kind: p.kind,
    primary_owner: !!p.primaryOwner,
    verified_remote_id: !!p.verifiedRemoteId,
  };
}

function rowToPerson(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    role: row.role,
    partialId: row.partial_id,
    phone: row.phone,
    email: row.email,
    kind: row.kind,
    primaryOwner: !!row.primary_owner,
    verifiedRemoteId: !!row.verified_remote_id,
  };
}

function courierToRow(k, caseId) {
  return {
    id: k.id,
    case_id: caseId,
    full_name: k.fullName,
    id_number: k.idNumber,
    dob: k.dob,
    gender: k.gender,
    address: k.address,
    phone: k.phone,
    email: k.email,
    active: k.active !== false,
    auth_start: k.authStart,
    auth_end: k.authEnd,
  };
}

function rowToCourier(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    idNumber: row.id_number,
    dob: row.dob,
    gender: row.gender,
    address: row.address,
    phone: row.phone,
    email: row.email,
    active: row.active !== false,
    authStart: row.auth_start,
    authEnd: row.auth_end,
  };
}

function formToRow(f, caseId) {
  return {
    id: f.id,
    case_id: caseId,
    form_type: f.formType,
    version: f.version || 1,
    assigned_person_id: f.assignedPersonId,
    assigned_person_role: f.assignedPersonRole,
    mandatory: f.mandatory !== false,
    status: f.status,
    completion_percent: f.completionPercent || 0,
    data: f.data || {},
    validation_errors: f.validationErrors || [],
    signed_by: f.signedBy,
    signed_at: f.signedAt,
    signature_method: f.signatureMethod,
    stamp_applied: !!f.stampApplied,
    stamp_applied_at: f.stampAppliedAt,
    submitted_at: f.submittedAt,
    reviewed_by: f.reviewedBy,
    reviewed_at: f.reviewedAt,
    review_notes: f.reviewNotes,
    history: f.history || [],
    created_at: f.createdAt,
    updated_at: f.updatedAt,
  };
}

function rowToForm(row) {
  return {
    id: row.id,
    formType: row.form_type,
    version: row.version || 1,
    caseId: row.case_id,
    assignedPersonId: row.assigned_person_id,
    assignedPersonRole: row.assigned_person_role,
    mandatory: row.mandatory !== false,
    status: row.status,
    completionPercent: row.completion_percent || 0,
    data: row.data || {},
    validationErrors: row.validation_errors || [],
    signedBy: row.signed_by,
    signedAt: row.signed_at,
    signatureMethod: row.signature_method,
    stampApplied: !!row.stamp_applied,
    stampAppliedAt: row.stamp_applied_at,
    submittedAt: row.submitted_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    reviewNotes: row.review_notes,
    history: row.history || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function taskToRow(t) {
  return {
    id: t.id,
    case_id: t.caseId,
    case_name: t.caseName,
    type: t.type,
    priority: t.priority,
    assignee: t.assignee,
    due: t.due,
    status: t.status,
    created_ago: t.createdAgo,
  };
}

function rowToTask(row) {
  return {
    id: row.id,
    caseId: row.case_id,
    caseName: row.case_name,
    type: row.type,
    priority: row.priority,
    assignee: row.assignee,
    due: row.due,
    status: row.status,
    createdAgo: row.created_ago,
  };
}

function activityToRow(a) {
  return { id: a.id, case_name: a.caseName, text: a.text, time: a.time };
}

function rowToActivity(row) {
  return { id: row.id, caseName: row.case_name, text: row.text, time: row.time };
}

function branchSettingsToRow(b) {
  return {
    id: "default",
    service_provider_name: b.serviceProviderName || "",
    service_provider_company_number: b.serviceProviderCompanyNumber || "",
    branch_name: b.branchName || "",
    branch_number: b.branchNumber || "",
    user_count: b.userCount || "",
    target_minutes: b.targetMinutes || "",
    reminder_policy: b.reminderPolicy || "",
  };
}

function rowToBranchSettings(row) {
  return {
    serviceProviderName: row.service_provider_name || "",
    serviceProviderCompanyNumber: row.service_provider_company_number || "",
    branchName: row.branch_name || "",
    branchNumber: row.branch_number || "",
    userCount: row.user_count || "",
    targetMinutes: row.target_minutes || "",
    reminderPolicy: row.reminder_policy || "",
  };
}

/* ================= טעינה מ-Supabase ================= */

export async function loadStateFromSupabase() {
  const [casesRes, peopleRes, couriersRes, formsRes, tasksRes, activityRes, branchRes] = await Promise.all([
    supabase.from("cases").select("*"),
    supabase.from("people").select("*"),
    supabase.from("couriers").select("*"),
    supabase.from("forms").select("*"),
    supabase.from("tasks").select("*"),
    supabase.from("activity").select("*"),
    supabase.from("branch_settings").select("*").eq("id", "default").maybeSingle(),
  ]);
  const firstError = [casesRes, peopleRes, couriersRes, formsRes, tasksRes, activityRes, branchRes].find((r) => r.error)?.error;
  if (firstError) throw firstError;

  const casesById = {};
  (casesRes.data || []).forEach((row) => { casesById[row.id] = rowToCaseBase(row); });
  (peopleRes.data || []).forEach((row) => { casesById[row.case_id]?.people.push(rowToPerson(row)); });
  (couriersRes.data || []).forEach((row) => { casesById[row.case_id]?.couriers.push(rowToCourier(row)); });
  (formsRes.data || []).forEach((row) => { casesById[row.case_id]?.forms.push(rowToForm(row)); });

  return {
    cases: Object.values(casesById),
    tasks: (tasksRes.data || []).map(rowToTask),
    activity: (activityRes.data || []).map(rowToActivity),
    branchSettings: branchRes.data ? rowToBranchSettings(branchRes.data) : null,
  };
}

/* ================= כתיבה ל-Supabase (upsert מלא של ה-state הנוכחי) ================= */

async function upsertOrThrow(table, rows) {
  if (!rows.length) return;
  const { error } = await supabase.from(table).upsert(rows);
  if (error) throw error;
}

export async function syncStateToSupabase(state) {
  const { cases = [], tasks = [], activity = [], branchSettings } = state;

  await upsertOrThrow("cases", cases.map(caseToRow));

  const people = cases.flatMap((c) => (c.people || []).map((p) => personToRow(p, c.id)));
  const couriers = cases.flatMap((c) => (c.couriers || []).map((k) => courierToRow(k, c.id)));
  const forms = cases.flatMap((c) => (c.forms || []).map((f) => formToRow(f, c.id)));

  await Promise.all([
    upsertOrThrow("people", people),
    upsertOrThrow("couriers", couriers),
    upsertOrThrow("forms", forms),
    upsertOrThrow("tasks", tasks.map(taskToRow)),
    upsertOrThrow("activity", activity.map(activityToRow)),
    branchSettings ? upsertOrThrow("branch_settings", [branchSettingsToRow(branchSettings)]) : Promise.resolve(),
  ]);
}

/* ================= API מאוחד — זה מה ש-App.jsx קורא לו ================= */

/* טעינה ראשונית: תמיד סינכרונית מ-localStorage תחילה (לא תלוי ברשת, בלי
   "הבהוב" בטעינת האפליקציה). קריאה נפרדת ל-tryHydrateFromSupabase יכולה
   לשדרג את הנתונים ברקע אם מדובר במכשיר חדש ללא localStorage. */
export function loadInitialState() {
  return loadLocalState();
}

/* מנסה "למשוך" נתונים מ-Supabase רק כאשר אין עדיין שום דבר ב-localStorage
   (מכשיר/דפדפן חדש) — כדי לא לדרוס נתונים מקומיים קיימים בשקט. */
export async function tryHydrateFromSupabase(hasLocalData) {
  if (hasLocalData) return null;
  const mode = await detectBackend();
  if (mode !== "supabase") return null;
  try {
    const remote = await loadStateFromSupabase();
    if (remote.cases.length === 0) return null; // אין עדיין נתונים בענן — אין מה למשוך
    return remote;
  } catch (err) {
    console.warn("Supabase hydrate failed, staying on local defaults:", err?.message || err);
    backendMode = "local";
    lastFailureAt = Date.now();
    return null;
  }
}

/* שמירה: local תמיד קודם (מיידי, מובטח), Supabase הוא ניסיון נוסף ברקע
   שלא חוסם ולא זורק — כל כשל פשוט מוריד את המצב בחזרה ל-'local'. */
export async function persistState(state) {
  saveLocalState(state);
  if (!isSupabaseConfigured) return;
  if (backendMode === "checking" || (backendMode === "local" && Date.now() - lastFailureAt > RETRY_COOLDOWN_MS)) {
    await detectBackend();
  }
  if (backendMode !== "supabase") return;
  try {
    await syncStateToSupabase(state);
  } catch (err) {
    console.warn("Supabase sync failed, falling back to localStorage only:", err?.message || err);
    backendMode = "local";
    lastFailureAt = Date.now();
  }
}
