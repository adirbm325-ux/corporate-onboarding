/* חישוב אחוז השלמה וולידציה לטופס ייפוי כוח תאגיד. src/utils/corporatePoaLogic.js */

export const COMPANY_FIELDS = [
  { key: "name", label: "שם החברה" },
  { key: "companyNumber", label: "מספר חברה" },
  { key: "incorporationDate", label: "תאריך התאגדות" },
  { key: "address", label: "כתובת החברה" },
];

export const PERSON_FIELDS = [
  { key: "fullName", label: "שם מלא" },
  { key: "idNumber", label: "מספר זהות" },
  { key: "dob", label: "תאריך לידה" },
  { key: "gender", label: "מין" },
  { key: "address", label: "כתובת" },
];

/* אחוז השלמה לפי שדות נדרשים בפועל: 4 שדות תאגיד + (5 שדות נותן הרשאה + סימון מורשה
   חתימה) + 5 שדות מיופה הכוח הראשון (המינימום הנדרש) + 5 שדות בעל השליטה הראשון
   (המינימום הנדרש). הוספת מיופי כוח/בעלי שליטה נוספים מעבר למינימום אינה משנה את המכנה. */
export function computeCorporatePoaCompletion(data) {
  const total = COMPANY_FIELDS.length + (PERSON_FIELDS.length + 1) + PERSON_FIELDS.length * 2;
  let filled = 0;
  COMPANY_FIELDS.forEach((f) => { if (data.company?.[f.key]?.trim()) filled++; });
  PERSON_FIELDS.forEach((f) => { if (data.grantor?.[f.key]?.trim()) filled++; });
  if (data.grantor?.isAuthorizedSigner) filled++;
  const firstAttorney = data.attorneys?.[0];
  PERSON_FIELDS.forEach((f) => { if (firstAttorney?.[f.key]?.trim()) filled++; });
  const firstOwner = data.controllingOwners?.[0];
  PERSON_FIELDS.forEach((f) => { if (firstOwner?.[f.key]?.trim()) filled++; });
  return total ? Math.round((filled / total) * 100) : 0;
}

export function validateCorporatePoa(data) {
  const errs = [];
  COMPANY_FIELDS.forEach((f) => {
    if (!data.company?.[f.key]?.trim()) errs.push({ field: `company.${f.key}`, message: `פרטי תאגיד — ${f.label}` });
  });
  PERSON_FIELDS.forEach((f) => {
    if (!data.grantor?.[f.key]?.trim()) errs.push({ field: `grantor.${f.key}`, message: `נותן ההרשאה — ${f.label}` });
  });
  if (!data.grantor?.isAuthorizedSigner) {
    errs.push({ field: "grantor.isAuthorizedSigner", message: "נותן ההרשאה — יש לאשר שהוא מורשה חתימה בחברה" });
  }
  if (!data.attorneys || data.attorneys.length === 0) {
    errs.push({ field: "attorneys", message: "נדרש לפחות מיופה כוח אחד" });
  } else {
    data.attorneys.forEach((a, i) => {
      PERSON_FIELDS.forEach((f) => {
        if (!a[f.key]?.trim()) errs.push({ field: `attorneys.${i}.${f.key}`, message: `מיופה כוח ${i + 1} — ${f.label}` });
      });
    });
  }
  if (!data.controllingOwners || data.controllingOwners.length === 0) {
    errs.push({ field: "controllingOwners", message: "נדרש לפחות בעל שליטה אחד" });
  } else {
    data.controllingOwners.forEach((o, i) => {
      PERSON_FIELDS.forEach((f) => {
        if (!o[f.key]?.trim()) errs.push({ field: `controllingOwners.${i}.${f.key}`, message: `בעל שליטה ${i + 1} — ${f.label}` });
      });
    });
  }
  return errs;
}
