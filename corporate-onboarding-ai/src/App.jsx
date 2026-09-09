import React, { useState, useEffect, useMemo, useRef } from "react";
import { loadInitialState, tryHydrateFromSupabase, persistState, getBackendMode } from "./lib/dataStore.js";
import FormsTab from "./components/forms/FormsTab.jsx";
import ClientPortalModal from "./components/forms/ClientPortalModal.jsx";
import CorporatePoaFormModal from "./components/forms/CorporatePoaFormModal.jsx";
import { validateCorporatePoa } from "./utils/corporatePoaLogic.js";
import ServiceReceiverDeclarationModal from "./components/forms/ServiceReceiverDeclarationModal.jsx";
import { validateServiceReceiverDeclaration } from "./utils/serviceReceiverDeclarationLogic.js";
import KycFormModal from "./components/forms/KycFormModal.jsx";
import { validateKycForm } from "./utils/kycFormLogic.js";
import PublicClientPortalScreen from "./components/forms/PublicClientPortalScreen.jsx";
import SendPortalLinkModal from "./components/forms/SendPortalLinkModal.jsx";
import { generatePortalToken, parsePortalParamsFromLocation } from "./utils/portalLink.js";

/* מנתב לפונקציית הולידציה הנכונה לפי סוג הטופס — משמש את שערי ה-guard בפעולות
   ברמת App (הגשה/אישור), בלי לשכפל את כללי הולידציה כאן. */
function validateFormData(formType, data) {
  if (formType === "corporate_poa") return validateCorporatePoa(data);
  if (formType === "service_recipient_declaration") return validateServiceReceiverDeclaration(data);
  if (formType === "kyc_extended") return validateKycForm(data);
  return [];
}

/* רק ייפוי כוח תאגיד דורש חותמת תאגיד — הצהרת מקבל שירות וטופס הכר את הלקוח
   נחתמים על ידי אדם בלבד, ללא חותמת חברה. */
function formRequiresStamp(formType) {
  return formType === "corporate_poa";
}
import { syncFormsForCase } from "./utils/formLogic.js";
import { FORM_TYPES } from "./data/formDefinitions.js";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  ListChecks,
  Plug,
  Search,
  Plus,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  X,
  Upload,
  RefreshCw,
  Building2,
  UserPlus,
  Info,
  ChevronLeft,
  ArrowUpRight,
  Sparkles,
  Camera,
  ShieldAlert,
  Truck,
  Link2,
} from "lucide-react";

/* ============================================================
   Corporate Onboarding AI — אבטיפוס Frontend בלבד
   נתוני דמה. אין חיבור אמיתי לישות / חשבשבת / WhatsApp.
   שכבת mockIntegrationAdapter מדמה שירותי backend עתידיים.
   ============================================================ */

/* ---------- מודל נתונים (JSDoc, לא TypeScript אמיתי בקובץ זה) ----------
 * CorporateCase: { id, name, companyNumber, field, address, contactName,
 *   contactPhone, contactEmail, serviceType, courierInvolved, status, assignee, updatedAt,
 *   people: Person[], documents: DocumentItem[], aiSuggestions: AiSuggestion[], remoteId: RemoteId }
 * Person: { id, fullName, role, partialId, phone, email, kind, verifiedRemoteId }
 * DocumentItem: { id, name, status, receivedAt, uploadedBy, note, mandatory, conditionLabel }
 * Task: { id, type, caseId, caseName, priority, assignee, due, status, createdAgo }
 * ActivityEvent: { id, caseId, caseName, text, time }
 * AiSuggestion: { id, text, source, confidence, state }  // state: 'pending'|'approved'|'flagged'|'opened'
 * RemoteId: { repName, idPhoto, selfie, decision, decidedBy, decidedAt, attempted }
 *   // decision: null|'approved'|'retry'|'compliance'
 * ------------------------------------------------------------------- */

/* קטלוג הדרישות דוגמה בלבד — לא רשימה רגולטורית סופית ואינה מהווה ייעוץ משפטי.
   ניתנת להגדרה מחדש בעתיד לפי מדיניות הצ'יינג' בפועל. */
const SERVICE_TYPES = [
  { value: "currency_exchange", label: "המרת מטבע" },
  { value: "domestic_transfer", label: "העברת כספים בארץ" },
  { value: "foreign_transfer", label: 'העברת כספים לחו"ל' },
  { value: "check_discounting", label: "ניכיון צ'קים" },
  { value: "other", label: "שירות אחר" },
];

function serviceLabel(value) {
  return SERVICE_TYPES.find((s) => s.value === value)?.label || value;
}

/* דרישות ליבה — חלות על כל תיק תאגיד, ללא תלות בסוג השירות. כולן חובה. */
const CORE_REQUIREMENTS = [
  { name: "תעודת התאגדות", reason: "מזהה את התאגיד ומאמת את קיומו המשפטי", providedBy: "נציג התאגיד" },
  { name: "מסמך בעלי שליטה", reason: "נדרש לזיהוי בעלי שליטה לצורך הכר את הלקוח", providedBy: "בעל שליטה או נציג" },
  { name: "פרטי מורשי חתימה", reason: "לאימות מי מוסמך לפעול בשם התאגיד", providedBy: "נציג התאגיד" },
  { name: "תעודת זהות של נציג", reason: "לאימות זהות איש הקשר מול התאגיד", providedBy: "נציג התאגיד" },
];

/* דרישות משתנות לפי סוג השירות המבוקש. כולן חובה כאשר סוג השירות נבחר. */
const SERVICE_REQUIREMENTS = {
  currency_exchange: [
    { name: "הצהרת מקור כספים", reason: "נדרש לבדיקת מקור הכספים המומרים בהתאם למדיניות איסור הלבנת הון", providedBy: "נציג התאגיד" },
    { name: 'אישור היקף פעילות מט"ח צפוי', reason: "מסייע להערכת סיכון ותדירות הפעילות", providedBy: "נציג התאגיד" },
  ],
  domestic_transfer: [
    { name: "פרטי חשבון בנק מקבל", reason: "לאימות יעד ההעברה בישראל", providedBy: "נציג התאגיד" },
    { name: "הצהרת מטרת ההעברה", reason: "נדרש לתיעוד מטרת התנועה הכספית", providedBy: "נציג התאגיד" },
  ],
  foreign_transfer: [
    { name: 'פרטי חשבון בנק בחו"ל (IBAN/SWIFT)', reason: "לאימות יעד ההעברה הבינלאומית", providedBy: "נציג התאגיד" },
    { name: "הצהרת מקור כספים ומטרת ההעברה", reason: "נדרש לבדיקת מקור הכספים ומטרתם בהעברות חוצות גבולות", providedBy: "נציג התאגיד" },
    { name: "אישור עמידה בדרישות ציות בינלאומיות", reason: "נדרש בהעברות לחו\"ל בהתאם למדיניות הציות של הצ'יינג'", providedBy: "מורשה חתימה" },
  ],
  check_discounting: [
    { name: "רשימת צ'קים לניכיון", reason: "פירוט הצ'קים המוצגים לניכיון", providedBy: "נציג התאגיד" },
    { name: "אישור ניהול חשבון עסקי פעיל", reason: "נדרש לאימות פעילות עסקית תקינה", providedBy: "נציג התאגיד" },
  ],
  other: [
    { name: "פירוט מהות השירות המבוקש", reason: "נדרש להבנת סוג השירות לצורך התאמת דרישות התיק", providedBy: "נציג התאגיד" },
  ],
};

/* דרישות נוספות — חלק חובה תמיד, חלק מותנות בנסיבות התיק (people/courierInvolved) או בסוג השירות.
   ה-condition מוערך "בזמן אמת" מול נתוני התיק הנוכחיים, כך שהפעלה/כיבוי מתעדכנים אוטומטית. */
const MONEY_SERVICE_TYPES = ["currency_exchange", "domestic_transfer", "foreign_transfer", "check_discounting"];

const EXTRA_REQUIREMENTS = [
  {
    name: "ייפוי כוח",
    mandatory: false,
    reason: "נדרש כאשר אדם פועל בשם התאגיד מכוח הרשאה שאינה בעלות ישירה",
    providedBy: "נציג התאגיד",
    conditionLabel: 'מופעל כאשר בתיק קיים איש קשר מסוג "מורשה פעולה"',
    condition: (ctx) => ctx.people.some((p) => p.kind === "מורשה פעולה"),
  },
  {
    name: "נסח רשם החברות",
    mandatory: true,
    reason: "מאמת את סטטוס התאגיד הרשמי מול רשם החברות",
    providedBy: "נציג התאגיד",
    condition: () => true,
  },
  {
    name: "פרוטוקול מורשי חתימה",
    mandatory: true,
    reason: "מפרט את הרכב מורשי החתימה הרשמי של התאגיד",
    providedBy: "נציג התאגיד",
    condition: () => true,
  },
  {
    name: "אישור ניהול חשבון בנק",
    mandatory: false,
    reason: "מאמת ניהול תקין של חשבון הבנק העסקי",
    providedBy: "נציג התאגיד",
    conditionLabel: "מופעל עבור שירותים הכרוכים בתנועת כספים",
    condition: (ctx) => ctx.serviceType !== "other",
  },
  {
    name: 'רישיון נש"מ/נש"פ',
    mandatory: false,
    reason: 'נדרש כאשר התאגיד פועל כנותן שירותי מטבע או פיקדון בהתאם לרישוי הרלוונטי',
    providedBy: "נציג התאגיד",
    conditionLabel: 'מופעל עבור שירותי מטבע, העברות כספים וניכיון צ׳קים',
    condition: (ctx) => MONEY_SERVICE_TYPES.includes(ctx.serviceType),
  },
  {
    name: "טופס הכר לקוח מורחב",
    mandatory: true,
    reason: "נדרש לפי מדיניות הכר את הלקוח המורחבת של הצ'יינג'",
    providedBy: "נציג התאגיד",
    condition: () => true,
  },
  {
    name: "הצהרת מקבל שירות חתומה על ידי שליח",
    mandatory: false,
    reason: "נדרש כאשר שליח מבצע בפועל את מסירת או קבלת השירות",
    providedBy: "שליח",
    conditionLabel: "מופעל רק כאשר סומן שהשירות מבוצע באמצעות שליח",
    condition: (ctx) => !!ctx.courierInvolved,
  },
  {
    name: "ייפוי כוח תאגיד",
    mandatory: false,
    reason: "נדרש כאשר נציג פועל מטעם התאגיד מול הצ'יינג'",
    providedBy: "מורשה חתימה",
    conditionLabel: 'מופעל כאשר בתיק קיים איש קשר מסוג "נציג"',
    condition: (ctx) => ctx.people.some((p) => p.kind === "נציג"),
  },
  {
    name: "צילום תעודת זהות של נציג התאגיד",
    mandatory: true,
    reason: "נדרש לזיהוי מרחוק של נציג התאגיד",
    providedBy: "נציג התאגיד",
    condition: () => true,
  },
  {
    name: "סלפי של נציג התאגיד",
    mandatory: true,
    reason: "נדרש להשוואה מול תעודת הזהות בתהליך הזיהוי המרוחק",
    providedBy: "נציג התאגיד",
    condition: () => true,
  },
  {
    name: "צילום מסך מפורטל הרישוי של בעלי שליטה ונושאי משרה",
    mandatory: true,
    reason: "מאמת את זהות בעלי השליטה ונושאי המשרה מול פורטל הרישוי הציבורי",
    providedBy: "נציג התאגיד",
    condition: () => true,
  },
];

/* מיפוי שם דרישה -> פונקציית תנאי, ללא תלות בסוג השירות (לשימוש בבדיקה חיה של activation) */
const REQUIREMENT_CONDITIONS = {};
[...CORE_REQUIREMENTS, ...Object.values(SERVICE_REQUIREMENTS).flat()].forEach((d) => {
  REQUIREMENT_CONDITIONS[d.name] = () => true;
});
EXTRA_REQUIREMENTS.forEach((d) => {
  REQUIREMENT_CONDITIONS[d.name] = d.condition;
});

function requirementDefs(serviceType) {
  return [
    ...CORE_REQUIREMENTS.map((d) => ({ ...d, mandatory: true, conditionLabel: null })),
    ...(SERVICE_REQUIREMENTS[serviceType] || []).map((d) => ({ ...d, mandatory: true, conditionLabel: null })),
    ...EXTRA_REQUIREMENTS,
  ];
}

const PROTOCOL_DOC_NAME = "פרוטוקול מורשי חתימה";
const PROTOCOL_CHECKLIST_FIELDS = ["originalSeen", "signatureVerified", "companyStampVerified", "authorizedSignersMatch"];
const PROTOCOL_CHECKLIST_LABELS = {
  originalSeen: "העובד ראה את המקור",
  signatureVerified: "נבדקה התאמת החתימה",
  companyStampVerified: "נבדקה חותמת החברה",
  authorizedSignersMatch: "הרכב מורשי החתימה תואם לרשומות",
};

function buildRequirements(serviceType, overrides = []) {
  return requirementDefs(serviceType).map((def, i) => {
    const o = overrides[i] || {};
    const doc = {
      id: `req-${i}`,
      name: def.name,
      reason: def.reason,
      providedBy: def.providedBy,
      mandatory: def.mandatory,
      conditionLabel: def.conditionLabel || null,
      status: o.status || "חסר",
      receivedAt: o.receivedAt || null,
      uploadedBy: o.uploadedBy || null,
      note: o.note || null,
    };
    if (def.name === PROTOCOL_DOC_NAME) {
      doc.verificationChecklist = {
        originalSeen: o.verificationChecklist?.originalSeen || false,
        signatureVerified: o.verificationChecklist?.signatureVerified || false,
        companyStampVerified: o.verificationChecklist?.companyStampVerified || false,
        authorizedSignersMatch: o.verificationChecklist?.authorizedSignersMatch || false,
      };
    }
    return doc;
  });
}

/* מעריך אם דרישה רלוונטית לתיק הנוכחי, "בזמן אמת" מול people/serviceType/courierInvolved.
   ctx יכול להיות אובייקט case מלא או הקשר קליל בזמן בניית האשף — שניהם כוללים את אותם שדות. */
function isDocActive(doc, ctx) {
  const cond = REQUIREMENT_CONDITIONS[doc.name];
  if (!cond) return true;
  return cond({ serviceType: ctx.serviceType, people: ctx.people || [], courierInvolved: !!ctx.courierInvolved });
}

function nextActionForStatus(status) {
  switch (status) {
    case "חסר": return "לבקש מהלקוח להעלות את המסמך";
    case "דורש בדיקה": return "לבדוק ולאשר מול המסמך המקורי";
    case "ממתין ללקוח": return "להמתין לתיקון או העלאה מחדש מהלקוח";
    case "התקבל": return "אין פעולה נדרשת";
    default: return "—";
  }
}

/* מסכם את מצב הדרישות לתיק: מאושרים / ממתינים לבדיקה / חסרים / מותנות שלא הופעלו */
function getRequirementsSummary(c) {
  const active = c.documents.filter((d) => isDocActive(d, c));
  const inactive = c.documents.filter((d) => !isDocActive(d, c));
  return {
    approved: active.filter((d) => d.status === "התקבל"),
    pendingReview: active.filter((d) => d.status === "דורש בדיקה" || d.status === "ממתין ללקוח"),
    missing: active.filter((d) => d.status === "חסר"),
    inactiveConditional: inactive,
  };
}

const INITIAL_CASES = [
  {
    id: "c1",
    name: "אורבן טרייד בע״מ",
    companyNumber: "515000001",
    field: "יבוא ושיווק טקסטיל",
    address: "רחוב הברזל 12, תל אביב",
    contactName: "רונית שגיא",
    contactPhone: "050-1234567",
    contactEmail: "ronit@urbantrade-demo.co.il",
    serviceType: "foreign_transfer",
    courierInvolved: false,
    status: "ממתין למסמכים",
    assignee: "דניאל כהן",
    updatedAt: "לפני 18 דקות",
    people: [
      { id: "p1", fullName: "רונית שגיא", role: "מנכ״לית", partialId: "•••••123", phone: "050-1234567", email: "ronit@urbantrade-demo.co.il", kind: "נציג" },
      { id: "p2", fullName: "אבי שגיא", role: "בעל מניות", partialId: "•••••456", phone: "052-7654321", email: "avi@urbantrade-demo.co.il", kind: "בעל שליטה", primaryOwner: true },
    ],
    documents: buildRequirements("foreign_transfer", [
      { status: "התקבל", receivedAt: "אתמול", uploadedBy: "רונית שגיא" },
      { status: "חסר" },
      { status: "התקבל", receivedAt: "אתמול", uploadedBy: "רונית שגיא" },
      { status: "התקבל", receivedAt: "אתמול", uploadedBy: "רונית שגיא" },
      { status: "דורש בדיקה", receivedAt: "היום", uploadedBy: "רונית שגיא", note: "פרטי החשבון שהתקבלו אינם תואמים באופן מלא את שם התאגיד — נדרש אימות ידני" },
      { status: "חסר" },
      { status: "חסר" },
      { status: "חסר" },
      { status: "התקבל", receivedAt: "אתמול", uploadedBy: "רונית שגיא" },
      { status: "התקבל", receivedAt: "אתמול", uploadedBy: "רונית שגיא" },
      { status: "חסר" },
      { status: "חסר" },
      { status: "דורש בדיקה", receivedAt: "היום", uploadedBy: "רונית שגיא", note: "נדרש להשלים פרטי מקור הכנסה בסעיף 4" },
      { status: "חסר" },
      { status: "התקבל", receivedAt: "אתמול", uploadedBy: "רונית שגיא" },
      { status: "התקבל", receivedAt: "היום", uploadedBy: "רונית שגיא" },
      { status: "התקבל", receivedAt: "היום", uploadedBy: "רונית שגיא" },
      { status: "חסר" },
    ]),
    aiSuggestions: [
      { id: "a1", text: "זוהה שם התאגיד במסמך ההתאגדות: אורבן טרייד בע״מ.", source: "תעודת התאגדות", confidence: "גבוהה", state: "pending" },
      { id: "a2", text: "זוהה בעל שליטה במסמך בעלי השליטה: אבי שגיא.", source: "מסמך בעלי שליטה", confidence: "גבוהה", state: "pending" },
    ],
    couriers: [],
    forms: [],
    portalToken: "demo-token-c1",
    remoteId: { repName: "רונית שגיא", idPhoto: true, selfie: true, decision: null, decidedBy: null, decidedAt: null, attempted: false },
  },
  {
    id: "c2",
    name: "נגב אקספרס בע״מ",
    companyNumber: "515000002",
    field: "הובלות ולוגיסטיקה",
    address: "אזור התעשייה, באר שבע",
    contactName: "משה אליהו",
    contactPhone: "054-2223344",
    contactEmail: "moshe@negev-express-demo.co.il",
    serviceType: "domestic_transfer",
    courierInvolved: true,
    status: "נמצאה אי־התאמה",
    assignee: "דניאל כהן",
    updatedAt: "לפני שעה",
    people: [
      { id: "p3", fullName: "משה אליהו", role: "מנכ״ל", partialId: "•••••789", phone: "054-2223344", email: "moshe@negev-express-demo.co.il", kind: "נציג" },
    ],
    documents: buildRequirements("domestic_transfer", [
      { status: "התקבל", receivedAt: "לפני יומיים", uploadedBy: "משה אליהו" },
      { status: "התקבל", receivedAt: "לפני יומיים", uploadedBy: "משה אליהו" },
      { status: "ממתין ללקוח", receivedAt: "לפני יום", uploadedBy: "משה אליהו", note: "המסמך שהתקבל אינו קריא — נשלחה בקשה להעלאה מחדש" },
      { status: "התקבל", receivedAt: "לפני יומיים", uploadedBy: "משה אליהו" },
      { status: "התקבל", receivedAt: "לפני יומיים", uploadedBy: "משה אליהו" },
      { status: "התקבל", receivedAt: "לפני יומיים", uploadedBy: "משה אליהו" },
      { status: "חסר" },
      { status: "התקבל", receivedAt: "לפני יומיים", uploadedBy: "משה אליהו" },
      { status: "התקבל", receivedAt: "לפני יומיים", uploadedBy: "משה אליהו" },
      { status: "התקבל", receivedAt: "לפני יומיים", uploadedBy: "משה אליהו" },
      { status: "התקבל", receivedAt: "לפני יומיים", uploadedBy: "משה אליהו" },
      { status: "התקבל", receivedAt: "לפני יומיים", uploadedBy: "משה אליהו" },
      { status: "חסר" },
      { status: "התקבל", receivedAt: "לפני יומיים", uploadedBy: "משה אליהו" },
      { status: "חסר" },
      { status: "חסר" },
      { status: "התקבל", receivedAt: "לפני יומיים", uploadedBy: "משה אליהו" },
    ]),
    aiSuggestions: [
      { id: "a3", text: "קיימת אי־התאמה בין שם החברה בטופס לבין תעודת ההתאגדות.", source: "תעודת התאגדות", confidence: "בינונית", state: "pending" },
    ],
    couriers: [
      { id: "k1", fullName: "יוסי מזרחי", idNumber: "•••••222", dob: "01/01/1990", gender: "זכר", address: "רחוב הדואר 3, באר שבע", phone: "050-9998877", email: "yossi@negev-express-demo.co.il", active: true, authStart: "01/01/2026", authEnd: null },
    ],
    forms: [],
    portalToken: "demo-token-c2",
    remoteId: { repName: "", idPhoto: false, selfie: false, decision: null, decidedBy: null, decidedAt: null, attempted: false },
  },
  {
    id: "c3",
    name: "פסגה לוגיסטיקה בע״מ",
    companyNumber: "515000003",
    field: "אחסנה והפצה",
    address: "פארק תעשייה, מודיעין",
    contactName: "יעל ברקאי",
    contactPhone: "053-9988776",
    contactEmail: "yael@pisga-log-demo.co.il",
    serviceType: "check_discounting",
    courierInvolved: false,
    status: "מוכן לבדיקה",
    assignee: "נועה לביא",
    updatedAt: "לפני שעתיים",
    people: [
      { id: "p4", fullName: "יעל ברקאי", role: "סמנכ״לית כספים", partialId: "•••••321", phone: "053-9988776", email: "yael@pisga-log-demo.co.il", kind: "מורשה פעולה" },
    ],
    documents: buildRequirements("check_discounting", [
      { status: "התקבל", receivedAt: "לפני 3 ימים", uploadedBy: "יעל ברקאי" },
      { status: "התקבל", receivedAt: "לפני 3 ימים", uploadedBy: "יעל ברקאי" },
      { status: "התקבל", receivedAt: "לפני 3 ימים", uploadedBy: "יעל ברקאי" },
      { status: "התקבל", receivedAt: "לפני 3 ימים", uploadedBy: "יעל ברקאי" },
      { status: "התקבל", receivedAt: "לפני 3 ימים", uploadedBy: "יעל ברקאי" },
      { status: "התקבל", receivedAt: "לפני 3 ימים", uploadedBy: "יעל ברקאי" },
      { status: "התקבל", receivedAt: "לפני 3 ימים", uploadedBy: "יעל ברקאי" },
      { status: "התקבל", receivedAt: "לפני 3 ימים", uploadedBy: "יעל ברקאי" },
      { status: "התקבל", receivedAt: "לפני 3 ימים", uploadedBy: "יעל ברקאי" },
      { status: "התקבל", receivedAt: "לפני 3 ימים", uploadedBy: "יעל ברקאי" },
      { status: "התקבל", receivedAt: "לפני 3 ימים", uploadedBy: "יעל ברקאי" },
      { status: "התקבל", receivedAt: "לפני 3 ימים", uploadedBy: "יעל ברקאי" },
      { status: "חסר" },
      { status: "חסר" },
      { status: "התקבל", receivedAt: "לפני 3 ימים", uploadedBy: "יעל ברקאי" },
      { status: "התקבל", receivedAt: "לפני 3 ימים", uploadedBy: "יעל ברקאי" },
      { status: "התקבל", receivedAt: "לפני 3 ימים", uploadedBy: "יעל ברקאי" },
    ]),
    aiSuggestions: [],
    couriers: [],
    forms: [],
    portalToken: "demo-token-c3",
    remoteId: { repName: "יעל ברקאי", idPhoto: true, selfie: true, decision: "approved", decidedBy: "נועה לביא", decidedAt: "לפני 3 ימים", attempted: true },
  },
  {
    id: "c4",
    name: "גלובל מרקט בע״מ",
    companyNumber: "515000004",
    field: "מסחר אלקטרוני",
    address: "שדרות רוטשילד 5, תל אביב",
    contactName: "טל אורן",
    contactPhone: "058-1112233",
    contactEmail: "tal@global-market-demo.co.il",
    serviceType: "currency_exchange",
    courierInvolved: false,
    status: "ממתין למסמכים",
    assignee: "נועה לביא",
    updatedAt: "לפני יום",
    people: [
      { id: "p5", fullName: "טל אורן", role: "מייסד", partialId: "•••••654", phone: "058-1112233", email: "tal@global-market-demo.co.il", kind: "נציג" },
    ],
    documents: buildRequirements("currency_exchange", [
      { status: "התקבל", receivedAt: "לפני יומיים", uploadedBy: "טל אורן" },
      { status: "חסר" },
      { status: "חסר" },
      { status: "התקבל", receivedAt: "לפני יומיים", uploadedBy: "טל אורן" },
      { status: "התקבל", receivedAt: "לפני יומיים", uploadedBy: "טל אורן" },
      { status: "חסר" },
      { status: "חסר" },
      { status: "התקבל", receivedAt: "לפני יומיים", uploadedBy: "טל אורן" },
      { status: "חסר" },
      { status: "חסר" },
      { status: "התקבל", receivedAt: "לפני יומיים", uploadedBy: "טל אורן" },
      { status: "חסר" },
      { status: "חסר" },
      { status: "התקבל", receivedAt: "לפני יומיים", uploadedBy: "טל אורן" },
      { status: "חסר" },
      { status: "חסר" },
      { status: "חסר" },
    ]),
    aiSuggestions: [],
    couriers: [],
    forms: [],
    portalToken: "demo-token-c4",
    remoteId: { repName: "", idPhoto: false, selfie: false, decision: null, decidedBy: null, decidedAt: null, attempted: false },
  },
  {
    id: "c5",
    name: "תבור פארם בע״מ",
    companyNumber: "515000005",
    field: "ייצור מזון",
    address: "אזור תעשייה תבור",
    contactName: "עידן כרמי",
    contactPhone: "050-5556677",
    contactEmail: "idan@tabor-farm-demo.co.il",
    serviceType: "other",
    courierInvolved: false,
    status: "טיוטה",
    assignee: "דניאל כהן",
    updatedAt: "לפני 3 ימים",
    people: [],
    documents: buildRequirements("other", [
      { status: "חסר" },
      { status: "חסר" },
      { status: "חסר" },
      { status: "חסר" },
      { status: "חסר" },
      { status: "חסר" },
      { status: "חסר" },
      { status: "חסר" },
      { status: "חסר" },
      { status: "חסר" },
      { status: "חסר" },
      { status: "חסר" },
      { status: "חסר" },
      { status: "חסר" },
      { status: "חסר" },
      { status: "חסר" },
    ]),
    aiSuggestions: [],
    couriers: [],
    forms: [],
    portalToken: "demo-token-c5",
    remoteId: { repName: "", idPhoto: false, selfie: false, decision: null, decidedBy: null, decidedAt: null, attempted: false },
  },
];

const INITIAL_TASKS = [
  { id: "t1", type: "מסמך חסר", caseId: "c1", caseName: "אורבן טרייד בע״מ", priority: "גבוהה", assignee: "דניאל כהן", due: "היום", status: "פתוחה" },
  { id: "t2", type: "אי־התאמה", caseId: "c2", caseName: "נגב אקספרס בע״מ", priority: "גבוהה", assignee: "דניאל כהן", due: "היום", status: "פתוחה" },
  { id: "t3", type: "בדיקת תיק", caseId: "c3", caseName: "פסגה לוגיסטיקה בע״מ", priority: "בינונית", assignee: "נועה לביא", due: "מחר", status: "פתוחה" },
  { id: "t4", type: "תזכורת ללקוח", caseId: "c4", caseName: "גלובל מרקט בע״מ", priority: "בינונית", assignee: "נועה לביא", due: "מחר", status: "פתוחה" },
  { id: "t5", type: "השלמת פרטים", caseId: "c5", caseName: "תבור פארם בע״מ", priority: "נמוכה", assignee: "דניאל כהן", due: "בעוד 3 ימים", status: "פתוחה" },
  { id: "t6", type: "אישור שדה AI", caseId: "c1", caseName: "אורבן טרייד בע״מ", priority: "בינונית", assignee: "דניאל כהן", due: "היום", status: "פתוחה" },
  { id: "t7", type: "העברה לאישור", caseId: "c3", caseName: "פסגה לוגיסטיקה בע״מ", priority: "גבוהה", assignee: "נועה לביא", due: "היום", status: "פתוחה" },
  { id: "t8", type: "מסמך לא קריא", caseId: "c2", caseName: "נגב אקספרס בע״מ", priority: "בינונית", assignee: "דניאל כהן", due: "מחר", status: "פתוחה" },
  { id: "t9", type: "תזכורת שנייה", caseId: "c4", caseName: "גלובל מרקט בע״מ", priority: "נמוכה", assignee: "נועה לביא", due: "בעוד יומיים", status: "הושלמה" },
];

const INITIAL_ACTIVITY = [
  { id: "e1", caseName: "אורבן טרייד בע״מ", text: "רונית שגיא העלתה את תעודת ההתאגדות", time: "לפני 20 דקות" },
  { id: "e2", caseName: "נגב אקספרס בע״מ", text: "המערכת זיהתה אי־התאמה בשם החברה", time: "לפני שעה" },
  { id: "e3", caseName: "פסגה לוגיסטיקה בע״מ", text: "דניאל כהן אישר את פרטי מורשי החתימה", time: "לפני שעתיים" },
  { id: "e4", caseName: "גלובל מרקט בע״מ", text: "נשלחה תזכורת שנייה ללקוח", time: "לפני יום" },
];

const STATUS_STYLES = {
  "טיוטה": "bg-slate-100 text-slate-600 border-slate-200",
  "ממתין למסמכים": "bg-amber-50 text-amber-700 border-amber-200",
  "נמצאה אי־התאמה": "bg-rose-50 text-rose-700 border-rose-200",
  "מוכן לבדיקה": "bg-sky-50 text-sky-700 border-sky-200",
  "אושר": "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const DOC_STATUS_STYLES = {
  "התקבל": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "חסר": "bg-rose-50 text-rose-700 border-rose-200",
  "דורש בדיקה": "bg-amber-50 text-amber-700 border-amber-200",
  "ממתין ללקוח": "bg-sky-50 text-sky-700 border-sky-200",
};

const DOC_CYCLE = ["חסר", "דורש בדיקה", "התקבל"];

function completeness(docs, ctx) {
  const relevant = ctx ? docs.filter((d) => isDocActive(d, ctx)) : docs;
  const received = relevant.filter((d) => d.status === "התקבל").length;
  return { received, total: relevant.length, pct: relevant.length ? Math.round((received / relevant.length) * 100) : 0 };
}

/* תנאי המעבר ל"מוכן לבדיקה": כל הדרישות הפעילות (רלוונטיות לתיק זה) התקבלו, אין מסמך פעיל שסומן
   כבעייתי בלי טיפול, וכל הצעות ה-AI אושרו או נסגרו על ידי עובד. דרישות מותנות שלא הופעלו לא נספרות.
   שום דבר לא מסומן כ"התקבל" אוטומטית. */
function remoteIdStatusLabel(remoteId) {
  if (!remoteId) return "לא התחיל";
  if (remoteId.decision === "approved") return "זוהה ואושר";
  if (remoteId.decision === "compliance") return "הועבר לאחראי ציות";
  if (remoteId.idPhoto && remoteId.selfie) return "ממתין לאישור עובד מורשה";
  if (remoteId.repName) return "בתהליך";
  return "לא התחיל";
}

function getReadinessChecklist(c) {
  const activeDocs = c.documents.filter((d) => isDocActive(d, c));
  const missingDocs = activeDocs.filter((d) => d.status === "חסר");
  const flaggedDocs = activeDocs.filter((d) => d.status === "דורש בדיקה" || d.status === "ממתין ללקוח");
  const pendingSuggestions = c.aiSuggestions.filter((s) => s.state === "pending");
  const remoteIdApproved = c.remoteId?.decision === "approved";
  const forms = syncFormsForCase(c);
  const unapprovedForms = forms.filter((f) => f.mandatory && f.status !== "approved");
  return [
    {
      id: "docs-received",
      label: "כל המסמכים הנדרשים (הרלוונטיים לתיק זה) התקבלו",
      met: missingDocs.length === 0,
      items: missingDocs.map((d) => d.name),
      emptyDetail: "כל המסמכים החסרים התקבלו",
    },
    {
      id: "docs-handled",
      label: "אין מסמך שסומן כבעייתי בלי טיפול",
      met: flaggedDocs.length === 0,
      items: flaggedDocs.map((d) => `${d.name} (${d.status})`),
      emptyDetail: "אין מסמכים הממתינים לטיפול",
    },
    {
      id: "ai-resolved",
      label: "הצעות ה-AI אושרו או נסגרו על ידי עובד",
      met: pendingSuggestions.length === 0,
      items: pendingSuggestions.map((s) => s.text),
      emptyDetail: "כל ההצעות טופלו",
    },
    {
      id: "remote-id",
      label: "זיהוי מרחוק של הנציג אושר על ידי עובד מורשה",
      met: remoteIdApproved,
      items: remoteIdApproved ? [] : [remoteIdStatusLabel(c.remoteId)],
      emptyDetail: "הזיהוי אושר",
    },
    {
      id: "forms-approved",
      label: "כל טפסי החובה של בעלי השליטה והשליחים אושרו",
      met: unapprovedForms.length === 0,
      items: unapprovedForms.map((f) => {
        const person = f.assignedPersonRole === "owner" ? c.people.find((p) => p.id === f.assignedPersonId) : (c.couriers || []).find((k) => k.id === f.assignedPersonId);
        return `${FORM_TYPES[f.formType]?.label || f.formType} — ${person?.fullName || "לא משויך"}`;
      }),
      emptyDetail: "כל הטפסים אושרו",
    },
  ];
}

function isReadyForReview(c) {
  return getReadinessChecklist(c).every((item) => item.met);
}

/* מקור אמת יחיד לכל המסכים: התיק עובר ל"מוכן לבדיקה" רק כשכל תנאי הרשימה מתקיימים, ולעולם לא אוטומטית אחורה */
function applyAutoStatus(c) {
  if (c.status === "אושר") return c;
  const ready = isReadyForReview(c);
  if (ready && c.status !== "מוכן לבדיקה") {
    return { ...c, status: "מוכן לבדיקה" };
  }
  if (!ready && c.status === "מוכן לבדיקה") {
    return { ...c, status: "ממתין למסמכים" };
  }
  return c;
}

/* מחשב עד 3 הפעולות הדחופות ביותר עבור תיק נתון — משמש גם בלוח העבודה וגם בכרטיס התאגיד.
   מתייחס רק לדרישות פעילות (isDocActive) — דרישה מותנית שלא הופעלה אינה "בעיה". */
function getCaseIssues(c) {
  const activeDocs = c.documents.filter((d) => isDocActive(d, c));
  const issues = [];
  const missingDoc = activeDocs.find((d) => d.status === "חסר");
  if (missingDoc) {
    issues.push({ id: `${c.id}-missing-${missingDoc.id}`, text: `חסר מסמך: ${missingDoc.name}`, urgency: "גבוהה", actionLabel: "שלח בקשת השלמה", kind: "completion" });
  }
  const waitingDoc = activeDocs.find((d) => d.status === "ממתין ללקוח");
  if (waitingDoc) {
    issues.push({ id: `${c.id}-waiting-${waitingDoc.id}`, text: `ממתין ללקוח: ${waitingDoc.name}`, urgency: "בינונית", actionLabel: "שלח תזכורת", kind: "reminder" });
  }
  const reviewDoc = activeDocs.find((d) => d.status === "דורש בדיקה");
  if (reviewDoc) {
    issues.push({ id: `${c.id}-review-doc-${reviewDoc.id}`, text: `מסמך דורש בדיקה: ${reviewDoc.name}`, urgency: "בינונית", actionLabel: "פתח תיק", kind: "review-doc" });
  }
  const pendingSuggestion = c.aiSuggestions.find((s) => s.state === "pending");
  if (pendingSuggestion) {
    issues.push({ id: `${c.id}-ai-${pendingSuggestion.id}`, text: `יש לאשר הצעת AI: ${pendingSuggestion.text}`, urgency: "בינונית", actionLabel: "בדוק הצעת AI", kind: "ai" });
  }
  if (c.remoteId && c.remoteId.decision !== "approved") {
    if (c.remoteId.idPhoto && c.remoteId.selfie) {
      issues.push({ id: `${c.id}-remoteid`, text: "זיהוי מרחוק ממתין לאישור עובד מורשה", urgency: "בינונית", actionLabel: "לאישור זיהוי", kind: "remote-id" });
    } else {
      issues.push({ id: `${c.id}-remoteid`, text: "זיהוי מרחוק של הנציג טרם הושלם", urgency: "בינונית", actionLabel: "המשך זיהוי מרחוק", kind: "remote-id" });
    }
  }
  if (c.status === "מוכן לבדיקה") {
    issues.push({ id: `${c.id}-review`, text: "כל התנאים התקיימו — התיק מוכן לבדיקה", urgency: "בינונית", actionLabel: "העבר לאישור", kind: "approve" });
  }
  if (issues.length === 0 && c.status === "ממתין למסמכים") {
    issues.push({ id: `${c.id}-nudge`, text: "התיק ממתין ללקוח — ניתן לשלוח תזכורת נוספת", urgency: "נמוכה", actionLabel: "שלח תזכורת", kind: "reminder" });
  }
  return issues.slice(0, 3);
}

/* קירוב גס בדקות מתוך טקסט יחסי כמו "לפני 18 דקות" / "לפני יום" — משמש רק כאומדן להמחשה
   מול יעד הסניף, לא כמדידת SLA מדויקת (אין באפליקציה חותמת זמן אמיתית לפתיחת תיק). */
function ageInMinutes(text) {
  if (!text) return null;
  if (text.includes("עכשיו") || text === "היום") return 0;
  const minutesMatch = text.match(/(\d+)\s*דקות/);
  if (minutesMatch) return parseInt(minutesMatch[1], 10);
  if (text.includes("שעתיים")) return 120;
  const hoursMatch = text.match(/(\d+)\s*שעות/);
  if (hoursMatch) return parseInt(hoursMatch[1], 10) * 60;
  if (text.includes("שעה")) return 60;
  if (text.includes("יומיים")) return 2880;
  const daysMatch = text.match(/(\d+)\s*ימים/);
  if (daysMatch) return parseInt(daysMatch[1], 10) * 1440;
  if (text.includes("יום")) return 1440;
  return null;
}

/* מסווג תיק פתוח לפי "איפה הוא תקוע" — אצל הלקוח / אצלנו (עובד) / ממתין לאישור סופי / בטיפול תקין */
function stuckReason(c) {
  if (c.status === "אושר") return "closed";
  const activeDocs = c.documents.filter((d) => isDocActive(d, c));
  const waitingOnClient = activeDocs.some((d) => d.status === "חסר" || d.status === "ממתין ללקוח");
  const waitingOnUs = activeDocs.some((d) => d.status === "דורש בדיקה") || c.aiSuggestions.some((s) => s.state === "pending");
  if (c.remoteId?.decision === "compliance") return "compliance";
  if (c.status === "מוכן לבדיקה") return "ready-for-approval";
  if (waitingOnUs) return "on-us";
  if (waitingOnClient) return "on-client";
  return "on-us";
}

function loadState() {
  return loadInitialState();
}

const NAV_ITEMS = [
  { id: "dashboard", label: "לוח עבודה", icon: LayoutDashboard },
  { id: "cases", label: "תיקים לתאגידים", icon: FolderKanban },
  { id: "clients", label: "לקוחות", icon: Users },
  { id: "tasks", label: "משימות", icon: ListChecks },
  { id: "settings", label: "הגדרות חיבור", icon: Plug },
];

const REMINDER_POLICIES = ["יומית", "כל 3 ימים", "שבועית"];

const DEFAULT_BRANCH_SETTINGS = {
  serviceProviderName: "",
  serviceProviderCompanyNumber: "",
  branchName: "סניף תל אביב",
  branchNumber: "12",
  userCount: "6",
  targetMinutes: "15",
  reminderPolicy: "כל 3 ימים",
};

const DEMO_CASE_ID = "c1";
const DEMO_STEPS = [
  { title: "פרטי התאגיד", desc: "כך נראה תיק שנפתח לתאגיד חדש: כל הפרטים, הסטטוס ואחוז ההשלמה במקום אחד." },
  { title: "מסמכים", desc: "המערכת מציגה בדיוק אילו מסמכים התקבלו, אילו חסרים, ומי העלה כל מסמך." },
  { title: "בדיקת AI", desc: "ה-AI קורא את המסמכים שהתקבלו ומציע נתונים לאישור העובד — הוא לא מחליט במקומו." },
  { title: "השלמת חוסרים", desc: "לחיצה אחת פותחת בקשת השלמה מסודרת ללקוח, עם בחירת ערוץ שליחה." },
  { title: "אישור וייצוא", desc: "בכרטיס המסמכים אפשר ללחוץ על \"סימולציה: הלקוח השלים את המסמך החסר\" כדי להדגים השלמה. מסמכים שדורשים בדיקה והצעות AI ממתינות עדיין דורשים אישור ידני של העובד — רק כשכל התנאים מתקיימים, התיק עובר אוטומטית ל\"מוכן לבדיקה\" וניתן לייצא אותו." },
];

export default function CorporateOnboardingApp() {
  const persisted = useMemo(() => loadState(), []);
  const [cases, setCases] = useState(persisted?.cases || INITIAL_CASES);
  const [tasks, setTasks] = useState(persisted?.tasks || INITIAL_TASKS);
  const [activity, setActivity] = useState(persisted?.activity || INITIAL_ACTIVITY);
  const [branchSettings, setBranchSettings] = useState(persisted?.branchSettings || DEFAULT_BRANCH_SETTINGS);
  const [viewerRole, setViewerRole] = useState(persisted?.viewerRole || null);

  const [view, setView] = useState("dashboard");
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [caseTab, setCaseTab] = useState("סקירה");
  const [wizardStep, setWizardStep] = useState(1);
  const [exportModalCaseId, setExportModalCaseId] = useState(null);
  const [completionModalCaseId, setCompletionModalCaseId] = useState(null);
  const [portalCaseId, setPortalCaseId] = useState(null);
  const [formEditorState, setFormEditorState] = useState(null);
  const [sendLinkCaseId, setSendLinkCaseId] = useState(null);
  const [demoActive, setDemoActive] = useState(false);
  const [demoStep, setDemoStep] = useState(1);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  /* זיהוי קישור פורטל ציבורי (?portal=...&token=...) — נבדק פעם אחת
     בעלייה. אם התיק והטוקן תואמים, המשתמש רואה אך ורק את מסך הפורטל
     הציבורי (PublicClientPortalScreen) ואינו ניגש לשום מסך פנימי אחר.
     portalHydrationDone מונע "הבהוב" שגיאה: אם למכשיר הזה (למשל טלפון
     לקוח שנכנס בפעם הראשונה) אין עדיין נתונים ב-localStorage, ממתינים
     שניסיון המשיכה מ-Supabase יסתיים (בהצלחה או בכישלון) לפני שקובעים
     סופית שהקישור אינו תקף — אחרת תיק שנוצר אחרי הפריסה עלול להיראות
     "לא תקין" רק כי ה-hydration עדיין בדרך. */
  const publicPortalParams = useMemo(() => parsePortalParamsFromLocation(), []);
  const [portalHydrationDone, setPortalHydrationDone] = useState(!publicPortalParams || !!persisted);
  const publicPortalCase = publicPortalParams
    ? cases.find((c) => c.id === publicPortalParams.caseId && c.portalToken === publicPortalParams.token)
    : null;
  const isCheckingPortalLink = !!publicPortalParams && !publicPortalCase && !portalHydrationDone;
  const isInvalidPortalLink = !!publicPortalParams && !publicPortalCase && portalHydrationDone;

  useEffect(() => {
    persistState({ cases, tasks, activity, branchSettings, viewerRole });
  }, [cases, tasks, activity, branchSettings, viewerRole]);

  /* מנסה למשוך נתונים מ-Supabase רק פעם אחת, בעלייה, ורק אם אין כלל
     נתונים ב-localStorage (מכשיר/דפדפן חדש). אם Supabase לא מוגדר, לא
     נגיש, או שהניסיון נכשל מכל סיבה — הפונקציה חוזרת null בשקט ושום
     דבר לא משתנה. זה לא מריץ שום דבר סינכרוני וזמן הטעינה הרגיל
     (localStorage) לא מושפע כלל. */
  useEffect(() => {
    tryHydrateFromSupabase(!!persisted).then((remote) => {
      if (remote) {
        if (remote.cases?.length) setCases(remote.cases);
        if (remote.tasks?.length) setTasks(remote.tasks);
        if (remote.activity?.length) setActivity(remote.activity);
        if (remote.branchSettings) setBranchSettings(remote.branchSettings);
      }
      setPortalHydrationDone(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showToast(message) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }

  function logActivity(caseName, text) {
    setActivity((prev) => [
      { id: `e${Date.now()}`, caseName, text, time: "עכשיו" },
      ...prev,
    ]);
  }

  function openCase(id, tab = "סקירה") {
    setSelectedCaseId(id);
    setCaseTab(tab);
    setView("case-detail");
  }

  function closeDemo() {
    setDemoActive(false);
    setCompletionModalCaseId(null);
  }

  function startDemo() {
    setDemoActive(true);
    setDemoStep(1);
  }

  useEffect(() => {
    if (!demoActive) return;
    if (demoStep === 1) {
      setSelectedCaseId(DEMO_CASE_ID);
      setCaseTab("פרטי תאגיד");
      setView("case-detail");
      setCompletionModalCaseId(null);
    } else if (demoStep === 2) {
      setCaseTab("מסמכים");
    } else if (demoStep === 3) {
      setCaseTab("סקירה");
    } else if (demoStep === 4) {
      setCaseTab("סקירה");
      setCompletionModalCaseId(DEMO_CASE_ID);
    } else if (demoStep === 5) {
      setCompletionModalCaseId(null);
      setCaseTab("מסמכים");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoStep, demoActive]);

  function updateCase(id, patch) {
    setCases((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function simulateDocumentUpload(caseId, docId) {
    const c = cases.find((cc) => cc.id === caseId);
    const doc = c?.documents.find((d) => d.id === docId);
    if (!c || !doc) return;

    if (doc.name === PROTOCOL_DOC_NAME) {
      const incomplete = PROTOCOL_CHECKLIST_FIELDS.filter((f) => !doc.verificationChecklist?.[f]);
      if (incomplete.length > 0) {
        showToast('לא ניתן לסמן את הפרוטוקול כ"התקבל" לפני השלמת כל שדות הבדיקה');
        return;
      }
    }

    const documents = c.documents.map((d) =>
      d.id === docId ? { ...d, status: "התקבל", receivedAt: "היום", uploadedBy: "לקוח (סימולציה)", note: null } : d
    );
    const updated = applyAutoStatus({ ...c, documents, updatedAt: "עכשיו" });
    setCases((prev) => prev.map((cc) => (cc.id === caseId ? updated : cc)));

    showToast(`המסמך "${doc.name}" עודכן ל"התקבל" (סימולציה)`);
    logActivity(updated.name, `המסמך "${doc.name}" התקבל (סימולציה)`);
    if (updated.status === "מוכן לבדיקה" && c.status !== "מוכן לבדיקה") {
      logActivity(updated.name, 'כל התנאים התקיימו — התיק עבר אוטומטית ל"מוכן לבדיקה"');
    }
  }

  function toggleProtocolChecklistItem(caseId, docId, field) {
    const c = cases.find((cc) => cc.id === caseId);
    const doc = c?.documents.find((d) => d.id === docId);
    if (!c || !doc) return;
    const nextValue = !doc.verificationChecklist?.[field];
    const documents = c.documents.map((d) =>
      d.id === docId ? { ...d, verificationChecklist: { ...d.verificationChecklist, [field]: nextValue } } : d
    );
    setCases((prev) => prev.map((cc) => (cc.id === caseId ? { ...cc, documents, updatedAt: "עכשיו" } : cc)));
  }

  /* מדמה רק את השלמת המסמכים שהוגדרו "חסר" — לא נוגעת במסמכים "דורש בדיקה" או "ממתין ללקוח",
     ואלה נשארים לבדיקה אנושית ידנית של העובד, כפי שאמור לקרות במוצר האמיתי. */
  function simulateClientCompletesMissing(caseId) {
    const c = cases.find((cc) => cc.id === caseId);
    if (!c) return;

    const completedNames = [];
    const blockedProtocol = c.documents.some(
      (d) => d.status === "חסר" && d.name === PROTOCOL_DOC_NAME && PROTOCOL_CHECKLIST_FIELDS.some((f) => !d.verificationChecklist?.[f])
    );

    const documents = c.documents.map((d) => {
      if (d.status !== "חסר") return d;
      if (d.name === PROTOCOL_DOC_NAME) {
        const incomplete = PROTOCOL_CHECKLIST_FIELDS.some((f) => !d.verificationChecklist?.[f]);
        if (incomplete) return d; // לא מסמנים כ"התקבל" לפני שכל שדות הבדיקה הושלמו
      }
      completedNames.push(d.name);
      return { ...d, status: "התקבל", receivedAt: "היום", uploadedBy: "לקוח (סימולציה)", note: null };
    });

    if (completedNames.length === 0) {
      showToast(blockedProtocol
        ? 'לא ניתן להשלים את "פרוטוקול מורשי חתימה" לפני מילוי כל שדות הבדיקה'
        : "אין מסמכים חסרים לתיק זה כרגע");
      return;
    }

    const updated = applyAutoStatus({ ...c, documents, updatedAt: "עכשיו" });
    setCases((prev) => prev.map((cc) => (cc.id === caseId ? updated : cc)));

    let message = `הלקוח השלים בסימולציה: ${completedNames.join(", ")}`;
    if (blockedProtocol) message += ' (פרוטוקול מורשי חתימה לא הושלם — נדרשות בדיקות)';
    showToast(message);
    logActivity(updated.name, `הלקוח השלים בסימולציה את המסמכים החסרים: ${completedNames.join(", ")}`);
    if (updated.status === "מוכן לבדיקה" && c.status !== "מוכן לבדיקה") {
      logActivity(updated.name, 'כל התנאים התקיימו — התיק עבר אוטומטית ל"מוכן לבדיקה"');
    }
  }

  function viewDocument(caseId, docId) {
    const c = cases.find((c) => c.id === caseId);
    const doc = c?.documents.find((d) => d.id === docId);
    if (doc) showToast(`פתיחת "${doc.name}" לצפייה (סימולציה)`);
  }

  function setSuggestionState(caseId, sid, state) {
    let resultingCase = null;
    setCases((prev) =>
      prev.map((c) => {
        if (c.id !== caseId) return c;
        const aiSuggestions = c.aiSuggestions.map((s) => (s.id === sid ? { ...s, state } : s));
        resultingCase = applyAutoStatus({ ...c, aiSuggestions });
        return resultingCase;
      })
    );
    if (state === "approved") showToast("ההצעה אושרה על ידי עובד מורשה");
    else if (state === "flagged") showToast("ההצעה סומנה לתיקון");
    else if (state === "opened") showToast("המסמך המקורי נפתח לצפייה (סימולציה)");
    if (resultingCase && resultingCase.status === "מוכן לבדיקה") {
      logActivity(resultingCase.name, 'כל התנאים התקיימו — התיק עבר אוטומטית ל"מוכן לבדיקה"');
    }
  }

  function setRemoteIdRepName(caseId, name) {
    setCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, remoteId: { ...c.remoteId, repName: name } } : c)));
  }

  function addCourier(caseId, draft) {
    const c = cases.find((cc) => cc.id === caseId);
    if (!c || !draft.fullName?.trim()) return;
    const courier = {
      id: `k${Date.now()}`,
      fullName: draft.fullName,
      idNumber: draft.idNumber || "•••••0000",
      dob: draft.dob || "",
      gender: draft.gender || "",
      address: draft.address || "",
      phone: draft.phone || "",
      email: draft.email || "",
      active: true,
      authStart: draft.authStart || "היום",
      authEnd: null,
    };
    const withCourier = { ...c, couriers: [...(c.couriers || []), courier] };
    const forms = syncFormsForCase(withCourier);
    const updated = applyAutoStatus({ ...withCourier, forms });
    setCases((prev) => prev.map((cc) => (cc.id === caseId ? updated : cc)));
    logActivity(c.name, `נוסף/ה שליח/ה ${courier.fullName} לתיק`);
    showToast("השליח נוסף לתיק");
  }

  function setPrimaryOwner(caseId, personId) {
    const c = cases.find((cc) => cc.id === caseId);
    if (!c) return;
    const people = c.people.map((p) => (p.kind === "בעל שליטה" ? { ...p, primaryOwner: p.id === personId } : p));
    setCases((prev) => prev.map((cc) => (cc.id === caseId ? applyAutoStatus({ ...cc, people }) : cc)));
    showToast("בעל השליטה הראשי עודכן");
  }

  /* מסנכרן את רשימת הטפסים של התיק מול בעלי השליטה והשליחים הנוכחיים — מוסיף סלוט לכל אדם
     חדש, ומוריד סלוט לאדם שהוסר, בלי לגעת בטפסים קיימים שכבר יש להם נתונים/סטטוס. */
  function ensureFormsSynced(caseId) {
    setCases((prev) =>
      prev.map((c) => {
        if (c.id !== caseId) return c;
        const nextForms = syncFormsForCase(c);
        const sameIds =
          c.forms && c.forms.length === nextForms.length && c.forms.every((f, i) => f.id === nextForms[i].id);
        return sameIds ? c : { ...c, forms: nextForms };
      })
    );
  }

  /* אישור-דמה של טופס — עד שהזרימה המלאה (שדות, חתימה, בדיקה) תיבנה בצ'קפוינט הבא,
     זהו הכלי היחיד שמאפשר להעביר טופס למצב "approved" ולבדוק את השפעתו על מוכנות התיק. */
  /* בוחר איזה עורך טופס לפתוח, ומאיזו נקודת מבט — כל שלושת סוגי הטפסים מקבלים כעת
     עורך מלא עם מחזור חיים (Checkpoint 2A+2B+2C). viewContext קובע האם מוצגות
     פעולות "עובד" (בדיקה/אישור/החזרה לתיקון) — 'employee' כשנפתח ישירות מכרטיס
     התאגיד, 'client' כשנפתח דרך סימולציית פורטל הלקוח. */
  function openFormEditor(form, personName, caseId, viewContext = "employee") {
    setFormEditorState({ form, caseId, viewContext });
  }

  /* מרנדר את עורך הטופס הפעיל (אם יש) — נקרא גם מהתצוגה הפנימית הרגילה
     וגם ממסך הפורטל הציבורי, כדי שמילוי טפסים יעבוד זהה בשני המצבים. */
  function renderFormEditor() {
    if (!formEditorState) return null;
    const c = cases.find((cc) => cc.id === formEditorState.caseId);
    if (!c) return null;
    // תמיד קוראים לטופס העדכני ביותר מתוך cases, כדי לא לעבוד על עותק מיושן אחרי שמירה
    const liveForm = (c.forms || []).find((f) => f.id === formEditorState.form.id) || formEditorState.form;
    const sharedProps = {
      form: liveForm,
      c,
      branchSettings,
      viewContext: formEditorState.viewContext || "employee",
      onClose: () => setFormEditorState(null),
      onSaveDraft: (data, percent, errs) => saveFormDraft(c.id, liveForm.id, data, percent, errs),
      onProceedToSignature: (data, percent) => submitFormForSignature(c.id, liveForm.id, data, percent),
      onSign: (signedName, signedDate) => signFormDraft(c.id, liveForm.id, signedName, signedDate),
      onApplyStamp: () => applyFormStamp(c.id, liveForm.id),
      onSubmitForReview: () => submitFormForReview(c.id, liveForm.id),
      onStartReview: () => startFormReview(c.id, liveForm.id),
      onRequestCorrection: (note) => requestFormCorrection(c.id, liveForm.id, note),
      onApprove: () => approveFormReview(c.id, liveForm.id),
    };
    if (liveForm.formType === "service_recipient_declaration") return <ServiceReceiverDeclarationModal {...sharedProps} />;
    if (liveForm.formType === "kyc_extended") return <KycFormModal {...sharedProps} />;
    return <CorporatePoaFormModal {...sharedProps} />;
  }

  /* שמירת טיוטה של טופס: לא נוגעת ב-id של הטופס, לא דורסת טפסים אחרים, ומעדכנת סטטוס
     ל-in_progress רק אם הטופס עדיין לא התחיל (או נשאר correction_requested אם שם היה). */
  function saveFormDraft(caseId, formId, data, completionPercent, validationErrors = []) {
    const c = cases.find((cc) => cc.id === caseId);
    if (!c) return;
    const baseForms = c.forms && c.forms.length ? c.forms : syncFormsForCase(c);
    const target = baseForms.find((f) => f.id === formId);
    if (!target) return;
    const wasNotStarted = target.status === "not_started";
    const forms = baseForms.map((f) =>
      f.id === formId
        ? { ...f, data, validationErrors, completionPercent, status: wasNotStarted ? "in_progress" : f.status, updatedAt: "עכשיו" }
        : f
    );
    const updated = applyAutoStatus({ ...c, forms, updatedAt: "עכשיו" });
    setCases((prev) => prev.map((cc) => (cc.id === caseId ? updated : cc)));
    logActivity(updated.name, `טופס ${FORM_TYPES[target.formType]?.label || target.formType} נשמר כטיוטה`);
    showToast("הטיוטה נשמרה");
  }

  /* מעביר ל-awaiting_signature. אם המקור הוא correction_requested (הגשה מחדש אחרי
     תיקון), מאפס חתימה/חותמת קודמות — נדרשת חתימה וחותמת חדשות — ושומר רשומת
     היסטוריה מינימלית לפני האיפוס, כדי לא לאבד את העובדה שכבר נחתם/הוגש בעבר. */
  function submitFormForSignature(caseId, formId, data, completionPercent) {
    const c = cases.find((cc) => cc.id === caseId);
    if (!c) return;
    const baseForms = c.forms && c.forms.length ? c.forms : syncFormsForCase(c);
    const target = baseForms.find((f) => f.id === formId);
    if (!target) return;
    const wasCorrection = target.status === "correction_requested";
    const history = wasCorrection
      ? [...(target.history || []), { event: "resubmitted_for_signature", at: "עכשיו", note: "הוגש מחדש לחתימה לאחר תיקון" }]
      : target.history || [];
    const forms = baseForms.map((f) =>
      f.id === formId
        ? {
            ...f,
            data,
            validationErrors: [],
            completionPercent,
            status: "awaiting_signature",
            // תיקון מחייב חתימה וחותמת חדשות — מאפסים את הקודמות, לא מוחקים את יומן הפעילות/ההיסטוריה
            signedBy: wasCorrection ? null : f.signedBy,
            signedAt: wasCorrection ? null : f.signedAt,
            signatureMethod: wasCorrection ? null : f.signatureMethod,
            stampApplied: wasCorrection ? false : f.stampApplied,
            stampAppliedAt: wasCorrection ? null : f.stampAppliedAt,
            history,
            updatedAt: "עכשיו",
          }
        : f
    );
    const updated = applyAutoStatus({ ...c, forms, updatedAt: "עכשיו" });
    setCases((prev) => prev.map((cc) => (cc.id === caseId ? updated : cc)));
    logActivity(updated.name, wasCorrection
      ? `טופס ${FORM_TYPES[target.formType]?.label || target.formType} הוגש מחדש לחתימה לאחר תיקון`
      : `טופס ${FORM_TYPES[target.formType]?.label || target.formType} עבר לסטטוס "ממתין לחתימה"`);
    showToast('הטופס עבר לסטטוס "ממתין לחתימה"');
  }

  function getFormOrSync(c, formId) {
    const baseForms = c.forms && c.forms.length ? c.forms : syncFormsForCase(c);
    return { baseForms, target: baseForms.find((f) => f.id === formId) };
  }

  /* חתימה מדומה — לא חתימה אלקטרונית משפטית. שומר שם חותם, תאריך, ושיטת חתימה קבועה
     "simulation". לא ניתן לחתום שוב אחרי שכבר נחתם (עד שמוחזר לתיקון ומאופס). */
  function signFormDraft(caseId, formId, signedName, signedDate) {
    const c = cases.find((cc) => cc.id === caseId);
    if (!c) return;
    const { baseForms, target } = getFormOrSync(c, formId);
    if (!target || target.status !== "awaiting_signature" || target.signedBy) return;
    const forms = baseForms.map((f) =>
      f.id === formId
        ? {
            ...f,
            signedBy: signedName,
            signedAt: signedDate,
            signatureMethod: "simulation",
            history: [...(f.history || []), { event: "signed", at: "עכשיו" }],
            updatedAt: "עכשיו",
          }
        : f
    );
    updateCase(caseId, { forms });
    logActivity(c.name, `בוצעה חתימה מדומה על טופס ${FORM_TYPES[target.formType]?.label || target.formType}`);
    showToast("החתימה המדומה נשמרה");
  }

  /* חותמת תאגיד מדומה — נפרדת מהחתימה, נדרשת גם היא לפני הגשה. */
  function applyFormStamp(caseId, formId) {
    const c = cases.find((cc) => cc.id === caseId);
    if (!c) return;
    const { baseForms, target } = getFormOrSync(c, formId);
    if (!target || target.status !== "awaiting_signature" || target.stampApplied) return;
    const forms = baseForms.map((f) =>
      f.id === formId
        ? { ...f, stampApplied: true, stampAppliedAt: "עכשיו", history: [...(f.history || []), { event: "stamped", at: "עכשיו" }], updatedAt: "עכשיו" }
        : f
    );
    updateCase(caseId, { forms });
    logActivity(c.name, `נוספה חותמת תאגיד מדומה לטופס ${FORM_TYPES[target.formType]?.label || target.formType}`);
    showToast("חותמת התאגיד נוספה בסימולציה");
  }

  /* הגשה לבדיקה — רק לאחר חתימה, חותמת וולידציה מלאה. לקוח/שליח לא יכולים להתקדם מעבר
     לזה — submitted/under_review/approved מנוהלים אך ורק דרך פעולות העובד למטה. */
  function submitFormForReview(caseId, formId) {
    const c = cases.find((cc) => cc.id === caseId);
    if (!c) return;
    const { baseForms, target } = getFormOrSync(c, formId);
    if (!target || target.status !== "awaiting_signature") return;
    if (!target.signedBy) return;
    if (formRequiresStamp(target.formType) && !target.stampApplied) return;
    if (validateFormData(target.formType, target.data).length > 0) return;
    const forms = baseForms.map((f) =>
      f.id === formId
        ? { ...f, status: "submitted", submittedAt: "עכשיו", history: [...(f.history || []), { event: "submitted", at: "עכשיו" }], updatedAt: "עכשיו" }
        : f
    );
    const updated = applyAutoStatus({ ...c, forms, updatedAt: "עכשיו" });
    setCases((prev) => prev.map((cc) => (cc.id === caseId ? updated : cc)));
    logActivity(updated.name, `טופס ${FORM_TYPES[target.formType]?.label || target.formType} הוגש לבדיקה`);
    showToast("הטופס הוגש לבדיקה");
  }

  /* פעולות עובד בלבד — submitted -> under_review */
  function startFormReview(caseId, formId) {
    const c = cases.find((cc) => cc.id === caseId);
    if (!c) return;
    const { baseForms, target } = getFormOrSync(c, formId);
    if (!target || target.status !== "submitted") return;
    const forms = baseForms.map((f) =>
      f.id === formId
        ? { ...f, status: "under_review", history: [...(f.history || []), { event: "review_started", at: "עכשיו" }], updatedAt: "עכשיו" }
        : f
    );
    updateCase(caseId, { forms });
    logActivity(c.name, `החלה בדיקת עובד לטופס ${FORM_TYPES[target.formType]?.label || target.formType}`);
    showToast("בדיקת הטופס החלה");
  }

  /* פעולות עובד בלבד — under_review -> correction_requested, עם הערה חובה. אינה נוגעת
     בהיסטוריית החתימה/הבדיקה הקודמת — רק מוסיפה רשומה חדשה. */
  function requestFormCorrection(caseId, formId, note) {
    const c = cases.find((cc) => cc.id === caseId);
    if (!c || !note?.trim()) return;
    const { baseForms, target } = getFormOrSync(c, formId);
    if (!target || target.status !== "under_review") return;
    const forms = baseForms.map((f) =>
      f.id === formId
        ? {
            ...f,
            status: "correction_requested",
            reviewNotes: note.trim(),
            history: [...(f.history || []), { event: "correction_requested", at: "עכשיו" }],
            updatedAt: "עכשיו",
          }
        : f
    );
    const updated = applyAutoStatus({ ...c, forms, updatedAt: "עכשיו" });
    setCases((prev) => prev.map((cc) => (cc.id === caseId ? updated : cc)));
    logActivity(updated.name, `טופס ${FORM_TYPES[target.formType]?.label || target.formType} הוחזר לתיקון על ידי עובד`);
    showToast("הטופס הוחזר לתיקון");
  }

  /* פעולות עובד בלבד — under_review -> approved. חסום אם לא הוגש, או שחסרות חתימה/חותמת. */
  function approveFormReview(caseId, formId) {
    const c = cases.find((cc) => cc.id === caseId);
    if (!c) return;
    const { baseForms, target } = getFormOrSync(c, formId);
    if (!target || target.status !== "under_review") return;
    if (!target.submittedAt || !target.signedBy) return;
    if (formRequiresStamp(target.formType) && !target.stampApplied) return;
    const forms = baseForms.map((f) =>
      f.id === formId
        ? {
            ...f,
            status: "approved",
            completionPercent: 100,
            reviewedBy: c.assignee,
            reviewedAt: "עכשיו",
            history: [...(f.history || []), { event: "approved", at: "עכשיו" }],
            updatedAt: "עכשיו",
          }
        : f
    );
    const updated = applyAutoStatus({ ...c, forms, updatedAt: "עכשיו" });
    setCases((prev) => prev.map((cc) => (cc.id === caseId ? updated : cc)));
    logActivity(updated.name, `טופס ${FORM_TYPES[target.formType]?.label || target.formType} אושר על ידי עובד`);
    showToast("הטופס אושר");
    if (updated.status === "מוכן לבדיקה" && c.status !== "מוכן לבדיקה") {
      logActivity(updated.name, 'כל התנאים התקיימו — התיק עבר אוטומטית ל"מוכן לבדיקה"');
    }
  }

  /* מסמן שהעלאת התמונה בוצעה בסימולציה — לא מפעילה מצלמה, לא מבקשת הרשאות, לא מעבדת ביומטריה.
     גם מעדכנת את המסמך המקביל ברשימת הדרישות, כדי לשמור עקביות בין כל המסכים. */
  function simulateIdPhotoUpload(caseId) {
    let resultingCase = null;
    setCases((prev) =>
      prev.map((c) => {
        if (c.id !== caseId) return c;
        const documents = c.documents.map((d) =>
          d.name === "צילום תעודת זהות של נציג התאגיד"
            ? { ...d, status: "התקבל", receivedAt: "היום", uploadedBy: `${c.remoteId?.repName || "נציג"} (זיהוי מרחוק)`, note: null }
            : d
        );
        const remoteId = { ...c.remoteId, idPhoto: true };
        resultingCase = applyAutoStatus({ ...c, documents, remoteId, updatedAt: "עכשיו" });
        return resultingCase;
      })
    );
    if (resultingCase) {
      logActivity(resultingCase.name, "התקבל צילום תעודת זהות של הנציג (סימולציה)");
      showToast("צילום תעודת הזהות התקבל בסימולציה");
    }
  }

  function simulateSelfieUpload(caseId) {
    let resultingCase = null;
    setCases((prev) =>
      prev.map((c) => {
        if (c.id !== caseId) return c;
        const documents = c.documents.map((d) =>
          d.name === "סלפי של נציג התאגיד"
            ? { ...d, status: "התקבל", receivedAt: "היום", uploadedBy: `${c.remoteId?.repName || "נציג"} (זיהוי מרחוק)`, note: null }
            : d
        );
        const remoteId = { ...c.remoteId, selfie: true };
        resultingCase = applyAutoStatus({ ...c, documents, remoteId, updatedAt: "עכשיו" });
        return resultingCase;
      })
    );
    if (resultingCase) {
      logActivity(resultingCase.name, "התקבל צילום סלפי של הנציג (סימולציה)");
      showToast("צילום הסלפי התקבל בסימולציה");
    }
  }

  /* אישור אנושי בלבד — שום דבר לא מאושר אוטומטית. 'approved' מקשר את הנציג לתאגיד (מסמן אדם קיים
     כמזוהה, או מוסיף אותו לרשימת אנשי הקשר אם הוא עדיין לא שם), 'retry' מאפס את שני הצילומים
     כדי לאפשר ניסיון חדש, ו-'compliance' מעביר לבדיקת אחראי ציות ופותח משימת מעקב. */
  /* אישור אנושי בלבד — שום דבר לא מאושר אוטומטית. 'approved' מקשר את הנציג לתאגיד (מסמן אדם קיים
     כמזוהה, או מוסיף אותו לרשימת אנשי הקשר אם הוא עדיין לא שם), 'retry' מאפס את שני הצילומים
     כדי לאפשר ניסיון חדש, ו-'compliance' מעביר לבדיקת אחראי ציות ופותח משימת מעקב.
     כל הנתונים ל-toast וליומן הפעילות מחושבים מראש מתוך cases הנוכחי (לא מתוך תוצאת ה-updater
     של setCases), כי אין ערובה שה-updater ירוץ באופן סינכרוני לפני שורת הקוד הבאה. */
  function decideRemoteId(caseId, decision) {
    const c = cases.find((cc) => cc.id === caseId);
    if (!c) return;

    let people = c.people;
    let remoteId = { ...c.remoteId };
    if (decision === "approved") {
      const existing = c.people.find((p) => p.fullName === c.remoteId.repName);
      if (existing) {
        people = c.people.map((p) => (p.id === existing.id ? { ...p, verifiedRemoteId: true } : p));
      } else if (c.remoteId.repName) {
        people = [
          ...c.people,
          { id: `p-remote-${Date.now()}`, fullName: c.remoteId.repName, role: "", partialId: "", phone: "", email: "", kind: "נציג", verifiedRemoteId: true },
        ];
      }
      remoteId = { ...remoteId, decision: "approved", decidedBy: c.assignee, decidedAt: "עכשיו" };
    } else if (decision === "retry") {
      remoteId = { ...remoteId, idPhoto: false, selfie: false, decision: null, attempted: true };
    } else if (decision === "compliance") {
      remoteId = { ...remoteId, decision: "compliance", decidedAt: "עכשיו" };
    }

    const updated = applyAutoStatus({ ...c, people, remoteId, updatedAt: "עכשיו" });
    setCases((prev) => prev.map((cc) => (cc.id === caseId ? updated : cc)));

    if (decision === "approved") {
      logActivity(updated.name, `זיהוי מרחוק של ${updated.remoteId.repName} אושר על ידי ${updated.assignee}`);
      showToast("בדיקת הזיהוי אושרה על ידי עובד מורשה");
      if (updated.status === "מוכן לבדיקה" && c.status !== "מוכן לבדיקה") {
        logActivity(updated.name, 'כל התנאים התקיימו — התיק עבר אוטומטית ל"מוכן לבדיקה"');
      }
    } else if (decision === "retry") {
      logActivity(updated.name, "נשלחה בקשה לניסיון חוזר בזיהוי מרחוק (סימולציה)");
      showToast("נשלחה בקשה לניסיון חוזר בזיהוי מרחוק");
    } else if (decision === "compliance") {
      logActivity(updated.name, "התיק הועבר לבדיקת אחראי ציות — זיהוי מרחוק (סימולציה)");
      showToast("התיק הועבר לאחראי ציות");
      setTasks((prev) => [
        { id: `t${Date.now()}`, type: "בדיקת אחראי ציות — זיהוי מרחוק", caseId: updated.id, caseName: updated.name, priority: "גבוהה", assignee: "אחראי ציות", due: "היום", status: "פתוחה" },
        ...prev,
      ]);
    }
  }

  function submitCompletionRequest(caseId, { channel, message }) {
    const c = cases.find((c) => c.id === caseId);
    if (!c) return;
    const channelLabel = { email: "מייל", sms: "SMS", whatsapp: "וואטסאפ (מדומה)" }[channel] || channel;
    updateCase(caseId, { status: "ממתין למסמכים", updatedAt: "עכשיו" });
    logActivity(c.name, `נשלחה בקשת השלמה ללקוח בערוץ ${channelLabel} (סימולציה): "${message.slice(0, 60)}${message.length > 60 ? "…" : ""}"`);
    setTasks((prev) => [
      { id: `t${Date.now()}`, type: "מעקב אחר בקשת השלמה", caseId: c.id, caseName: c.name, priority: "בינונית", assignee: c.assignee, due: "בעוד 3 ימים", status: "פתוחה" },
      ...prev,
    ]);
    showToast(`בקשת ההשלמה נשלחה בסימולציה בערוץ ${channelLabel} ל־${c.contactName}`);
    setCompletionModalCaseId(null);
  }

  function markTaskDone(taskId) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: "הושלמה" } : t)));
    showToast("המשימה סומנה כהושלמה");
  }

  function snoozeTask(taskId) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, due: "נדחתה ליום הבא" } : t)));
    showToast("המשימה נדחתה ליום הבא");
  }

  function createCorporateCase(draft) {
    const id = `c${Date.now()}`;
    const serviceType = draft.serviceType || "other";
    const baseCase = {
      id,
      name: draft.name || "תאגיד חדש",
      companyNumber: draft.companyNumber || "515000000",
      field: draft.field || "",
      address: draft.address || "",
      contactName: draft.contactName || "",
      contactPhone: draft.contactPhone || "",
      contactEmail: draft.contactEmail || "",
      serviceType,
      courierInvolved: !!draft.courierInvolved,
      status: "טיוטה",
      assignee: "דניאל כהן",
      updatedAt: "עכשיו",
      people: draft.people || [],
      documents: draft.documents && draft.documents.length ? draft.documents : buildRequirements(serviceType, []),
      aiSuggestions: [],
      couriers: [],
      forms: [],
      portalToken: generatePortalToken(),
      remoteId: { repName: "", idPhoto: false, selfie: false, decision: null, decidedBy: null, decidedAt: null, attempted: false },
    };
    const newCase = applyAutoStatus(baseCase);
    setCases((prev) => [newCase, ...prev]);
    logActivity(newCase.name, "נפתח תיק תאגיד חדש (נתוני דמה)");
    return newCase;
  }

  const selectedCase = cases.find((c) => c.id === selectedCaseId) || null;

  if (isCheckingPortalLink) {
    return (
      <div dir="rtl" className="min-h-screen w-full bg-slate-50 flex items-center justify-center px-4" style={{ fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif" }}>
        <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-sm text-center">
          <div className="font-medium text-slate-800 mb-2">בודק את הקישור…</div>
          <div className="text-sm text-slate-500">רק רגע, טוענים את פרטי התיק שלך.</div>
        </div>
      </div>
    );
  }

  if (isInvalidPortalLink) {
    return (
      <div dir="rtl" className="min-h-screen w-full bg-slate-50 flex items-center justify-center px-4" style={{ fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif" }}>
        <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-sm text-center">
          <div className="font-medium text-slate-800 mb-2">קישור לא תקין</div>
          <div className="text-sm text-slate-500">הקישור שקיבלת אינו תקף. יש לפנות לנציג שסיפק לך אותו ולבקש קישור מעודכן.</div>
        </div>
      </div>
    );
  }

  if (publicPortalCase) {
    return (
      <>
        <PublicClientPortalScreen
          c={publicPortalCase}
          branchSettings={branchSettings}
          onOpenForm={(form, personName) => openFormEditor(form, personName, publicPortalCase.id, "client")}
        />
        {renderFormEditor()}
      </>
    );
  }

  if (!viewerRole) {
    return <EntryGate onChoose={(role) => setViewerRole(role)} />;
  }

  return (
    <div dir="rtl" className="min-h-screen w-full bg-slate-50 text-slate-800 flex" style={{ fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif" }}>
      <Sidebar
        view={view}
        viewerRole={viewerRole}
        onSwitchRole={() => setViewerRole(null)}
        setView={(v) => {
          setView(v);
          setSelectedCaseId(null);
          if (demoActive) closeDemo();
        }}
      />

      <main className="flex-1 min-w-0 h-screen overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 py-8">
          {view === "dashboard" && viewerRole === "manager" && (
            <ManagerDashboard
              cases={cases}
              tasks={tasks}
              branchSettings={branchSettings}
              onOpenCase={openCase}
              onGoToCases={() => setView("cases")}
              onGoToTasks={() => setView("tasks")}
            />
          )}
          {view === "dashboard" && viewerRole !== "manager" && (
            <Dashboard
              cases={cases}
              tasks={tasks}
              activity={activity}
              onOpenCase={openCase}
              onOpenCompletionRequest={(caseId) => setCompletionModalCaseId(caseId)}
              onStartDemo={startDemo}
              onSendReminder={(caseId) => {
                const c = cases.find((c) => c.id === caseId);
                if (c) {
                  logActivity(c.name, "נשלחה תזכורת ללקוח (סימולציה)");
                  showToast(`תזכורת נשלחה בסימולציה ל־${c.name}`);
                }
              }}
            />
          )}

          {view === "cases" && (
            <CasesList
              cases={cases}
              onOpenCase={openCase}
              onNewCase={() => {
                setWizardStep(1);
                setView("wizard");
              }}
            />
          )}

          {view === "clients" && <ClientsScreen cases={cases} onOpenCase={openCase} />}

          {view === "wizard" && (
            <NewCaseWizard
              step={wizardStep}
              setStep={setWizardStep}
              onCancel={() => setView("cases")}
              onFinish={(draft) => {
                const created = createCorporateCase(draft);
                const { received, total } = completeness(created.documents, created);
                if (received < total) {
                  updateCase(created.id, { status: "ממתין למסמכים" });
                  showToast("בקשת השלמה נשלחה ללקוח בסימולציה");
                } else {
                  showToast("כל המסמכים כבר סומנו כהתקבלו — התיק מוכן לבדיקה");
                }
                setView("cases");
              }}
              onSaveDraft={(draft) => {
                createCorporateCase(draft);
                showToast("התיק נשמר כטיוטה");
                setView("cases");
              }}
            />
          )}

          {view === "case-detail" && selectedCase && (
            <CaseDetail
              c={selectedCase}
              activity={activity.filter((a) => a.caseName === selectedCase.name)}
              tab={caseTab}
              onTabChange={(t) => {
                setCaseTab(t);
                if (t === "טפסים") ensureFormsSynced(selectedCase.id);
              }}
              onBack={() => setView("cases")}
              onUploadDocument={(docId) => simulateDocumentUpload(selectedCase.id, docId)}
              onToggleProtocolChecklist={(docId, field) => toggleProtocolChecklistItem(selectedCase.id, docId, field)}
              onCompleteMissingDocs={() => simulateClientCompletesMissing(selectedCase.id)}
              onViewDocument={(docId) => viewDocument(selectedCase.id, docId)}
              onSendReminder={() => {
                logActivity(selectedCase.name, "נשלחה תזכורת ללקוח (סימולציה)");
                showToast("תזכורת נשלחה בסימולציה");
              }}
              onOpenCompletionRequest={() => setCompletionModalCaseId(selectedCase.id)}
              onSendPortalLink={() => setSendLinkCaseId(selectedCase.id)}
              onApprove={() => {
                updateCase(selectedCase.id, { status: "אושר", updatedAt: "עכשיו" });
                logActivity(selectedCase.name, "התיק הועבר לאישור");
                showToast("התיק הועבר לאישור");
              }}
              onExport={() => setExportModalCaseId(selectedCase.id)}
              onAddPerson={(person) => {
                const withPerson = { ...selectedCase, people: [...selectedCase.people, person] };
                const forms = syncFormsForCase(withPerson);
                const updated = applyAutoStatus({ ...withPerson, forms });
                setCases((prev) => prev.map((cc) => (cc.id === selectedCase.id ? updated : cc)));
                logActivity(selectedCase.name, `נוסף/ה ${person.fullName} כ${person.kind}`);
                showToast("איש הקשר נוסף לתיק");
              }}
              onSetSuggestionState={(sid, state) => setSuggestionState(selectedCase.id, sid, state)}
              onSetRemoteIdRepName={(name) => setRemoteIdRepName(selectedCase.id, name)}
              onUploadIdPhoto={() => simulateIdPhotoUpload(selectedCase.id)}
              onUploadSelfie={() => simulateSelfieUpload(selectedCase.id)}
              onDecideRemoteId={(decision) => decideRemoteId(selectedCase.id, decision)}
              onOpenFormPreview={(form, personName) => openFormEditor(form, personName, selectedCase.id, "employee")}
              onOpenClientPortal={() => setPortalCaseId(selectedCase.id)}
              onAddCourier={(draft) => addCourier(selectedCase.id, draft)}
              onSetPrimaryOwner={(personId) => setPrimaryOwner(selectedCase.id, personId)}
            />
          )}

          {view === "tasks" && (
            <TasksScreen tasks={tasks} onMarkDone={markTaskDone} onSnooze={snoozeTask} onOpenCase={openCase} />
          )}

          {view === "settings" && (
            <SettingsScreen
              showToast={showToast}
              branchSettings={branchSettings}
              onSaveBranchSettings={(next) => {
                setBranchSettings(next);
                showToast("הגדרות הסניף נשמרו");
              }}
            />
          )}
        </div>
      </main>

      {exportModalCaseId && (
        <ExportModal
          caseName={cases.find((c) => c.id === exportModalCaseId)?.name}
          onClose={() => {
            setExportModalCaseId(null);
            if (demoActive) closeDemo();
          }}
        />
      )}

      {completionModalCaseId && (() => {
        const c = cases.find((cc) => cc.id === completionModalCaseId);
        return c ? (
          <CompletionRequestModal
            c={c}
            onClose={() => setCompletionModalCaseId(null)}
            onSubmit={(payload) => submitCompletionRequest(c.id, payload)}
          />
        ) : null;
      })()}

      {portalCaseId && (() => {
        const c = cases.find((cc) => cc.id === portalCaseId);
        return c ? (
          <ClientPortalModal
            c={c}
            branchSettings={branchSettings}
            onClose={() => setPortalCaseId(null)}
            onOpenForm={(form, personName) => openFormEditor(form, personName, c.id, "client")}
          />
        ) : null;
      })()}

      {sendLinkCaseId && (() => {
        const c = cases.find((cc) => cc.id === sendLinkCaseId);
        return c ? (
          <SendPortalLinkModal
            c={c}
            onClose={() => setSendLinkCaseId(null)}
            onSaveContact={(contact) => {
              updateCase(c.id, contact);
              showToast("פרטי הקשר עודכנו בתיק");
            }}
          />
        ) : null;
      })()}

      {renderFormEditor()}

      {demoActive && (
        <DemoPanel
          step={demoStep}
          onPrev={() => setDemoStep((s) => Math.max(1, s - 1))}
          onNext={() => setDemoStep((s) => Math.min(DEMO_STEPS.length, s + 1))}
          onClose={() => {
            closeDemo();
            setView("dashboard");
            setSelectedCaseId(null);
          }}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}

/* ---------------------------- Sidebar ---------------------------- */

function EntryGate({ onChoose }) {
  return (
    <div dir="rtl" className="min-h-screen w-full bg-slate-50 flex items-center justify-center px-4" style={{ fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif" }}>
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
        <div className="text-lg font-semibold text-slate-900">Corporate Onboarding AI</div>
        <div className="text-sm text-slate-500 mt-1">שכבת עבודה מעל ישות וחשבשבת</div>
        <div className="mt-8 text-base font-medium text-slate-800">איך תרצה/י להיכנס למערכת?</div>
        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={() => onChoose("manager")}
            className="text-sm px-4 py-3 rounded-lg bg-slate-900 text-white hover:bg-slate-950"
          >
            אני מנהל/ת סניף
          </button>
          <button
            onClick={() => onChoose("staff")}
            className="text-sm px-4 py-3 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            אני עובד/ת תפעול
          </button>
        </div>
        <div className="text-xs text-slate-400 mt-6">הבחירה קובעת אילו מסכים יוצגו. ניתן להחליף בכל עת מהסרגל הצדדי.</div>
      </div>
    </div>
  );
}

function Sidebar({ view, setView, viewerRole, onSwitchRole }) {
  const isManager = viewerRole === "manager";
  return (
    <aside className="w-64 shrink-0 h-screen bg-slate-900 text-slate-200 flex flex-col justify-between">
      <div>
        <div className="px-6 py-6 border-b border-white/10">
          <div className="text-white font-semibold text-lg leading-tight">Corporate Onboarding AI</div>
          <div className="text-xs text-slate-400 mt-1">שכבת עבודה מעל ישות וחשבשבת</div>
        </div>
        <nav className="px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = view === item.id || (view === "wizard" && item.id === "cases") || (view === "case-detail" && item.id === "cases");
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${isManager ? "bg-indigo-500/20 text-indigo-300" : "bg-sky-500/20 text-sky-300"}`}>
            {isManager ? "מס" : "דכ"}
          </div>
          <div className="text-sm">
            <div className="text-white leading-tight">{isManager ? "מנהל/ת סניף" : "דניאל כהן"}</div>
            <div className="text-slate-400 text-xs">{isManager ? "תצוגת ניהול" : "עובד תפעול"}</div>
          </div>
        </div>
        <button onClick={onSwitchRole} className="text-xs text-slate-500 hover:text-slate-300 mt-3">
          החלף תצוגה
        </button>
      </div>
    </aside>
  );
}

/* ---------------------------- Shared bits ---------------------------- */

function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] || "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md border text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function DocStatusBadge({ status }) {
  const cls = DOC_STATUS_STYLES[status] || "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-md border text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function RequirementKindBadge({ mandatory }) {
  return mandatory ? (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded border text-xs font-medium bg-slate-100 text-slate-600 border-slate-200">
      חובה
    </span>
  ) : (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded border text-xs font-medium bg-indigo-50 text-indigo-600 border-indigo-200">
      מותנה
    </span>
  );
}

function ProgressBar({ received, total }) {
  const pct = Math.round((received / total) * 100);
  const color = pct === 100 ? "bg-emerald-500" : pct >= 60 ? "bg-sky-500" : "bg-amber-500";
  return (
    <div className="flex items-center gap-2 min-w-28">
      <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500 whitespace-nowrap">
        {received}/{total}
      </span>
    </div>
  );
}

function Toast({ message }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-slate-900 text-white text-sm px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
        <CheckCircle2 size={16} className="text-emerald-400" />
        {message}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon = Info, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 text-slate-500">
      <Icon size={28} className="mb-3 text-slate-400" strokeWidth={1.5} />
      <div className="font-medium text-slate-600">{title}</div>
      {subtitle && <div className="text-sm mt-1">{subtitle}</div>}
    </div>
  );
}

/* ---------------------------- Dashboard ---------------------------- */

function Dashboard({ cases, tasks, activity, onOpenCase, onOpenCompletionRequest, onSendReminder, onStartDemo }) {
  const openTasks = tasks.filter((t) => t.status === "פתוחה").length;
  const waitingForClient = cases.filter((c) => c.status === "ממתין למסמכים").length;
  const readyForReview = cases.filter((c) => c.status === "מוכן לבדיקה").length;
  const mismatches = cases.filter((c) => c.status === "נמצאה אי־התאמה").length;

  const kpis = [
    { label: "משימות פתוחות", value: openTasks, icon: ListChecks, tone: "text-slate-900" },
    { label: "תיקים ממתינים ללקוח", value: waitingForClient, icon: Clock, tone: "text-amber-600" },
    { label: "תיקים מוכנים לבדיקה", value: readyForReview, icon: CheckCircle2, tone: "text-sky-600" },
    { label: "תיקים עם אי־התאמות", value: mismatches, icon: AlertTriangle, tone: "text-rose-600" },
  ];

  const urgencyRank = { "גבוהה": 0, "בינונית": 1, "נמוכה": 2 };
  const attention = cases
    .flatMap((c) => getCaseIssues(c).map((issue) => ({ ...issue, caseId: c.id, caseName: c.name, updatedAt: c.updatedAt })))
    .sort((a, b) => urgencyRank[a.urgency] - urgencyRank[b.urgency])
    .slice(0, 5);

  function handleAttentionAction(item) {
    if (item.kind === "completion") onOpenCompletionRequest(item.caseId);
    else if (item.kind === "reminder") onSendReminder(item.caseId);
    else if (item.kind === "review-doc") onOpenCase(item.caseId, "מסמכים");
    else if (item.kind === "remote-id") onOpenCase(item.caseId, "זיהוי מרחוק");
    else onOpenCase(item.caseId, "סקירה");
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">לוח עבודה</h1>
          <p className="text-slate-500 mt-1">בוקר טוב, דניאל. הנה מה שדורש טיפול היום.</p>
        </div>
        <button
          onClick={onStartDemo}
          className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 shrink-0"
        >
          <Sparkles size={16} />
          צפה בדמו של פתיחת תאגיד
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mt-6">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <Icon size={18} className={k.tone} strokeWidth={1.8} />
              </div>
              <div className="text-2xl font-semibold text-slate-900 mt-3">{k.value}</div>
              <div className="text-sm text-slate-500 mt-0.5">{k.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-6 mt-8">
        <div className="col-span-2 bg-white border border-slate-200 rounded-xl">
          <div className="px-5 py-4 border-b border-slate-100 font-medium text-slate-800">מה דורש טיפול עכשיו</div>
          {attention.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="אין פעולות דחופות כרגע" subtitle="כל התיקים הפעילים מטופלים" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {attention.map((a) => (
                <li key={a.id} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{a.text}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {a.caseName} · עודכן {a.updatedAt}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <UrgencyPill level={a.urgency} />
                    <button
                      onClick={() => handleAttentionAction(a)}
                      className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      {a.actionLabel}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl">
          <div className="px-5 py-4 border-b border-slate-100 font-medium text-slate-800">פעילות אחרונה</div>
          {activity.length === 0 ? (
            <EmptyState icon={Clock} title="אין עדיין פעילות" />
          ) : (
            <ul className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {activity.slice(0, 8).map((e) => (
                <li key={e.id} className="px-5 py-3">
                  <div className="text-sm text-slate-700">{e.text}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {e.caseName} · {e.time}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mt-6">
        <PilotValueCard />
        <BeforeAfterCard />
      </div>
    </div>
  );
}

function ManagerDashboard({ cases, tasks, branchSettings, onOpenCase, onGoToCases, onGoToTasks }) {
  const openCases = cases.filter((c) => c.status !== "אושר");
  const target = parseInt(branchSettings.targetMinutes, 10) || 15;

  const withAge = openCases.map((c) => ({ c, age: ageInMinutes(c.updatedAt) }));
  const withinTarget = withAge.filter((x) => x.age !== null && x.age <= target);
  const overTarget = withAge.filter((x) => x.age !== null && x.age > target);
  const compliance = openCases.filter((c) => c.remoteId?.decision === "compliance");
  const pctOnTarget = withAge.length ? Math.round((withinTarget.length / withAge.length) * 100) : 100;

  const stuckCounts = { "on-client": 0, "on-us": 0, "ready-for-approval": 0 };
  openCases.forEach((c) => {
    const reason = stuckReason(c);
    if (stuckCounts[reason] !== undefined) stuckCounts[reason] += 1;
  });

  const employees = {};
  openCases.forEach((c) => {
    if (!employees[c.assignee]) employees[c.assignee] = { active: 0, overTarget: 0 };
    employees[c.assignee].active += 1;
  });
  withAge.forEach(({ c, age }) => {
    if (age !== null && age > target && employees[c.assignee]) employees[c.assignee].overTarget += 1;
  });
  const openTasksByAssignee = {};
  tasks.filter((t) => t.status === "פתוחה").forEach((t) => {
    openTasksByAssignee[t.assignee] = (openTasksByAssignee[t.assignee] || 0) + 1;
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">תצוגת מנהל/ת סניף</h1>
      <p className="text-slate-500 mt-1">
        סניף {branchSettings.branchName} (מס׳ {branchSettings.branchNumber}) · תמונת מצב מצטברת, לא ברמת תיק בודד.
      </p>

      <div className="grid grid-cols-4 gap-4 mt-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-2xl font-semibold text-emerald-600">{withinTarget.length}</div>
          <div className="text-sm text-slate-500 mt-0.5">תיקים בתוך היעד</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-2xl font-semibold text-rose-600">{overTarget.length}</div>
          <div className="text-sm text-slate-500 mt-0.5">תיקים חורגים מהיעד</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-2xl font-semibold text-indigo-600">{compliance.length}</div>
          <div className="text-sm text-slate-500 mt-0.5">הוסלמו לאחראי ציות</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-2xl font-semibold text-slate-900">{pctOnTarget}%</div>
          <div className="text-sm text-slate-500 mt-0.5">עמידה ביעד ({target} דק׳)</div>
        </div>
      </div>
      <div className="text-xs text-slate-400 mt-2">מבוסס על זמן מאז עדכון אחרון בכל תיק, כאומדן להמחשה — לא מדידת SLA מדויקת.</div>

      <div className="grid grid-cols-2 gap-6 mt-6">
        <div className="bg-white border border-slate-200 rounded-xl">
          <div className="px-5 py-4 border-b border-slate-100 font-medium text-slate-800">עומס לפי עובד</div>
          {Object.keys(employees).length === 0 ? (
            <EmptyState icon={Users} title="אין תיקים פתוחים כרגע" />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs">
                <tr>
                  <th className="text-right font-medium px-5 py-2.5">עובד</th>
                  <th className="text-right font-medium px-5 py-2.5">תיקים פעילים</th>
                  <th className="text-right font-medium px-5 py-2.5">חורגים מהיעד</th>
                  <th className="text-right font-medium px-5 py-2.5">משימות פתוחות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(employees).map(([name, stats]) => (
                  <tr key={name}>
                    <td className="px-5 py-2.5 text-slate-800">{name}</td>
                    <td className="px-5 py-2.5 text-slate-600">{stats.active}</td>
                    <td className="px-5 py-2.5">
                      {stats.overTarget > 0 ? (
                        <span className="text-rose-600 font-medium">{stats.overTarget}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-slate-600">{openTasksByAssignee[name] || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="px-5 py-3 border-t border-slate-100">
            <button onClick={onGoToTasks} className="text-xs text-slate-500 hover:text-slate-700">לרשימת המשימות המלאה ←</button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl">
          <div className="px-5 py-4 border-b border-slate-100 font-medium text-slate-800">איפה תיקים תקועים</div>
          <ul className="divide-y divide-slate-100">
            <li className="px-5 py-3 flex items-center justify-between">
              <span className="text-sm text-slate-700">ממתינים ללקוח</span>
              <span className="text-sm font-semibold text-amber-600">{stuckCounts["on-client"]}</span>
            </li>
            <li className="px-5 py-3 flex items-center justify-between">
              <span className="text-sm text-slate-700">ממתינים לטיפול אצלנו</span>
              <span className="text-sm font-semibold text-rose-600">{stuckCounts["on-us"]}</span>
            </li>
            <li className="px-5 py-3 flex items-center justify-between">
              <span className="text-sm text-slate-700">מוכנים לאישור סופי</span>
              <span className="text-sm font-semibold text-sky-600">{stuckCounts["ready-for-approval"]}</span>
            </li>
          </ul>
          <div className="px-5 py-3 border-t border-slate-100">
            <button onClick={onGoToCases} className="text-xs text-slate-500 hover:text-slate-700">לרשימת התיקים המלאה ←</button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl mt-6">
        <div className="px-5 py-4 border-b border-slate-100 font-medium text-slate-800">תיקים שהוסלמו לאחראי ציות</div>
        {compliance.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="אין כרגע תיקים שהוסלמו לאחראי ציות" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {compliance.map((c) => (
              <li key={c.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-800">{c.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">עודכן {c.updatedAt}</div>
                </div>
                <button onClick={() => onOpenCase(c.id)} className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">
                  פתח תיק
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <PilotValueCard />
    </div>
  );
}

function PilotValueCard() {
  const stats = [
    { label: "תהליך קודם", value: "15 דקות" },
    { label: "תהליך עם המערכת", value: "8 דקות" },
    { label: "חיסכון", value: "7 דקות לתיק" },
    { label: "תיקים החודש", value: "42" },
    { label: "זמן שנחסך החודש", value: '4 שע\' ו-54 דק׳' },
  ];
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-slate-800">ערך שנוצר בפיילוט</div>
        <span className="text-xs px-2 py-1 rounded-md bg-slate-100 text-slate-500">נתוני הדגמה בלבד</span>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-4">
        {stats.map((s) => (
          <div key={s.label} className="border border-slate-100 rounded-lg px-3 py-2.5">
            <div className="text-base font-semibold text-slate-900">{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BeforeAfterCard() {
  const before = [
    "חיפוש ידני במסמכים ובמיילים",
    "שיחות חוזרות ללקוח לבירור סטטוס",
    "הקלדה חוזרת של פרטי התאגיד",
    "חוסר ודאות לגבי מה חסר בתיק",
  ];
  const after = [
    "רשימת חוסרים מוצגת אוטומטית",
    "בקשת השלמה ללקוח בלחיצה אחת",
    "נתונים שחולצו ממסמכים, לאישור מהיר",
    "כרטיס תאגיד ברור שמוכן לבדיקה",
  ];
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="text-sm font-medium text-slate-800">לפני ואחרי — מה משתנה בתהליך</div>
      <div className="grid grid-cols-2 gap-6 mt-4">
        <div>
          <div className="text-xs font-medium text-slate-500 mb-2">היום, ללא המערכת</div>
          <ul className="space-y-2">
            {before.map((item) => (
              <li key={item} className="text-sm text-slate-600 flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-2 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-xs font-medium text-slate-500 mb-2">עם Corporate Onboarding AI</div>
          <ul className="space-y-2">
            {after.map((item) => (
              <li key={item} className="text-sm text-slate-700 flex items-start gap-2">
                <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function UrgencyPill({ level }) {
  const map = {
    "גבוהה": "bg-rose-50 text-rose-700 border-rose-200",
    "בינונית": "bg-amber-50 text-amber-700 border-amber-200",
    "נמוכה": "bg-slate-100 text-slate-600 border-slate-200",
  };
  return <span className={`text-xs px-2 py-1 rounded-md border ${map[level]}`}>{level}</span>;
}

/* ---------------------------- Cases List ---------------------------- */

function CasesList({ cases, onOpenCase, onNewCase }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("הכל");

  const filtered = cases.filter((c) => {
    const matchesQuery =
      !query || c.name.includes(query) || c.companyNumber.includes(query);
    const matchesStatus = statusFilter === "הכל" || c.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">תיקים לתאגידים</h1>
        <button
          onClick={onNewCase}
          className="flex items-center gap-2 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-lg hover:bg-slate-950"
        >
          <Plus size={16} />
          פתיחת תאגיד חדש
        </button>
      </div>

      <div className="flex items-center gap-3 mt-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש לפי שם תאגיד או מספר חברה"
            className="w-full border border-slate-200 rounded-lg py-2 pr-9 pl-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-slate-200 rounded-lg py-2 px-3 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
        >
          {["הכל", ...Object.keys(STATUS_STYLES)].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl mt-5 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="text-right font-medium px-5 py-3">שם תאגיד</th>
              <th className="text-right font-medium px-5 py-3">מספר חברה</th>
              <th className="text-right font-medium px-5 py-3">סטטוס</th>
              <th className="text-right font-medium px-5 py-3">שלמות תיק</th>
              <th className="text-right font-medium px-5 py-3">משימה הבאה</th>
              <th className="text-right font-medium px-5 py-3">עודכן לאחרונה</th>
              <th className="text-right font-medium px-5 py-3">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((c) => {
              const { received, total } = completeness(c.documents, c);
              return (
                <tr
                  key={c.id}
                  onClick={() => onOpenCase(c.id)}
                  className="hover:bg-slate-50 cursor-pointer"
                >
                  <td className="px-5 py-3.5 font-medium text-slate-800">{c.name}</td>
                  <td className="px-5 py-3.5 text-slate-500">{c.companyNumber}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={c.status} /></td>
                  <td className="px-5 py-3.5"><ProgressBar received={received} total={total} /></td>
                  <td className="px-5 py-3.5 text-slate-600">
                    {c.documents.find((d) => d.status !== "התקבל")?.name || "אין פעולה נדרשת"}
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">{c.updatedAt}</td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenCase(c.id); }}
                      className="text-slate-900 text-sm hover:underline"
                    >
                      פתח תיק
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <EmptyState icon={Search} title="לא נמצאו תיקים" subtitle="נסה מונח חיפוש אחר או אפס את המסננים" />
        )}
      </div>
    </div>
  );
}

/* ---------------------------- Clients screen (simple) ---------------------------- */

function ClientsScreen({ cases, onOpenCase }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">לקוחות</h1>
      <p className="text-slate-500 mt-1">אנשי קשר מייצגים בכל תיק תאגיד. פרטי הקשר של הלקוח מוצגים מתוך התיק.</p>
      <div className="bg-white border border-slate-200 rounded-xl mt-6 divide-y divide-slate-100">
        {cases.map((c) => (
          <div key={c.id} className="px-5 py-4 flex items-center justify-between">
            <div>
              <div className="font-medium text-slate-800">{c.contactName || "אין איש קשר משויך"}</div>
              <div className="text-sm text-slate-500 mt-0.5">{c.name} · {c.contactEmail || "—"}</div>
            </div>
            <button onClick={() => onOpenCase(c.id)} className="text-sm text-slate-900 hover:underline">
              פתח תיק
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------- New Case Wizard ---------------------------- */

const WIZARD_STEPS = ["פרטי תאגיד", "נציג ומורשי פעולה", "רשימת מסמכים", "בדיקת שלמות", "שליחה ללקוח"];

function NewCaseWizard({ step, setStep, onCancel, onFinish, onSaveDraft }) {
  const [form, setForm] = useState({
    name: "", companyNumber: "", field: "", address: "",
    contactName: "", contactPhone: "", contactEmail: "", serviceType: SERVICE_TYPES[0].value,
    courierInvolved: false,
  });
  const [people, setPeople] = useState([]);
  const [personDraft, setPersonDraft] = useState({ fullName: "", role: "", partialId: "", phone: "", email: "", kind: "נציג" });
  const [docs, setDocs] = useState(() => buildRequirements(form.serviceType, []));
  const [suggestionState, setSuggestionState] = useState({});

  useEffect(() => {
    setDocs(buildRequirements(form.serviceType, []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.serviceType]);

  const canProceedStep1 = form.name.trim() && form.companyNumber.trim() && form.contactEmail.trim();

  function addPerson() {
    if (!personDraft.fullName.trim()) return;
    setPeople((prev) => [...prev, { id: `pw${Date.now()}`, ...personDraft }]);
    setPersonDraft({ fullName: "", role: "", partialId: "", phone: "", email: "", kind: "נציג" });
  }

  function cycleDoc(id) {
    setDocs((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        const idx = DOC_CYCLE.indexOf(d.status);
        const nextStatus = DOC_CYCLE[(idx + 1) % DOC_CYCLE.length];
        return {
          ...d,
          status: nextStatus,
          receivedAt: nextStatus === "חסר" ? null : "היום",
          uploadedBy: nextStatus === "חסר" ? null : "לקוח (סימולציה)",
        };
      })
    );
  }

  const activeDocsForSummary = docs.filter((d) => isDocActive(d, { serviceType: form.serviceType, people, courierInvolved: form.courierInvolved }));
  const received = activeDocsForSummary.filter((d) => d.status === "התקבל").length;
  const needsReview = activeDocsForSummary.filter((d) => d.status === "דורש בדיקה").length;
  const missing = activeDocsForSummary.filter((d) => d.status !== "התקבל" && d.status !== "דורש בדיקה");

  const suggestions = [
    { id: "s1", text: `זוהה שם התאגיד במסמך ההתאגדות: ${form.name || "תאגיד חדש"}.`, key: "name" },
    { id: "s2", text: "זוהה בעל שליטה במסמך בעלי השליטה.", key: "owner" },
    { id: "s3", text: "קיימת אי־התאמה בין שם הנציג בטופס לבין המסמך.", key: "rep" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">פתיחת תאגיד חדש</h1>
        <button onClick={onCancel} className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1">
          <X size={16} /> ביטול
        </button>
      </div>

      <div className="flex items-center gap-2 mt-6">
        {WIZARD_STEPS.map((label, i) => {
          const n = i + 1;
          const active = n === step;
          const done = n < step;
          return (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-2 w-full">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${
                    done ? "bg-emerald-500 text-white" : active ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {done ? <CheckCircle2 size={14} /> : n}
                </div>
                <div className={`text-xs ${active ? "text-slate-800 font-medium" : "text-slate-400"} truncate`}>{label}</div>
              </div>
              {n < WIZARD_STEPS.length && <div className="h-px bg-slate-200 flex-1" />}
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl mt-6 p-6">
        {step === 1 && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="שם התאגיד *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="מספר חברה *" value={form.companyNumber} onChange={(v) => setForm({ ...form, companyNumber: v })} placeholder="515000000" />
            <Field label="תחום פעילות" value={form.field} onChange={(v) => setForm({ ...form, field: v })} />
            <Field label="כתובת" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
            <Field label="איש קשר" value={form.contactName} onChange={(v) => setForm({ ...form, contactName: v })} />
            <Field label="טלפון" value={form.contactPhone} onChange={(v) => setForm({ ...form, contactPhone: v })} />
            <Field label="דוא״ל *" value={form.contactEmail} onChange={(v) => setForm({ ...form, contactEmail: v })} />
            <div>
              <label className="text-sm text-slate-600 block mb-1.5">סוג השירות המבוקש</label>
              <select
                value={form.serviceType}
                onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
                className="w-full border border-slate-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
              >
                {SERVICE_TYPES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <div className="text-xs text-slate-400 mt-1">הבחירה קובעת את רשימת הדרישות שתיווצר לתיק בשלב הבא.</div>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                id="courierInvolved"
                type="checkbox"
                checked={form.courierInvolved}
                onChange={(e) => setForm({ ...form, courierInvolved: e.target.checked })}
              />
              <label htmlFor="courierInvolved" className="text-sm text-slate-600">השירות מבוצע באמצעות שליח</label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="שם מלא" value={personDraft.fullName} onChange={(v) => setPersonDraft({ ...personDraft, fullName: v })} />
              <Field label="תפקיד" value={personDraft.role} onChange={(v) => setPersonDraft({ ...personDraft, role: v })} />
              <Field label="מספר מזהה חלקי (דמה)" value={personDraft.partialId} onChange={(v) => setPersonDraft({ ...personDraft, partialId: v })} placeholder="•••••1234" />
              <Field label="טלפון" value={personDraft.phone} onChange={(v) => setPersonDraft({ ...personDraft, phone: v })} />
              <Field label="דוא״ל" value={personDraft.email} onChange={(v) => setPersonDraft({ ...personDraft, email: v })} />
              <div>
                <label className="text-sm text-slate-600 block mb-1.5">סוג קשר</label>
                <select
                  value={personDraft.kind}
                  onChange={(e) => setPersonDraft({ ...personDraft, kind: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                >
                  <option>נציג</option>
                  <option>מורשה פעולה</option>
                  <option>בעל שליטה</option>
                </select>
              </div>
            </div>
            <button
              onClick={addPerson}
              className="mt-4 flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50"
            >
              <UserPlus size={16} /> הוסף לרשימה
            </button>

            <div className="mt-5">
              {people.length === 0 ? (
                <EmptyState icon={Users} title="עדיין לא נוספו אנשי קשר" subtitle="הוסף נציגים, מורשי פעולה ובעלי שליטה" />
              ) : (
                <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {people.map((p) => (
                    <li key={p.id} className="px-4 py-3 flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium text-slate-800">{p.fullName}</span>
                        <span className="text-slate-400 mx-2">·</span>
                        <span className="text-slate-500">{p.role || "ללא תפקיד"}</span>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-md bg-slate-100 text-slate-600">{p.kind}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="text-sm text-slate-600 mb-3">
              רשימת הדרישות נוצרה לפי סוג השירות שנבחר: <span className="font-medium text-slate-800">{serviceLabel(form.serviceType)}</span>
            </div>
            {(() => {
              const wizardCtx = { serviceType: form.serviceType, people, courierInvolved: form.courierInvolved };
              const activeDocs = docs.filter((d) => isDocActive(d, wizardCtx));
              const inactiveDocs = docs.filter((d) => !isDocActive(d, wizardCtx));
              return (
                <>
                  <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                    {activeDocs.map((d) => (
                      <li key={d.id} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-sm text-slate-700">
                              <FileText size={16} className="text-slate-400 shrink-0" />
                              <span className="truncate">{d.name}</span>
                              <RequirementKindBadge mandatory={d.mandatory} />
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">{d.reason}</div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <DocStatusBadge status={d.status} />
                            <button
                              onClick={() => cycleDoc(d.id)}
                              className="text-xs flex items-center gap-1 text-slate-900 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-50"
                            >
                              <Upload size={13} /> סימולציית העלאת מסמך
                            </button>
                          </div>
                        </div>
                        <div className="text-xs text-slate-400 mt-1.5 flex items-center gap-3 flex-wrap">
                          <span>מי מספק: {d.providedBy}</span>
                          <span>פעולה הבאה: {nextActionForStatus(d.status)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {inactiveDocs.length > 0 && (
                    <div className="mt-4">
                      <div className="text-sm font-medium text-slate-500 mb-2">דרישות מותנות שלא הופעלו בתיק זה</div>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg divide-y divide-slate-200">
                        {inactiveDocs.map((d) => (
                          <div key={d.id} className="px-4 py-2.5 flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                              <FileText size={14} className="text-slate-400 shrink-0" />
                              <span className="truncate">{d.name}</span>
                              <RequirementKindBadge mandatory={d.mandatory} />
                            </div>
                            <div className="text-xs text-slate-400">{d.conditionLabel}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
            <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mt-3">
              הרשימה היא דוגמה הניתנת להגדרה ואינה ייעוץ משפטי או רשימה רגולטורית סופית.
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <div className="grid grid-cols-4 gap-3">
              <MiniStat label="מסמכים התקבלו" value={received} tone="text-emerald-600" />
              <MiniStat label="מסמכים חסרים" value={missing.length} tone="text-rose-600" />
              <MiniStat label="דורשים בדיקה" value={needsReview} tone="text-amber-600" />
              <MiniStat label="שדות לאישור" value={2} tone="text-sky-600" />
            </div>

            <div className="mt-6">
              <div className="text-sm font-medium text-slate-700 mb-3">הצעות AI</div>
              <div className="space-y-2">
                {suggestions.map((s) => {
                  const state = suggestionState[s.id] || "pending";
                  return (
                    <div key={s.id} className="flex items-start justify-between gap-4 border border-sky-100 bg-sky-50/60 rounded-lg px-4 py-3">
                      <div className="flex items-start gap-2">
                        <Sparkles size={15} className="text-sky-500 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-sm text-slate-700">{s.text}</span>
                          {state === "flagged" && (
                            <div className="text-xs text-amber-700 mt-1">סומן לתיקון על ידי דניאל כהן</div>
                          )}
                          {state === "opened" && (
                            <div className="text-xs text-slate-500 mt-1">המסמך המקורי נפתח לצפייה (סימולציה)</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {state === "approved" ? (
                          <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 size={13} /> אושר</span>
                        ) : (
                          <>
                            <button onClick={() => setSuggestionState((p) => ({ ...p, [s.id]: "approved" }))} className="text-xs px-2.5 py-1 rounded-md border border-slate-200 hover:bg-white">אשר</button>
                            <button onClick={() => setSuggestionState((p) => ({ ...p, [s.id]: "flagged" }))} className="text-xs px-2.5 py-1 rounded-md border border-slate-200 hover:bg-white">תקן</button>
                            <button onClick={() => setSuggestionState((p) => ({ ...p, [s.id]: "opened" }))} className="text-xs px-2.5 py-1 rounded-md border border-slate-200 hover:bg-white">פתח מסמך</button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 flex items-center gap-2">
              <Info size={14} className="shrink-0" />
              המערכת מציעה בדיקות. אישור סופי מבוצע על ידי עובד מורשה.
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <div className="text-sm font-medium text-slate-700 mb-2">פריטים חסרים לשליחה ללקוח</div>
            {missing.length === 0 ? (
              <div className="text-sm text-slate-500 mb-4">לא נותרו פריטים חסרים לפי נתוני הדמה.</div>
            ) : (
              <ul className="list-disc pr-5 text-sm text-slate-600 space-y-1 mb-4">
                {missing.map((m) => <li key={m.id}>{m.name}</li>)}
              </ul>
            )}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700 leading-relaxed">
              שלום {form.contactName || "[שם איש הקשר]"}, כדי להשלים את פתיחת התיק של {form.name || "[שם התאגיד]"} נדרש להעלות את הפריטים הבאים:{" "}
              {missing.length ? missing.map((m) => m.name).join(", ") : "אין פריטים חסרים"}. ניתן להשלים אותם בקישור המאובטח.
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-5">
        <button
          onClick={() => (step === 1 ? onCancel() : setStep(step - 1))}
          className="text-sm px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          {step === 1 ? "ביטול" : "חזרה"}
        </button>

        {step < 5 ? (
          <button
            disabled={step === 1 && !canProceedStep1}
            onClick={() => setStep(step + 1)}
            className="text-sm px-5 py-2.5 rounded-lg bg-slate-900 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-950"
          >
            המשך
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={() => onSaveDraft({ ...form, people, documents: docs })}
              className="text-sm px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              שמור כטיוטה
            </button>
            <button
              onClick={() => onFinish({ ...form, people, documents: docs })}
              className="flex items-center gap-2 text-sm px-5 py-2.5 rounded-lg bg-slate-900 text-white hover:bg-slate-950"
            >
              <Send size={15} /> שלח בקשת השלמה
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="text-sm text-slate-600 block mb-1.5">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-slate-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900"
      />
    </div>
  );
}

function MiniStat({ label, value, tone }) {
  return (
    <div className="border border-slate-200 rounded-lg p-3">
      <div className={`text-xl font-semibold ${tone}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}

/* ---------------------------- Case Detail ---------------------------- */

const CASE_TABS = ["סקירה", "פרטי תאגיד", "בעלות ונציגים", "מסמכים", "זיהוי מרחוק", "טפסים", "משימות ותקשורת", "יומן פעילות"];

function ReadinessChecklistCard({ c }) {
  if (c.status === "אושר") return null;
  const checklist = getReadinessChecklist(c);
  const ready = checklist.every((item) => item.met);
  return (
    <div className={`rounded-xl border p-4 ${ready ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200"}`}>
      <div className="text-sm font-medium text-slate-800">
        {ready ? "כל התנאים מתקיימים — התיק מוכן לבדיקה" : "מה עדיין נדרש כדי להעביר את התיק ל\"מוכן לבדיקה\""}
      </div>
      <ul className="mt-3 space-y-3">
        {checklist.map((item) => (
          <li key={item.id} className="flex items-start gap-2">
            {item.met ? (
              <CheckCircle2 size={15} className="text-emerald-500 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle size={15} className="text-amber-500 mt-0.5 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm text-slate-700">{item.label}</div>
              {item.met ? (
                <div className="text-xs text-slate-500 mt-0.5">{item.emptyDetail}</div>
              ) : (
                <ul className="mt-1 space-y-1">
                  {item.items.map((text, i) => (
                    <li key={i} className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 inline-block ml-1 mb-1">
                      {text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CaseDetail({ c, activity, tab, onTabChange, onBack, onUploadDocument, onCompleteMissingDocs, onViewDocument, onSendReminder, onOpenCompletionRequest, onApprove, onExport, onAddPerson, onSetSuggestionState, onSetRemoteIdRepName, onUploadIdPhoto, onUploadSelfie, onDecideRemoteId, onOpenFormPreview, onOpenClientPortal, onAddCourier, onSetPrimaryOwner, onToggleProtocolChecklist, onSendPortalLink }) {
  const [personDraft, setPersonDraft] = useState({ fullName: "", role: "", partialId: "", phone: "", email: "", kind: "נציג" });
  const { received, total } = completeness(c.documents, c);
  const missingCount = c.documents.filter((d) => d.status === "חסר").length;
  const issues = getCaseIssues(c);

  function handleIssueAction(issue) {
    if (issue.kind === "completion") onOpenCompletionRequest();
    else if (issue.kind === "reminder") onSendReminder();
    else if (issue.kind === "ai") onTabChange("סקירה");
    else if (issue.kind === "review-doc") onTabChange("מסמכים");
    else if (issue.kind === "remote-id") onTabChange("זיהוי מרחוק");
    else if (issue.kind === "approve") onApprove();
  }

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft size={16} className="rotate-180" /> חזרה לרשימת התיקים
      </button>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Building2 size={20} className="text-slate-400" />
              <h1 className="text-xl font-semibold text-slate-900">{c.name}</h1>
              <StatusBadge status={c.status} />
            </div>
            <div className="text-sm text-slate-500 mt-2 flex items-center gap-4 flex-wrap">
              <span>מספר חברה {c.companyNumber}</span>
              <span>עובד מטפל: {c.assignee}</span>
              <span>עודכן: {c.updatedAt}</span>
              <span>זיהוי נציג: {remoteIdStatusLabel(c.remoteId)}</span>
              <span>משימה הבאה: {issues[0]?.text || "אין פעולה נדרשת"}</span>
            </div>
          </div>
          <div className="text-left">
            <div className="text-xs text-slate-500 mb-1">שלמות תיק</div>
            <ProgressBar received={received} total={total} />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-5 flex-wrap">
          <ActionButton icon={Link2} label="שלח קישור ללקוח" onClick={onSendPortalLink} />
          <ActionButton icon={FileText} label="שלח בקשת השלמה" onClick={onOpenCompletionRequest} />
          <ActionButton icon={Send} label="שלח תזכורת" onClick={onSendReminder} />
          <ActionButton icon={CheckCircle2} label="העבר לאישור" onClick={onApprove} />
          <ActionButton icon={ArrowUpRight} label="ייצא לישות/חשבשבת" onClick={onExport} />
        </div>

        {issues.length > 0 && (
          <div className="mt-5 pt-5 border-t border-slate-100">
            <div className="text-sm font-medium text-slate-800 mb-3">מה דורש טיפול עכשיו</div>
            <ul className="space-y-2">
              {issues.map((issue) => (
                <li key={issue.id} className="flex items-center justify-between gap-4 bg-slate-50 border border-slate-100 rounded-lg px-3.5 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <UrgencyPill level={issue.urgency} />
                    <span className="text-sm text-slate-700 truncate">{issue.text}</span>
                  </div>
                  <button
                    onClick={() => handleIssueAction(issue)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 shrink-0"
                  >
                    {issue.actionLabel}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 mt-6 border-b border-slate-200">
        {CASE_TABS.map((t) => (
          <button
            key={t}
            onClick={() => onTabChange(t)}
            className={`px-4 py-2.5 text-sm border-b-2 -mb-px ${
              tab === t ? "border-slate-900 text-slate-900 font-medium" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "סקירה" && (
          <div className="space-y-4">
            <ReadinessChecklistCard c={c} />

            {c.aiSuggestions.length > 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-sm font-medium text-slate-700 mb-3">הצעות AI</div>
                <div className="space-y-2">
                  {c.aiSuggestions.map((s) => (
                    <div key={s.id} className="border border-slate-100 rounded-lg px-3.5 py-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-2 min-w-0">
                          <Sparkles size={15} className="text-sky-500 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-sm text-slate-700">{s.text}</div>
                            <div className="text-xs text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                              <span>מקור: {s.source}</span>
                              <span>רמת זיהוי טכנית: {s.confidence}</span>
                            </div>
                            {s.state === "flagged" && <div className="text-xs text-amber-700 mt-1">סומן לתיקון על ידי {c.assignee}</div>}
                            {s.state === "opened" && <div className="text-xs text-slate-500 mt-1">המסמך המקורי נפתח לצפייה (סימולציה)</div>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {s.state === "approved" ? (
                            <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 size={13} /> אושר</span>
                          ) : (
                            <>
                              <button onClick={() => onSetSuggestionState(s.id, "approved")} className="text-xs px-2.5 py-1 rounded-md border border-slate-200 hover:bg-slate-50">אשר</button>
                              <button onClick={() => onSetSuggestionState(s.id, "flagged")} className="text-xs px-2.5 py-1 rounded-md border border-slate-200 hover:bg-slate-50">תקן</button>
                              <button onClick={() => onSetSuggestionState(s.id, "opened")} className="text-xs px-2.5 py-1 rounded-md border border-slate-200 hover:bg-slate-50">פתח מסמך</button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
                  הצעת AI אינה אישור רגולטורי. יש לאמת את הנתון מול המסמך המקורי.
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <EmptyState icon={Sparkles} title="אין הצעות AI פתוחות לתיק זה" />
              </div>
            )}
          </div>
        )}

        {tab === "פרטי תאגיד" && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-2 gap-4 text-sm">
            <DetailRow label="שם תאגיד" value={c.name} source="תעודת התאגדות" />
            <DetailRow label="מספר חברה" value={c.companyNumber} source="תעודת התאגדות" />
            <DetailRow label="תחום פעילות" value={c.field} source="טופס פתיחה" />
            <DetailRow label="כתובת" value={c.address} source="טופס פתיחה" />
            <DetailRow label="איש קשר" value={c.contactName} source="טופס פתיחה" />
            <DetailRow label="טלפון" value={c.contactPhone} source="טופס פתיחה" />
            <DetailRow label="דוא״ל" value={c.contactEmail} source="טופס פתיחה" />
            <DetailRow label="סוג שירות" value={serviceLabel(c.serviceType)} source="טופס פתיחה" />
          </div>
        )}

        {tab === "בעלות ונציגים" && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              {c.people.length === 0 ? (
                <EmptyState icon={Users} title="אין עדיין אנשי קשר בתיק" />
              ) : (
                <ul className="divide-y divide-slate-100 mb-5">
                  {c.people.map((p) => (
                    <li key={p.id} className="py-3 flex items-center justify-between text-sm">
                      <div>
                        <div className="font-medium text-slate-800 flex items-center gap-2">
                          {p.fullName}
                          {p.primaryOwner && (
                            <span className="text-xs px-1.5 py-0.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-700">בעל שליטה ראשי</span>
                          )}
                          {p.verifiedRemoteId && (
                            <span className="text-xs px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 flex items-center gap-1">
                              <CheckCircle2 size={11} /> זוהה מרחוק
                            </span>
                          )}
                        </div>
                        <div className="text-slate-500 text-xs mt-0.5">{p.role} · {p.phone} · {p.email}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {p.kind === "בעל שליטה" && !p.primaryOwner && (
                          <button onClick={() => onSetPrimaryOwner(p.id)} className="text-xs text-slate-500 hover:text-slate-700 underline">
                            הגדר כראשי
                          </button>
                        )}
                        <span className="text-xs px-2 py-1 rounded-md bg-slate-100 text-slate-600">{p.kind}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="grid grid-cols-3 gap-3">
                <Field label="שם מלא" value={personDraft.fullName} onChange={(v) => setPersonDraft({ ...personDraft, fullName: v })} />
                <Field label="תפקיד" value={personDraft.role} onChange={(v) => setPersonDraft({ ...personDraft, role: v })} />
                <div>
                  <label className="text-sm text-slate-600 block mb-1.5">סוג קשר</label>
                  <select
                    value={personDraft.kind}
                    onChange={(e) => setPersonDraft({ ...personDraft, kind: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                  >
                    <option>נציג</option>
                    <option>מורשה פעולה</option>
                    <option>בעל שליטה</option>
                  </select>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!personDraft.fullName.trim()) return;
                  onAddPerson({ ...personDraft, id: `p${Date.now()}`, partialId: "•••••0000", phone: "", email: "" });
                  setPersonDraft({ fullName: "", role: "", partialId: "", phone: "", email: "", kind: "נציג" });
                }}
                className="mt-3 flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                <UserPlus size={16} /> הוסף לרשימה
              </button>
            </div>

            <CourierSection c={c} onAddCourier={onAddCourier} />
          </div>
        )}

        {tab === "מסמכים" && (
          <div>
            {(() => {
              const summary = getRequirementsSummary(c);
              const activeDocs = c.documents.filter((d) => isDocActive(d, c));
              const inactiveDocs = c.documents.filter((d) => !isDocActive(d, c));
              return (
                <>
                  <div className="grid grid-cols-4 gap-3 mb-3">
                    <div className="bg-white border border-slate-200 rounded-xl p-3">
                      <div className="text-lg font-semibold text-emerald-600">{summary.approved.length}</div>
                      <div className="text-xs text-slate-500 mt-0.5">מסמכים מאושרים</div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-3">
                      <div className="text-lg font-semibold text-amber-600">{summary.pendingReview.length}</div>
                      <div className="text-xs text-slate-500 mt-0.5">ממתינים לבדיקה</div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-3">
                      <div className="text-lg font-semibold text-rose-600">{summary.missing.length}</div>
                      <div className="text-xs text-slate-500 mt-0.5">מסמכים חסרים</div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-3">
                      <div className="text-lg font-semibold text-slate-500">{summary.inactiveConditional.length}</div>
                      <div className="text-xs text-slate-500 mt-0.5">דרישות מותנות שלא הופעלו</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 flex-wrap bg-white border border-slate-200 rounded-xl p-4 mb-3">
                    <div className="text-sm text-slate-600">
                      מסמכים ב"דורש בדיקה" או "ממתין ללקוח" דורשים בדיקה אנושית ואינם הופכים ל"התקבל" אוטומטית.
                    </div>
                    <button
                      onClick={onCompleteMissingDocs}
                      disabled={missingCount === 0}
                      className="text-xs flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-950 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    >
                      <Upload size={13} /> סימולציה: הלקוח השלים את המסמך החסר
                    </button>
                  </div>
                  <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-3">
                    רשימת הדרישות מותאמת לסוג השירות "{serviceLabel(c.serviceType)}" ולנסיבות התיק (אנשי קשר, שימוש בשליח). זוהי דוגמה הניתנת להגדרה ואינה ייעוץ משפטי או רשימה רגולטורית סופית.
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {activeDocs.map((d) => (
                      <div key={d.id} className="px-5 py-3.5">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-sm text-slate-700">
                              <FileText size={16} className="text-slate-400 shrink-0" />
                              <span className="truncate">{d.name}</span>
                              <RequirementKindBadge mandatory={d.mandatory} />
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">{d.reason}</div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <DocStatusBadge status={d.status} />
                            {d.status !== "חסר" && (
                              <button
                                onClick={() => onViewDocument(d.id)}
                                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
                              >
                                צפייה
                              </button>
                            )}
                            <button
                              onClick={() => onUploadDocument(d.id)}
                              className="text-xs flex items-center gap-1 text-slate-900 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-50"
                            >
                              <RefreshCw size={13} /> {d.status === "חסר" ? "סימולציית העלאה" : "החלפה / העלאה מחדש"}
                            </button>
                          </div>
                        </div>
                        <div className="text-xs text-slate-400 mt-1.5 flex items-center gap-3 flex-wrap">
                          <span>מי מספק: {d.providedBy}</span>
                          <span>פעולה הבאה: {nextActionForStatus(d.status)}</span>
                          {d.status !== "חסר" && <span>התקבל {d.receivedAt} · {d.uploadedBy}</span>}
                        </div>
                        {d.note && (
                          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5 mt-2 inline-block">
                            {d.note}
                          </div>
                        )}
                        {d.verificationChecklist && (
                          <div className="mt-2.5 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
                            <div className="text-xs text-slate-500 mb-1.5">שדות בדיקה — נדרשים לפני שהמסמך יכול להיחשב "התקבל"</div>
                            <div className="grid grid-cols-2 gap-1.5">
                              {PROTOCOL_CHECKLIST_FIELDS.map((field) => (
                                <label key={field} className="flex items-center gap-1.5 text-xs text-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={!!d.verificationChecklist[field]}
                                    onChange={() => onToggleProtocolChecklist(d.id, field)}
                                  />
                                  {PROTOCOL_CHECKLIST_LABELS[field]}
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {inactiveDocs.length > 0 && (
                    <div className="mt-4">
                      <div className="text-sm font-medium text-slate-500 mb-2">דרישות מותנות שלא הופעלו בתיק זה</div>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl divide-y divide-slate-200">
                        {inactiveDocs.map((d) => (
                          <div key={d.id} className="px-5 py-2.5 flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                              <FileText size={14} className="text-slate-400 shrink-0" />
                              <span className="truncate">{d.name}</span>
                              <RequirementKindBadge mandatory={d.mandatory} />
                            </div>
                            <div className="text-xs text-slate-400">{d.conditionLabel}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {tab === "זיהוי מרחוק" && (
          <RemoteIdPanel
            c={c}
            onSetRepName={onSetRemoteIdRepName}
            onUploadIdPhoto={onUploadIdPhoto}
            onUploadSelfie={onUploadSelfie}
            onDecide={onDecideRemoteId}
          />
        )}

        {tab === "טפסים" && (
          <FormsTab c={c} onOpenForm={onOpenFormPreview} onOpenPortal={onOpenClientPortal} />
        )}

        {tab === "משימות ותקשורת" && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <EmptyState icon={ListChecks} title="אין תקשורת נוספת בתיק זה" subtitle="תזכורות ובקשות ישלחו כסימולציה ויתועדו ביומן הפעילות" />
          </div>
        )}

        {tab === "יומן פעילות" && (
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {activity.length === 0 ? (
              <EmptyState icon={Clock} title="אין עדיין פעילות מתועדת" />
            ) : (
              activity.map((e) => (
                <div key={e.id} className="px-5 py-3.5">
                  <div className="text-sm text-slate-700">{e.text}</div>
                  <div className="text-xs text-slate-400 mt-1">{e.time}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 text-sm px-3.5 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

function DetailRow({ label, value, source }) {
  return (
    <div className="border border-slate-100 rounded-lg px-3 py-2.5">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-slate-800 mt-0.5">{value || "—"}</div>
      <div className="text-xs text-slate-400 mt-1">מקור: {source}</div>
    </div>
  );
}

function CourierSection({ c, onAddCourier }) {
  const [draft, setDraft] = useState({ fullName: "", idNumber: "", dob: "", gender: "", address: "", phone: "", email: "" });
  const couriers = c.couriers || [];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-800 mb-1">
        <Truck size={16} className="text-slate-400" /> שליחים
      </div>
      <div className="text-xs text-slate-500 mb-4">כל שליח מנוהל כרשומה נפרדת, עם מסמכים וטפסים משלו (ראו טאב "טפסים").</div>

      {couriers.length === 0 ? (
        <EmptyState icon={Truck} title="אין עדיין שליחים בתיק" />
      ) : (
        <ul className="divide-y divide-slate-100 mb-5">
          {couriers.map((k) => (
            <li key={k.id} className="py-3 flex items-center justify-between text-sm">
              <div>
                <div className="font-medium text-slate-800">{k.fullName}</div>
                <div className="text-slate-500 text-xs mt-0.5">{k.phone} · {k.email} · מ.ז {k.idNumber}</div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-md border ${k.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                {k.active ? "פעיל" : "לא פעיל"}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Field label="שם מלא" value={draft.fullName} onChange={(v) => setDraft({ ...draft, fullName: v })} />
        <Field label="מספר זהות (דמה)" value={draft.idNumber} onChange={(v) => setDraft({ ...draft, idNumber: v })} placeholder="•••••0000" />
        <Field label="תאריך לידה" value={draft.dob} onChange={(v) => setDraft({ ...draft, dob: v })} placeholder="DD/MM/YYYY" />
        <Field label="מין" value={draft.gender} onChange={(v) => setDraft({ ...draft, gender: v })} />
        <Field label="כתובת" value={draft.address} onChange={(v) => setDraft({ ...draft, address: v })} />
        <Field label="טלפון" value={draft.phone} onChange={(v) => setDraft({ ...draft, phone: v })} />
        <Field label="דוא״ל" value={draft.email} onChange={(v) => setDraft({ ...draft, email: v })} />
      </div>
      <button
        onClick={() => {
          if (!draft.fullName.trim()) return;
          onAddCourier(draft);
          setDraft({ fullName: "", idNumber: "", dob: "", gender: "", address: "", phone: "", email: "" });
        }}
        className="mt-3 flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50"
      >
        <UserPlus size={16} /> הוסף שליח
      </button>
    </div>
  );
}

function RemoteIdPanel({ c, onSetRepName, onUploadIdPhoto, onUploadSelfie, onDecide }) {
  const r = c.remoteId || { repName: "", idPhoto: false, selfie: false, decision: null, decidedBy: null, decidedAt: null };
  const bothCaptured = r.idPhoto && r.selfie;
  const awaitingDecision = bothCaptured && !r.decision;
  const locked = r.decision === "approved";

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="text-sm font-medium text-slate-800 mb-1">זיהוי מרחוק של נציג התאגיד</div>
        <div className="text-xs text-slate-500 mb-4">סטטוס נוכחי: {remoteIdStatusLabel(r)}</div>

        <div className="mb-5">
          <div className="text-xs font-medium text-slate-500 mb-1.5">1. פרטי נציג</div>
          <input
            value={r.repName}
            onChange={(e) => onSetRepName(e.target.value)}
            placeholder="שם הנציג המזוהה"
            disabled={locked}
            className="w-full max-w-sm border border-slate-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1.5">2. צילום תעודת זהות</div>
            {r.idPhoto ? (
              <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-5 flex flex-col items-center gap-2">
                <FileText size={26} className="text-emerald-500" />
                <div className="text-xs text-emerald-700 text-center">התקבל — placeholder בלבד, ללא תמונה אמיתית</div>
              </div>
            ) : (
              <button
                onClick={onUploadIdPhoto}
                disabled={!r.repName}
                className="w-full border border-dashed border-slate-300 rounded-lg p-5 flex flex-col items-center gap-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Upload size={22} />
                <span className="text-xs text-center">העלה צילום תעודת זהות — סימולציה</span>
              </button>
            )}
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1.5">3. צילום סלפי</div>
            {r.selfie ? (
              <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-5 flex flex-col items-center gap-2">
                <Camera size={26} className="text-emerald-500" />
                <div className="text-xs text-emerald-700 text-center">התקבל — placeholder בלבד, ללא תמונה אמיתית</div>
              </div>
            ) : (
              <button
                onClick={onUploadSelfie}
                disabled={!r.repName}
                className="w-full border border-dashed border-slate-300 rounded-lg p-5 flex flex-col items-center gap-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Camera size={22} />
                <span className="text-xs text-center">צלם סלפי — סימולציה</span>
              </button>
            )}
          </div>
        </div>
        <div className="text-xs text-slate-400 -mt-3 mb-5">אין הפעלה של מצלמה אמיתית ואין בקשת הרשאות מצלמה — הכפתורים מדמים קבלת תמונה בלבד.</div>

        {bothCaptured && (
          <div className="bg-sky-50 border border-sky-200 rounded-lg px-4 py-3 mb-5 text-sm text-sky-800">
            4. בדיקת התאמה טכנית הושלמה — נדרשת בדיקה ואישור של עובד מורשה.
          </div>
        )}

        {awaitingDecision && (
          <div>
            <div className="text-xs font-medium text-slate-500 mb-2">5. אישור אנושי</div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => onDecide("approved")} className="text-sm px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-950">
                אשר בדיקת זיהוי
              </button>
              <button onClick={() => onDecide("retry")} className="text-sm px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">
                בקש ניסיון חוזר
              </button>
              <button onClick={() => onDecide("compliance")} className="text-sm px-4 py-2 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50">
                העבר לאחראי ציות
              </button>
            </div>
          </div>
        )}

        {r.decision === "approved" && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex items-start gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
            <div className="text-sm text-emerald-800">
              זיהוי הנציג {r.repName} אושר על ידי {r.decidedBy}{r.decidedAt ? ` (${r.decidedAt})` : ""}. הנציג קושר לתאגיד ברשימת "בעלות ונציגים".
            </div>
          </div>
        )}
        {r.decision === "compliance" && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 text-sm text-indigo-800">
            התיק הועבר לבדיקת אחראי ציות — ממתין להחלטה נוספת. נפתחה משימת מעקב במסך המשימות.
          </div>
        )}
      </div>

      <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-2">
        <ShieldAlert size={15} className="mt-0.5 shrink-0" />
        גרסה זו היא סימולציה בלבד. זיהוי מרחוק אמיתי דורש ספק זיהוי מתאים, בקרות אבטחה, אישור אחראי ציות ובדיקה משפטית.
      </div>
    </div>
  );
}

/* ---------------------------- Tasks ---------------------------- */

function TasksScreen({ tasks, onMarkDone, onSnooze, onOpenCase }) {
  const [showDone, setShowDone] = useState(false);
  const visible = tasks.filter((t) => (showDone ? true : t.status === "פתוחה"));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">משימות</h1>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          הצג גם משימות שהושלמו
        </label>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl mt-5 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="text-right font-medium px-5 py-3">סוג משימה</th>
              <th className="text-right font-medium px-5 py-3">תאגיד</th>
              <th className="text-right font-medium px-5 py-3">עדיפות</th>
              <th className="text-right font-medium px-5 py-3">אחראי</th>
              <th className="text-right font-medium px-5 py-3">תאריך יעד</th>
              <th className="text-right font-medium px-5 py-3">סטטוס</th>
              <th className="text-right font-medium px-5 py-3">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-5 py-3.5 text-slate-800">{t.type}</td>
                <td className="px-5 py-3.5">
                  <button onClick={() => onOpenCase(t.caseId)} className="text-slate-900 hover:underline">{t.caseName}</button>
                </td>
                <td className="px-5 py-3.5"><UrgencyPill level={t.priority} /></td>
                <td className="px-5 py-3.5 text-slate-600">{t.assignee}</td>
                <td className="px-5 py-3.5 text-slate-600">{t.due}</td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs px-2 py-1 rounded-md border ${t.status === "הושלמה" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                    {t.status}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  {t.status !== "הושלמה" && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => onMarkDone(t.id)} className="text-xs px-2.5 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50">סמן כהושלמה</button>
                      <button onClick={() => onSnooze(t.id)} className="text-xs px-2.5 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50">דחה</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <EmptyState icon={ListChecks} title="אין משימות פתוחות" subtitle="כל הכבוד, אין כרגע פעולות ממתינות" />}
      </div>
    </div>
  );
}

/* ---------------------------- Settings ---------------------------- */

function SettingsScreen({ showToast, branchSettings, onSaveBranchSettings }) {
  const [checking, setChecking] = useState(null);
  const [branchDraft, setBranchDraft] = useState(branchSettings);
  const [backendStatus, setBackendStatus] = useState(getBackendMode());

  useEffect(() => {
    const interval = setInterval(() => setBackendStatus(getBackendMode()), 1000);
    return () => clearInterval(interval);
  }, []);

  function testConnection(system) {
    setChecking(system);
    setTimeout(() => {
      setChecking(null);
      showToast(`בדיקת החיבור ל־${system} הסתיימה בסימולציה — אין חיבור אמיתי`);
    }, 1200);
  }

  function configureConnection(system) {
    showToast(`הגדרת חיבור ל־${system} תתאפשר לאחר קבלת הרשאות ומפרט API`);
  }

  const backendLabel = { checking: "בודק חיבור…", supabase: "מחובר ל-Supabase", local: "עובד במצב מקומי (localStorage)" }[backendStatus];
  const backendStyle = backendStatus === "supabase"
    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
    : "text-slate-600 bg-slate-50 border-slate-200";

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">הגדרות חיבור</h1>
      <p className="text-slate-500 mt-1">חיבורים למערכות הליבה. בשלב הפיילוט כל הנתונים הם נתוני דמה.</p>

      <div className="bg-white border border-slate-200 rounded-xl p-5 mt-6">
        <div className="flex items-center justify-between">
          <div className="font-medium text-slate-800">בסיס נתונים</div>
          <Plug size={18} className="text-slate-400" />
        </div>
        <div className={`text-sm border rounded-md px-3 py-2 mt-3 inline-block ${backendStyle}`}>
          {backendLabel}
        </div>
        <div className="text-xs text-slate-400 mt-2">
          זהו מצב אמיתי, לא מדומה — האפליקציה בודקת חיבור בפועל ועוברת אוטומטית לעבודה מקומית אם אין חיבור זמין.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 mt-5">
        {["ישות", "חשבשבת"].map((system) => (
          <div key={system} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div className="font-medium text-slate-800">{system}</div>
              <Plug size={18} className="text-slate-400" />
            </div>
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-3 inline-block">
              חיבור לדוגמה — טרם הוגדר
            </div>
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => testConnection(system)}
                className="text-sm px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-2"
              >
                {checking === system ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                בדיקת חיבור
              </button>
              <button
                onClick={() => configureConnection(system)}
                className="text-sm px-3.5 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-950"
              >
                הגדרת חיבור
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 flex items-start gap-2">
        <Info size={15} className="mt-0.5 shrink-0" />
        בגרסת הפיילוט אנו עובדים עם נתוני דמה. חיבור אמיתי יבוצע רק לאחר קבלת הרשאות, מפרט API ואישור בעל המערכת.
      </div>

      <div className="grid grid-cols-2 gap-5 mt-8">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="font-medium text-slate-800 mb-4">פרטי נותן השירות</div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="שם נותן השירות" value={branchDraft.serviceProviderName} onChange={(v) => setBranchDraft({ ...branchDraft, serviceProviderName: v })} placeholder="שם נותן השירות" />
            <Field label="מספר חברה של נותן השירות" value={branchDraft.serviceProviderCompanyNumber} onChange={(v) => setBranchDraft({ ...branchDraft, serviceProviderCompanyNumber: v })} placeholder="מספר חברה" />
          </div>
          <div className="text-xs text-slate-400 mt-2">
            שדות אלה מוצגים בפורטל הלקוח ובכותרות הטפסים. כשריקים, מוצגים placeholders ניטרליים בלבד.
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="font-medium text-slate-800 mb-4">פרטי הסניף</div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="שם הסניף" value={branchDraft.branchName} onChange={(v) => setBranchDraft({ ...branchDraft, branchName: v })} />
            <Field label="מספר סניף" value={branchDraft.branchNumber} onChange={(v) => setBranchDraft({ ...branchDraft, branchNumber: v })} />
            <Field label="מספר משתמשים" value={branchDraft.userCount} onChange={(v) => setBranchDraft({ ...branchDraft, userCount: v })} />
            <Field label="יעד זמן לפתיחת תיק (דקות)" value={branchDraft.targetMinutes} onChange={(v) => setBranchDraft({ ...branchDraft, targetMinutes: v })} />
            <div>
              <label className="text-sm text-slate-600 block mb-1.5">מדיניות תזכורות</label>
              <select
                value={branchDraft.reminderPolicy}
                onChange={(e) => setBranchDraft({ ...branchDraft, reminderPolicy: e.target.value })}
                className="w-full border border-slate-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
              >
                {REMINDER_POLICIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={() => onSaveBranchSettings(branchDraft)}
            className="mt-4 text-sm px-4 py-2.5 rounded-lg bg-slate-900 text-white hover:bg-slate-950"
          >
            שמור הגדרות סניף
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="font-medium text-slate-800">מודל שימוש: לפי סניף</div>
          <div className="text-sm text-slate-600 mt-3 leading-relaxed">
            החיוב בפיילוט מבוסס על פעילות הסניף <span className="font-medium text-slate-800">{branchSettings.branchName}</span> (מס' {branchSettings.branchNumber}), ולא לפי משתמש בודד.
            הסניף כולל כרגע {branchSettings.userCount} משתמשים, עם יעד של {branchSettings.targetMinutes} דקות לפתיחת תיק ומדיניות תזכורות {branchSettings.reminderPolicy}.
          </div>
          <div className="text-xs text-slate-400 mt-3">נתוני הדגמה בלבד — אינו הסכם מסחרי סופי.</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- Export Modal ---------------------------- */

function ExportModal({ caseName, onClose }) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between">
          <div className="font-medium text-slate-800">ייצוא לישות/חשבשבת</div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="text-sm text-slate-600 mt-3 leading-relaxed">
          הנתונים של <span className="font-medium text-slate-800">{caseName}</span> מוכנים לייצוא. בחיבור אמיתי הפעולה תעביר רק נתונים שאושרו.
        </div>
        <div className="flex justify-start gap-3 mt-5">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-950">הבנתי</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- Completion Request Modal ---------------------------- */

const CHANNEL_OPTIONS = [
  { value: "email", label: "מייל" },
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "וואטסאפ (מדומה)" },
];

function CompletionRequestModal({ c, onClose, onSubmit }) {
  const missing = c.documents.filter((d) => d.status !== "התקבל");
  const [channel, setChannel] = useState("email");
  const [message, setMessage] = useState(
    `שלום ${c.contactName || "[שם איש הקשר]"}, כדי להשלים את פתיחת התיק של ${c.name} נדרש להעלות את הפריטים הבאים: ${
      missing.length ? missing.map((d) => d.name).join(", ") : "אין פריטים חסרים כרגע"
    }. ניתן להשלים אותם בקישור המאובטח.`
  );

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-screen overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="font-medium text-slate-800">שליחת בקשת השלמה — {c.name}</div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="text-sm text-slate-600 block mb-1.5">שם איש קשר</label>
            <div className="text-sm text-slate-800 border border-slate-200 rounded-lg py-2 px-3 bg-slate-50">
              {c.contactName || "—"}
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-600 block mb-1.5">ערוץ שליחה</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-full border border-slate-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
            >
              {CHANNEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="text-sm text-slate-600 block mb-1.5">מסמכים חסרים</label>
          {missing.length === 0 ? (
            <div className="text-sm text-slate-500">אין מסמכים חסרים כרגע.</div>
          ) : (
            <ul className="list-disc pr-5 text-sm text-slate-600 space-y-1">
              {missing.map((d) => <li key={d.id}>{d.name}</li>)}
            </ul>
          )}
        </div>

        <div className="mt-4">
          <label className="text-sm text-slate-600 block mb-1.5">הודעה לשליחה (ניתנת לעריכה)</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="w-full border border-slate-200 rounded-lg py-2 px-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900"
          />
        </div>

        <div className="mt-4 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-start gap-2">
          <Info size={14} className="mt-0.5 shrink-0" />
          פעולה זו היא סימולציה בלבד. לא תישלח הודעה אמיתית ללקוח.
        </div>

        <div className="flex items-center gap-3 mt-5">
          <button onClick={onClose} className="text-sm px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
            ביטול
          </button>
          <button
            onClick={() => onSubmit({ channel, message })}
            className="flex items-center gap-2 text-sm px-5 py-2.5 rounded-lg bg-slate-900 text-white hover:bg-slate-950"
          >
            <Send size={15} /> שלח בסימולציה
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- Demo Panel ---------------------------- */

function DemoPanel({ step, onPrev, onNext, onClose }) {
  const current = DEMO_STEPS[step - 1];
  return (
    <div className="fixed bottom-6 inset-x-0 flex justify-center z-40 px-4 pointer-events-none">
      <div className="bg-white border border-slate-200 rounded-xl shadow-lg max-w-xl w-full p-5 pointer-events-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-sky-500" />
            <span className="text-xs font-medium text-slate-500">דמו — פתיחת תאגיד · שלב {step} מתוך {DEMO_STEPS.length}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xs flex items-center gap-1">
            <X size={14} /> סיים דמו
          </button>
        </div>

        <div className="flex items-center gap-1.5 mt-3">
          {DEMO_STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i + 1 <= step ? "bg-sky-500" : "bg-slate-200"}`} />
          ))}
        </div>

        <div className="mt-3">
          <div className="text-sm font-semibold text-slate-900">{step}. {current.title}</div>
          <div className="text-sm text-slate-600 mt-1">{current.desc}</div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <button
            onClick={onPrev}
            disabled={step === 1}
            className="text-sm px-3.5 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            הקודם
          </button>
          {step < DEMO_STEPS.length ? (
            <button onClick={onNext} className="text-sm px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-950">
              הבא
            </button>
          ) : (
            <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-950">
              סיים דמו
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
