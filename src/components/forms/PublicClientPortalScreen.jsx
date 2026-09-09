import React, { useState } from "react";
import { Info, Building2 } from "lucide-react";
import { FORM_TYPES, FORM_STATUS_LABELS } from "../../data/formDefinitions.js";
import { syncFormsForCase } from "../../utils/formLogic.js";

export default function PublicClientPortalScreen({ c, branchSettings, onOpenForm }) {
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
    <div dir="rtl" className="min-h-screen w-full bg-slate-50 text-slate-800" style={{ fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif" }}>
      <div className="max-w-xl mx-auto px-5 py-8">
        <div className="flex items-center gap-2 mb-1">
          <Building2 size={18} className="text-slate-400" />
          <div className="font-semibold text-slate-900">Corporate Onboarding AI — פורטל לקוח</div>
        </div>
        <div className="text-xs text-slate-500 mb-6">נותן השירות: {providerName} · מספר חברה: {providerNumber}</div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
          <div className="text-sm text-slate-500">פתיחת תיק עבור</div>
          <div className="text-lg font-medium text-slate-900 mt-0.5">{c.name}</div>
        </div>

        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-5 flex items-start gap-2">
          <Info size={13} className="mt-0.5 shrink-0" />
          פורטל זה הוא סימולציה בלבד. אין להזין נתונים אישיים אמיתיים ואין כאן חתימה אלקטרונית משפטית.
        </div>

        {people.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-5 text-sm text-slate-500">
            עדיין לא הוגדרו אנשי קשר או שליחים בתיק זה. יש לפנות לנציג הצ׳יינג׳.
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="text-sm text-slate-600 block mb-1.5">מי ממלא את הטפסים?</label>
              <select
                value={selectedId || ""}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg py-2 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20"
              >
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName} — {p.role === "owner" ? "בעל שליטה / נציג" : "שליח"}
                  </option>
                ))}
              </select>
            </div>

            {selectedPerson && (
              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                {myForms.length === 0 ? (
                  <div className="p-5 text-sm text-slate-500">אין טפסים המוקצים לאדם זה כרגע.</div>
                ) : (
                  myForms.map((f) => (
                    <div key={f.id} className="p-4 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-slate-800">{FORM_TYPES[f.formType]?.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{FORM_STATUS_LABELS[f.status]} · {f.completionPercent}% הושלם</div>
                      </div>
                      <button
                        onClick={() => onOpenForm(f, selectedPerson.fullName)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-950 shrink-0"
                      >
                        {f.status === "not_started" ? "פתח טופס" : "המשך"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
