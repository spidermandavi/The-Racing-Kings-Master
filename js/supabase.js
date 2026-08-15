// Direct browser connection to Supabase. No Replit/Flask backend is required.
const SUPABASE_URL='https://oprfbthhvbqdiktnuqzz.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_qad4DWNHCFaLLbTv7cnZsw_t2YPsnuL';
const {createClient}=window.supabase;
const supabaseClient=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
window.rkSupabase=supabaseClient;
window.rkAuth={
 async session(){const {data,error}=await supabaseClient.auth.getSession();if(error)throw error;return data.session},
 async user(){const s=await this.session();if(!s)return null;const {data,error}=await supabaseClient.from('profiles').select('id,username,country,description,rating,is_admin,created_at,updated_at').eq('id',s.user.id).single();if(error)throw error;return {...data,email:s.user.email}},
 async requireUser(){const u=await this.user();if(!u){location.href='auth.html';throw new Error('Login required')}return u},
 async isAdmin(){const u=await this.user();return !!u?.is_admin}
};
