import React, { useState } from "react";
import { FileSignature, Filter, Users, Truck, PenLine } from "lucide-react";
import { FORM_TYPES, FORM_STATUS_LABELS, FORM_STATUS_STYLES } from "../../data/formDefinitions.js";
import { syncFormsForCase, formNextAction } from "../../utils/formLogic.js";

const FILTERS = [
  { id: "all", label: "כל הטפסים" },
  { id: "owner", label: "טפסי בעל החברה/בעלי השליטה" },
  { id: "courier", label: "טפסי שליחים" },
  { id: "awaiting_signature", label: "ממתינים לחתימה" },
  { id: "correction_requested", label: "דורשים תיקון" },
];

function FormStatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-md border text-xs font-medium ${FORM_STATUS_STYLES[status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
      {FORM_STATUS_LABELS[status] || status}
    </span>
  );
}

function personFor(c, form) {
  if (form.assignedPersonRole === "owner") {
    return c.people.find((p) => p.id === form.assignedPersonId);
  }
  return (c.couriers || []).find((k) => k.id === form.assignedPersonId);
}

export default function FormsTab({ c, onOpenForm, onOpenPortal }) {
  const [filter, setFilter] = useState("all");
  const forms = syncFormsForCase(c);

  const filtered = forms.filter((f) => {
    if (filter === "all") return true;
    if (filter === "owner") return f.assignedPersonRole === "owner";
    if (filter === "courier") return f.assignedPersonRole === "courier";
    if (filter === "awaiting_signature") return f.status === "awaiting_signature";
    if (filter === "correction_requested") return f.status === "correction_requested";
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap bg-white border border-slate-200 rounded-xl p-4 mb-3">
        <div className="text-sm text-slate-600">
          טפסים דיגיטליים המוקצים לבעלי שליטה ולשליחים בתיק זה — מבוססים על רשימת אנשי הקשר והשליחים הנוכחית.
        </div>
        <button
          onClick={onOpenPortal}
          className="text-xs flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-950 shrink-0"
        >
          <PenLine size={13} /> פתח פורטל לקוח — סימולציה
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-3">
        <Filter size={14} className="text-slate-400" />
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`text-xs px-3 py-1.5 rounded-full border ${
              filter === f.id ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
          אין טפסים בסינון הנוכחי.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((form) => {
            const def = FORM_TYPES[form.formType];
            const person = personFor(c, form);
            const roleLabel = form.assignedPersonRole === "owner" ? "בעל שליטה" : "שליח";
            return (
              <div key={form.id} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <FileSignature size={16} className="text-slate-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800">{def?.label || form.formType}</div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        {form.assignedPersonRole === "courier" ? <Truck size={11} /> : <Users size={11} />}
                        {person?.fullName || "לא משויך"} · {roleLabel}
                      </div>
                    </div>
                  </div>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded border shrink-0 ${form.mandatory ? "bg-slate-100 text-slate-600 border-slate-200" : "bg-indigo-50 text-indigo-600 border-indigo-200"}`}>
                    {form.mandatory ? "חובה" : "מותנה"}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <FormStatusBadge status={form.status} />
                  <span className="text-xs text-slate-500">{form.completionPercent}% הושלם</span>
                  <span className="text-xs text-slate-500">· חתימה: {form.signedAt ? "נחתם" : "חסרה"}</span>
                </div>

                <div className="text-xs text-slate-400 mt-2">פעולה הבאה: {formNextAction(form)}</div>

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <button
                    onClick={() => onOpenForm(form, person?.fullName)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
                  >
                    {form.status === "not_started" ? "פתח טופס" : "המשך מילוי"}
                  </button>
                  <button
                    onClick={onOpenPortal}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
                  >
                    פתח כתצוגת לקוח — סימולציה
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
