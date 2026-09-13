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
