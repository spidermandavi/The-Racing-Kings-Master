// Supabase client for The Racing Kings Master.
// This uses a publishable/anon key, which is safe to expose in browser code.
const SUPABASE_URL = 'https://oprfbthhvbqdiktnuqzz.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_qad4DWNHCFaLLbTv7cnZsw_t2YPsnuL';

const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

window.rkSupabase = supabaseClient;
