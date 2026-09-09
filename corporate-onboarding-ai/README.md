# Corporate Onboarding AI — אבטיפוס

אבטיפוס Frontend בלבד, עם נתוני דמה. אין חיבור אמיתי לישות, לחשבשבת, ל-WhatsApp או לכל שירות חיצוני.

## הרצה מקומית

```bash
npm install
npm run dev
```

לאחר מכן פתחו את הכתובת שתוצג בטרמינל (בדרך כלל http://localhost:5173).

## בדיקת בנייה

```bash
npm run build
```

## מה מדומה בשלב זה

- כל הנתונים (תאגידים, מסמכים, נציגים, משימות, יומן פעילות) הם נתוני דמה בקובץ src/App.jsx.
- שכבת "mock integration adapter" מיוצגת כרגע כפונקציות בתוך src/App.jsx (createCorporateCase, cycleDocStatus, sendCompletionRequest וכו') — נועדו להיות מוחלפות בעתיד ב-API אמיתי.
- שינויים (סטטוס מסמכים, משימות, פעילות) נשמרים ב-localStorage של הדפדפן בלבד.
- שליחת בקשות השלמה, תזכורות וייצוא לישות/חשבשבת הן סימולציות (toast + עדכון סטטוס) ואינן פונות לשום שירות חיצוני.
