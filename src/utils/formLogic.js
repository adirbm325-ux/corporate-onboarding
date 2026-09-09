/* לוגיקת יצירה/סנכרון של מופעי טפסים לתיק, לפי בעלי שליטה ושליחים קיימים.
   src/utils/formLogic.js */

import { FORM_TYPES } from "../data/formDefinitions.js";

function blankForm(caseId, formType, assignedPersonId, assignedPersonRole, extra = {}) {
  const now = "עכשיו";
  return {
    id: `form-${caseId}-${formType}-${assignedPersonId}`,
    formType,
    version: 1,
    caseId,
    assignedPersonId,
    assignedPersonRole, // 'owner' | 'courier'
    mandatory: FORM_TYPES[formType]?.mandatory ?? true,
    status: "not_started",
    completionPercent: 0,
    data: {},
    validationErrors: [],
    signedBy: null,
    signedAt: null,
    signatureMethod: null,
    stampApplied: false,
    stampAppliedAt: null,
    submittedAt: null,
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null,
    history: [],
    createdAt: now,
    updatedAt: now,
    ...extra,
  };
}

/* בונה את רשימת מופעי הטפסים הנדרשים לתיק, לפי בעלי השליטה (people עם kind "בעל שליטה")
   והשליחים (courier). ממזג עם טפסים קיימים בתיק (לא דורס נתונים שכבר מולאו). */
export function syncFormsForCase(c) {
  const owners = (c.people || []).filter((p) => p.kind === "בעל שליטה");
  const existing = c.forms || [];
  const existingById = Object.fromEntries(existing.map((f) => [f.id, f]));
  const nextForms = [];

  owners.forEach((owner) => {
    ["kyc_extended", "service_recipient_declaration"].forEach((formType) => {
      const blank = blankForm(c.id, formType, owner.id, "owner");
      nextForms.push(existingById[blank.id] || blank);
    });
  });

  (c.couriers || []).filter((k) => k.active !== false).forEach((courier) => {
    ["corporate_poa", "service_recipient_declaration"].forEach((formType) => {
      const blank = blankForm(c.id, formType, courier.id, "courier", {
        grantedByPersonId: formType === "corporate_poa" ? (owners.find((o) => o.primaryOwner)?.id || owners[0]?.id || null) : null,
      });
      nextForms.push(existingById[blank.id] || blank);
    });
  });

  return nextForms;
}

export function formIsComplete(form) {
  return form.status === "approved";
}

export function formNextAction(form) {
  switch (form.status) {
    case "not_started": return "לפתוח ולהתחיל מילוי";
    case "in_progress": return "להשלים את מילוי הטופס";
    case "awaiting_signature": return "להשיג חתימה";
    case "submitted": return "ממתין לבדיקת עובד";
    case "under_review": return "לבדוק ולהחליט";
    case "correction_requested": return "לחזור ללקוח לתיקון";
    case "approved": return "אין פעולה נדרשת";
    default: return "—";
  }
}

/* עד כמה תיק "מסמכי תאגיד" הושלם, ביחס לטפסים ולמסמכים ברמת התאגיד/בעלים/שליחים גם יחד */
export function formsReadiness(forms) {
  const mandatoryForms = forms.filter((f) => f.mandatory);
  const approved = mandatoryForms.filter((f) => f.status === "approved");
  return { total: mandatoryForms.length, approved: approved.length };
}
