/* VYORA API client — Stage 9: adds reminder opt-out/opt-in, OVULA cycle export/delete, community reports, progress & integration connect/disconnect. */
(function(){
  let token=localStorage.getItem('vyoraSessionToken');
  let sessionPromise=null;
  async function createSession(){
    if(sessionPromise) return sessionPromise;
    sessionPromise=(async()=>{
      const response=await fetch('/api/session/guest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({displayName:localStorage.getItem('vyoraDisplayName')||'VYORA Guest'})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(data.error||'Could not create VYORA session');
      token=data.token;localStorage.setItem('vyoraSessionToken',token);return token;
    })();
    try{return await sessionPromise;}finally{sessionPromise=null;}
  }
  async function request(url,options={}){
    if(!token) await createSession();
    const headers={'content-type':'application/json',...(options.headers||{}),authorization:'Bearer '+token};
    let response=await fetch(url,{...options,headers});
    if(response.status===401){localStorage.removeItem('vyoraSessionToken');token=null;await createSession();response=await fetch(url,{...options,headers:{...headers,authorization:'Bearer '+token}});}
    const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||`Request failed (${response.status})`);return data;
  }
  const get=url=>request(url);
  const post=(url,body)=>request(url,{method:'POST',body:JSON.stringify(body||{})});
  const patch=(url,body)=>request(url,{method:'PATCH',body:JSON.stringify(body||{})});
  const put=(url,body)=>request(url,{method:'PUT',body:JSON.stringify(body||{})});
  const del=url=>request(url,{method:'DELETE'});
  window.VyoraAPI={
    request,get,post,patch,put,del,
    // Auth & OTP verification
    register:async(email,password,displayName,phone)=>{const data=await post('/api/auth/register',{email,password,displayName,phone});if(data.token){token=data.token;localStorage.setItem('vyoraSessionToken',token);}return data;},
    login:async(email,password)=>{const data=await post('/api/auth/login',{email,password});if(data.token){token=data.token;localStorage.setItem('vyoraSessionToken',token);}return data;},
    logout:async()=>{try{await post('/api/auth/logout',{});}finally{localStorage.removeItem('vyoraSessionToken');token=null;}},
    linkGuest:async(email,password,displayName)=>{const data=await post('/api/auth/link-guest',{email,password,displayName});if(data.token){token=data.token;localStorage.setItem('vyoraSessionToken',token);}return data;},
    requestOtp:(channel,destination)=>post('/api/auth/verify/request',{channel,destination}),
    confirmOtp:(channel,destination,code)=>post('/api/auth/verify/confirm',{channel,destination,code}),
    requestPasswordReset:email=>post('/api/auth/password-reset/request',{email}),
    confirmPasswordReset:(email,code,newPassword)=>post('/api/auth/password-reset/confirm',{email,code,newPassword}),
    // Consents & Audit
    listConsents:()=>get('/api/consents'),
    grantConsent:(purpose,scope='standard')=>post('/api/consents',{purpose,scope}),
    revokeConsent:purpose=>del('/api/consents/'+encodeURIComponent(purpose)),
    listAudit:()=>get('/api/audit'),
    // Copilot Memory, Safety Report & Adaptive Plans
    chat:async(message,mode='vyora',history=[]) => (await post('/api/chat',{message,mode,history})).answer,
    chatFull:(message,mode='vyora',history=[]) => post('/api/ai/chat',{message,mode,history}),
    getChatMemory:()=>get('/api/chat/memory'),
    saveChatMemory:items=>put('/api/chat/memory',{items}),
    clearChatMemory:()=>del('/api/chat/memory'),
    reportAiAnswer:payload=>post('/api/ai/report',payload),
    generatePlan:params=>post('/api/plans/generate',params),
    patchPlan:(id,edit)=>patch('/api/plans/'+encodeURIComponent(id),edit),
    // Core features + Stage 9 extensions
    health:()=>get('/api/health'),ready:()=>get('/api/health/ready'),me:()=>get('/api/me'),getProfile:()=>get('/api/profile'),saveProfile:profile=>put('/api/profile',{profile}),
    listMeds:()=>get('/api/reminders'),addMed:med=>post('/api/reminders',{...med,label:med.label||med.name,reminderType:med.reminderType||'medication'}),deleteMed:id=>del('/api/reminders/'+encodeURIComponent(id)),updateReminder:(id,data)=>patch('/api/reminders/'+encodeURIComponent(id),data),testReminder:data=>post('/api/reminders/test',data),
    optOutReminders:(channel='all')=>post('/api/reminders/opt-out',{channel}),optInReminders:(channel='all')=>post('/api/reminders/opt-in',{channel}),
    addVitals:v=>post('/api/vitals',v),listVitals:()=>get('/api/vitals'),deleteVital:id=>del('/api/vitals/'+encodeURIComponent(id)),
    listProgress:()=>get('/api/progress'),addProgress:p=>post('/api/progress',p),deleteProgress:id=>del('/api/progress/'+encodeURIComponent(id)),
    savePlan:p=>post('/api/plans',p),listPlans:()=>get('/api/plans'),deletePlan:id=>del('/api/plans/'+encodeURIComponent(id)),
    listWorkouts:()=>get('/api/workouts'),logWorkout:log=>post('/api/workouts',{log}),deleteWorkout:id=>del('/api/workouts/'+encodeURIComponent(id)),
    listOvula:()=>get('/api/ovula/entries'),saveOvula:(entry,consent=true)=>post('/api/ovula/entries',{entry,consent}),deleteOvula:id=>del('/api/ovula/entries/'+encodeURIComponent(id)),exportOvula:()=>get('/api/ovula/export'),deleteAllOvula:()=>del('/api/ovula/data'),
    listPosts:()=>get('/api/community/posts'),createPost:postData=>post('/api/community/posts',postData),deletePost:id=>del('/api/community/posts/'+encodeURIComponent(id)),likePost:id=>post('/api/community/posts/'+encodeURIComponent(id)+'/like',{}),listComments:id=>get('/api/community/posts/'+encodeURIComponent(id)+'/comments'),commentPost:(id,body)=>post('/api/community/posts/'+encodeURIComponent(id)+'/comments',{body}),
    reportPost:(postId,reason,details)=>post('/api/community/reports',{postId,reason,details}),listReports:()=>get('/api/admin/reports'),getFeatureFlags:()=>get('/api/feature-flags'),setFeatureFlag:(key,enabled)=>patch('/api/admin/feature-flags/'+encodeURIComponent(key),{enabled}),getAdminOverview:()=>get('/api/admin/overview'),runGoldEval:()=>get('/api/admin/eval/run'),listAiReports:()=>get('/api/admin/ai-reports'),reviewAiReport:(id,status)=>patch('/api/admin/ai-reports/'+encodeURIComponent(id),{status}),verifyPartner:(id,status)=>patch('/api/admin/partners/'+encodeURIComponent(id)+'/verify',{status}),listDeliveryFailures:()=>get('/api/admin/delivery-failures'),moderateReport:(id,payload)=>patch('/api/admin/reports/'+encodeURIComponent(id),payload),
    listPartners:()=>get('/api/partners'),createPartner:p=>post('/api/partners',p),listCampaigns:()=>get('/api/campaigns'),createCampaign:p=>post('/api/campaigns',p),updateCampaign:(id,p)=>patch('/api/campaigns/'+encodeURIComponent(id),p),
    listTrainers:()=>get('/api/trainers'),listTrainerShares:()=>get('/api/trainers/shares'),shareWithTrainer:(id,scopes)=>post('/api/trainers/'+encodeURIComponent(id)+'/share',{scopes}),revokeTrainerShare:id=>del('/api/trainers/'+encodeURIComponent(id)+'/share'),reviewTrainer:(id,data)=>post('/api/trainers/'+encodeURIComponent(id)+'/reviews',data),rescheduleBooking:(id,data)=>patch('/api/bookings/'+encodeURIComponent(id),data),recordCampaignEvent:(id,eventType)=>post('/api/campaigns/'+encodeURIComponent(id)+'/events',{eventType}),getCampaignAnalytics:id=>get('/api/campaigns/'+encodeURIComponent(id)+'/analytics'),reportPlace:(id,issue)=>post('/api/places/'+encodeURIComponent(id)+'/report',{issue}),clearPlaces:()=>del('/api/places'),listBookings:()=>get('/api/bookings'),bookTrainer:b=>post('/api/bookings',b),cancelBooking:id=>del('/api/bookings/'+encodeURIComponent(id)),
    getPredictions:()=>get('/api/training/predictions'),getComparison:()=>get('/api/training/comparison'),getIntelligence:()=>get('/api/training/intelligence'),setGamification:enabled=>patch('/api/profile/gamification',{enabled}),listRoutes:()=>get('/api/training/routes'),createRoute:r=>post('/api/training/routes',r),deleteRoute:id=>del('/api/training/routes/'+encodeURIComponent(id)),getLeaderboard:(metricType='weekly_km')=>get('/api/training/leaderboard?metricType='+encodeURIComponent(metricType)),optInLeaderboard:data=>post('/api/training/leaderboard/opt-in',data),leaveLeaderboard:()=>post('/api/training/leaderboard/leave',{}),listChallenges:()=>get('/api/challenges'),createChallenge:c=>post('/api/challenges',c),updateChallenge:(id,value)=>patch('/api/challenges/'+encodeURIComponent(id)+'/progress',{value}),
    listPlaces:()=>get('/api/places'),savePlace:p=>post('/api/places',p),deletePlace:id=>del('/api/places/'+encodeURIComponent(id)),
    integrations:()=>get('/api/integrations'),connectIntegration:(provider,scopes)=>post('/api/integrations/'+encodeURIComponent(provider)+'/connect',{consent:true,scopes}),disconnectIntegration:provider=>post('/api/integrations/'+encodeURIComponent(provider)+'/disconnect',{}),listImportedMetrics:()=>get('/api/integrations/metrics'),importMetric:m=>post('/api/integrations/metrics',m),
    exportData:async()=>{const data=await get('/api/export');const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='vyora-data-export.json';a.click();URL.revokeObjectURL(a.href);return data;},
    deleteAccount:async()=>{const result=await del('/api/account');localStorage.removeItem('vyoraSessionToken');token=null;return result;}
  };
  createSession().catch(e=>console.warn('VYORA session:',e.message));
})();
