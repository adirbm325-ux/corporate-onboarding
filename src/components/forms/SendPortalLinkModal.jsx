import React, { useState } from "react";
import { X, Copy, Check, AlertTriangle, MessageCircle, Smartphone, Mail } from "lucide-react";
import { buildPortalUrl, buildWhatsAppLink, buildSmsLink, buildEmailLink, buildPortalMessage } from "../../utils/portalLink.js";

export default function SendPortalLinkModal({ c, onClose, onSaveContact }) {
  const [contactName, setContactName] = useState(c.contactName || "");
  const [contactPhone, setContactPhone] = useState(c.contactPhone || "");
  const [contactEmail, setContactEmail] = useState(c.contactEmail || "");
  const [copied, setCopied] = useState(false);

  const url = buildPortalUrl(c.id, c.portalToken);
  const message = buildPortalMessage(c.name, contactName, url);

  function handleSaveContact() {
    onSaveContact({ contactName, contactPhone, contactEmail });
  }

  function handleCopy() {
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 px-4 py-6">
      <div dir="rtl" className="bg-white rounded-xl max-w-md w-full p-6 max-h-full overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="font-medium text-slate-800">שלח קישור פורטל ללקוח</div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-4 flex items-start gap-2">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          הקישור מקנה גישה לתיק זה בלבד, ללא אימות זהות אמיתי בשלב זה — אין לשתף אותו מעבר ללקוח המיועד. השליחה בפועל דורשת לחיצת "שלח" שלך באפליקציית ההודעות — אין שליחה אוטומטית ללא מגע יד אדם.
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs text-slate-600 block mb-1">שם איש קשר</label>
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="w-full border border-slate-200 rounded-lg py-1.5 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-600 block mb-1">טלפון</label>
              <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="050-1234567" className="w-full border border-slate-200 rounded-lg py-1.5 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
            </div>
            <div>
              <label className="text-xs text-slate-600 block mb-1">דוא״ל</label>
              <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="w-full border border-slate-200 rounded-lg py-1.5 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
            </div>
          </div>
          <button onClick={handleSaveContact} className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">
            שמור פרטי קשר בתיק
          </button>
        </div>

        <div className="mt-5">
          <label className="text-xs text-slate-600 block mb-1">קישור הפורטל לתיק זה</label>
          <div className="flex items-center gap-2">
            <input readOnly value={url} className="flex-1 border border-slate-200 rounded-lg py-1.5 px-2.5 text-xs text-slate-500 bg-slate-50" />
            <button onClick={handleCopy} className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1 shrink-0">
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "הועתק" : "העתק"}
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <div className="text-xs font-medium text-slate-500">פתח הודעה מוכנה מראש בערוץ הרצוי</div>
          <a
            href={buildWhatsAppLink(contactPhone, message)}
            target="_blank"
            rel="noreferrer"
            className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 ${!contactPhone ? "opacity-40 pointer-events-none" : ""}`}
          >
            <MessageCircle size={15} /> פתח ב-WhatsApp
          </a>
          <a
            href={buildSmsLink(contactPhone, message)}
            className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 ${!contactPhone ? "opacity-40 pointer-events-none" : ""}`}
          >
            <Smartphone size={15} /> שלח SMS
          </a>
          <a
            href={buildEmailLink(contactEmail, `פתיחת תיק — ${c.name}`, message)}
            className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 ${!contactEmail ? "opacity-40 pointer-events-none" : ""}`}
          >
            <Mail size={15} /> שלח דוא״ל
          </a>
        </div>

        <div className="flex justify-start mt-5">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-950">סגור</button>
        </div>
      </div>
    </div>
  );
}
