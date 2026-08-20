/* Global Supabase notifications */
(function () {
  let channel = null;
  let currentUserId = null;
  let initialized = false;

  function icon() { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
  function timeAgo(value) { const s=Math.max(0,Math.floor((Date.now()-new Date(value))/1000)); if(s<60)return'Just now'; if(s<3600)return`${Math.floor(s/60)}m ago`; if(s<86400)return`${Math.floor(s/3600)}h ago`; return`${Math.floor(s/86400)}d ago`; }
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  function ensureUI() {
    const right=document.querySelector('.nav-right'); const menu=document.getElementById('menuBtn');
    if(!right || document.getElementById('notificationBtn')) return;
    const wrap=document.createElement('div'); wrap.className='notification-wrap';
    wrap.innerHTML=`<button id="notificationBtn" class="icon-btn notification-btn" type="button" aria-label="Notifications" aria-expanded="false">${icon()}<span id="notificationBadge" class="notification-badge" hidden>0</span></button><div id="notificationPanel" class="notification-panel" hidden><div class="notification-head"><strong>Notifications</strong><button id="notificationReadAll" type="button">Mark all read</button></div><div id="notificationList" class="notification-list"><div class="notification-empty">No notifications yet.</div></div></div>`;
    right.insertBefore(wrap, menu || null);
    const btn=wrap.querySelector('#notificationBtn'), panel=wrap.querySelector('#notificationPanel');
    btn.onclick=()=>{const open=panel.hidden;panel.hidden=!open;btn.setAttribute('aria-expanded',String(open));if(open)loadNotifications();};
    document.addEventListener('click',e=>{if(!wrap.contains(e.target)){panel.hidden=true;btn.setAttribute('aria-expanded','false');}});
    wrap.querySelector('#notificationReadAll').onclick=markAllRead;
    wrap.querySelector('#notificationList').onclick=async e=>{const item=e.target.closest('[data-notification-id]');if(!item)return; await markRead(item.dataset.notificationId); const link=item.dataset.link; if(link)location.href=link;};
  }

  function render(items) {
    const badge=document.getElementById('notificationBadge'), list=document.getElementById('notificationList'); if(!badge||!list)return;
    const unread=items.filter(n=>!n.read).length; badge.textContent=unread>99?'99+':unread; badge.hidden=!unread;
    list.innerHTML=items.length?items.map(n=>`<button type="button" class="notification-item ${n.read?'':'unread'}" data-notification-id="${esc(n.id)}" data-link="${esc(n.link||'')}"><span class="notification-title">${esc(n.title||n.type||'Notification')}</span>${n.body?`<span class="notification-body">${esc(n.body)}</span>`:''}<span class="notification-time">${timeAgo(n.created_at)}</span></button>`).join(''):'<div class="notification-empty">No notifications yet.</div>';
  }

  async function loadNotifications() {
    if(!window.rkSupabase||!currentUserId)return;
    const {data,error}=await window.rkSupabase.from('notifications').select('*').eq('user_id',currentUserId).order('created_at',{ascending:false}).limit(30);
    if(error){console.warn('Notifications could not be loaded:',error.message);return;} render(data||[]);
  }
  async function markRead(id){if(!id||!window.rkSupabase)return;await window.rkSupabase.from('notifications').update({read:true}).eq('id',id).eq('user_id',currentUserId);await loadNotifications();}
  async function markAllRead(){if(!window.rkSupabase||!currentUserId)return;await window.rkSupabase.from('notifications').update({read:true}).eq('user_id',currentUserId).eq('read',false);await loadNotifications();}
  function subscribe(){if(channel||!window.rkSupabase||!currentUserId)return;channel=window.rkSupabase.channel(`rk-notifications-${currentUserId}`).on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:`user_id=eq.${currentUserId}`},loadNotifications).subscribe();}
  async function syncUser(){ensureUI();const {data:{session}}=await window.rkSupabase.auth.getSession();const id=session?.user?.id||null;if(channel&&id!==currentUserId){window.rkSupabase.removeChannel(channel);channel=null;}currentUserId=id;if(id){await loadNotifications();subscribe();}else render([]);}
  async function init(){if(initialized)return;initialized=true;ensureUI();if(!window.rkSupabase)return;await syncUser();window.rkSupabase.auth.onAuthStateChange(()=>setTimeout(syncUser,0));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
