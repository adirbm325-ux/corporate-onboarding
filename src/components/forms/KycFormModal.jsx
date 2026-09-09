import React, { useState } from "react";
import { X, AlertTriangle, Info, RotateCcw, Plus, Trash2, ChevronRight, ChevronLeft } from "lucide-react";
import {
  STEPS, CLIENT_TYPE_OPTIONS, COUNTRY_TIE_RELATIONS, SPECIAL_ACTIVITY_FIELDS, PROVIDER_REASON_OPTIONS,
  AMOUNT_RANGES, EXPECTED_SERVICES, FUNDING_SOURCES, CASH_USAGE_LEVELS, SERVICE_FOLLOWUP_KEY,
  validateKycForm, computeKycCompletion, errorsByStep,
} from "../../utils/kycFormLogic.js";
import { SANCTIONED_COUNTRIES_CONFIG } from "../../data/formDefinitions.js";
import { TextField, TextAreaField, SelectField, RadioGroup, BooleanField, CheckboxGroup } from "./kycFields.jsx";
import FormLifecyclePanel from "./FormLifecyclePanel.jsx";
import { STATUS_LABELS, isFormEditable } from "../../utils/formStatusHelpers.js";

function makeId() {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function isDataEmpty(data) {
  return !data || Object.keys(data).length === 0;
}

const ROLE_OPTIONS = ["בעל חברה", "בעל שליטה", "נציג", "שליח"];

function buildPrefill(c, form) {
  let personal = { fullName: "", idNumber: "", dob: "", gender: "", address: "" };
  let role = "";
  if (form.assignedPersonRole === "courier") {
    const courier = (c.couriers || []).find((k) => k.id === form.assignedPersonId);
    if (courier) {
      personal = { fullName: courier.fullName || "", idNumber: courier.idNumber || "", dob: courier.dob || "", gender: courier.gender || "", address: courier.address || "" };
      role = "שליח";
    }
  } else {
    const owner = c.people.find((p) => p.id === form.assignedPersonId) || c.people.find((p) => p.kind === "בעל שליטה" && p.primaryOwner);
    if (owner) {
      personal = { fullName: owner.fullName || "", idNumber: owner.partialId || "", dob: "", gender: "", address: "" };
      role = owner.kind === "בעל שליטה" ? "בעל שליטה" : "נציג";
    }
  }
  return {
    step1: { ...personal, role, residency: null, residencyDetails: "", clientType: null, companyRole: "", licenseType: "", licenseScope: "", licenseNumber: "", complianceOfficerName: "", fieldOfActivity: c.field || "" },
    step2: { hasIsraeliBankAccount: null, bankName: "", branchNumber: "", branchCity: "", accountNumber: "", refusalReason: "", isPep: null, pepType: "", pepRole: "", pepCountry: "", pepTenure: "", pepRelationDetails: "", pepExplanation: "" },
    step3: { hasCountryTies: null, countryTiesCountries: [], countryTiesRelation: "", countryTiesDetails: "", actingForOther: null, actingForOtherName: "", actingForOtherId: "", hasCourier: null, courierId: "", specialActivityFields: [], reasonForChoosingProvider: "", reasonOther: "" },
    step4: { familiarityLevel: "", ceoName: "", ceoId: "", companyFullName: c.name || "", companyNumber: c.companyNumber || "", companyAddress: c.address || "", establishedDate: "", yearsInField: "", yearsInvolved: "", annualTurnover: "", employeeCount: "", mainClients: "", hasForeignActivity: null, foreignActivityDetails: "", suppliers: [], customers: [], hasOtherBusinesses: null, otherBusinesses: [] },
    step5: { selectedServices: [] },
    step6: { selectedSources: [], corporateProfits: {}, giftInheritance: {}, savings: {}, realEstateSale: {}, salary: {}, investmentProfits: {} },
    step7: { cashUsageLevel: "", cashNeedExplanation: "", cashEntities: [], additionalInfo: "" },
    step8: { confirmedAccurate: false },
  };
}

export default function KycFormModal({
  form, c, branchSettings, viewContext = "employee",
  onClose, onSaveDraft, onProceedToSignature,
  onSign, onApplyStamp, onSubmitForReview, onStartReview, onRequestCorrection, onApprove,
}) {
  const [data, setData] = useState(() => (isDataEmpty(form.data) ? buildPrefill(c, form) : form.data));
  const [errors, setErrors] = useState(form.validationErrors || []);
  const [currentStep, setCurrentStep] = useState(1);

  const editable = isFormEditable(form.status);
  const locked = !editable;
  const providerName = branchSettings?.serviceProviderName?.trim() || "שם נותן השירות";
  const providerNumber = branchSettings?.serviceProviderCompanyNumber?.trim() || "מספר חברה";
  const stepErrCounts = errorsByStep(errors);

  function errFor(field) {
    return errors.find((e) => e.field === field)?.message;
  }
  function updateStep(step, field, value) {
    setData((d) => ({ ...d, [step]: { ...d[step], [field]: value } }));
  }
  function updateNested(step, group, field, value) {
    setData((d) => ({ ...d, [step]: { ...d[step], [group]: { ...(d[step][group] || {}), [field]: value } } }));
  }
  function addListItem(step, listKey, blank) {
    setData((d) => ({ ...d, [step]: { ...d[step], [listKey]: [...(d[step][listKey] || []), { id: makeId(), ...blank }] } }));
  }
  function updateListItem(step, listKey, index, field, value) {
    setData((d) => ({ ...d, [step]: { ...d[step], [listKey]: d[step][listKey].map((item, i) => (i === index ? { ...item, [field]: value } : item)) } }));
  }
  function removeListItem(step, listKey, index) {
    setData((d) => ({ ...d, [step]: { ...d[step], [listKey]: d[step][listKey].filter((_, i) => i !== index) } }));
  }
  function toggleService(index, name) {
    setData((d) => {
      const exists = d.step5.selectedServices.some((s) => s.index === index);
      const selectedServices = exists
        ? d.step5.selectedServices.filter((s) => s.index !== index)
        : [...d.step5.selectedServices, { index, name, amountRange: "", monthlyVolume: "", annualVolume: "", purpose: "", repayment: "", repaymentBankDetails: "" }];
      return { ...d, step5: { ...d.step5, selectedServices } };
    });
  }
  function updateServiceField(index, field, value) {
    setData((d) => ({ ...d, step5: { ...d.step5, selectedServices: d.step5.selectedServices.map((s) => (s.index === index ? { ...s, [field]: value } : s)) } }));
  }

  function handleSaveDraft() {
    onSaveDraft(data, computeKycCompletion(data), errors);
  }
  function handleProceed() {
    const errs = validateKycForm(data);
    setErrors(errs);
    const percent = computeKycCompletion(data);
    if (errs.length === 0) onProceedToSignature(data, percent);
    else {
      onSaveDraft(data, percent, errs);
      const firstErrStep = errs[0]?.step;
      if (firstErrStep) setCurrentStep(firstErrStep);
    }
  }

  const s1 = data.step1 || {}, s2 = data.step2 || {}, s3 = data.step3 || {}, s4 = data.step4 || {}, s5 = data.step5 || {}, s6 = data.step6 || {}, s7 = data.step7 || {}, s8 = data.step8 || {};

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 px-4 py-6">
      <div dir="rtl" className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-full overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="font-medium text-slate-800">טופס הכר את הלקוח — מורחב</div>
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
            <ul className="text-xs text-rose-600 list-disc pr-4 space-y-0.5 max-h-24 overflow-y-auto">
              {errors.map((e, i) => <li key={i}>{e.message}</li>)}
            </ul>
          </div>
        )}

        {/* אינדיקטור שלבים */}
        {editable && (
          <div className="flex items-center gap-1 mt-4 overflow-x-auto pb-1">
            {STEPS.map((st) => (
              <button
                key={st.id}
                onClick={() => setCurrentStep(st.id)}
                className={`shrink-0 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border ${
                  currentStep === st.id ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {st.id}
                {stepErrCounts[st.id] ? <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" /> : null}
              </button>
            ))}
            <span className="text-xs text-slate-500 mr-2 shrink-0">{STEPS.find((s) => s.id === currentStep)?.label}</span>
          </div>
        )}

        <fieldset disabled={locked} className="mt-4 space-y-4">
          {/* ===== שלב 1 ===== */}
          {(currentStep === 1 || locked) && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-800">1. פרטים אישיים וסוג לקוח</div>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="שם מלא" value={s1.fullName} onChange={(v) => updateStep("step1", "fullName", v)} error={errFor("step1.fullName")} />
                <TextField label="מספר זהות" value={s1.idNumber} onChange={(v) => updateStep("step1", "idNumber", v)} error={errFor("step1.idNumber")} />
                <TextField label="תאריך לידה" value={s1.dob} onChange={(v) => updateStep("step1", "dob", v)} error={errFor("step1.dob")} />
                <TextField label="מין" value={s1.gender} onChange={(v) => updateStep("step1", "gender", v)} error={errFor("step1.gender")} />
                <TextField label="כתובת" value={s1.address} onChange={(v) => updateStep("step1", "address", v)} error={errFor("step1.address")} />
                <SelectField label="תפקיד" value={s1.role} onChange={(v) => updateStep("step1", "role", v)} options={ROLE_OPTIONS.map((r) => ({ value: r, label: r }))} />
              </div>
              <RadioGroup label="תושבות" value={s1.residency} onChange={(v) => updateStep("step1", "residency", v)} options={[{ value: "israel", label: "ישראל" }, { value: "other", label: "אחר" }]} error={errFor("step1.residency")} />
              {s1.residency === "other" && <TextField label="פירוט תושבות" value={s1.residencyDetails} onChange={(v) => updateStep("step1", "residencyDetails", v)} error={errFor("step1.residencyDetails")} />}
              <SelectField label="סוג לקוח" value={s1.clientType} onChange={(v) => updateStep("step1", "clientType", v)} options={CLIENT_TYPE_OPTIONS} error={errFor("step1.clientType")} />
              {s1.clientType === "business_for_company" && <TextField label="תפקיד בתאגיד" value={s1.companyRole} onChange={(v) => updateStep("step1", "companyRole", v)} error={errFor("step1.companyRole")} />}
              {s1.clientType === "financial_service_provider" && (
                <div className="grid grid-cols-2 gap-3 border border-slate-100 rounded-lg p-3">
                  <SelectField label="סוג רישיון" value={s1.licenseType} onChange={(v) => updateStep("step1", "licenseType", v)} options={[{ value: "credit", label: "אשראי" }, { value: "financial_asset", label: "נכס פיננסי" }]} error={errFor("step1.licenseType")} />
                  <SelectField label="היקף רישיון" value={s1.licenseScope} onChange={(v) => updateStep("step1", "licenseScope", v)} options={[{ value: "basic", label: "בסיסי" }, { value: "extended", label: "מורחב" }]} error={errFor("step1.licenseScope")} />
                  <TextField label="מספר רישיון" value={s1.licenseNumber} onChange={(v) => updateStep("step1", "licenseNumber", v)} error={errFor("step1.licenseNumber")} />
                  <TextField label="שם אחראי ציות" value={s1.complianceOfficerName} onChange={(v) => updateStep("step1", "complianceOfficerName", v)} error={errFor("step1.complianceOfficerName")} />
                </div>
              )}
              <TextField label="תחום עיסוק" value={s1.fieldOfActivity} onChange={(v) => updateStep("step1", "fieldOfActivity", v)} error={errFor("step1.fieldOfActivity")} />
            </div>
          )}

          {/* ===== שלב 2 ===== */}
          {(currentStep === 2 || locked) && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-800">2. חשבון בנק ואיש ציבור</div>
              <BooleanField label="קיים חשבון בנק בישראל?" value={s2.hasIsraeliBankAccount} onChange={(v) => updateStep("step2", "hasIsraeliBankAccount", v)} error={errFor("step2.hasIsraeliBankAccount")} />
              {s2.hasIsraeliBankAccount === true && (
                <div className="grid grid-cols-2 gap-3 border border-slate-100 rounded-lg p-3">
                  <TextField label="שם הבנק" value={s2.bankName} onChange={(v) => updateStep("step2", "bankName", v)} error={errFor("step2.bankName")} />
                  <TextField label="מספר סניף" value={s2.branchNumber} onChange={(v) => updateStep("step2", "branchNumber", v)} error={errFor("step2.branchNumber")} />
                  <TextField label="יישוב הסניף" value={s2.branchCity} onChange={(v) => updateStep("step2", "branchCity", v)} error={errFor("step2.branchCity")} />
                  <TextField label="מספר חשבון" value={s2.accountNumber} onChange={(v) => updateStep("step2", "accountNumber", v)} error={errFor("step2.accountNumber")} />
                </div>
              )}
              {s2.hasIsraeliBankAccount === false && (
                <TextAreaField label="סיבת הסירוב/היעדר חשבון" value={s2.refusalReason} onChange={(v) => updateStep("step2", "refusalReason", v)} error={errFor("step2.refusalReason")} />
              )}
              <BooleanField label='הלקוח או בעל שליטה בו הם "איש ציבור"?' value={s2.isPep} onChange={(v) => updateStep("step2", "isPep", v)} error={errFor("step2.isPep")} />
              {s2.isPep === true && (
                <div className="grid grid-cols-2 gap-3 border border-slate-100 rounded-lg p-3">
                  <SelectField label="סוג" value={s2.pepType} onChange={(v) => updateStep("step2", "pepType", v)} options={[{ value: "local", label: "מקומי" }, { value: "foreign", label: "זר" }]} error={errFor("step2.pepType")} />
                  <TextField label="תפקיד" value={s2.pepRole} onChange={(v) => updateStep("step2", "pepRole", v)} error={errFor("step2.pepRole")} />
                  <TextField label="מדינה" value={s2.pepCountry} onChange={(v) => updateStep("step2", "pepCountry", v)} error={errFor("step2.pepCountry")} />
                  <TextField label="תקופת כהונה" value={s2.pepTenure} onChange={(v) => updateStep("step2", "pepTenure", v)} />
                  <TextField label="פירוט הקשר (אם בן משפחה/שותף/תאגיד בשליטה)" value={s2.pepRelationDetails} onChange={(v) => updateStep("step2", "pepRelationDetails", v)} />
                  <TextAreaField label="הסבר חופשי" value={s2.pepExplanation} onChange={(v) => updateStep("step2", "pepExplanation", v)} />
                </div>
              )}
            </div>
          )}

          {/* ===== שלב 3 ===== */}
          {(currentStep === 3 || locked) && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-800">3. זיקות, פעולה עבור אחר ושליחים</div>
              <BooleanField label="קיימת זיקה למדינות/טריטוריות מסוימות?" value={s3.hasCountryTies} onChange={(v) => updateStep("step3", "hasCountryTies", v)} error={errFor("step3.hasCountryTies")} />
              {s3.hasCountryTies === true && (
                <div className="border border-slate-100 rounded-lg p-3 space-y-3">
                  <CheckboxGroup
                    label={`מדינות (${SANCTIONED_COUNTRIES_CONFIG.demoNotice})`}
                    values={s3.countryTiesCountries}
                    onChange={(v) => updateStep("step3", "countryTiesCountries", v)}
                    options={SANCTIONED_COUNTRIES_CONFIG.countries.map((c2) => ({ value: c2, label: c2 }))}
                    error={errFor("step3.countryTiesCountries")}
                  />
                  <SelectField label="סוג הקשר" value={s3.countryTiesRelation} onChange={(v) => updateStep("step3", "countryTiesRelation", v)} options={COUNTRY_TIE_RELATIONS} error={errFor("step3.countryTiesRelation")} />
                  <TextAreaField label="פירוט" value={s3.countryTiesDetails} onChange={(v) => updateStep("step3", "countryTiesDetails", v)} />
                </div>
              )}
              <BooleanField label="הממלא פועל עבור אדם/תאגיד אחר?" value={s3.actingForOther} onChange={(v) => updateStep("step3", "actingForOther", v)} error={errFor("step3.actingForOther")} />
              {s3.actingForOther === true && (
                <div className="grid grid-cols-2 gap-3 border border-slate-100 rounded-lg p-3">
                  <TextField label="שם" value={s3.actingForOtherName} onChange={(v) => updateStep("step3", "actingForOtherName", v)} error={errFor("step3.actingForOtherName")} />
                  <TextField label="מספר זהות/חברה" value={s3.actingForOtherId} onChange={(v) => updateStep("step3", "actingForOtherId", v)} />
                </div>
              )}
              {(c.couriers || []).length > 0 && (
                <BooleanField label="פועל שליח מטעם התאגיד?" value={s3.hasCourier} onChange={(v) => updateStep("step3", "hasCourier", v)} />
              )}
              {s3.hasCourier === true && (
                <SelectField
                  label="בחר/י שליח"
                  value={s3.courierId}
                  onChange={(v) => updateStep("step3", "courierId", v)}
                  options={(c.couriers || []).map((k) => ({ value: k.id, label: k.fullName }))}
                />
              )}
              <CheckboxGroup
                label="תחומי פעילות מיוחדים"
                values={s3.specialActivityFields}
                onChange={(v) => updateStep("step3", "specialActivityFields", v)}
                options={SPECIAL_ACTIVITY_FIELDS}
                exclusiveValue="none"
                error={errFor("step3.specialActivityFields")}
              />
              <SelectField label="סיבת בחירת נותן השירות" value={s3.reasonForChoosingProvider} onChange={(v) => updateStep("step3", "reasonForChoosingProvider", v)} options={PROVIDER_REASON_OPTIONS} error={errFor("step3.reasonForChoosingProvider")} />
              {s3.reasonForChoosingProvider === "other" && <TextField label="פירוט" value={s3.reasonOther} onChange={(v) => updateStep("step3", "reasonOther", v)} error={errFor("step3.reasonOther")} />}
            </div>
          )}

          {/* ===== שלב 4 ===== */}
          {(currentStep === 4 || locked) && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-800">4. פרטי התאגיד והפעילות העסקית</div>
              <RadioGroup
                label="רמת היכרות עם העסק"
                value={s4.familiarityLevel}
                onChange={(v) => updateStep("step4", "familiarityLevel", v)}
                options={[{ value: "excellent", label: "מכיר מצוין" }, { value: "partial", label: "מכיר באופן חלקי" }, { value: "little", label: "היכרות מעטה" }, { value: "none", label: "לא מכיר כלל" }]}
                error={errFor("step4.familiarityLevel")}
              />
              <div className="grid grid-cols-2 gap-3">
                <TextField label='שם מנכ"ל' value={s4.ceoName} onChange={(v) => updateStep("step4", "ceoName", v)} error={errFor("step4.ceoName")} />
                <TextField label='מ.ז מנכ"ל' value={s4.ceoId} onChange={(v) => updateStep("step4", "ceoId", v)} error={errFor("step4.ceoId")} />
                <TextField label="שם מלא של התאגיד" value={s4.companyFullName} onChange={(v) => updateStep("step4", "companyFullName", v)} error={errFor("step4.companyFullName")} />
                <TextField label="מספר חברה" value={s4.companyNumber} onChange={(v) => updateStep("step4", "companyNumber", v)} error={errFor("step4.companyNumber")} />
                <TextField label="כתובת" value={s4.companyAddress} onChange={(v) => updateStep("step4", "companyAddress", v)} error={errFor("step4.companyAddress")} />
                <TextField label="תאריך הקמה/התאגדות" value={s4.establishedDate} onChange={(v) => updateStep("step4", "establishedDate", v)} />
                <TextField label="שנות פעילות בתחום" value={s4.yearsInField} onChange={(v) => updateStep("step4", "yearsInField", v)} />
                <TextField label="שנות מעורבות הממלא בעסק" value={s4.yearsInvolved} onChange={(v) => updateStep("step4", "yearsInvolved", v)} />
                <TextField label="מחזור שנתי משוער" value={s4.annualTurnover} onChange={(v) => updateStep("step4", "annualTurnover", v)} error={errFor("step4.annualTurnover")} />
                <TextField label="מספר עובדים" value={s4.employeeCount} onChange={(v) => updateStep("step4", "employeeCount", v)} error={errFor("step4.employeeCount")} />
              </div>
              <RadioGroup label="לקוחות עיקריים" value={s4.mainClients} onChange={(v) => updateStep("step4", "mainClients", v)} options={[{ value: "private", label: "פרטיים" }, { value: "business", label: "עסקיים" }, { value: "both", label: "שניהם" }]} error={errFor("step4.mainClients")} />
              <BooleanField label="קיימת פעילות או קשר לחברות בחו״ל?" value={s4.hasForeignActivity} onChange={(v) => updateStep("step4", "hasForeignActivity", v)} />
              {s4.hasForeignActivity === true && <TextAreaField label="פירוט" value={s4.foreignActivityDetails} onChange={(v) => updateStep("step4", "foreignActivityDetails", v)} />}

              <DynamicTable
                title="ספקים עיקריים"
                items={s4.suppliers}
                fields={[{ key: "name", label: "שם" }, { key: "productType", label: "סוג מוצר/שירות" }]}
                onAdd={() => addListItem("step4", "suppliers", { name: "", productType: "" })}
                onUpdate={(i, f, v) => updateListItem("step4", "suppliers", i, f, v)}
                onRemove={(i) => removeListItem("step4", "suppliers", i)}
              />
              <DynamicTable
                title="לקוחות עיקריים"
                items={s4.customers}
                fields={[{ key: "name", label: "שם" }, { key: "productType", label: "סוג מוצר/שירות" }]}
                onAdd={() => addListItem("step4", "customers", { name: "", productType: "" })}
                onUpdate={(i, f, v) => updateListItem("step4", "customers", i, f, v)}
                onRemove={(i) => removeListItem("step4", "customers", i)}
              />
              <BooleanField label="קיימים עסקים נוספים בבעלות?" value={s4.hasOtherBusinesses} onChange={(v) => updateStep("step4", "hasOtherBusinesses", v)} />
              {s4.hasOtherBusinesses === true && (
                <DynamicTable
                  title="עסקים נוספים"
                  items={s4.otherBusinesses}
                  fields={[{ key: "name", label: "שם העסק" }, { key: "idNumber", label: "מספר זהות/חברה" }, { key: "field", label: "תחום פעילות" }, { key: "notes", label: "הערות" }]}
                  onAdd={() => addListItem("step4", "otherBusinesses", { name: "", idNumber: "", field: "", notes: "" })}
                  onUpdate={(i, f, v) => updateListItem("step4", "otherBusinesses", i, f, v)}
                  onRemove={(i) => removeListItem("step4", "otherBusinesses", i)}
                />
              )}
            </div>
          )}

          {/* ===== שלב 5 ===== */}
          {(currentStep === 5 || locked) && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-800">5. פעילות צפויה</div>
              {errFor("step5.selectedServices") && <div className="text-xs text-rose-600">{errFor("step5.selectedServices")}</div>}
              <div className="space-y-2">
                {EXPECTED_SERVICES.map((name, idx) => {
                  const sv = s5.selectedServices.find((x) => x.index === idx);
                  const followup = SERVICE_FOLLOWUP_KEY[idx];
                  return (
                    <div key={idx} className="border border-slate-200 rounded-lg p-3">
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" disabled={locked} checked={!!sv} onChange={() => toggleService(idx, name)} />
                        {name}
                      </label>
                      {sv && (
                        <div className="mt-2 space-y-2 pr-6">
                          <div className="grid grid-cols-3 gap-2">
                            <SelectField label="טווח סכום לפעולה" value={sv.amountRange} onChange={(v) => updateServiceField(idx, "amountRange", v)} options={AMOUNT_RANGES} />
                            <TextField label="היקף חודשי" value={sv.monthlyVolume} onChange={(v) => updateServiceField(idx, "monthlyVolume", v)} />
                            <TextField label="היקף שנתי" value={sv.annualVolume} onChange={(v) => updateServiceField(idx, "annualVolume", v)} />
                          </div>
                          {followup === "fx_purpose" && <TextField label='מטרת השימוש במט"ח' value={sv.purpose} onChange={(v) => updateServiceField(idx, "purpose", v)} />}
                          {followup === "transfer_purpose" && <TextField label="מהות ההעברה והקשר למוטב/שולח" value={sv.purpose} onChange={(v) => updateServiceField(idx, "purpose", v)} />}
                          {followup === "self_check" && (
                            <div className="grid grid-cols-2 gap-2">
                              <TextField label="מטרת האשראי" value={sv.purpose} onChange={(v) => updateServiceField(idx, "purpose", v)} />
                              <TextField label="אמצעי ההחזר" value={sv.repayment} onChange={(v) => updateServiceField(idx, "repayment", v)} />
                            </div>
                          )}
                          {followup === "third_party_check" && <TextField label="בעבור מה התקבלו השיקים והתמורה" value={sv.purpose} onChange={(v) => updateServiceField(idx, "purpose", v)} />}
                          {followup === "cash_service" && <TextField label="הצורך בשירות" value={sv.purpose} onChange={(v) => updateServiceField(idx, "purpose", v)} />}
                          {followup === "loan" && (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <TextField label="מטרת האשראי" value={sv.purpose} onChange={(v) => updateServiceField(idx, "purpose", v)} />
                                <SelectField label="אמצעי ההחזר" value={sv.repayment} onChange={(v) => updateServiceField(idx, "repayment", v)} options={[{ value: "bank_transfer", label: "העברה בנקאית" }, { value: "other", label: "אחר" }]} />
                              </div>
                              {sv.repayment === "bank_transfer" && <TextField label="שם חשבון, בנק, סניף ומספר חשבון" value={sv.repaymentBankDetails} onChange={(v) => updateServiceField(idx, "repaymentBankDetails", v)} />}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===== שלב 6 ===== */}
          {(currentStep === 6 || locked) && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-800">6. מקורות מימון והון</div>
              <CheckboxGroup values={s6.selectedSources} onChange={(v) => updateStep("step6", "selectedSources", v)} options={FUNDING_SOURCES.map((s) => ({ value: s, label: s }))} error={errFor("step6.selectedSources")} />
              {s6.selectedSources?.includes("רווחי תאגיד") && (
                <div className="grid grid-cols-3 gap-2 border border-slate-100 rounded-lg p-3">
                  <TextField label="שם התאגיד" value={s6.corporateProfits?.companyName} onChange={(v) => updateNested("step6", "corporateProfits", "companyName", v)} />
                  <TextField label="תחום פעילות" value={s6.corporateProfits?.field} onChange={(v) => updateNested("step6", "corporateProfits", "field", v)} />
                  <TextField label="אחוז החזקה" value={s6.corporateProfits?.ownershipPercent} onChange={(v) => updateNested("step6", "corporateProfits", "ownershipPercent", v)} />
                </div>
              )}
              {(s6.selectedSources?.includes("מתנה") || s6.selectedSources?.includes("ירושה")) && (
                <div className="grid grid-cols-2 gap-2 border border-slate-100 rounded-lg p-3">
                  <TextField label="פרטי המעניק/המוריש" value={s6.giftInheritance?.fromWhom} onChange={(v) => updateNested("step6", "giftInheritance", "fromWhom", v)} />
                  <TextField label="הקשר" value={s6.giftInheritance?.relation} onChange={(v) => updateNested("step6", "giftInheritance", "relation", v)} />
                </div>
              )}
              {s6.selectedSources?.includes("חסכונות") && (
                <div className="grid grid-cols-3 gap-2 border border-slate-100 rounded-lg p-3">
                  <TextField label="מעסיק עיקרי" value={s6.savings?.mainEmployer} onChange={(v) => updateNested("step6", "savings", "mainEmployer", v)} />
                  <TextField label="שנות ותק" value={s6.savings?.yearsSeniority} onChange={(v) => updateNested("step6", "savings", "yearsSeniority", v)} />
                  <TextField label="תחום פעילות המעסיק" value={s6.savings?.employerField} onChange={(v) => updateNested("step6", "savings", "employerField", v)} />
                </div>
              )}
              {s6.selectedSources?.includes('מכירת נדל"ן') && (
                <div className="border border-slate-100 rounded-lg p-3">
                  <TextField label="סוג הנדל״ן שנמכר" value={s6.realEstateSale?.propertyType} onChange={(v) => updateNested("step6", "realEstateSale", "propertyType", v)} />
                </div>
              )}
              {s6.selectedSources?.includes("משכורת") && (
                <div className="grid grid-cols-3 gap-2 border border-slate-100 rounded-lg p-3">
                  <TextField label="תחום עיסוק/מקצוע" value={s6.salary?.profession} onChange={(v) => updateNested("step6", "salary", "profession", v)} />
                  <TextField label="שנות ניסיון" value={s6.salary?.yearsExperience} onChange={(v) => updateNested("step6", "salary", "yearsExperience", v)} />
                  <TextField label="משך עבודה אצל המעסיק" value={s6.salary?.employmentDuration} onChange={(v) => updateNested("step6", "salary", "employmentDuration", v)} />
                </div>
              )}
              {s6.selectedSources?.includes("רווחים מהשקעות") && (
                <div className="grid grid-cols-2 gap-2 border border-slate-100 rounded-lg p-3">
                  <TextField label="משך החזקת התיק" value={s6.investmentProfits?.holdingPeriod} onChange={(v) => updateNested("step6", "investmentProfits", "holdingPeriod", v)} />
                  <TextField label="החברה המנהלת" value={s6.investmentProfits?.managingCompany} onChange={(v) => updateNested("step6", "investmentProfits", "managingCompany", v)} />
                </div>
              )}
            </div>
          )}

          {/* ===== שלב 7 ===== */}
          {(currentStep === 7 || locked) && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-800">7. שימוש במזומן</div>
              <RadioGroup label="שיעור הפעילות במזומן" value={s7.cashUsageLevel} onChange={(v) => updateStep("step7", "cashUsageLevel", v)} options={CASH_USAGE_LEVELS} error={errFor("step7.cashUsageLevel")} />
              {s7.cashUsageLevel && s7.cashUsageLevel !== "none" && (
                <>
                  <TextAreaField label="הסבר הצורך בקבלת מזומן" value={s7.cashNeedExplanation} onChange={(v) => updateStep("step7", "cashNeedExplanation", v)} error={errFor("step7.cashNeedExplanation")} />
                  <DynamicTable
                    title="גופים עיקריים לפעילות במזומן (עד 10)"
                    items={s7.cashEntities}
                    fields={[{ key: "name", label: "שם" }, { key: "idNumber", label: "מספר זהות/חברה" }, { key: "field", label: "תחום עיסוק" }, { key: "cashActivityType", label: "סוג הפעילות במזומן" }, { key: "monthlyVolume", label: "היקף חודשי" }]}
                    onAdd={() => (s7.cashEntities?.length || 0) < 10 && addListItem("step7", "cashEntities", { name: "", idNumber: "", field: "", cashActivityType: "", monthlyVolume: "" })}
                    onUpdate={(i, f, v) => updateListItem("step7", "cashEntities", i, f, v)}
                    onRemove={(i) => removeListItem("step7", "cashEntities", i)}
                    error={errFor("step7.cashEntities")}
                  />
                </>
              )}
              <TextAreaField label="מידע נוסף שיכול לסייע במתן השירות" value={s7.additionalInfo} onChange={(v) => updateStep("step7", "additionalInfo", v)} />
            </div>
          )}

          {/* ===== שלב 8 ===== */}
          {(currentStep === 8 || locked) && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-800">8. הצהרה</div>
              <div className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed">
                הנני מצהיר/ה כי כל הפרטים שמסרתי בטופס זה נכונים ומדויקים, וכי מסירת מידע כוזב או אי-מסירת פרטים מהווה עבירה על פי דין.
              </div>
              <label className={`flex items-center gap-2 text-sm ${errFor("step8.confirmedAccurate") ? "text-rose-600" : "text-slate-700"}`}>
                <input type="checkbox" checked={!!s8.confirmedAccurate} onChange={(e) => updateStep("step8", "confirmedAccurate", e.target.checked)} />
                קראתי ואני מאשר/ת שכל הפרטים בטופס נכונים
              </label>
            </div>
          )}
        </fieldset>

        {editable && (
          <div className="flex items-center justify-between mt-4">
            <button
              disabled={currentStep === 1}
              onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
              className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30"
            >
              <ChevronRight size={13} /> הקודם
            </button>
            <button
              disabled={currentStep === 8}
              onClick={() => setCurrentStep((s) => Math.min(8, s + 1))}
              className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30"
            >
              הבא <ChevronLeft size={13} />
            </button>
          </div>
        )}

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

function DynamicTable({ title, items, fields, onAdd, onUpdate, onRemove, error }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-xs font-medium text-slate-500">{title}</div>
        <button onClick={onAdd} className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50">
          <Plus size={12} /> הוסף
        </button>
      </div>
      {error && <div className="text-xs text-rose-600 mb-1.5">{error}</div>}
      {(!items || items.length === 0) ? (
        <div className="text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg p-3 text-center">אין עדיין רשומות</div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={item.id || i} className="flex items-center gap-2 border border-slate-200 rounded-lg p-2">
              <div className="grid gap-2 flex-1" style={{ gridTemplateColumns: `repeat(${fields.length}, minmax(0, 1fr))` }}>
                {fields.map((f) => (
                  <input
                    key={f.key}
                    value={item[f.key] || ""}
                    placeholder={f.label}
                    onChange={(e) => onUpdate(i, f.key, e.target.value)}
                    className="border border-slate-200 rounded-md py-1 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                  />
                ))}
              </div>
              <button onClick={() => onRemove(i)} className="text-rose-500 hover:text-rose-700 shrink-0"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
