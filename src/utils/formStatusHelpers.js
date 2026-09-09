/* תוויות סטטוס ולוגיקת נעילת שדות משותפות לכל סוגי הטפסים. src/utils/formStatusHelpers.js */

export const STATUS_LABELS = {
  not_started: "טרם התחיל",
  in_progress: "במילוי",
  awaiting_signature: "ממתין לחתימה",
  submitted: "הוגש לבדיקה",
  under_review: "בבדיקת עובד",
  approved: "אושר",
  correction_requested: "נדרש תיקון",
};

export function isFormEditable(status) {
  return ["not_started", "in_progress", "correction_requested"].includes(status);
}
