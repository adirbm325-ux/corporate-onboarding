/* קטלוג סוגי הטפסים והגדרות נלוות. נתוני דמה בלבד, לא ייעוץ משפטי.
   src/data/formDefinitions.js */

export const FORM_TYPES = {
  corporate_poa: {
    key: "corporate_poa",
    label: "ייפוי כוח תאגיד",
    appliesTo: ["owner", "courier"], // נחתם ע"י בעל שליטה, מעניק הרשאה לשליח (או לבעל שליטה אחר)
    mandatory: true,
  },
  service_recipient_declaration: {
    key: "service_recipient_declaration",
    label: "הצהרת מקבל שירות",
    appliesTo: ["owner", "courier"],
    mandatory: true,
  },
  kyc_extended: {
    key: "kyc_extended",
    label: "טופס הכר את הלקוח — מורחב",
    appliesTo: ["owner"],
    mandatory: true,
  },
};

export const FORM_STATUSES = [
  "not_started",
  "in_progress",
  "awaiting_signature",
  "submitted",
  "under_review",
  "approved",
  "correction_requested",
];

export const FORM_STATUS_LABELS = {
  not_started: "טרם התחיל",
  in_progress: "במילוי",
  awaiting_signature: "ממתין לחתימה",
  submitted: "הוגש לבדיקה",
  under_review: "בבדיקה",
  approved: "אושר",
  correction_requested: "נדרש תיקון",
};

export const FORM_STATUS_STYLES = {
  not_started: "bg-slate-100 text-slate-600 border-slate-200",
  in_progress: "bg-sky-50 text-sky-700 border-sky-200",
  awaiting_signature: "bg-amber-50 text-amber-700 border-amber-200",
  submitted: "bg-indigo-50 text-indigo-700 border-indigo-200",
  under_review: "bg-indigo-50 text-indigo-700 border-indigo-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  correction_requested: "bg-rose-50 text-rose-700 border-rose-200",
};

/* רשימת דמה בלבד — יש לאמת מול הרשימה העדכנית לפני שימוש אמיתי.
   הרשימה המקורית שעליה התבסס נוסח הטופס תאריכה 24/07/2025 ואינה נחשבת אוטומטית לעדכנית. */
export const SANCTIONED_COUNTRIES_CONFIG = {
  effectiveDate: "2025-07-24",
  demoNotice: "רשימת הדגמה — יש לאמת מול הרשימה העדכנית לפני שימוש אמיתי",
  countries: [
    "איראן", "צפון קוריאה", "סוריה", "רוסיה", "בלארוס",
  ],
};

export const CASH_USAGE_LEVELS = [
  { value: "all", label: "כל הפעילות" },
  { value: "75pct", label: "כ־75%" },
  { value: "half", label: "כחצי מהפעילות" },
  { value: "under25", label: "חלק קטן, עד 25%" },
  { value: "none", label: "אין צורך במזומן" },
];

export const EXPECTED_SERVICES = [
  "קניית מט\"ח",
  "מכירת מט\"ח",
  "העברת כספים מישראל לחו\"ל",
  "העברת כספים מחו\"ל לישראל",
  "פריטת שיקים של משכורת",
  "ניכיון שיקים עצמיים/סולו",
  "ניכיון שיקים של צד שלישי",
  "קבלת מזומן כנגד העברה בנקאית",
  "מסירת מזומן כנגד העברה בנקאית לחשבון הלקוח",
  "ניכיון כרטיסי אשראי",
  "פקטורינג/ניכיון חשבוניות",
  "הלוואות לטווח קצר — עד שלושה חודשים",
  "הלוואות לטווח ארוך — מעל שלושה חודשים",
];

export const FUNDING_SOURCES = [
  "רווחי תאגיד", "מתנה", "ירושה", "חסכונות", "מכירת נדל\"ן", "משכורת", "רווחים מהשקעות",
];
