// Compatibility wrapper for legacy pages.
// Keep every page on the same Supabase client/auth behavior as js/supabase.js.
(function () {
  const SUPABASE_URL = 'https://oprfbthhvbqdiktnuqzz.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_qad4DWNHCFaLLbTv7cnZsw_t2YPsnuL';

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('Supabase library must be loaded before js/supabase-client.js');
    return;
  }

  const supabaseClient = window.rkSupabase || window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'implicit'
      }
    }
  );

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

      // Authentication is determined by the Supabase session, not by whether
      // a matching profile row happens to exist yet.
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
        const returnTo = window.location.pathname.split('/').pop() || 'index.html';
        window.location.href = `auth.html?redirect=${encodeURIComponent(returnTo + window.location.search)}`;
        throw new Error('Login required');
      }
      return user;
    },

    async isAdmin() {
      const user = await this.user();
      return !!user?.is_admin;
    }
  };
})();
