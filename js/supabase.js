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

function fallbackUserFromSession(session) {
  const authUser = session?.user;
  if (!authUser) return null;

  return {
    id: authUser.id,
    username:
      authUser.user_metadata?.username ||
      authUser.user_metadata?.lichess_username ||
      authUser.email?.split('@')[0] ||
      'Member',
    country: authUser.user_metadata?.country || null,
    description: null,
    rating: null,
    is_admin: false,
    created_at: authUser.created_at || null,
    updated_at: null,
    email: authUser.email || null
  };
}

window.rkAuth = {
  async session() {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async user() {
    const session = await this.session();
    if (!session) return null;

    // A valid Supabase session is authoritative for authentication.
    // Start with a session-derived user so a profile-table/RLS/network
    // problem can never make the global UI incorrectly say "Login".
    const fallback = fallbackUserFromSession(session);

    try {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('id,username,country,description,rating,is_admin,created_at,updated_at')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error) {
        console.warn('Could not load site profile; keeping authenticated session:', error);
        return fallback;
      }

      return data ? { ...fallback, ...data, email: session.user.email } : fallback;
    } catch (error) {
      console.warn('Could not load site profile; keeping authenticated session:', error);
      return fallback;
    }
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
