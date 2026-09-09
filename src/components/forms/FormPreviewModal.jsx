import React from "react";
import { X, Info } from "lucide-react";
import { FORM_TYPES, FORM_STATUS_LABELS } from "../../data/formDefinitions.js";

export default function FormPreviewModal({ form, personName, branchSettings, onClose }) {
  if (!form) return null;
  const def = FORM_TYPES[form.formType];
  const providerName = branchSettings?.serviceProviderName?.trim() || "שם נותן השירות";
  const providerNumber = branchSettings?.serviceProviderCompanyNumber?.trim() || "מספר חברה";
  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between">
          <div className="font-medium text-slate-800">{def?.label || form.formType}</div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="text-xs text-slate-500 mt-1">נותן השירות: {providerName} · מספר חברה: {providerNumber}</div>
        <div className="text-sm text-slate-600 mt-3 space-y-1.5">
          <div>מוקצה ל: <span className="text-slate-800">{personName || "לא משויך"}</span></div>
          <div>סטטוס נוכחי: <span className="text-slate-800">{FORM_STATUS_LABELS[form.status]}</span></div>
          <div>אחוז השלמה: <span className="text-slate-800">{form.completionPercent}%</span></div>
          <div>חתימה: <span className="text-slate-800">{form.signedAt ? `נחתם (${form.signedAt})` : "חסרה"}</span></div>
          {form.status === "approved" && (
            <div>אושר על ידי: <span className="text-slate-800">{form.reviewedBy} ({form.reviewedAt})</span></div>
          )}
        </div>
        <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mt-4">
          מילוי השדות המלא, החתימה והבדיקה של הטופס הזה ייבנו בשלב הבא של הפיתוח. כרגע ניתן לראות את הסטטוס בלבד.
        </div>
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2 flex items-start gap-2">
          <Info size={13} className="mt-0.5 shrink-0" />
          נוסח הדמו דורש אימות ואישור של יועץ משפטי ואחראי ציות לפני שימוש אמיתי.
        </div>
        <div className="flex justify-start mt-5">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-950">סגור</button>
        </div>
      </div>
    </div>
  );
}
