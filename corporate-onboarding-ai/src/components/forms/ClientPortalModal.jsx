import React, { useState } from "react";
import { X, Info, User } from "lucide-react";
import { FORM_TYPES, FORM_STATUS_LABELS } from "../../data/formDefinitions.js";
import { syncFormsForCase } from "../../utils/formLogic.js";

export default function ClientPortalModal({ c, branchSettings, onClose, onOpenForm }) {
  const providerName = branchSettings?.serviceProviderName?.trim() || "שם נותן השירות";
  const providerNumber = branchSettings?.serviceProviderCompanyNumber?.trim() || "מספר חברה";
  const owners = c.people.filter((p) => p.kind === "בעל שליטה" || p.kind === "נציג");
  const couriers = c.couriers || [];
  const people = [
    ...owners.map((p) => ({ ...p, role: "owner" })),
    ...couriers.map((k) => ({ ...k, role: "courier" })),
  ];
  const [selectedId, setSelectedId] = useState(people[0]?.id || null);
  const forms = syncFormsForCase(c);
  const selectedPerson = people.find((p) => p.id === selectedId);
  const myForms = selectedPerson ? forms.filter((f) => f.assignedPersonId === selectedPerson.id) : [];

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-screen overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="font-medium text-slate-800">פורטל לקוח — סימולציה</div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="text-xs text-slate-500 mt-1">נותן השירות: {providerName} · מספר חברה: {providerNumber}</div>

        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3 flex items-start gap-2">
          <Info size={13} className="mt-0.5 shrink-0" />
          פורטל זה הוא סימולציה בלבד. אין להזין נתונים אישיים אמיתיים ואין כאן חתימה אלקטרונית משפטית.
        </div>

        <div className="mt-4">
          <label className="text-sm text-slate-600 block mb-1.5">מי ממלא את הטפסים?</label>
          {people.length === 0 ? (
            <div className="text-sm text-slate-500">אין עדיין בעלי שליטה או שליחים בתיק זה.</div>
          ) : (
            <select
              value={selectedId || ""}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} — {p.role === "owner" ? "בעל שליטה / נציג" : "שליח"}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedPerson && (
          <div className="mt-4">
            <div className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
              <User size={13} /> טפסים המוקצים ל{selectedPerson.fullName}
            </div>
            {myForms.length === 0 ? (
              <div className="text-sm text-slate-500">אין טפסים מוקצים לאדם זה.</div>
            ) : (
              <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {myForms.map((f) => (
                  <li key={f.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="text-sm text-slate-700">{FORM_TYPES[f.formType]?.label}</div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-slate-500">{FORM_STATUS_LABELS[f.status]}</span>
                      <button
                        onClick={() => onOpenForm(f, selectedPerson.fullName)}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
                      >
                        {f.status === "not_started" ? "פתח טופס" : "המשך מילוי"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
