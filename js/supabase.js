// Shared Supabase client + auth helpers for every page.
// Keep this file loaded before menu.js and any page-specific scripts.
const SUPABASE_URL = 'https://oprfbthhvbqdiktnuqzz.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_qad4DWNHCFaLLbTv7cnZsw_t2YPsnuL';

const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit'
  }
});

window.rkSupabase = supabaseClient;

window.rkAuth = {
  async session() {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async user() {
    const session = await this.session();
    if (!session) return null;

    // maybeSingle() prevents a missing profile from making the global menu
    // incorrectly treat an authenticated session as logged out.
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('id,username,country,description,rating,is_admin,created_at,updated_at')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error) throw error;

    return data ? { ...data, email: session.user.email } : {
      id: session.user.id,
      username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'Member',
      country: null,
      description: null,
      rating: null,
      is_admin: false,
      created_at: null,
      updated_at: null,
      email: session.user.email
    };
  },

  async requireUser() {
    const user = await this.user();
    if (!user) {
      window.location.href = 'auth.html';
      throw new Error('Login required');
    }
    return user;
  },

  async isAdmin() {
    const user = await this.user();
    return !!user?.is_admin;
  }
};
