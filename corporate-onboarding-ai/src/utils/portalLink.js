/* יצירה ופענוח של קישורי פורטל ייחודיים לתיק, וקישורי שליחה אמיתיים
   (לא מדומים) ל-WhatsApp/SMS/Email — כל אחד פותח את אפליקציית התקשורת
   עם הודעה מוכנה מראש; השליחה בפועל עדיין דורשת לחיצת "שלח" של אדם.
   src/utils/portalLink.js */

export function generatePortalToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function buildPortalUrl(caseId, token) {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?portal=${encodeURIComponent(caseId)}&token=${encodeURIComponent(token)}`;
}

/* קורא פרמטרים מה-URL הנוכחי. מחזיר null אם אין קישור פורטל בכתובת. */
export function parsePortalParamsFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const caseId = params.get("portal");
  const token = params.get("token");
  if (!caseId || !token) return null;
  return { caseId, token };
}

/* ממיר מספר טלפון ישראלי מקומי (050-1234567) לפורמט בינלאומי הנדרש
   על ידי wa.me (9725XXXXXXXX, בלי + ובלי מקפים/רווחים). זהו אומדן פשוט
   המניח מספר ישראלי — אינו מאמת תקינות המספר. */
export function normalizeIsraeliPhoneForWhatsApp(phone) {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return `972${digits.slice(1)}`;
  return digits;
}

export function buildWhatsAppLink(phone, message) {
  const normalized = normalizeIsraeliPhoneForWhatsApp(phone);
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function buildSmsLink(phone, message) {
  return `sms:${phone}?body=${encodeURIComponent(message)}`;
}

export function buildEmailLink(email, subject, message) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
}

export function buildPortalMessage(caseName, contactName, url) {
  return `שלום ${contactName || ""},\nלצורך השלמת פתיחת התיק עבור ${caseName}, אנא היכנס/י לקישור הבא ומלא/י את הפרטים הנדרשים:\n${url}\n\nהקישור אישי ותקף לתיק זה בלבד — אין להעביר אותו הלאה.`;
}
