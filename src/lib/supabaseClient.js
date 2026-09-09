/* קליינט Supabase. src/lib/supabaseClient.js
   אם המפתחות חסרים (או לא תקינים), isSupabaseConfigured יהיה false ו-supabase יהיה null —
   שכבת dataStore.js אחראית לזהות את זה ולעבוד מול localStorage בלבד במקרה כזה. */

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(url && key && url.trim().startsWith("http"));

export const supabase = isSupabaseConfigured ? createClient(url, key) : null;
