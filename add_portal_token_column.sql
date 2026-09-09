-- תיקון נקודתי: הוספת עמודת portal_token שהייתה חסרה מלכתחילה בטבלת
-- cases. זה לא מוחק שום נתון קיים - רק מוסיף עמודה חדשה וריקה.

ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS portal_token TEXT;

NOTIFY pgrst, 'reload schema';
