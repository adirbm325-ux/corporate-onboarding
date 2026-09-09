import React, { useState } from "react";
import { X, Plus, Trash2, AlertTriangle, Info, RotateCcw } from "lucide-react";
import {
  DECLARANT_FIELDS, BENEFICIARY_FIELDS, OWNER_FIELDS, SERVICE_BASIS_OPTIONS, CONTROLLING_OWNERS_BASIS_OPTIONS,
  computeServiceReceiverDeclarationCompletion, validateServiceReceiverDeclaration,
} from "../../utils/serviceReceiverDeclarationLogic.js";
import FormLifecyclePanel from "./FormLifecyclePanel.jsx";
import { STATUS_LABELS, isFormEditable } from "../../utils/formStatusHelpers.js";

function makeId() {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function isDataEmpty(data) {
  return !data || Object.keys(data).length === 0;
}

const ROLE_OPTIONS = ["בעל חברה", "בעל שליטה", "נציג", "שליח"];

/* ממלא מראש מתוך התיק — פרטי המצהיר נלקחים מהאדם שהטופס משויך אליו (שליח או בעל
   שליטה), ורשימת בעלי השליטה מוצעת מראש מתוך c.people (עדיין לא נבחרת עד שהמצהיר
   בוחר "בעלי השליטה הם הרשימה שלהלן"). נתונים שנשמרו קודמים תמיד למילוי האוטומטי. */
function buildPrefill(c, form) {
  let declarant = { fullName: "", idNumber: "", role: "" };
  if (form.assignedPersonRole === "courier") {
    const courier = (c.couriers || []).find((k) => k.id === form.assignedPersonId);
    if (courier) declarant = { fullName: courier.fullName || "", idNumber: courier.idNumber || "", role: "שליח" };
  } else {
    const owner = c.people.find((p) => p.id === form.assignedPersonId) || c.people.find((p) => p.kind === "בעל שליטה" && p.primaryOwner);
    if (owner) declarant = { fullName: owner.fullName || "", idNumber: owner.partialId || "", role: owner.kind === "בעל שליטה" ? "בעל שליטה" : "נציג" };
  }
  return {
    declarant,
    serviceBasis: null,
    unknownBeneficiaryExplanation: "",
    beneficiaries: [],
    controllingOwnersBasis: null,
    controllingOwners: c.people
      .filter((p) => p.kind === "בעל שליטה")
      .map((p) => ({ id: p.id, fullName: p.fullName || "", idNumber: p.partialId || "", dob: "", gender: "", address: "" })),
  };
}

function FieldsGrid({ fields, values, onChange, errorsFor }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {fields.map((f) => (
        <div key={f.key}>
          <label className="text-xs text-slate-600 block mb-1">{f.label}</label>
          <input
            value={values[f.key] || ""}
            onChange={(e) => onChange(f.key, e.target.value)}
            className={`w-full border rounded-lg py-1.5 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 ${
              errorsFor?.has(f.key) ? "border-rose-300" : "border-slate-200"
            }`}
          />
        </div>
      ))}
    </div>
  );
}

export default function ServiceReceiverDeclarationModal({
  form, c, branchSettings, viewContext = "employee",
  onClose, onSaveDraft, onProceedToSignature,
  onSign, onApplyStamp, onSubmitForReview, onStartReview, onRequestCorrection, onApprove,
}) {
  const [data, setData] = useState(() => (isDataEmpty(form.data) ? buildPrefill(c, form) : form.data));
  const [errors, setErrors] = useState(form.validationErrors || []);

  const editable = isFormEditable(form.status);
  const locked = !editable;

  const providerName = branchSettings?.serviceProviderName?.trim() || "שם נותן השירות";
  const providerNumber = branchSettings?.serviceProviderCompanyNumber?.trim() || "מספר חברה";

  function errSetFor(prefix) {
    const set = new Set();
    errors.forEach((e) => { if (e.field.startsWith(`${prefix}.`)) set.add(e.field.slice(prefix.length + 1)); });
    return set;
  }
  function listItemErrSet(listKey, index) {
    const prefix = `${listKey}.${index}.`;
    const set = new Set();
    errors.forEach((e) => { if (e.field.startsWith(prefix)) set.add(e.field.slice(prefix.length)); });
    return set;
  }
  const topLevelErrors = new Set(errors.map((e) => e.field));

  function updateDeclarant(field, value) {
    setData((d) => ({ ...d, declarant: { ...d.declarant, [field]: value } }));
  }
  function updateListItem(listKey, index, field, value) {
    setData((d) => ({ ...d, [listKey]: d[listKey].map((item, i) => (i === index ? { ...item, [field]: value } : item)) }));
  }
  function addListItem(listKey, blank) {
    setData((d) => ({ ...d, [listKey]: [...(d[listKey] || []), { id: makeId(), ...blank }] }));
  }
  function removeListItem(listKey, index) {
    setData((d) => ({ ...d, [listKey]: d[listKey].filter((_, i) => i !== index) }));
  }

  function handleSaveDraft() {
    const percent = computeServiceReceiverDeclarationCompletion(data);
    onSaveDraft(data, percent, errors);
  }
  function handleProceed() {
    const errs = validateServiceReceiverDeclaration(data);
    setErrors(errs);
    const percent = computeServiceReceiverDeclarationCompletion(data);
    if (errs.length === 0) onProceedToSignature(data, percent);
    else onSaveDraft(data, percent, errs);
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 px-4 py-6">
      <div dir="rtl" className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-full overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="font-medium text-slate-800">הצהרת מקבל שירות</div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
          <span>נותן השירות: {providerName} · מספר חברה: {providerNumber}</span>
          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">סטטוס: {STATUS_LABELS[form.status] || form.status}</span>
        </div>

        {form.status === "correction_requested" && form.reviewNotes && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
            <div className="text-sm font-medium text-amber-800 mb-1 flex items-center gap-1.5"><RotateCcw size={14} /> העובד ביקש תיקון</div>
            <div className="text-sm text-amber-700">{form.reviewNotes}</div>
          </div>
        )}

        {errors.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 mt-4">
            <div className="text-sm font-medium text-rose-700 mb-1.5 flex items-center gap-1.5">
              <AlertTriangle size={14} /> יש להשלים {errors.length} שדות לפני מעבר ל"ממתין לחתימה"
            </div>
            <ul className="text-xs text-rose-600 list-disc pr-4 space-y-0.5">
              {errors.map((e, i) => <li key={i}>{e.message}</li>)}
            </ul>
          </div>
        )}

        {/* פרטי המצהיר */}
        <div className="mt-4">
          <div className="text-sm font-medium text-slate-800 mb-2">פרטי המצהיר</div>
          <fieldset disabled={locked} className="space-y-3">
            <FieldsGrid fields={DECLARANT_FIELDS} values={data.declarant || {}} onChange={updateDeclarant} errorsFor={errSetFor("declarant")} />
            <div>
              <label className="text-xs text-slate-600 block mb-1">תפקיד המצהיר</label>
              <select
                value={data.declarant?.role || ""}
                onChange={(e) => updateDeclarant("role", e.target.value)}
                className={`w-full border rounded-lg py-1.5 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 ${
                  errSetFor("declarant").has("role") ? "border-rose-300" : "border-slate-200"
                }`}
              >
                <option value="">בחר/י תפקיד</option>
                {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </fieldset>
        </div>

        {/* בסיס קבלת השירות */}
        <div className="mt-5">
          <div className="text-sm font-medium text-slate-800 mb-2">בסיס קבלת השירות</div>
          <fieldset disabled={locked} className="space-y-2">
            {SERVICE_BASIS_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="serviceBasis"
                  checked={data.serviceBasis === opt.value}
                  onChange={() => setData((d) => ({ ...d, serviceBasis: opt.value }))}
                />
                {opt.label}
              </label>
            ))}
          </fieldset>
          {topLevelErrors.has("serviceBasis") && <div className="text-xs text-rose-600 mt-1">יש לבחור בסיס לקבלת השירות</div>}

          {data.serviceBasis === "unknown_beneficiary" && (
            <div className="mt-3">
              <label className="text-xs text-slate-600 block mb-1">הסבר, כולל התחייבות למסור את פרטי הנהנה מיד עם היוודע זהותו</label>
              <textarea
                disabled={locked}
                value={data.unknownBeneficiaryExplanation || ""}
                onChange={(e) => setData((d) => ({ ...d, unknownBeneficiaryExplanation: e.target.value }))}
                rows={2}
                className={`w-full border rounded-lg py-1.5 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 disabled:bg-slate-50 ${
                  topLevelErrors.has("unknownBeneficiaryExplanation") ? "border-rose-300" : "border-slate-200"
                }`}
              />
            </div>
          )}
        </div>

        {/* נהנים */}
        {data.serviceBasis === "beneficiary" && (
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-slate-800">נהנים</div>
              {!locked && (
                <button
                  onClick={() => addListItem("beneficiaries", { name: "", idNumber: "", dob: "", gender: "", address: "" })}
                  className="text-xs flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
                >
                  <Plus size={13} /> הוסף נהנה
                </button>
              )}
            </div>
            {topLevelErrors.has("beneficiaries") && <div className="text-xs text-rose-600 mb-2">נדרש לפחות נהנה אחד</div>}
            {(!data.beneficiaries || data.beneficiaries.length === 0) ? (
              <div className="text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg p-4 text-center">אין עדיין נהנים</div>
            ) : (
              <div className="space-y-3">
                {data.beneficiaries.map((b, i) => (
                  <div key={b.id} className="border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-medium text-slate-500">נהנה {i + 1}</div>
                      {!locked && (
                        <button onClick={() => removeListItem("beneficiaries", i)} className="text-rose-500 hover:text-rose-700"><Trash2 size={14} /></button>
                      )}
                    </div>
                    <fieldset disabled={locked}>
                      <FieldsGrid fields={BENEFICIARY_FIELDS} values={b} onChange={(field, value) => updateListItem("beneficiaries", i, field, value)} errorsFor={listItemErrSet("beneficiaries", i)} />
                    </fieldset>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* בעלי שליטה בתאגיד */}
        <div className="mt-5">
          <div className="text-sm font-medium text-slate-800 mb-2">בעלי שליטה בתאגיד</div>
          <fieldset disabled={locked} className="space-y-2">
            {CONTROLLING_OWNERS_BASIS_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="controllingOwnersBasis"
                  checked={data.controllingOwnersBasis === opt.value}
                  onChange={() => setData((d) => ({ ...d, controllingOwnersBasis: opt.value }))}
                />
                {opt.label}
              </label>
            ))}
          </fieldset>
          {topLevelErrors.has("controllingOwnersBasis") && <div className="text-xs text-rose-600 mt-1">יש לבחור אחת מהאפשרויות</div>}

          {data.controllingOwnersBasis === "list" && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium text-slate-500">רשימת בעלי שליטה</div>
                {!locked && (
                  <button
                    onClick={() => addListItem("controllingOwners", { fullName: "", idNumber: "", dob: "", gender: "", address: "" })}
                    className="text-xs flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
                  >
                    <Plus size={13} /> הוסף בעל שליטה
                  </button>
                )}
              </div>
              {topLevelErrors.has("controllingOwners") && <div className="text-xs text-rose-600 mb-2">נדרש לפחות בעל שליטה אחד</div>}
              {(!data.controllingOwners || data.controllingOwners.length === 0) ? (
                <div className="text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg p-4 text-center">אין עדיין בעלי שליטה</div>
              ) : (
                <div className="space-y-3">
                  {data.controllingOwners.map((o, i) => (
                    <div key={o.id} className="border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-medium text-slate-500">בעל שליטה {i + 1}</div>
                        {!locked && (
                          <button onClick={() => removeListItem("controllingOwners", i)} className="text-rose-500 hover:text-rose-700"><Trash2 size={14} /></button>
                        )}
                      </div>
                      <fieldset disabled={locked}>
                        <FieldsGrid fields={OWNER_FIELDS} values={o} onChange={(field, value) => updateListItem("controllingOwners", i, field, value)} errorsFor={listItemErrSet("controllingOwners", i)} />
                      </fieldset>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* הצהרה קבועה */}
        <div className="mt-5">
          <div className="text-sm font-medium text-slate-800 mb-2">הצהרה</div>
          <div className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed space-y-2">
            <div>הנני מצהיר/ה כי כל הפרטים שמסרתי לעיל נכונים ומדויקים, וכי אודיע ל{providerName} על כל שינוי בפרט מהפרטים שנמסרו בהצהרה זו מיד עם היוודעו.</div>
            <div>ידוע לי כי מסירת מידע כוזב מהווה עבירה על פי דין.</div>
          </div>
        </div>

        <FormLifecyclePanel
          form={form}
          viewContext={viewContext}
          requiresStamp={false}
          onSign={onSign}
          onApplyStamp={onApplyStamp}
          onSubmitForReview={onSubmitForReview}
          onStartReview={onStartReview}
          onRequestCorrection={onRequestCorrection}
          onApprove={onApprove}
        />

        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-4 flex items-start gap-2">
          <Info size={13} className="mt-0.5 shrink-0" />
          נוסח הדמו דורש אימות ואישור של יועץ משפטי ואחראי ציות לפני שימוש אמיתי.
        </div>

        <div className="flex items-center justify-start gap-2 mt-5">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">סגור</button>
          {editable && (
            <>
              <button onClick={handleSaveDraft} className="text-sm px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">שמור טיוטה</button>
              <button onClick={handleProceed} className="text-sm px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-950">
                {form.status === "correction_requested" ? "הגש מחדש לחתימה" : 'המשך ל"ממתין לחתימה"'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
