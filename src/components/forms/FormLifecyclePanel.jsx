import React, { useState } from "react";
import { AlertTriangle, PenLine, Stamp, Send, CheckCircle2, RotateCcw } from "lucide-react";

/* אזור מחזור החיים המוצג מתחת לשדות הטופס עצמו — זהה בין כל סוגי הטפסים.
   requiresStamp קובע האם נדרשת גם חותמת תאגיד לפני הגשה (רלוונטי לייפוי כוח
   תאגיד, לא רלוונטי להצהרת מקבל שירות/KYC שנחתמים על ידי אדם בלבד). */
export default function FormLifecyclePanel({
  form, viewContext, requiresStamp,
  onSign, onApplyStamp, onSubmitForReview, onStartReview, onRequestCorrection, onApprove,
}) {
  const [signedName, setSignedName] = useState(form.signedBy || "");
  const [signedDate, setSignedDate] = useState(form.signedAt || "");
  const [confirmDetailsAccurate, setConfirmDetailsAccurate] = useState(false);
  const [confirmAuthorizedSigner, setConfirmAuthorizedSigner] = useState(false);
  const [stampConfirmed, setStampConfirmed] = useState(false);
  const [correctionNote, setCorrectionNote] = useState("");

  const canSign = signedName.trim() && signedDate.trim() && confirmDetailsAccurate && confirmAuthorizedSigner;
  const canSubmitForReview = requiresStamp ? !!form.signedBy && !!form.stampApplied : !!form.signedBy;

  if (form.status === "awaiting_signature") {
    return (
      <div className="mt-5 border border-slate-200 rounded-lg p-4 space-y-4">
        <div className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
          <PenLine size={15} /> חתימה{requiresStamp ? " וחותמת" : ""}
        </div>

        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          זוהי סימולציה בלבד ואינה מהווה חתימה אלקטרונית משפטית. אין להזין נתוני לקוחות אמיתיים.
        </div>

        {!form.signedBy ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-600 block mb-1">שם החותם</label>
                <input
                  value={signedName}
                  onChange={(e) => setSignedName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg py-1.5 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 block mb-1">תאריך חתימה</label>
                <input
                  value={signedDate}
                  onChange={(e) => setSignedDate(e.target.value)}
                  placeholder="DD/MM/YYYY"
                  className="w-full border border-slate-200 rounded-lg py-1.5 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={confirmDetailsAccurate} onChange={(e) => setConfirmDetailsAccurate(e.target.checked)} />
              אני מאשר/ת שהפרטים בטופס נכונים
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={confirmAuthorizedSigner} onChange={(e) => setConfirmAuthorizedSigner(e.target.checked)} />
              אני מאשר/ת שהחותם מורשה לחתום על טופס זה
            </label>
            <button
              disabled={!canSign}
              onClick={() => onSign(signedName.trim(), signedDate.trim())}
              className="text-sm px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-950 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              חתום בסימולציה
            </button>
          </div>
        ) : (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <CheckCircle2 size={14} /> נחתם על ידי {form.signedBy} בתאריך {form.signedAt} (סימולציה)
          </div>
        )}

        {requiresStamp && form.signedBy && !form.stampApplied && (
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
              <Stamp size={15} /> חותמת תאגיד
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={stampConfirmed} onChange={(e) => setStampConfirmed(e.target.checked)} />
              אני מאשר/ת הטבעת חותמת תאגיד על מסמך זה
            </label>
            <button
              disabled={!stampConfirmed}
              onClick={onApplyStamp}
              className="text-sm px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-950 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              הוסף חותמת בסימולציה
            </button>
          </div>
        )}

        {requiresStamp && form.stampApplied && (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <CheckCircle2 size={14} /> חותמת תאגיד נוספה בסימולציה ({form.stampAppliedAt})
          </div>
        )}

        {canSubmitForReview && (
          <button
            onClick={onSubmitForReview}
            className="text-sm px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-950 flex items-center gap-2"
          >
            <Send size={14} /> הגש לבדיקה
          </button>
        )}
      </div>
    );
  }

  if (form.status === "submitted") {
    return (
      <div className="mt-5 border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="text-sm text-slate-700">
          הטופס הוגש לבדיקה ב-{form.submittedAt}, נחתם על ידי {form.signedBy} ({form.signedAt}).
        </div>
        {viewContext === "employee" ? (
          <button onClick={onStartReview} className="text-sm px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-950">
            התחל בדיקה
          </button>
        ) : (
          <div className="text-sm text-slate-500">הטופס ממתין לבדיקת עובד מורשה.</div>
        )}
      </div>
    );
  }

  if (form.status === "under_review") {
    return (
      <div className="mt-5 border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="text-sm text-slate-700">הטופס בבדיקת עובד. נחתם על ידי {form.signedBy} ({form.signedAt}).</div>
        {viewContext === "employee" ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-600 block mb-1">הערת תיקון (חובה להחזרה לתיקון)</label>
              <textarea
                value={correctionNote}
                onChange={(e) => setCorrectionNote(e.target.value)}
                rows={2}
                className="w-full border border-slate-200 rounded-lg py-1.5 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={!correctionNote.trim()}
                onClick={() => onRequestCorrection(correctionNote)}
                className="text-sm px-4 py-2 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <RotateCcw size={14} /> החזר לתיקון
              </button>
              <button onClick={onApprove} className="text-sm px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-950 flex items-center gap-2">
                <CheckCircle2 size={14} /> אשר טופס
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-500">הטופס בבדיקת עובד מורשה.</div>
        )}
      </div>
    );
  }

  if (form.status === "approved") {
    return (
      <div className="mt-5 border border-emerald-200 bg-emerald-50 rounded-lg p-4 text-sm text-emerald-800 space-y-1">
        <div className="flex items-center gap-1.5"><CheckCircle2 size={15} /> הטופס אושר</div>
        <div>
          נחתם על ידי {form.signedBy} ({form.signedAt})
          {requiresStamp && <> · חותמת: {form.stampApplied ? `נוספה (${form.stampAppliedAt})` : "—"}</>}
        </div>
        <div>אושר על ידי {form.reviewedBy} ({form.reviewedAt})</div>
      </div>
    );
  }

  return null;
}
