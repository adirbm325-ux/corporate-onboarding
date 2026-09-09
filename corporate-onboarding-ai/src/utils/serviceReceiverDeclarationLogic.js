/* חישוב אחוז השלמה וולידציה לטופס הצהרת מקבל שירות. src/utils/serviceReceiverDeclarationLogic.js */

export const DECLARANT_FIELDS = [
  { key: "fullName", label: "שם מלא" },
  { key: "idNumber", label: "מספר זהות" },
];

export const BENEFICIARY_FIELDS = [
  { key: "name", label: "שם מלא" },
  { key: "idNumber", label: "מספר זהות" },
  { key: "dob", label: "תאריך לידה / התאגדות" },
  { key: "gender", label: "מין" },
  { key: "address", label: "מען" },
];

export const OWNER_FIELDS = [
  { key: "fullName", label: "שם מלא" },
  { key: "idNumber", label: "מספר זהות" },
  { key: "dob", label: "תאריך לידה" },
  { key: "gender", label: "מין" },
  { key: "address", label: "כתובת" },
];

export const SERVICE_BASIS_OPTIONS = [
  { value: "self", label: "מבקש/ת לקבל את השירות בעבור עצמי בלבד" },
  { value: "beneficiary", label: "מבקש/ת לקבל את השירות בעבור נהנה אחר" },
  { value: "unknown_beneficiary", label: "קיים נהנה, אך פרטי הזיהוי שלו אינם ידועים כעת" },
];

export const CONTROLLING_OWNERS_BASIS_OPTIONS = [
  { value: "none", label: "אין בעל שליטה בתאגיד" },
  { value: "list", label: "בעלי השליטה הם הרשימה שלהלן" },
];

export function computeServiceReceiverDeclarationCompletion(data) {
  let total = DECLARANT_FIELDS.length + 1 /* role */ + 1 /* serviceBasis */;
  let filled = 0;
  DECLARANT_FIELDS.forEach((f) => { if (data.declarant?.[f.key]?.trim()) filled++; });
  if (data.declarant?.role?.trim()) filled++;
  if (data.serviceBasis) filled++;

  if (data.serviceBasis === "unknown_beneficiary") {
    total += 1;
    if (data.unknownBeneficiaryExplanation?.trim()) filled++;
  }
  if (data.serviceBasis === "beneficiary") {
    total += BENEFICIARY_FIELDS.length;
    const first = data.beneficiaries?.[0];
    BENEFICIARY_FIELDS.forEach((f) => { if (first?.[f.key]?.trim()) filled++; });
  }
  if (data.controllingOwnersBasis === "list") {
    total += OWNER_FIELDS.length;
    const first = data.controllingOwners?.[0];
    OWNER_FIELDS.forEach((f) => { if (first?.[f.key]?.trim()) filled++; });
  } else if (data.controllingOwnersBasis) {
    total += 1;
    filled += 1;
  } else {
    total += 1;
  }
  return total ? Math.round((filled / total) * 100) : 0;
}

export function validateServiceReceiverDeclaration(data) {
  const errs = [];
  DECLARANT_FIELDS.forEach((f) => {
    if (!data.declarant?.[f.key]?.trim()) errs.push({ field: `declarant.${f.key}`, message: `פרטי המצהיר — ${f.label}` });
  });
  if (!data.declarant?.role?.trim()) {
    errs.push({ field: "declarant.role", message: "פרטי המצהיר — יש לבחור תפקיד" });
  }
  if (!data.serviceBasis) {
    errs.push({ field: "serviceBasis", message: 'יש לבחור בסיס לקבלת השירות' });
  }
  if (data.serviceBasis === "unknown_beneficiary" && !data.unknownBeneficiaryExplanation?.trim()) {
    errs.push({ field: "unknownBeneficiaryExplanation", message: "יש להסביר מדוע פרטי הנהנה אינם ידועים, ולהתחייב למוסרם עם היוודעם" });
  }
  if (data.serviceBasis === "beneficiary") {
    if (!data.beneficiaries || data.beneficiaries.length === 0) {
      errs.push({ field: "beneficiaries", message: "נדרש לפחות נהנה אחד" });
    } else {
      data.beneficiaries.forEach((b, i) => {
        BENEFICIARY_FIELDS.forEach((f) => {
          if (!b[f.key]?.trim()) errs.push({ field: `beneficiaries.${i}.${f.key}`, message: `נהנה ${i + 1} — ${f.label}` });
        });
      });
    }
  }
  if (!data.controllingOwnersBasis) {
    errs.push({ field: "controllingOwnersBasis", message: "יש לבחור האם קיימים בעלי שליטה בתאגיד" });
  } else if (data.controllingOwnersBasis === "list") {
    if (!data.controllingOwners || data.controllingOwners.length === 0) {
      errs.push({ field: "controllingOwners", message: "נדרש לפחות בעל שליטה אחד" });
    } else {
      data.controllingOwners.forEach((o, i) => {
        OWNER_FIELDS.forEach((f) => {
          if (!o[f.key]?.trim()) errs.push({ field: `controllingOwners.${i}.${f.key}`, message: `בעל שליטה ${i + 1} — ${f.label}` });
        });
      });
    }
  }
  return errs;
}
