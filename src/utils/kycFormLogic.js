/* טופס הכר את הלקוח המורחב — מודל נתונים, ולידציה וחישוב השלמה לכל 8 השלבים.
   src/utils/kycFormLogic.js */

import { EXPECTED_SERVICES, FUNDING_SOURCES, CASH_USAGE_LEVELS } from "../data/formDefinitions.js";

export const STEPS = [
  { id: 1, label: "פרטים אישיים וסוג לקוח" },
  { id: 2, label: "חשבון בנק ואיש ציבור" },
  { id: 3, label: "זיקות, פעולה עבור אחר ושליחים" },
  { id: 4, label: "פרטי התאגיד והפעילות העסקית" },
  { id: 5, label: "פעילות צפויה" },
  { id: 6, label: "מקורות מימון והון" },
  { id: 7, label: "שימוש במזומן" },
  { id: 8, label: "הצהרה" },
];

export const CLIENT_TYPE_OPTIONS = [
  { value: "private", label: "פרטי — פועל עבור עצמו לצרכים אישיים" },
  { value: "business_licensed", label: "עסקי — עוסק מורשה" },
  { value: "business_for_company", label: "עסקי — פועל בשם תאגיד" },
  { value: "financial_service_provider", label: "נותן שירותים פיננסיים" },
];

export const COUNTRY_TIE_RELATIONS = [
  { value: "business", label: "פעילות עסקית" },
  { value: "financial", label: "פעילות כספית" },
  { value: "birthplace", label: "מקום לידה" },
  { value: "address", label: "כתובת" },
  { value: "citizenship", label: "אזרחות" },
  { value: "family", label: "משפחה" },
  { value: "other", label: "אחר" },
];

export const SPECIAL_ACTIVITY_FIELDS = [
  { value: "financial_services", label: "נותני שירותים פיננסיים" },
  { value: "security", label: "חברות שמירה/אבטחה" },
  { value: "manpower", label: "חברות כוח אדם" },
  { value: "nonprofits", label: "עמותות" },
  { value: "gambling", label: "הימורים" },
  { value: "fuel", label: "ענף הדלק" },
  { value: "none", label: "אין קשר לתחומים אלה" },
];

export const PROVIDER_REASON_OPTIONS = [
  { value: "geo", label: "נוחות גאוגרפית" },
  { value: "recommendation", label: "המלצה" },
  { value: "subagent", label: "סוכן משנה של ספק שירות אחר" },
  { value: "refused_elsewhere", label: "בנק/נותן שירות אחר סירב לתת שירות" },
  { value: "advertising", label: "היענות לפרסום" },
  { value: "credit_need", label: "צורך באשראי" },
  { value: "no_other_provider", label: "אין ספק אחר לשירות המבוקש" },
  { value: "other", label: "אחר" },
];

export const AMOUNT_RANGES = [
  { value: "under10k", label: "מתחת ל־10,000 ₪" },
  { value: "10k_50k", label: "10,000–50,000 ₪" },
  { value: "50k_100k", label: "50,001–100,000 ₪" },
  { value: "over100k", label: "מעל 100,000 ₪" },
];

/* שירותים שדורשים שאלת המשך ייעודית, לפי אינדקס מתוך EXPECTED_SERVICES */
export const SERVICE_FOLLOWUP_KEY = {
  0: "fx_purpose",
  1: "fx_purpose",
  2: "transfer_purpose",
  3: "transfer_purpose",
  5: "self_check",
  6: "third_party_check",
  7: "cash_service",
  8: "cash_service",
  11: "loan",
  12: "loan",
};

export { EXPECTED_SERVICES, FUNDING_SOURCES, CASH_USAGE_LEVELS };

function empty(list) {
  return !list || list.length === 0;
}

function validateStep1(d) {
  const errs = [];
  const s = d.step1 || {};
  ["fullName", "idNumber", "dob", "gender", "address"].forEach((k) => {
    if (!s[k]?.trim()) errs.push({ field: `step1.${k}`, step: 1, message: "שלב 1 — שדה חובה חסר בפרטים האישיים" });
  });
  if (!s.residency) errs.push({ field: "step1.residency", step: 1, message: "שלב 1 — יש לבחור תושבות" });
  if (s.residency === "other" && !s.residencyDetails?.trim()) errs.push({ field: "step1.residencyDetails", step: 1, message: "שלב 1 — פירוט תושבות חסר" });
  if (!s.clientType) errs.push({ field: "step1.clientType", step: 1, message: "שלב 1 — יש לבחור סוג לקוח" });
  if (s.clientType === "business_for_company" && !s.companyRole?.trim()) errs.push({ field: "step1.companyRole", step: 1, message: "שלב 1 — תפקיד בתאגיד חסר" });
  if (s.clientType === "financial_service_provider") {
    ["licenseType", "licenseScope", "licenseNumber", "complianceOfficerName"].forEach((k) => {
      if (!s[k]) errs.push({ field: `step1.${k}`, step: 1, message: "שלב 1 — פרטי רישיון חסרים" });
    });
  }
  if (!s.fieldOfActivity?.trim()) errs.push({ field: "step1.fieldOfActivity", step: 1, message: "שלב 1 — תחום עיסוק חסר" });
  return errs;
}

function validateStep2(d) {
  const errs = [];
  const s = d.step2 || {};
  if (s.hasIsraeliBankAccount === null || s.hasIsraeliBankAccount === undefined) {
    errs.push({ field: "step2.hasIsraeliBankAccount", step: 2, message: "שלב 2 — יש לענות על שאלת חשבון הבנק" });
  } else if (s.hasIsraeliBankAccount) {
    ["bankName", "branchNumber", "branchCity", "accountNumber"].forEach((k) => {
      if (!s[k]?.trim()) errs.push({ field: `step2.${k}`, step: 2, message: "שלב 2 — פרטי חשבון בנק חסרים" });
    });
  } else if (!s.refusalReason?.trim()) {
    errs.push({ field: "step2.refusalReason", step: 2, message: "שלב 2 — יש לפרט מדוע אין חשבון בנק" });
  }
  if (s.isPep === null || s.isPep === undefined) {
    errs.push({ field: "step2.isPep", step: 2, message: "שלב 2 — יש לענות על שאלת איש ציבור" });
  } else if (s.isPep) {
    ["pepType", "pepRole", "pepCountry"].forEach((k) => {
      if (!s[k]) errs.push({ field: `step2.${k}`, step: 2, message: "שלב 2 — פרטי איש הציבור חסרים" });
    });
  }
  return errs;
}

function validateStep3(d) {
  const errs = [];
  const s = d.step3 || {};
  if (s.hasCountryTies === null || s.hasCountryTies === undefined) {
    errs.push({ field: "step3.hasCountryTies", step: 3, message: "שלב 3 — יש לענות על שאלת הזיקה למדינות" });
  } else if (s.hasCountryTies) {
    if (empty(s.countryTiesCountries)) errs.push({ field: "step3.countryTiesCountries", step: 3, message: "שלב 3 — יש לבחור מדינה אחת לפחות" });
    if (!s.countryTiesRelation) errs.push({ field: "step3.countryTiesRelation", step: 3, message: "שלב 3 — יש לבחור סוג קשר" });
  }
  if (s.actingForOther === null || s.actingForOther === undefined) {
    errs.push({ field: "step3.actingForOther", step: 3, message: "שלב 3 — יש לענות האם פועל עבור אחר" });
  } else if (s.actingForOther && (!s.actingForOtherName?.trim() || !s.actingForOtherId?.trim())) {
    errs.push({ field: "step3.actingForOtherName", step: 3, message: "שלב 3 — פרטי האדם שבעבורו פועל חסרים" });
  }
  if (empty(s.specialActivityFields)) {
    errs.push({ field: "step3.specialActivityFields", step: 3, message: 'שלב 3 — יש לבחור לפחות אפשרות אחת (או "אין קשר")' });
  }
  if (!s.reasonForChoosingProvider) errs.push({ field: "step3.reasonForChoosingProvider", step: 3, message: "שלב 3 — יש לבחור סיבת בחירת נותן השירות" });
  if (s.reasonForChoosingProvider === "other" && !s.reasonOther?.trim()) errs.push({ field: "step3.reasonOther", step: 3, message: "שלב 3 — פירוט הסיבה חסר" });
  return errs;
}

function validateStep4(d) {
  const errs = [];
  const s = d.step4 || {};
  if (!s.familiarityLevel) errs.push({ field: "step4.familiarityLevel", step: 4, message: "שלב 4 — יש לבחור רמת היכרות עם העסק" });
  ["ceoName", "ceoId", "companyFullName", "companyNumber", "companyAddress", "annualTurnover", "employeeCount"].forEach((k) => {
    if (!s[k]?.trim()) errs.push({ field: `step4.${k}`, step: 4, message: "שלב 4 — שדה חובה חסר בפרטי העסק" });
  });
  if (!s.mainClients) errs.push({ field: "step4.mainClients", step: 4, message: "שלב 4 — יש לבחור סוג לקוחות עיקריים" });
  return errs;
}

function validateStep5(d) {
  const errs = [];
  const services = d.step5?.selectedServices || [];
  if (empty(services)) {
    errs.push({ field: "step5.selectedServices", step: 5, message: "שלב 5 — יש לבחור לפחות שירות צפוי אחד" });
    return errs;
  }
  services.forEach((sv, i) => {
    if (!sv.amountRange) errs.push({ field: `step5.services.${i}.amountRange`, step: 5, message: `שלב 5 — טווח סכום חסר עבור "${sv.name}"` });
    if (!sv.monthlyVolume?.trim() && !sv.annualVolume?.trim()) {
      errs.push({ field: `step5.services.${i}.volume`, step: 5, message: `שלב 5 — יש למלא היקף חודשי או שנתי עבור "${sv.name}"` });
    }
    if (sv.monthlyVolume?.trim() && sv.annualVolume?.trim()) {
      errs.push({ field: `step5.services.${i}.volumeBoth`, step: 5, message: `שלב 5 — אין למלא גם היקף חודשי וגם שנתי עבור "${sv.name}"` });
    }
    const followup = SERVICE_FOLLOWUP_KEY[sv.index];
    if (followup === "fx_purpose" && !sv.purpose?.trim()) errs.push({ field: `step5.services.${i}.purpose`, step: 5, message: `שלב 5 — מטרת השימוש במט"ח חסרה עבור "${sv.name}"` });
    if (followup === "transfer_purpose" && !sv.purpose?.trim()) errs.push({ field: `step5.services.${i}.purpose`, step: 5, message: `שלב 5 — מהות ההעברה חסרה עבור "${sv.name}"` });
    if (followup === "self_check" && (!sv.purpose?.trim() || !sv.repayment?.trim())) errs.push({ field: `step5.services.${i}.selfCheck`, step: 5, message: `שלב 5 — מטרת האשראי/אמצעי ההחזר חסרים עבור "${sv.name}"` });
    if (followup === "third_party_check" && !sv.purpose?.trim()) errs.push({ field: `step5.services.${i}.purpose`, step: 5, message: `שלב 5 — פירוט השיקים חסר עבור "${sv.name}"` });
    if (followup === "cash_service" && !sv.purpose?.trim()) errs.push({ field: `step5.services.${i}.purpose`, step: 5, message: `שלב 5 — הצורך בשירות חסר עבור "${sv.name}"` });
    if (followup === "loan") {
      if (!sv.purpose?.trim() || !sv.repayment?.trim()) errs.push({ field: `step5.services.${i}.loan`, step: 5, message: `שלב 5 — מטרת האשראי/אמצעי ההחזר חסרים עבור "${sv.name}"` });
      if (sv.repayment === "bank_transfer" && !sv.repaymentBankDetails?.trim()) errs.push({ field: `step5.services.${i}.repaymentBankDetails`, step: 5, message: `שלב 5 — פרטי חשבון להחזר חסרים עבור "${sv.name}"` });
    }
  });
  return errs;
}

function validateStep6(d) {
  const errs = [];
  const sources = d.step6?.selectedSources || [];
  if (empty(sources)) {
    errs.push({ field: "step6.selectedSources", step: 6, message: "שלב 6 — יש לבחור לפחות מקור מימון אחד" });
    return errs;
  }
  const s6 = d.step6 || {};
  if (sources.includes("רווחי תאגיד") && (!s6.corporateProfits?.companyName?.trim() || !s6.corporateProfits?.field?.trim() || !s6.corporateProfits?.ownershipPercent?.trim())) {
    errs.push({ field: "step6.corporateProfits", step: 6, message: "שלב 6 — פרטי רווחי התאגיד חסרים" });
  }
  if ((sources.includes("מתנה") || sources.includes("ירושה")) && (!s6.giftInheritance?.fromWhom?.trim() || !s6.giftInheritance?.relation?.trim())) {
    errs.push({ field: "step6.giftInheritance", step: 6, message: "שלב 6 — פרטי המעניק/המוריש חסרים" });
  }
  if (sources.includes("חסכונות") && (!s6.savings?.mainEmployer?.trim() || !s6.savings?.yearsSeniority?.trim())) {
    errs.push({ field: "step6.savings", step: 6, message: "שלב 6 — פרטי החסכונות חסרים" });
  }
  if (sources.includes('מכירת נדל"ן') && !s6.realEstateSale?.propertyType?.trim()) {
    errs.push({ field: "step6.realEstateSale", step: 6, message: 'שלב 6 — סוג הנדל"ן שנמכר חסר' });
  }
  if (sources.includes("משכורת") && (!s6.salary?.profession?.trim() || !s6.salary?.yearsExperience?.trim())) {
    errs.push({ field: "step6.salary", step: 6, message: "שלב 6 — פרטי המשכורת חסרים" });
  }
  if (sources.includes("רווחים מהשקעות") && (!s6.investmentProfits?.holdingPeriod?.trim() || !s6.investmentProfits?.managingCompany?.trim())) {
    errs.push({ field: "step6.investmentProfits", step: 6, message: "שלב 6 — פרטי ההשקעות חסרים" });
  }
  return errs;
}

function validateStep7(d) {
  const errs = [];
  const s = d.step7 || {};
  if (!s.cashUsageLevel) {
    errs.push({ field: "step7.cashUsageLevel", step: 7, message: "שלב 7 — יש לבחור שיעור פעילות במזומן" });
    return errs;
  }
  if (s.cashUsageLevel !== "none") {
    if (!s.cashNeedExplanation?.trim()) errs.push({ field: "step7.cashNeedExplanation", step: 7, message: "שלב 7 — הסבר הצורך במזומן חסר" });
    if (empty(s.cashEntities)) errs.push({ field: "step7.cashEntities", step: 7, message: "שלב 7 — יש לפרט לפחות גוף אחד לפעילות במזומן" });
  }
  return errs;
}

function validateStep8(d) {
  const errs = [];
  if (!d.step8?.confirmedAccurate) {
    errs.push({ field: "step8.confirmedAccurate", step: 8, message: "שלב 8 — יש לאשר שהפרטים נכונים לפני המשך לחתימה" });
  }
  return errs;
}

const STEP_VALIDATORS = [validateStep1, validateStep2, validateStep3, validateStep4, validateStep5, validateStep6, validateStep7, validateStep8];

export function validateKycForm(data) {
  const d = data || {};
  return STEP_VALIDATORS.flatMap((fn) => fn(d));
}

/* אחוז השלמה גס: אחוז השלבים (מתוך 8) שאין בהם אף שגיאת ולידציה */
export function computeKycCompletion(data) {
  const completeSteps = STEP_VALIDATORS.filter((fn) => fn(data || {}).length === 0).length;
  return Math.round((completeSteps / STEP_VALIDATORS.length) * 100);
}

/* קיבוץ שגיאות ולידציה לפי שלב, לתג "יש שגיאות" ליד כל שלב באשף */
export function errorsByStep(errors) {
  const map = {};
  errors.forEach((e) => { map[e.step] = (map[e.step] || 0) + 1; });
  return map;
}
