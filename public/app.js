const $=s=>document.querySelector(s); const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function img(src){return src?`<img src="${esc(src)}" alt="">`:''}
async function load(){const d=await fetch('/api/public').then(r=>r.json());const s=d.settings;
 $('#initiativeName').textContent=s.initiative_name;$('#tagline').textContent=s.tagline;$('#heroText').textContent=s.hero_text;$('#belief').textContent=s.belief;$('#aboutText').textContent=s.about;$('#mission').textContent=s.mission;$('#vision').textContent=s.vision;$('#joinIntro').textContent=s.join_intro;$('#footerText').textContent=s.footer_text;
 ['navJoin','heroJoin','joinBtn'].forEach(id=>{const el=document.getElementById(id);if(el)el.href=s.join_url;});$('#emailLink').href='mailto:'+s.email;$('#emailLink').textContent=s.email;$('#instagram').href=s.instagram;$('#facebook').href=s.facebook;
 $('#values').innerHTML=(s.values||[]).map((v,i)=>`<article class="card"><div class="featureIcon">${['🌱','🤝','🧭','📚','💡','♻️'][i%6]}</div><h3>${esc(v[0])}</h3><p>${esc(v[1])}</p></article>`).join('');
 $('#fieldsGrid').innerHTML=(s.fields||[]).map((v,i)=>`<article class="card"><div class="featureIcon">${['🤝','🎓','💡','🎪','🌱'][i%5]}</div><h3>${esc(v[0])}</h3><p>${esc(v[1])}</p></article>`).join('');
 $('#joinReasons').innerHTML=(s.join_reasons||[]).map(x=>`<div class="card">✓ ${esc(x)}</div>`).join('');
 const events=d.events||[]; $('#eventsGrid').innerHTML=events.length?events.map(e=>`<article class="card mediaCard">${img(e.cover_image)}<div class="body"><span class="badge">${esc(e.event_state||'فعالية')}</span><h3>${esc(e.title)}</h3><div class="meta">${esc(e.event_date)} ${e.event_time?'• '+esc(e.event_time):''} ${e.location?'• '+esc(e.location):''}</div><p>${esc(e.summary||e.description)}</p>${e.registration_url?`<a class="btn green" target="_blank" href="${esc(e.registration_url)}">التسجيل</a>`:''}</div></article>`).join(''):`<div class="empty full">🌱 قريبًا نلتقي في أولى فعاليات روح.</div>`;
 const ach=d.achievements||[]; $('#achievementsGrid').innerHTML=ach.length?ach.map(a=>`<article class="card mediaCard">${img(a.cover_image)}<div class="body"><h3>${esc(a.title)}</h3><div class="meta">${esc(a.achievement_date)}</div><p>${esc(a.summary||a.description)}</p>${(a.volunteers||a.beneficiaries||a.volunteer_hours)?`<div class="meta">${a.volunteers?`👥 ${a.volunteers} متطوع `:''}${a.beneficiaries?` • ${a.beneficiaries} مستفيد`:''}${a.volunteer_hours?` • ${a.volunteer_hours} ساعة`:''}</div>`:''}</div></article>`).join(''):`<div class="empty full">✨ قريبًا… نكتب أولى قصص الأثر معًا.</div>`;
 $('#faqList').innerHTML=(d.faqs||[]).map(f=>`<details class="faq"><summary>${esc(f.question)}</summary><p>${esc(f.answer)}</p></details>`).join('');
 if(s.stats_visible==='1'){ $('#statsSection').classList.remove('hidden');$('#sVolunteers').textContent='+'+d.stats.volunteers;$('#sEvents').textContent='+'+d.stats.events;$('#sHours').textContent='+'+d.stats.hours;$('#sBeneficiaries').textContent='+'+d.stats.beneficiaries; }
}
async function updateVolunteerNavigation(){
 try{
  const r=await fetch('/api/volunteer/me');
  const d=await r.json();
  const v=d.volunteer;

  const links=['navJoin','heroJoin','joinBtn'];

  links.forEach(id=>{
   const el=document.getElementById(id);
   if(!el) return;

   if(v){
    el.href='/volunteer-account';
    el.target='_self';
    el.textContent=id==='navJoin'?'انضم الآن':'انضم إلينا';
   }else{
    el.href='/volunteer-apply';
    el.target='_self';
    el.textContent=id==='navJoin'?'انضم الآن':'انضم إلينا';
   }
  });
 }catch(e){
  console.error('Volunteer navigation error:',e);
 }
}

load()
 .then(updateVolunteerNavigation)
 .catch(console.error);

const ideaForm=document.getElementById('ideaForm');

if(ideaForm){
 ideaForm.addEventListener('submit',async e=>{
  e.preventDefault();

  const msg=document.getElementById('ideaMessage');
  const btn=ideaForm.querySelector('button[type="submit"]');

  const data={
   name:document.getElementById('ideaName').value.trim(),
   contact:document.getElementById('ideaContact').value.trim(),
   title:document.getElementById('ideaTitle').value.trim(),
   category:document.getElementById('ideaCategory').value,
   description:document.getElementById('ideaDescription').value.trim(),
   problem:document.getElementById('ideaProblem').value.trim(),
   expected_impact:document.getElementById('ideaImpact').value.trim()
  };

  try{
   btn.disabled=true;
   btn.textContent='جارٍ إرسال الفكرة...';
   msg.textContent='';

   const r=await fetch('/api/ideas',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(data)
   });

   const result=await r.json();

   if(!r.ok) throw new Error(result.error||'تعذر إرسال الفكرة');

   msg.textContent='✅ تم استلام فكرتك بنجاح، شكرًا لمساهمتك في صناعة الأثر.';
   ideaForm.reset();

  }catch(err){
   msg.textContent='❌ '+err.message;
  }finally{
   btn.disabled=false;
   btn.textContent='شارك فكرتك';
  }
 });
}


// صندوق الشكاوى
const complaintForm=document.getElementById('complaintForm');

if(complaintForm){
 complaintForm.addEventListener('submit',async e=>{
  e.preventDefault();

  const btn=document.getElementById('complaintSubmit');
  const msg=document.getElementById('complaintMessage');

  const data={
   name:document.getElementById('complaintName').value.trim(),
   phone:document.getElementById('complaintPhone').value.trim(),
   email:document.getElementById('complaintEmail').value.trim(),
   complaint:document.getElementById('complaintText').value.trim()
  };

  try{
   btn.disabled=true;
   btn.textContent='جارٍ إرسال الشكوى...';
   msg.textContent='';

   const r=await fetch('/api/complaints',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(data)
   });

   const result=await r.json();

   if(!r.ok)
    throw new Error(result.error||'تعذر إرسال الشكوى');

   msg.textContent='✅ تم استلام شكواك بنجاح، وسيتم التعامل معها من قبل الجهة المختصة.';
   complaintForm.reset();

  }catch(err){
   msg.textContent='❌ '+err.message;
  }finally{
   btn.disabled=false;
   btn.textContent='إرسال الشكوى';
  }
 });
}
