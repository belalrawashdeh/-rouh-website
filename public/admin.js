const $=s=>document.querySelector(s), content=$('#content'); let me=null, needsSetup=false, current='dashboard';
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
async function api(url,opt={}){opt.headers={...(opt.headers||{}),'Content-Type':'application/json'};const r=await fetch(url,opt);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'حدث خطأ');return d}
function flash(t,err=false){$('#msg').innerHTML=`<div class="notice ${err?'error':''}">${esc(t)}</div>`;setTimeout(()=>$('#msg').innerHTML='',3500)}
async function init(){needsSetup=(await api('/api/setup/status')).needsSetup;me=(await api('/api/me')).user;if(me)showAdmin();else showAuth()}
function showAuth(){ $('#authView').classList.remove('hidden');$('#adminView').classList.add('hidden');$('#authTitle').textContent=needsSetup?'إعداد الموقع لأول مرة':'دخول المسؤولين';$('#nameField').classList.toggle('hidden',!needsSetup)}
$('#authForm').onsubmit=async e=>{e.preventDefault();try{if(needsSetup){await api('/api/setup',{method:'POST',body:JSON.stringify({name:$('#authName').value,email:$('#authEmail').value,password:$('#authPassword').value})});needsSetup=false;$('#authMsg').innerHTML='<div class="notice">تم إنشاء حساب المالك. سجّل الدخول الآن.</div>';showAuth()}else{await api('/api/login',{method:'POST',body:JSON.stringify({email:$('#authEmail').value,password:$('#authPassword').value})});me=(await api('/api/me')).user;showAdmin()}}catch(ex){$('#authMsg').innerHTML=`<div class="notice error">${esc(ex.message)}</div>`}}
function showAdmin(){ $('#authView').classList.add('hidden');$('#adminView').classList.remove('hidden');$('#userBox').innerHTML=`<p><b>${esc(me.name)}</b><br><span class="muted">${esc(me.role)}</span></p>`;document.querySelectorAll('[data-role]').forEach(x=>{const need=x.dataset.role;x.classList.toggle('hidden',need==='owner'?me.role!=='owner':!['owner','admin'].includes(me.role))});loadTab('dashboard')}
$('#logoutBtn').onclick=async()=>{await api('/api/logout',{method:'POST'});me=null;showAuth()};
$('#menu').onclick=e=>{if(e.target.dataset.tab)loadTab(e.target.dataset.tab)};
async function loadTab(tab){current=tab;document.querySelectorAll('#menu button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));const titles={dashboard:'لوحة التحكم',events:'الفعاليات',achievements:'الإنجازات',ideas:'الأفكار',volunteers:'طلبات المتطوعين','rejected-volunteers':'سجل المرفوضين',content:'محتوى الموقع',faqs:'الأسئلة الشائعة',trash:'سلة المحذوفات',users:'المسؤولون والصلاحيات',audit:'سجل التعديلات'};$('#pageTitle').textContent=titles[tab];content.innerHTML='<div class="panel">جارٍ التحميل…</div>';try{if(tab==='dashboard')return dashboard();if(tab==='events')return listEntities('events');if(tab==='achievements')return listEntities('achievements');if(tab==='ideas')return ideas();if(tab==='volunteers')return volunteers();if(tab==='rejected-volunteers')return rejectedVolunteers();if(tab==='content')return editContent();if(tab==='faqs')return faqs();if(tab==='trash')return trash();if(tab==='users')return users();if(tab==='audit')return audit()}catch(e){content.innerHTML=`<div class="notice error">${esc(e.message)}</div>`}}
async function dashboard(){const d=await api('/api/admin/dashboard');content.innerHTML=`<div class="grid grid4"><div class="panel"><b>الفعاليات</b><h2>${d.counts.events}</h2></div><div class="panel"><b>الإنجازات</b><h2>${d.counts.achievements}</h2></div><div class="panel"><b>المسؤولون</b><h2>${d.counts.users}</h2></div><div class="panel"><b>المحتوى المنشور</b><h2>${d.counts.published}</h2></div></div><div class="panel"><h3>آخر التعديلات</h3>${d.audit.map(a=>`<p><b>${esc(a.user_name||'النظام')}</b> — ${esc(a.action)} ${esc(a.entity)} <span class="muted">${esc(a.created_at)}</span></p>`).join('')||'<p class="muted">لا يوجد سجل بعد.</p>'}</div>`}
const cfg={events:{title:'فعالية',date:'event_date',fields:[['title','اسم الفعالية'],['summary','وصف مختصر'],['description','الوصف الكامل'],['event_date','التاريخ','date'],['event_time','الوقت','time'],['location','المكان'],['registration_url','رابط التسجيل'],['event_state','الحالة الظاهرة']],image:'cover_image'},achievements:{title:'إنجاز',date:'achievement_date',fields:[['title','عنوان الإنجاز'],['summary','وصف مختصر'],['description','الوصف الكامل'],['achievement_date','التاريخ','date'],['volunteers','عدد المتطوعين','number'],['beneficiaries','عدد المستفيدين','number'],['volunteer_hours','الساعات التطوعية','number']],image:'cover_image'}};
async function listEntities(type){const d=await api('/api/admin/'+type);content.innerHTML=`<div class="panel"><button class="btn green" onclick="entityForm('${type}')">+ إضافة ${cfg[type].title}</button></div><div class="panel"><table class="table"><thead><tr><th>الصورة</th><th>العنوان</th><th>الحالة</th><th>التاريخ</th><th>إجراءات</th></tr></thead><tbody>${d.items.map(x=>`<tr><td>${x.cover_image?`<img class="thumb" src="${esc(x.cover_image)}">`:''}</td><td>${esc(x.title)}</td><td>${esc(x.status)}</td><td>${esc(x[cfg[type].date])}</td><td><div class="rowActions"><button class="btn light small" onclick='entityForm("${type}",${JSON.stringify(x).replaceAll("'","&#39;")})'>تعديل</button><button class="btn danger small" onclick="removeEntity('${type}',${x.id})">حذف</button></div></td></tr>`).join('')||'<tr><td colspan="5">لا يوجد محتوى بعد.</td></tr>'}</tbody></table></div>`}
window.entityForm=(type,item={})=>{const c=cfg[type];content.innerHTML=`<div class="panel"><h3>${item.id?'تعديل':'إضافة'} ${c.title}</h3><form id="entityForm" class="formGrid">${c.fields.map(f=>`<div class="field ${['summary','description'].includes(f[0])?'full':''}"><label>${f[1]}</label>${['summary','description'].includes(f[0])?`<textarea name="${f[0]}">${esc(item[f[0]]||'')}</textarea>`:`<input name="${f[0]}" type="${f[2]||'text'}" value="${esc(item[f[0]]||'')}">`}</div>`).join('')}<div class="field"><label>الصورة</label><input id="imgFile" type="file" accept="image/jpeg,image/png,image/webp"><input type="hidden" name="cover_image" value="${esc(item.cover_image||'')}">${item.cover_image?`<img class="imagePreview" src="${esc(item.cover_image)}">`:''}</div><div class="field"><label>حالة النشر</label><select name="status"><option value="draft" ${item.status!=='published'?'selected':''}>مسودة</option><option value="published" ${item.status==='published'?'selected':''}>منشور</option></select></div><div class="full rowActions"><button class="btn green" type="submit">حفظ</button><button class="btn light" type="button" onclick="loadTab('${type}')">إلغاء</button></div></form></div>`;$('#entityForm').onsubmit=async e=>{e.preventDefault();try{const fd=new FormData(e.target),obj=Object.fromEntries(fd.entries());const file=$('#imgFile').files[0];if(file)obj.cover_image=await upload(file);await api('/api/admin/'+type+(item.id?'/'+item.id:''),{method:item.id?'PUT':'POST',body:JSON.stringify(obj)});flash('تم الحفظ');loadTab(type)}catch(ex){flash(ex.message,true)}}};
async function upload(file){const dataUrl=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)});return (await api('/api/admin/upload',{method:'POST',body:JSON.stringify({filename:file.name,dataUrl})})).url}
window.removeEntity=async(type,id)=>{if(!confirm('نقل العنصر إلى سلة المحذوفات؟'))return;try{await api('/api/admin/'+type+'/'+id,{method:'DELETE'});flash('تم النقل إلى سلة المحذوفات');loadTab(type)}catch(e){flash(e.message,true)}};
async function editContent(){const d=await api('/api/admin/content'),s=d.settings,st=d.stats;content.innerHTML=`<form id="contentForm"><div class="panel formGrid"><div class="field"><label>اسم المبادرة</label><input name="initiative_name" value="${esc(s.initiative_name)}"></div><div class="field"><label>الشعار النصي</label><input name="tagline" value="${esc(s.tagline)}"></div>${[['hero_text','نص الواجهة'],['belief','عبارة الإيمان'],['about','من نحن'],['mission','الرسالة'],['vision','الرؤية'],['join_intro','نص الانضمام']].map(x=>`<div class="field full"><label>${x[1]}</label><textarea name="${x[0]}">${esc(s[x[0]])}</textarea></div>`).join('')}<div class="field"><label>البريد</label><input name="email" value="${esc(s.email)}"></div><div class="field"><label>رابط نموذج الانتساب</label><input name="join_url" value="${esc(s.join_url)}"></div><div class="field"><label>Instagram</label><input name="instagram" value="${esc(s.instagram)}"></div><div class="field"><label>Facebook</label><input name="facebook" value="${esc(s.facebook)}"></div><div class="field full"><label>القيم (JSON)</label><textarea name="values_json">${esc(s.values_json)}</textarea></div><div class="field full"><label>المجالات (JSON)</label><textarea name="fields_json">${esc(s.fields_json)}</textarea></div><div class="field full"><label>أسباب الانضمام (JSON)</label><textarea name="join_reasons_json">${esc(s.join_reasons_json)}</textarea></div><div class="field"><label>إظهار أرقام الأثر</label><select name="stats_visible"><option value="0" ${s.stats_visible!=='1'?'selected':''}>مخفي</option><option value="1" ${s.stats_visible==='1'?'selected':''}>ظاهر</option></select></div></div><div class="panel formGrid"><h3 class="full">أرقام الأثر</h3>${[['volunteers','المتطوعون'],['events','الفعاليات'],['hours','ساعات التطوع'],['beneficiaries','المستفيدون']].map(x=>`<div class="field"><label>${x[1]}</label><input type="number" name="stat_${x[0]}" value="${st[x[0]]}"></div>`).join('')}<button class="btn green full">حفظ التعديلات</button></div></form>`;$('#contentForm').onsubmit=async e=>{e.preventDefault();try{const o=Object.fromEntries(new FormData(e.target).entries()),stats={};for(const k of ['volunteers','events','hours','beneficiaries']){stats[k]=o['stat_'+k];delete o['stat_'+k]}await api('/api/admin/settings',{method:'PUT',body:JSON.stringify(o)});await api('/api/admin/stats',{method:'PUT',body:JSON.stringify(stats)});flash('تم تحديث محتوى الموقع')}catch(ex){flash(ex.message,true)}}}
async function faqs(){const d=await api('/api/admin/faqs');content.innerHTML=`<div class="panel"><button class="btn green" onclick="faqForm()">+ إضافة سؤال</button></div><div class="panel">${d.items.map(f=>`<div class="faq"><b>${esc(f.question)}</b><p>${esc(f.answer)}</p><div class="rowActions"><button class="btn light small" onclick='faqForm(${JSON.stringify(f).replaceAll("'","&#39;")})'>تعديل</button><button class="btn danger small" onclick="deleteFaq(${f.id})">حذف</button></div></div>`).join('')}</div>`}
window.faqForm=(f={})=>{content.innerHTML=`<div class="panel"><form id="faqForm" class="formGrid"><div class="field full"><label>السؤال</label><input name="question" value="${esc(f.question||'')}" required></div><div class="field full"><label>الإجابة</label><textarea name="answer" required>${esc(f.answer||'')}</textarea></div><div class="field"><label>الترتيب</label><input name="sort_order" type="number" value="${f.sort_order||0}"></div><div class="field"><label>الحالة</label><select name="active"><option value="1">ظاهر</option><option value="0" ${f.active===0?'selected':''}>مخفي</option></select></div><button class="btn green full">حفظ</button></form></div>`;$('#faqForm').onsubmit=async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(e.target).entries());o.active=o.active==='1';try{await api('/api/admin/faqs'+(f.id?'/'+f.id:''),{method:f.id?'PUT':'POST',body:JSON.stringify(o)});loadTab('faqs')}catch(ex){flash(ex.message,true)}}}
window.deleteFaq=async id=>{if(confirm('حذف السؤال؟')){await api('/api/admin/faqs/'+id,{method:'DELETE'});loadTab('faqs')}};
async function trash(){const d=await api('/api/admin/trash');const group=(title,type,items)=>`<div class="panel"><h3>${title}</h3>${items.map(x=>`<p>${esc(x.title)} <button class="btn light small" onclick="restore('${type}',${x.id})">استرجاع</button></p>`).join('')||'<p class="muted">فارغة</p>'}</div>`;content.innerHTML=group('الفعاليات','events',d.events)+group('الإنجازات','achievements',d.achievements)+group('الأسئلة','faqs',d.faqs)}
window.restore=async(type,id)=>{await api(`/api/admin/trash/${type}/${id}/restore`,{method:'POST'});flash('تم الاسترجاع');loadTab('trash')};
async function users(){const d=await api('/api/admin/users');content.innerHTML=`<div class="panel"><button class="btn green" onclick="userForm()">+ إضافة مسؤول</button></div><div class="panel"><table class="table"><tr><th>الاسم</th><th>البريد</th><th>الصلاحية</th><th>الحالة</th><th></th></tr>${d.items.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.role)}</td><td>${u.active?'فعال':'موقوف'}</td><td>${u.role!=='owner'?`<button class="btn light small" onclick='userForm(${JSON.stringify(u).replaceAll("'","&#39;")})'>تعديل</button>`:''}</td></tr>`).join('')}</table></div>`}
window.userForm=(u={})=>{content.innerHTML=`<div class="panel"><form id="userForm" class="formGrid"><div class="field"><label>الاسم</label><input name="name" value="${esc(u.name||'')}" required></div>${u.id?'':`<div class="field"><label>البريد</label><input name="email" type="email" required></div><div class="field"><label>كلمة المرور</label><input name="password" type="password" minlength="8" required></div>`}<div class="field"><label>الصلاحية</label><select name="role"><option value="admin" ${u.role==='admin'?'selected':''}>Admin</option><option value="editor" ${u.role==='editor'?'selected':''}>Editor</option></select></div>${u.id?`<div class="field"><label>الحالة</label><select name="active"><option value="1" ${u.active?'selected':''}>فعال</option><option value="0" ${!u.active?'selected':''}>موقوف</option></select></div>`:''}<button class="btn green full">حفظ</button></form></div>`;$('#userForm').onsubmit=async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(e.target).entries());if(u.id)o.active=o.active==='1';try{await api('/api/admin/users'+(u.id?'/'+u.id:''),{method:u.id?'PUT':'POST',body:JSON.stringify(o)});flash('تم الحفظ');loadTab('users')}catch(ex){flash(ex.message,true)}}}
async function audit(){const d=await api('/api/admin/audit');content.innerHTML=`<div class="panel"><table class="table"><tr><th>المسؤول</th><th>الإجراء</th><th>العنصر</th><th>التفاصيل</th><th>الوقت</th></tr>${d.items.map(a=>`<tr><td>${esc(a.user_name||'النظام')}</td><td>${esc(a.action)}</td><td>${esc(a.entity)} ${esc(a.entity_id)}</td><td>${esc(a.details)}</td><td>${esc(a.created_at)}</td></tr>`).join('')}</table></div>`}
init().catch(e=>console.error(e));


async function volunteers(){
 const d=await api('/api/admin/volunteers');
 d.items=d.items.filter(v=>v.status==='pending' || (v.status==='accepted' && !v.whatsapp_sent_at));

 const statusText={
  pending:'قيد المراجعة',
  accepted:'مقبول',
  rejected:'مرفوض'
 };

 if(!d.items.length){
  content.innerHTML='<div class="panel"><h3>طلبات المتطوعين</h3><p class="muted">لا توجد طلبات متطوعين حتى الآن.</p></div>';
  return;
 }

 content.innerHTML=`
  <div class="panel">
   <h3>طلبات المتطوعين</h3>
   <p class="muted">يمكن للمالك أو المسؤول قبول أو رفض طلبات الانضمام.</p>

   <div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse">
     <thead>
      <tr>
       <th>الاسم</th>
       <th>البريد</th>
       <th>الهاتف</th>
       <th>التخصص</th>
       <th>المستوى</th>
       <th>المدينة</th>
       <th>الحالة</th>
       <th>الإجراء</th>
      </tr>
     </thead>

     <tbody>
      ${d.items.map(v=>`
       <tr>
        <td>${esc(v.name||'')}</td>
        <td>${esc(v.email||'')}</td>
        <td>${esc(v.phone||'')}</td>
        <td>${esc(v.major||'-')}</td>
        <td>${esc(v.level||'-')}</td>
        <td>${esc(v.city||'-')}</td>
        <td><b>${esc(statusText[v.status]||v.status)}</b></td>

        <td>
         ${v.status!=='accepted'
          ? `<button class="btn green" onclick="updateVolunteer(${v.id},'accepted')">قبول</button>`
          : ''}

         ${v.status!=='rejected'
          ? `<button class="btn light" onclick="updateVolunteer(${v.id},'rejected')">رفض</button>`
          : ''}

         ${v.status==='accepted' && v.whatsapp_sent_at
          ? `<span class="notice">✅ تم إرسال القبول</span>`
          : v.status==='accepted' && v.invite_token
          ? `<button class="btn green" onclick='openVolunteerWhatsApp(${JSON.stringify(v)})'>إرسال رسالة القبول على واتساب</button>`
          : ''}
        </td>
       </tr>
      `).join('')}
     </tbody>
    </table>
   </div>
  </div>
 `;
}


function normalizeWhatsAppPhone(phone){
 let p=String(phone||'').replace(/\D/g,'');

 if(p.startsWith('00962'))
  p=p.slice(2);

 if(p.startsWith('962'))
  return p;

 if(p.startsWith('0'))
  return '962'+p.slice(1);

 return p;
}

async function openVolunteerWhatsApp(v){
 if(!v || !v.phone || !v.invite_token){
  alert('بيانات المتطوع أو رابط الدعوة غير مكتمل');
  return;
 }

 const phone=normalizeWhatsAppPhone(v.phone);

 const registerUrl=
  window.location.origin+
  '/volunteer-register?token='+
  encodeURIComponent(v.invite_token);

 const groupUrl=
  'https://chat.whatsapp.com/HPFufR8WZ2TE4FD2KLxoEF?s=cl&p=i&mlu=4';

 const message=
`\u{1F389} مبارك! تم قبولك رسميًا في مبادرة روح \u{1F49A}

أهلًا وسهلًا فيك بين عائلة روح \u{1F331}
متحمسين نشوف أفكارك، حماسك، وإنجازاتك معنا، ويلا نبدأ نصنع أثر حلو سوا! \u{1F525}

من اليوم إنت جزء من فريق روح، وكل فكرة، مشاركة، وخطوة بتعملها معنا إلها قيمة وأثر \u{2728}

\u{1F510} أنشئ حسابك على موقع روح من خلال رابط التسجيل الخاص فيك:
${registerUrl}

\u{1F465} وانضم لمجموعة المتطوعين من هنا:
${groupUrl}

أهلًا فيك مرة ثانية، ومتحمسين نبدأ المشوار سوا \u{1F49A}\u{1F331}
فريق مبادرة روح`;

 const url=
  'https://wa.me/'+phone+
  '?text='+encodeURIComponent(message);

 const whatsappWindow=window.open(url,'_blank','noopener,noreferrer');

 if(!whatsappWindow){
  alert('المتصفح منع فتح واتساب. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى.');
  return;
 }

 try{
  await api('/api/admin/volunteers/'+v.id+'/whatsapp-sent',{
   method:'PUT',
   body:JSON.stringify({})
  });

  await volunteers();
 }catch(e){
  console.error(e);
  alert('تم فتح واتساب، لكن تعذر تسجيل حالة الإرسال.');
 }
}

window.openVolunteerWhatsApp=openVolunteerWhatsApp;


async function rejectedVolunteers(){
 const d=await api('/api/admin/volunteers');
 const items=d.items.filter(v=>v.status==='rejected');

 if(!items.length){
  content.innerHTML=`
   <div class="panel">
    <h3>سجل المرفوضين</h3>
    <p class="muted">لا توجد طلبات مرفوضة حتى الآن.</p>
   </div>`;
  return;
 }

 content.innerHTML=`
  <div class="panel">
   <h3>سجل المرفوضين</h3>
   <p class="muted">
    الطلبات التي تم رفضها محفوظة هنا ولا يتم حذفها.
   </p>

   <div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse">
     <thead>
      <tr>
       <th>الاسم</th>
       <th>البريد</th>
       <th>الهاتف</th>
       <th>التخصص</th>
       <th>المستوى</th>
       <th>المدينة</th>
       <th>تاريخ الرفض</th>
      </tr>
     </thead>

     <tbody>
      ${items.map(v=>`
       <tr>
        <td>${esc(v.name||'')}</td>
        <td>${esc(v.email||'')}</td>
        <td>${esc(v.phone||'')}</td>
        <td>${esc(v.major||'-')}</td>
        <td>${esc(v.level||'-')}</td>
        <td>${esc(v.city||'-')}</td>
        <td>${esc(v.rejected_at||'-')}</td>
       </tr>
      `).join('')}
     </tbody>
    </table>
   </div>
  </div>`;
}

async function updateVolunteer(id,status){
 const ok=confirm(status==='accepted'
  ? 'هل تريد قبول هذا المتطوع؟'
  : 'هل تريد رفض هذا الطلب؟');

 if(!ok) return;

 try{
  await api('/api/admin/volunteers/'+id,{
   method:'PUT',
   body:JSON.stringify({status})
  });

  volunteers();
 }catch(e){
  alert(e.message);
 }
}

async function ideas(){
 const d=await api('/api/admin/ideas');
 const statusLabel={
  new:'جديدة',
  reviewing:'قيد الدراسة',
  accepted:'مقبولة',
  rejected:'مرفوضة',
  implemented:'تم تنفيذها'
 };

 content.innerHTML=d.items.length?d.items.map(x=>`
  <div class="panel">
   <div class="topbar">
    <div>
     <h3>${esc(x.title)}</h3>
     <div class="muted">${esc(x.created_at)}</div>
    </div>
    <span class="badge">${esc(statusLabel[x.status]||x.status)}</span>
   </div>

   <div class="formGrid">
    <div class="field">
     <label>الاسم</label>
     <input value="${esc(x.name)}" disabled>
    </div>

    <div class="field">
     <label>وسيلة التواصل</label>
     <input value="${esc(x.contact)}" disabled>
    </div>

    <div class="field">
     <label>المجال</label>
     <input value="${esc(x.category||'غير محدد')}" disabled>
    </div>

    <div class="field">
     <label>الحالة</label>
     <select id="ideaStatus${x.id}">
      ${Object.entries(statusLabel).map(([k,v])=>`<option value="${k}" ${x.status===k?'selected':''}>${v}</option>`).join('')}
     </select>
    </div>

    <div class="field full">
     <label>وصف الفكرة</label>
     <textarea disabled>${esc(x.description)}</textarea>
    </div>

    <div class="field full">
     <label>المشكلة التي تحاول الفكرة حلها</label>
     <textarea disabled>${esc(x.problem||'')}</textarea>
    </div>

    <div class="field full">
     <label>الأثر المتوقع</label>
     <textarea disabled>${esc(x.expected_impact||'')}</textarea>
    </div>

    <div class="field full">
     <label>ملاحظات الإدارة</label>
     <textarea id="ideaNotes${x.id}">${esc(x.admin_notes||'')}</textarea>
    </div>

    <button class="btn green full" onclick="saveIdea(${x.id})">حفظ التحديث</button>
   </div>
  </div>
 `).join(''):'<div class="panel"><p class="muted">لا توجد أفكار مرسلة حتى الآن.</p></div>';
}

async function saveIdea(id){
 try{
  const status=document.getElementById('ideaStatus'+id).value;
  const admin_notes=document.getElementById('ideaNotes'+id).value;

  await api('/api/admin/ideas/'+id,{
   method:'PUT',
   body:JSON.stringify({status,admin_notes})
  });

  flash('تم تحديث حالة الفكرة');
  ideas();
 }catch(e){
  flash(e.message,true);
 }
}
