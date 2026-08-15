const SUPABASE_URL = "https://oprfbthhvbqdiktnuqzz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_qad4DWNHCFaLLbTv7cnZsw_t2YPsnuL";
const rkSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
window.rkSupabase = rkSupabase;
window.rkAuth = {
  async session() { const { data, error } = await rkSupabase.auth.getSession(); if (error) throw error; return data.session; },
  async user() { const session = await this.session(); if (!session) return null; const { data, error } = await rkSupabase.from('profiles').select('id,username,country,description,rating,is_admin,created_at,updated_at').eq('id', session.user.id).single(); if (error) throw error; return { ...data, email: session.user.email }; },
  async requireUser() { const user = await this.user(); if (!user) { window.location.href = 'auth.html'; throw new Error('Login required'); } return user; }
};
