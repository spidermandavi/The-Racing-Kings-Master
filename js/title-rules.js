// Canonical Racing Kings title definitions.
const RK_TITLE_RULES = {
  universal: Object.freeze({ accountAgeDays: 92, minNormGames: 10, blitzControls: Object.freeze(['3+0','3+2','5+0']) }),
  titles: Object.freeze({
    RKSGM:Object.freeze({code:'RKSGM',name:'Super Grandmaster',badgeClass:'badge-elite',ratedGames:10000,rating:2500,norms:Object.freeze({blitz:1,standard:1,performance:2450}),specialRoute:'RKWC'}),
    RKGM:Object.freeze({code:'RKGM',name:'Grandmaster',badgeClass:'badge-grand',ratedGames:5000,rating:2400,norms:Object.freeze({blitz:1,standard:1,performance:2400})}),
    RKIM:Object.freeze({code:'RKIM',name:'International Master',badgeClass:'badge-master',ratedGames:3000,rating:2300,norms:Object.freeze({blitz:1,standard:1,performance:2300})}),
    RKM:Object.freeze({code:'RKM',name:'Master',badgeClass:'badge-candidate',ratedGames:1000,rating:2200,norms:Object.freeze({blitz:2,standard:2,performance:2200})}),
    RKCM:Object.freeze({code:'RKCM',name:'Candidate Master',badgeClass:'badge-clight',ratedGames:500,rating:2100,norms:Object.freeze({blitz:2,standard:2,performance:2100})}),
    RKV:Object.freeze({code:'RKV',name:'Veteran',badgeClass:'badge-veteran',ratedGames:10000,rating:null,veteranHistoryYears:5,norms:null}),
    RKHM:Object.freeze({code:'RKHM',name:'Honorary Master',badgeClass:'badge-special',ratedGames:null,rating:null,norms:null,adminAwarded:true}),
    RKWC:Object.freeze({code:'RKWC',name:'World Champion',badgeClass:'badge-special',ratedGames:null,rating:null,norms:null,adminAwarded:true,recognitionOnly:true})
  }),
  order: Object.freeze(['RKSGM','RKGM','RKIM','RKM','RKCM','RKV','RKHM','RKWC'])
};
RK_TITLE_RULES.isBlitzControl = clock => RK_TITLE_RULES.universal.blitzControls.includes(String(clock ?? '').replace(/\s+/g,''));
RK_TITLE_RULES.get = code => RK_TITLE_RULES.titles[String(code || '').trim().toUpperCase()] || null;
window.RK_TITLE_RULES = RK_TITLE_RULES;

// Compatibility bridge for the legacy profile application UI. The title data above
// remains the canonical source of truth; this only removes the stale hardcoded
// application rules still embedded in the shared menu code.
(function bridgeTitleApplicationRules(){
  if(window.__rkCanonicalApplicationBridge)return;
  window.__rkCanonicalApplicationBridge=true;
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const getStats=()=>{
    const rows=[...document.querySelectorAll('#statsGrid .stat-item')];
    const get=labels=>{const list=Array.isArray(labels)?labels: [labels];const row=rows.find(r=>list.includes(r.querySelector('.stat-label')?.textContent?.trim().toLowerCase()));return row?.querySelector('.stat-value')?.textContent?.replace(/[^0-9.-]/g,'')||'';};
    return {games:Number(get(['rated rk games','total games']))||0,peakRating:Number(get('peak rating'))||0};
  };
  const findReady=()=>{
    if(typeof window.openApplyModal!=='function'){setTimeout(findReady,50);return;}
    const originalClose=window.closeApplyModal;
    window.openApplyModal=async function(){
      const overlay=document.getElementById('applyModal'),body=document.getElementById('applyModalBody');
      if(!overlay||!body)return;
      const user=await window.rkAuth.user().catch(()=>null);
      const profileUser=document.getElementById('usernameInput')?.value?.trim()||'';
      if(!user){body.innerHTML='<div class="modal-info">You need a site account to apply for a title.</div><div class="modal-actions"><button class="modal-cancel-btn" onclick="closeApplyModal()">Close</button><button class="modal-submit-btn" onclick="window.location.href=\'auth.html\'">Login / Register</button></div>';overlay.classList.remove('hidden');return;}
      if(!profileUser||String(user.username).toLowerCase()!==profileUser.toLowerCase()){
        const safeUser=esc(user.username).replace(/'/g,'&#39;');
        body.innerHTML=`<div class="modal-info">You're logged in as <strong>${esc(user.username)}</strong>. You can only apply for your own title. Load your own profile first.</div><div class="modal-actions"><button class="modal-cancel-btn" onclick="closeApplyModal()">Close</button><button class="modal-submit-btn" onclick="document.getElementById('usernameInput').value='${safeUser}';closeApplyModal();loadProfile('${safeUser.replace(/&#39;/g,"\\'")}')">Load My Profile</button></div>`;
        overlay.classList.remove('hidden');return;
      }
      const defs=RK_TITLE_RULES.order.filter(code=>!RK_TITLE_RULES.get(code).adminAwarded).map(code=>{const d=RK_TITLE_RULES.get(code);return [code,d.name,d.ratedGames,d.rating==null?0:d.rating]});
      const stats=getStats();
      const first=defs.find(d=>stats.games>=d[2]&&(d[3]===0||stats.peakRating>=d[3]))||defs[defs.length-1];
      body.innerHTML=`<div class="modal-field"><label class="modal-label">Lichess Username</label><input class="modal-input" value="${esc(profileUser).replace(/\"/g,'&quot;')}" readonly /></div><div class="modal-field"><label class="modal-label">Title Applying For</label><select class="modal-select" id="applyTitleSelect" onchange="updateApplyStats()">${defs.map(d=>`<option value="${d[0]}" ${d[0]===first[0]?'selected':''}>${d[0]} — ${d[1]}</option>`).join('')}</select></div><div class="modal-stats" id="applyStatsBox"></div><div class="modal-field"><label class="modal-label">Message (optional)</label><textarea class="modal-textarea" id="applyMessage" placeholder="Any additional context for the admin…"></textarea></div><div class="modal-info">Your current Lichess stats are included automatically. Tournament norms are reviewed by an admin. RKWC and RKHM are manually awarded and are not automatic applications.</div><div id="applyFeedback" style="margin-bottom:.75rem;font-size:.84rem;display:none"></div><div class="modal-actions"><button class="modal-cancel-btn" onclick="closeApplyModal()">Cancel</button><button class="modal-submit-btn" id="applySubmitBtn" onclick="submitTitleApplication()">Submit Application</button></div>`;
      overlay.classList.remove('hidden');window.updateApplyStats();
    };
    window.updateApplyStats=function(){
      const box=document.getElementById('applyStatsBox');if(!box)return;const code=document.getElementById('applyTitleSelect')?.value;const d=RK_TITLE_RULES.get(code);if(!d){box.innerHTML='';return;}const stats=getStats(),gOk=stats.games>=d.ratedGames,rOk=d.rating==null||stats.peakRating>=d.rating;box.innerHTML=`<div class="modal-stat-row"><span class="modal-stat-label">RK games</span><span class="modal-stat-val ${gOk?'met':'unmet'}">${stats.games.toLocaleString()} / ${d.ratedGames.toLocaleString()} ${gOk?'✓':'✗'}</span></div><div class="modal-stat-row"><span class="modal-stat-label">Peak rating</span><span class="modal-stat-val ${rOk?'met':'unmet'}">${d.rating==null?'No rating req':`${stats.peakRating} / ${d.rating} ${rOk?'✓':'✗'}`}</span></div><div class="modal-stat-row" style="margin-top:.3rem;padding-top:.3rem;border-top:1px solid var(--border)"><span class="modal-stat-label" style="font-size:.76rem">Tournament norms</span><span style="font-size:.76rem;color:var(--text-muted)">Verified by admin</span></div>`;
    };
    window.submitTitleApplication=async function(){
      const btn=document.getElementById('applySubmitBtn'),feedback=document.getElementById('applyFeedback'),titleCode=document.getElementById('applyTitleSelect')?.value,message=(document.getElementById('applyMessage')?.value||'').trim();
      const user=await window.rkAuth.user().catch(()=>null);
      if(!btn||!feedback||!titleCode||!user?.id)return;
      const stats=getStats();btn.disabled=true;btn.textContent='Submitting…';feedback.style.display='none';
      try{const {data:existing,error:existingError}=await window.rkSupabase.from('title_applications').select('id').eq('user_id',user.id).eq('title_code',titleCode).eq('status','pending').limit(1);if(existingError)throw existingError;if(existing?.length)throw new Error('You already have a pending application for this title.');const {error}=await window.rkSupabase.from('title_applications').insert({user_id:user.id,title_code:titleCode,message,games:stats.games,peak_rating:stats.peakRating});if(error)throw error;feedback.textContent='✓ Application submitted! The admin will review it shortly.';feedback.style.color='#4ade80';feedback.style.display='block';btn.textContent='Submitted';}catch(e){feedback.textContent=e.message||'Submission failed.';feedback.style.color='#f87171';feedback.style.display='block';btn.disabled=false;btn.textContent='Submit Application';}
    };
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',findReady,{once:true});else findReady();
})();
