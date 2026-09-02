const $=s=>document.querySelector(s), content=$('#content'); let me=null, needsSetup=false, current='dashboard';
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
async function api(url,opt={}){opt.headers={...(opt.headers||{}),'Content-Type':'application/json'};const r=await fetch(url,opt);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'حدث خطأ');return d}
function flash(t,err=false){$('#msg').innerHTML=`<div class="notice ${err?'error':''}">${esc(t)}</div>`;setTimeout(()=>$('#msg').innerHTML='',3500)}
async function init(){
 needsSetup=(await api('/api/setup/status')).needsSetup;

 const session=await api('/api/me');

 if(session.suspended){
  me=null;
  showAuth();
  $('#authMsg').innerHTML=
   '<div class="notice error">⛔ حسابك موقوف من قِبل المالك.<br>يرجى التواصل مع إدارة مبادرة روح.</div>';
  return;
 }

 me=session.user;

 if(me)
  showAdmin();
 else
  showAuth();
}
function showAuth(){ $('#authView').classList.remove('hidden');$('#adminView').classList.add('hidden');$('#authTitle').textContent=needsSetup?'إعداد الموقع لأول مرة':'دخول المسؤولين';$('#nameField').classList.toggle('hidden',!needsSetup)}
$('#authForm').onsubmit=async e=>{e.preventDefault();try{if(needsSetup){await api('/api/setup',{method:'POST',body:JSON.stringify({name:$('#authName').value,email:$('#authEmail').value,password:$('#authPassword').value})});needsSetup=false;$('#authMsg').innerHTML='<div class="notice">تم إنشاء حساب المالك. سجّل الدخول الآن.</div>';showAuth()}else{await api('/api/login',{method:'POST',body:JSON.stringify({email:$('#authEmail').value,password:$('#authPassword').value})});me=(await api('/api/me')).user;showAdmin()}}catch(ex){$('#authMsg').innerHTML=`<div class="notice error">${esc(ex.message)}</div>`}}
let selectedDepartment='all';

async function renderDepartmentBar(){
 const bar=$('#departmentBar');
 if(!bar || !me) return;

 let departmentAdmins=[];
 try{
  const d=await api('/api/admin/department-admins');
  departmentAdmins=d.items||[];
 }catch{
  departmentAdmins=[];
 }

 const departments=[
  'الميداني',
  'إدارة الموارد البشرية (HR)',
  'الأكاديمي',
  'العلاقات العامة',
  'التقني',
  'فكرة',
  'الإعلامي',
  'التيسير'
 ];

 const isHR=
  me.role==='admin' &&
  me.department==='إدارة الموارد البشرية (HR)';

 const isDeputy=me.system_role==='deputy_owner';

 const canViewAll=
  me.role==='owner' || isDeputy || isHR;

 if(!canViewAll){
  selectedDepartment=me.department || '';

  const admins=departmentAdmins
   .filter(a=>a.department===me.department)
   .map(a=>a.name);

  bar.innerHTML=`
   <div class="departmentBar departmentBarColumn">
    <div>
     <span>🏢 القسم الحالي</span>
     <strong>${esc(me.department||'غير محدد')}</strong>
    </div>

    <div class="departmentAdmins">
     👤 مسؤول القسم:
     <strong>${admins.length ? admins.map(esc).join('، ') : 'غير محدد'}</strong>
    </div>
   </div>
  `;
  return;
 }

 const selectedAdmins=
  selectedDepartment==='all'
   ? []
   : departmentAdmins
      .filter(a=>a.department===selectedDepartment)
      .map(a=>a.name);

 bar.innerHTML=`
  <div class="departmentBar departmentBarColumn">
   <div>
    <span>🏢 عرض القسم</span>
    <select id="departmentFilter">
     <option value="all">كل الأقسام</option>
     ${departments.map(d=>`
      <option value="${esc(d)}"
       ${selectedDepartment===d?'selected':''}>
       ${esc(d)}
      </option>
     `).join('')}
    </select>
   </div>

   <div id="departmentAdminsInfo" class="departmentAdmins">
    ${
     selectedDepartment==='all'
      ? `👤 مسؤولو الأقسام: <strong>${departmentAdmins.length}</strong>`
      : `👤 مسؤول القسم: <strong>${selectedAdmins.length ? selectedAdmins.map(esc).join('، ') : 'غير محدد'}</strong>`
    }
   </div>
  </div>
 `;

 $('#departmentFilter').onchange=e=>{
  selectedDepartment=e.target.value;

  const info=$('#departmentAdminsInfo');

  if(info){
   if(selectedDepartment==='all'){
    info.innerHTML=`👤 مسؤولو الأقسام: <strong>${departmentAdmins.length}</strong>`;
   }else{
    const admins=departmentAdmins
     .filter(a=>a.department===selectedDepartment)
     .map(a=>a.name);

    info.innerHTML=`👤 مسؤول القسم: <strong>${admins.length ? admins.map(esc).join('، ') : 'غير محدد'}</strong>`;
   }
  }

  flash(
   selectedDepartment==='all'
    ? 'يتم عرض كل الأقسام'
    : 'تم اختيار قسم '+selectedDepartment
  );

  const activeTab=document.querySelector('#menu button.active')?.dataset.tab;

  if(activeTab==='volunteers'){
   volunteers();
  }
 };
}

function showAdmin(){ $('#authView').classList.add('hidden');$('#adminView').classList.remove('hidden');$('#userBox').innerHTML=`<p><b>${esc(me.name)}</b><br><span class="muted">${me.role==='owner'?'المالك':me.system_role==='deputy_owner'?'الريس':'مسؤول قسم'}</span></p>`;renderDepartmentBar();loadNotifications();document.querySelectorAll('[data-role]').forEach(x=>{const need=x.dataset.role;let allowed=true;if(need==='owner')allowed=me.role==='owner';else if(need==='management')allowed=me.role==='owner'||me.system_role==='deputy_owner';else if(need==='trash')allowed=me.role==='owner'||(me.role==='admin'&&me.system_role!=='deputy_owner'&&me.department==='إدارة الموارد البشرية (HR)');else if(need==='hr')allowed=me.role==='owner'||me.system_role==='deputy_owner'||(me.role==='admin'&&me.department==='إدارة الموارد البشرية (HR)');else allowed=['owner','admin'].includes(me.role);x.classList.toggle('hidden',!allowed)});loadTab('dashboard')}
$('#logoutBtn').onclick=async()=>{await api('/api/logout',{method:'POST'});me=null;showAuth()};
$('#menu').onclick=e=>{if(e.target.dataset.tab)loadTab(e.target.dataset.tab)};
async function loadTab(tab){current=tab;document.querySelectorAll('#menu button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));const titles={dashboard:'لوحة التحكم',events:'الفعاليات',achievements:'الإنجازات',ideas:'الأفكار',complaints:'الشكاوى',volunteers:'طلبات المتطوعين','department-work':'محتوى القسم','rejected-volunteers':'سجل المرفوضين',content:'محتوى الموقع',faqs:'الأسئلة الشائعة',trash:'سلة المحذوفات',approvals:'طلبات الموافقة',users:'المسؤولون والصلاحيات',audit:'سجل التعديلات'};$('#pageTitle').textContent=titles[tab];content.innerHTML='<div class="panel">جارٍ التحميل…</div>';try{if(tab==='dashboard')return dashboard();if(tab==='events')return listEntities('events');if(tab==='achievements')return listEntities('achievements');if(tab==='ideas')return ideas();if(tab==='complaints')return complaints();if(tab==='volunteers')return volunteers();if(tab==='department-work')return departmentWork();if(tab==='rejected-volunteers')return rejectedVolunteers();if(tab==='content')return editContent();if(tab==='faqs')return faqs();if(tab==='trash')return trash();if(tab==='approvals')return deletionRequests();if(tab==='users')return users();if(tab==='audit')return audit()}catch(e){content.innerHTML=`<div class="notice error">${esc(e.message)}</div>`}}
async function dashboard(){
 const d=await api('/api/admin/dashboard');

 if(d.dashboardType==='deputy'){
  content.innerHTML=`
   <div class="panel">
    <h3>الريس</h3>
    <p class="muted">نظرة شاملة على إدارة المبادرة.</p>
   </div>

   <div class="grid grid4">
    <div class="panel">
     <b>الفعاليات</b>
     <h2>${d.counts.events}</h2>
    </div>

    <div class="panel">
     <b>الإنجازات</b>
     <h2>${d.counts.achievements}</h2>
    </div>

    <div class="panel">
     <b>المسؤولون الفعالون</b>
     <h2>${d.counts.users}</h2>
    </div>

    <div class="panel">
     <b>المحتوى المنشور</b>
     <h2>${d.counts.published}</h2>
    </div>
   </div>`;
  return;
 }

 if(d.dashboardType==='owner'){
  const auditPanel=`
   <div class="panel">
    <h3>آخر التعديلات</h3>
    ${d.audit.map(a=>`
     <p>
      <b>${esc(a.user_name||'النظام')}</b>
      — ${esc(a.action)} ${esc(a.entity)}
      <span class="muted">${esc(a.created_at)}</span>
     </p>
    `).join('')||'<p class="muted">لا يوجد سجل بعد.</p>'}
   </div>`;

  content.innerHTML=`
   <div class="grid grid4">
    <div class="panel"><b>الفعاليات</b><h2>${d.counts.events}</h2></div>
    <div class="panel"><b>الإنجازات</b><h2>${d.counts.achievements}</h2></div>
    <div class="panel"><b>المسؤولون</b><h2>${d.counts.users}</h2></div>
    <div class="panel"><b>المحتوى المنشور</b><h2>${d.counts.published}</h2></div>
   </div>
   ${auditPanel}`;
  return;
 }

 if(d.dashboardType==='hr'){
  content.innerHTML=`
   <div class="panel">
    <h3>إدارة الموارد البشرية (HR)</h3>
    <p class="muted">نظرة سريعة على إدارة المتطوعين والشكاوى.</p>
   </div>

   <div class="grid grid4">
    <div class="panel">
     <b>طلبات المتطوعين</b>
     <h2>${d.counts.applications}</h2>
    </div>

    <div class="panel">
     <b>حسابات المتطوعين الفعالة</b>
     <h2>${d.counts.activeVolunteers}</h2>
    </div>

    <div class="panel">
     <b>الشكاوى الجديدة</b>
     <h2>${d.counts.newComplaints}</h2>
    </div>
   </div>`;
  return;
 }

 if(d.dashboardType==='department'){
  content.innerHTML=`
   <div class="panel">
    <h3>${esc(d.department||'القسم')}</h3>
    <p class="muted">لوحة التحكم الخاصة بقسمك.</p>
   </div>

   <div class="grid grid4">
    <div class="panel">
     <b>متطوعو القسم</b>
     <h2>${d.counts.volunteers}</h2>
    </div>

    <div class="panel">
     <b>محتوى القسم</b>
     <h2>${d.counts.departmentContent}</h2>
    </div>
   </div>`;
  return;
 }

 content.innerHTML='<div class="notice error">تعذر تحميل لوحة التحكم.</div>';
}
const cfg={events:{title:'فعالية',date:'event_date',fields:[['title','اسم الفعالية'],['summary','وصف مختصر'],['description','الوصف الكامل'],['event_date','التاريخ','date'],['event_time','الوقت','time'],['location','المكان'],['registration_url','رابط التسجيل'],['event_state','الحالة الظاهرة']],image:'cover_image'},achievements:{title:'إنجاز',date:'achievement_date',fields:[['title','عنوان الإنجاز'],['summary','وصف مختصر'],['description','الوصف الكامل'],['achievement_date','التاريخ','date'],['volunteers','عدد المتطوعين','number'],['beneficiaries','عدد المستفيدين','number'],['volunteer_hours','الساعات التطوعية','number']],image:'cover_image'}};
async function listEntities(type){const d=await api('/api/admin/'+type);content.innerHTML=`<div class="panel"><button class="btn green" onclick="entityForm('${type}')">+ إضافة ${cfg[type].title}</button></div><div class="panel"><table class="table"><thead><tr><th>الصورة</th><th>العنوان</th><th>الحالة</th><th>التاريخ</th><th>إجراءات</th></tr></thead><tbody>${d.items.map(x=>`<tr><td>${x.cover_image?`<img class="thumb" src="${esc(x.cover_image)}">`:''}</td><td>${esc(x.title)}</td><td>${esc(x.status)}</td><td>${esc(x[cfg[type].date])}</td><td><div class="rowActions"><button class="btn light small" onclick='entityForm("${type}",${JSON.stringify(x).replaceAll("'","&#39;")})'>تعديل</button><button class="btn danger small" onclick="removeEntity('${type}',${x.id})">حذف</button></div></td></tr>`).join('')||'<tr><td colspan="5">لا يوجد محتوى بعد.</td></tr>'}</tbody></table></div>`}
window.entityForm=(type,item={})=>{const c=cfg[type];content.innerHTML=`<div class="panel"><h3>${item.id?'تعديل':'إضافة'} ${c.title}</h3><form id="entityForm" class="formGrid">${c.fields.map(f=>`<div class="field ${['summary','description'].includes(f[0])?'full':''}"><label>${f[1]}</label>${['summary','description'].includes(f[0])?`<textarea name="${f[0]}">${esc(item[f[0]]||'')}</textarea>`:`<input name="${f[0]}" type="${f[2]||'text'}" value="${esc(item[f[0]]||'')}">`}</div>`).join('')}<div class="field"><label>الصورة</label><input id="imgFile" type="file" accept="image/jpeg,image/png,image/webp"><input type="hidden" name="cover_image" value="${esc(item.cover_image||'')}">${item.cover_image?`<img class="imagePreview" src="${esc(item.cover_image)}">`:''}</div><div class="field"><label>حالة النشر</label><select name="status"><option value="draft" ${item.status!=='published'?'selected':''}>مسودة</option><option value="published" ${item.status==='published'?'selected':''}>منشور</option></select></div><div class="full rowActions"><button class="btn green" type="submit">حفظ</button><button class="btn light" type="button" onclick="loadTab('${type}')">إلغاء</button></div></form></div>`;$('#entityForm').onsubmit=async e=>{e.preventDefault();try{const fd=new FormData(e.target),obj=Object.fromEntries(fd.entries());const file=$('#imgFile').files[0];if(file)obj.cover_image=await upload(file);await api('/api/admin/'+type+(item.id?'/'+item.id:''),{method:item.id?'PUT':'POST',body:JSON.stringify(obj)});flash('تم الحفظ');loadTab(type)}catch(ex){flash(ex.message,true)}}};
async function upload(file){const dataUrl=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)});return (await api('/api/admin/upload',{method:'POST',body:JSON.stringify({filename:file.name,dataUrl})})).url}
window.removeEntity=async(type,id)=>{if(!confirm(me.role==='owner'?'نقل العنصر إلى سلة المحذوفات؟':'إرسال طلب حذف إلى المالك؟'))return;try{const r=await api('/api/admin/'+type+'/'+id,{method:'DELETE'});flash(r.pendingApproval?'تم إرسال طلب الحذف للمالك':'تم النقل إلى سلة المحذوفات');loadTab(type)}catch(e){flash(e.message,true)}};
async function editContent(){const d=await api('/api/admin/content'),s=d.settings,st=d.stats;content.innerHTML=`<form id="contentForm"><div class="panel formGrid"><div class="field"><label>اسم المبادرة</label><input name="initiative_name" value="${esc(s.initiative_name)}"></div><div class="field"><label>الشعار النصي</label><input name="tagline" value="${esc(s.tagline)}"></div>${[['hero_text','نص الواجهة'],['belief','عبارة الإيمان'],['about','من نحن'],['mission','الرسالة'],['vision','الرؤية'],['join_intro','نص الانضمام']].map(x=>`<div class="field full"><label>${x[1]}</label><textarea name="${x[0]}">${esc(s[x[0]])}</textarea></div>`).join('')}<div class="field"><label>البريد</label><input name="email" value="${esc(s.email)}"></div><div class="field"><label>رابط نموذج الانتساب</label><input name="join_url" value="${esc(s.join_url)}"></div><div class="field"><label>Instagram</label><input name="instagram" value="${esc(s.instagram)}"></div><div class="field"><label>Facebook</label><input name="facebook" value="${esc(s.facebook)}"></div><div class="field full"><label>القيم (JSON)</label><textarea name="values_json">${esc(s.values_json)}</textarea></div><div class="field full"><label>المجالات (JSON)</label><textarea name="fields_json">${esc(s.fields_json)}</textarea></div><div class="field full"><label>أسباب الانضمام (JSON)</label><textarea name="join_reasons_json">${esc(s.join_reasons_json)}</textarea></div><div class="field"><label>إظهار أرقام الأثر</label><select name="stats_visible"><option value="0" ${s.stats_visible!=='1'?'selected':''}>مخفي</option><option value="1" ${s.stats_visible==='1'?'selected':''}>ظاهر</option></select></div></div><div class="panel formGrid"><h3 class="full">أرقام الأثر</h3>${[['volunteers','المتطوعون'],['events','الفعاليات'],['hours','ساعات التطوع'],['beneficiaries','المستفيدون']].map(x=>`<div class="field"><label>${x[1]}</label><input type="number" name="stat_${x[0]}" value="${st[x[0]]}"></div>`).join('')}<button class="btn green full">حفظ التعديلات</button></div></form>`;$('#contentForm').onsubmit=async e=>{e.preventDefault();try{const o=Object.fromEntries(new FormData(e.target).entries()),stats={};for(const k of ['volunteers','events','hours','beneficiaries']){stats[k]=o['stat_'+k];delete o['stat_'+k]}await api('/api/admin/settings',{method:'PUT',body:JSON.stringify(o)});await api('/api/admin/stats',{method:'PUT',body:JSON.stringify(stats)});flash('تم تحديث محتوى الموقع')}catch(ex){flash(ex.message,true)}}}
async function faqs(){const d=await api('/api/admin/faqs');content.innerHTML=`<div class="panel"><button class="btn green" onclick="faqForm()">+ إضافة سؤال</button></div><div class="panel">${d.items.map(f=>`<div class="faq"><b>${esc(f.question)}</b><p>${esc(f.answer)}</p><div class="rowActions"><button class="btn light small" onclick='faqForm(${JSON.stringify(f).replaceAll("'","&#39;")})'>تعديل</button><button class="btn danger small" onclick="deleteFaq(${f.id})">حذف</button></div></div>`).join('')}</div>`}
window.faqForm=(f={})=>{content.innerHTML=`<div class="panel"><form id="faqForm" class="formGrid"><div class="field full"><label>السؤال</label><input name="question" value="${esc(f.question||'')}" required></div><div class="field full"><label>الإجابة</label><textarea name="answer" required>${esc(f.answer||'')}</textarea></div><div class="field"><label>الترتيب</label><input name="sort_order" type="number" value="${f.sort_order||0}"></div><div class="field"><label>الحالة</label><select name="active"><option value="1">ظاهر</option><option value="0" ${f.active===0?'selected':''}>مخفي</option></select></div><button class="btn green full">حفظ</button></form></div>`;$('#faqForm').onsubmit=async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(e.target).entries());o.active=o.active==='1';try{await api('/api/admin/faqs'+(f.id?'/'+f.id:''),{method:f.id?'PUT':'POST',body:JSON.stringify(o)});loadTab('faqs')}catch(ex){flash(ex.message,true)}}}
window.deleteFaq=async id=>{if(confirm(me.role==='owner'?'حذف السؤال؟':'إرسال طلب حذف السؤال إلى المالك؟')){try{const r=await api('/api/admin/faqs/'+id,{method:'DELETE'});flash(r.pendingApproval?'تم إرسال طلب الحذف للمالك':'تم نقل السؤال إلى سلة المحذوفات');loadTab('faqs')}catch(e){flash(e.message,true)}}};
async function trash(){
 const isHR=
  me.role==='admin' &&
  me.department==='إدارة الموارد البشرية (HR)';

 let d={
  events:[],
  achievements:[],
  faqs:[],
  department_content:[]
 };

 if(me.role==='owner'){
  d=await api('/api/admin/trash');
 }

 const group=(title,type,items)=>`
  <div class="panel">
   <h3>${title}</h3>
   ${items.map(x=>`
    <p>
     ${esc(x.title)}
     <button class="btn light small" onclick="restore('${type}',${x.id})">
      استرجاع
     </button>
    </p>
   `).join('')||'<p class="muted">فارغة</p>'}
  </div>`;

 let volunteerTrash='';

 if(me.role==='owner' || isHR){
  try{
   const vd=await api('/api/admin/volunteer-accounts/trash');

   volunteerTrash=`
    <div class="panel">
     <h3>حسابات المتطوعين المحذوفة</h3>

     ${vd.items.map(v=>`
      <p>
       <b>${esc(v.name)}</b>
       — ${esc(v.username||'-')}
       — ${esc(v.department||'-')}

       <button class="btn danger small"
        onclick="permanentlyDeleteVolunteerAccount(${v.id})">
        🗑️ إزالة نهائيًا
       </button>
      </p>
     `).join('')||'<p class="muted">فارغة</p>'}
    </div>`;
  }catch(e){}
 }

 const generalTrash=
  me.role==='owner'
   ? group('الفعاليات','events',d.events)+
     group('الإنجازات','achievements',d.achievements)+
     group('الأسئلة','faqs',d.faqs)+
     group('محتوى الأقسام','department_content',d.department_content)
   : '';

 content.innerHTML=
  generalTrash+
  volunteerTrash;

}
window.restore=async(type,id)=>{await api(`/api/admin/trash/${type}/${id}/restore`,{method:'POST'});flash('تم الاسترجاع');loadTab('trash')};

window.permanentlyDeleteVolunteerAccount=async id=>{
 if(!confirm(
  'هل تريد إزالة حساب هذا المتطوع نهائيًا؟\n\n' +
  'لا يمكن التراجع عن هذا الإجراء.'
 )) return;

 try{
  const r=await api('/api/admin/volunteer-accounts/'+id+'/permanent',{
   method:'DELETE'
  });

  flash(r.message || 'تم حذف حساب المتطوع نهائيًا');
  loadTab('trash');
 }catch(e){
  flash(e.message,true);
 }
};

async function users(){const d=await api('/api/admin/users');content.innerHTML=`<div class="panel"><button class="btn green" onclick="userForm()">+ إضافة مسؤول</button></div><div class="panel"><table class="table"><tr><th>الاسم</th><th>الهاتف</th><th>البريد</th><th>الصلاحية</th><th>القسم</th><th>الحالة</th><th></th></tr>${d.items.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.phone||'-')}</td><td>${esc(u.email)}</td><td>${u.role==='owner'?'المالك':u.system_role==='deputy_owner'?'الريس':'مسؤول قسم'}</td><td>${esc(u.department||'-')}</td><td>${u.active?'فعال':'موقوف'}</td><td>${u.role!=='owner'?`<button class="btn light small" onclick='userForm(${JSON.stringify(u).replaceAll("'","&#39;")})'>تعديل</button>`:''}</td></tr>`).join('')}</table></div>`}
window.userForm=(u={})=>{content.innerHTML=`<div class="panel"><form id="userForm" class="formGrid"><div class="field"><label>الاسم</label><input name="name" value="${esc(u.name||'')}" required></div><div class="field"><label>رقم الهاتف</label><input name="phone" type="tel" value="${esc(u.phone||'')}" maxlength="30" required></div><div class="field"><label>البريد</label><input name="email" type="email" value="${esc(u.email||'')}" required></div>${u.id?'':`<div class="field"><label>كلمة المرور</label><input name="password" type="password" minlength="8" required></div>`}<div class="field"><label>الصلاحية</label><select name="role">
<option value="admin" ${u.system_role!=='deputy_owner'?'selected':''}>مسؤول قسم</option>
<option value="deputy_owner" ${u.system_role==='deputy_owner'?'selected':''}>الريس</option>
</select></div>
<div class="field">
<label>القسم</label>
<select name="department">
<option value="">بدون قسم</option>
<option value="الميداني" ${u.department==='الميداني'?'selected':''}>الميداني</option>
<option value="إدارة الموارد البشرية (HR)" ${u.department==='إدارة الموارد البشرية (HR)'?'selected':''}>إدارة الموارد البشرية (HR)</option>
<option value="الأكاديمي" ${u.department==='الأكاديمي'?'selected':''}>الأكاديمي</option>
<option value="العلاقات العامة" ${u.department==='العلاقات العامة'?'selected':''}>العلاقات العامة</option>
<option value="التقني" ${u.department==='التقني'?'selected':''}>التقني</option>
<option value="فكرة" ${u.department==='فكرة'?'selected':''}>فكرة</option>
<option value="الإعلامي" ${u.department==='الإعلامي'?'selected':''}>الإعلامي</option>
<option value="التيسير" ${u.department==='التيسير'?'selected':''}>التيسير</option>
</select>
</div>${u.id?`<div class="field"><label>الحالة</label><select name="active"><option value="1" ${u.active?'selected':''}>فعال</option><option value="0" ${!u.active?'selected':''}>موقوف</option></select></div>`:''}<button class="btn green full">حفظ</button></form></div>`;$('#userForm').onsubmit=async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(e.target).entries());if(u.id)o.active=o.active==='1';try{await api('/api/admin/users'+(u.id?'/'+u.id:''),{method:u.id?'PUT':'POST',body:JSON.stringify(o)});flash('تم الحفظ');loadTab('users')}catch(ex){flash(ex.message,true)}}}

async function deletionRequests(){
 const d=await api('/api/admin/deletion-requests');

 const names={
  department_content:'محتوى القسم',
  events:'فعالية',
  achievements:'إنجاز',
  faq:'سؤال شائع',
  volunteer_application:'طلب متطوع'
 };

 const statusNames={
  pending:'بانتظار الموافقة',
  approved:'تمت الموافقة',
  rejected:'مرفوض'
 };

 content.innerHTML=`
  <div class="panel">
   <h3>طلبات حذف بانتظار موافقة المالك</h3>
   <table class="table">
    <thead>
     <tr>
      <th>المسؤول</th>
      <th>القسم</th>
      <th>نوع العنصر</th>
      <th>العنصر</th>
      <th>الحالة</th>
      <th>الوقت</th>
      <th>الإجراء</th>
     </tr>
    </thead>
    <tbody>
     ${d.items.map(r=>`
      <tr>
       <td>${esc(r.requester_name||'-')}</td>
       <td>${esc(r.requester_department||'-')}</td>
       <td>${esc(names[r.entity_type]||r.entity_type)}</td>
       <td>${esc(r.item_title||('#'+r.entity_id))}</td>
       <td>${esc(statusNames[r.status]||r.status)}</td>
       <td>${esc(r.created_at)}</td>
       <td>
        ${r.status==='pending'?`
         <div class="rowActions">
          <button class="btn green small" onclick="decideDeletionRequest(${r.id},'approve')">موافقة على الحذف</button>
          <button class="btn danger small" onclick="decideDeletionRequest(${r.id},'reject')">رفض الحذف</button>
         </div>
        `:`<span class="muted">${esc(r.decided_by_name||'تم اتخاذ القرار')}</span>`}
       </td>
      </tr>
     `).join('')||'<tr><td colspan="7">لا توجد طلبات حذف.</td></tr>'}
    </tbody>
   </table>
  </div>
 `;
}

window.decideDeletionRequest=async(id,action)=>{
 const message=action==='approve'
  ? 'هل تريد الموافقة على حذف هذا العنصر؟'
  : 'هل تريد رفض طلب الحذف؟';

 if(!confirm(message)) return;

 try{
  await api('/api/admin/deletion-requests/'+id,{
   method:'PUT',
   body:JSON.stringify({action})
  });

  flash(action==='approve'?'تمت الموافقة على الحذف':'تم رفض طلب الحذف');
  deletionRequests();
 }catch(e){
  flash(e.message,true);
 }
};

async function audit(){const d=await api('/api/admin/audit');content.innerHTML=`<div class="panel"><table class="table"><tr><th>المسؤول</th><th>الإجراء</th><th>العنصر</th><th>التفاصيل</th><th>الوقت</th></tr>${d.items.map(a=>`<tr><td>${esc(a.user_name||'النظام')}</td><td>${esc(a.action)}</td><td>${esc(a.entity)} ${esc(a.entity_id)}</td><td>${esc(a.details)}</td><td>${esc(a.created_at)}</td></tr>`).join('')}</table></div>`}
init().catch(e=>console.error(e));


async function volunteers(){
 const d=await api('/api/admin/volunteers');

 const allItems=d.items.filter(v=>v.status!=='rejected');

 const items=allItems.filter(v=>{
  if(me.role==='owner' || me.system_role==='deputy_owner' || (
   me.role==='admin' &&
   me.department==='إدارة الموارد البشرية (HR)'
  )){
   return selectedDepartment==='all' ||
          v.department===selectedDepartment;
  }

  return v.department===me.department && v.department_approval!=='rejected';
 });

 const isHR=
  me.role==='admin' &&
  me.department==='إدارة الموارد البشرية (HR)';

 const isOwnerOrHR=
  me.role==='owner' || me.system_role==='deputy_owner' || isHR;

 const statusText={
  pending:'قيد المراجعة',
  contacted:'تم التواصل معه',
  accepted:'مقبول',
  rejected:'مرفوض'
 };

 if(!items.length){
  content.innerHTML='<div class="panel"><h3>طلبات المتطوعين</h3><p class="muted">لا توجد طلبات متطوعين حتى الآن.</p></div>';
  return;
 }

 content.innerHTML=`
  <div class="panel">
   <h3>طلبات المتطوعين</h3>

   <p class="muted">
    HR يراجع الطلب ويوجهه للقسم المناسب، وبعدها مسؤول القسم
    يقرر قبوله أو رفضه. بعد موافقة القسم، يقوم HR بإرسال رسالة القبول.
   </p>

   <div class="volunteerTableWrap">
    <table class="volunteerTable">
     <thead>
      <tr>
       <th>الاسم</th>
       <th>البريد</th>
       <th>الهاتف</th>
       <th>التخصص</th>
       <th>المستوى</th>
       <th>المدينة</th>
       <th>الحالة</th>
       <th>القسم</th>
       <th>الإجراء</th>
      </tr>
     </thead>

     <tbody>
      ${items.map(v=>{

       let stateText=statusText[v.status]||v.status;

       if(
        v.status==='pending' &&
        v.contacted_at &&
        !v.department_approval
       )
        stateText='تم التواصل معه';

       if(v.department_approval==='pending')
        stateText='بانتظار موافقة القسم';

       if(v.department_approval==='accepted')
        stateText='مقبول من القسم';

       if(v.department_approval==='rejected')
        stateText=`❌ لم يوافق عليه قسم ${v.department || 'غير محدد'}`;

       let actions='';

       if(
        isOwnerOrHR &&
        v.status==='pending' &&
        !v.contacted_at &&
        !v.department_approval
       ){
        actions+=`
         <button class="btn light"
          onclick="updateVolunteer(${v.id},'contacted')">
          💬 تم التواصل
         </button>
        `;
       }

       if(
        isOwnerOrHR &&
        (v.status==='pending' || v.status==='contacted') &&
        v.department_approval!=='pending'
       ){
        actions+=`
         <button class="btn green"
          onclick="updateVolunteer(${v.id},'route_to_department')">
          🏢 توجيه إلى قسم
         </button>
        `;

        actions+=`
         <button class="btn danger"
          onclick="updateVolunteer(${v.id},'rejected')">
          ❌ رفض الطلب
         </button>
        `;
       }

       const canDepartmentDecide =
        v.department_approval==='pending' &&
        (
         me.role==='owner' ||
         me.system_role==='deputy_owner' ||
         (
          me.role==='admin' &&
          me.department===v.department
         )
        );

       if(canDepartmentDecide){
        actions+=`
         <button class="btn green"
          onclick="updateVolunteer(${v.id},'department_accepted')">
          ✅ قبول للفريق
         </button>

         <button class="btn danger"
          onclick="updateVolunteer(${v.id},'department_rejected')">
          ❌ رفض من القسم
         </button>
        `;
       }

       const canCancelDepartmentAcceptance =
        v.status==='accepted' &&
        v.department_approval==='accepted' &&
        (
         isOwnerOrHR ||
         (
          me.role==='admin' &&
          me.department===v.department
         )
        );

       if(canCancelDepartmentAcceptance && !v.volunteer_id){
        actions+=`
         <button class="btn light"
          onclick="updateVolunteer(${v.id},'cancel_department_acceptance')">
          ↩️ إلغاء القبول
         </button>
        `;
       }

       if(
        isOwnerOrHR &&
        v.status==='accepted' &&
        v.department_approval==='accepted' &&
        v.invite_token
       ){
        actions+=`
         <button class="btn green"
          onclick='openVolunteerWhatsApp(${JSON.stringify(v)})'>
          📱 فتح رسالة القبول
         </button>
        `;

        if(!v.whatsapp_sent_at){
         actions+=`
          <button class="btn light"
           onclick="confirmVolunteerWhatsAppSent(${v.id})">
           ✅ تأكيد تم الإرسال
          </button>
         `;
        }
       }

       if(v.status==='accepted' && v.whatsapp_sent_at){
        actions+=`
         <span class="notice">
          ✅ تم إرسال القبول
         </span>
        `;
       }

       if(!v.volunteer_id || v.volunteer_deleted_at){
        if(v.status==='accepted' && !v.volunteer_id){
         actions+=`
          <button class="btn danger"
           onclick="deleteVolunteer(${v.id})">
           🗑️ حذف المتطوع
          </button>
         `;
        }
       }else{
        actions+=`
         <span class="notice">
          👤 لديه حساب
          ${v.volunteer_active ? '🟢 فعال' : '🔴 معطل'}
         </span>

         ${
          isOwnerOrHR
           ? `<button class="btn light"
                onclick='changeVolunteerDepartment(${JSON.stringify(v)})'>
                ✏️ تغيير القسم
              </button>`
           : ''
         }

         ${
          isOwnerOrHR
           ? `<button class="btn ${v.volunteer_active ? 'danger' : 'green'}"
                onclick="toggleVolunteerAccount(${v.id},${v.volunteer_active ? 'false' : 'true'})">
                ${v.volunteer_active ? '⛔ تعطيل الحساب' : '✅ تفعيل الحساب'}
              </button>`
           : ''
         }

         ${
          isOwnerOrHR
           ? `<button class="btn danger"
                onclick="deleteVolunteerAccount(${v.id})">
                🗑️ حذف الحساب
              </button>`
           : ''
         }
        `;
       }

       return `
        <tr>
         <td>
          ${esc(v.name||'')}
          ${
           v.status==='accepted' &&
           v.department_approval==='accepted' &&
           !v.volunteer_id &&
           !v.is_admin_user
            ? '<br><span class="accountWarning">⚠️ لم ينشئ حسابًا</span>'
            : ''
          }
         </td>
         <td>${esc(v.email||'')}</td>
         <td>${esc(v.phone||'')}</td>
         <td>${esc(v.major||'-')}</td>
         <td>${esc(v.level||'-')}</td>
         <td>${esc(v.city||'-')}</td>

         <td>
          <b>${esc(stateText)}</b>
         </td>

         <td>
          ${
           v.department
            ? `<b>${esc(v.department)}</b>`
            : '<span class="muted">لم يحدد بعد</span>'
          }
         </td>

         <td>
          <div class="rowActions">
           ${actions}
          </div>
         </td>
        </tr>
       `;
      }).join('')}
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

 const department = v.department || 'لم يتم تحديد القسم';

 const departmentGroups={
  'الميداني':'https://chat.whatsapp.com/DGStqSESpgjAq3DxIrljUB?s=sw&p=i&mlu=4',
  'إدارة الموارد البشرية (HR)':'https://chat.whatsapp.com/Exl2HKLne4z1toK8sORvew?s=sw&p=i&mlu=4',
  'الأكاديمي':'https://chat.whatsapp.com/ENASFRdtXWu7KXOja2eZNq?s=sw&p=i&mlu=4',
  'العلاقات العامة':'https://chat.whatsapp.com/GrAuXBNMXPu40IWR4r2CJw?s=sw&p=i&mlu=4',
  'التقني':'https://chat.whatsapp.com/CqLWTkhVzPW0vsIMr2Xgar?s=sw&p=i&mlu=4',
  'فكرة':'https://chat.whatsapp.com/EuiNNbPQedBErniuShpYue?s=sw&p=i&mlu=4',
  'الإعلامي':'https://chat.whatsapp.com/If0dpI1IF2B8mdYot3UlsB?s=sw&p=i&mlu=4',
  'التيسير':'https://chat.whatsapp.com/HyCISufWvtC50xMfqDHppJ?s=sw&p=i&mlu=4'
 };

 const groupUrl=departmentGroups[department] || '';

 const groupMessage=groupUrl
  ? '\n\n👥 وانضم لمجموعة قسمك على واتساب من هنا:\n' +
    groupUrl
  : '';

 const allDepartmentsGroup =
  '\n\n💚 وانضم لمجموعة مبادرة روح – جميع الأقسام من هنا:\n' +
  'https://chat.whatsapp.com/HPFufR8WZ2TE4FD2KLxoEF?s=sw&p=i&mlu=4';

 const message =
 '\u{1F389} مبارك! تم قبولك رسميًا في مبادرة روح \u{1F49A}\n\n' +
 '\u{1F3E2} تم قبولك في قسم: ' + department + '\n\n' +
 'أهلًا وسهلًا فيك بين عائلة روح \u{1F331}\n' +
 'متحمسين نشوف أفكارك، حماسك، وإنجازاتك معنا، ويلا نبدأ نصنع أثر حلو سوا! \u{1F525}\n\n' +
 'من اليوم إنت جزء من فريق روح، وكل فكرة، مشاركة، وخطوة بتعملها معنا إلها قيمة وأثر \u{2728}\n\n' +
 '\u{1F510} أنشئ حسابك على موقع روح من خلال رابط التسجيل الخاص فيك:\n' +
 registerUrl +
 groupMessage +
 allDepartmentsGroup +
 '\n\n' +
 'أهلًا فيك مرة ثانية، ومتحمسين نبدأ المشوار سوا \u{1F49A}\u{1F331}\n' +
 'فريق مبادرة روح';

 const url =
  'https://web.whatsapp.com/send?phone=' +
  phone +
  '&type=phone_number&app_absent=0&text=' +
  encodeURIComponent(message);

 const openMode=prompt(
  'كيف تريد فتح واتساب؟\n\n1 = WhatsApp Web\n2 = تطبيق WhatsApp',
  '1'
 );

 if(openMode===null) return;

 if(openMode.trim()==='2'){
  window.location.href=
   'whatsapp://send?phone='+
   phone+
   '&text='+
   encodeURIComponent(message);
 }else{
  const whatsappWindow=window.open(url,'_blank');

  if(!whatsappWindow){
   alert('المتصفح منع فتح واتساب. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى.');
   return;
  }
 }

 flash('📱 تم فتح رسالة القبول في واتساب');
}

window.openVolunteerWhatsApp=openVolunteerWhatsApp;

async function confirmVolunteerWhatsAppSent(id){
 const ok=confirm(
  'هل تم إرسال رسالة القبول للمتطوع فعلًا؟\n\n' +
  'اضغط OK فقط بعد إرسال الرسالة في واتساب.'
 );

 if(!ok) return;

 try{
  await api('/api/admin/volunteers/'+id+'/whatsapp-sent',{
   method:'PUT',
   body:JSON.stringify({})
  });

  flash('✅ تم تسجيل إرسال رسالة القبول');
  await volunteers();

 }catch(e){
  alert(e.message);
 }
}

window.confirmVolunteerWhatsAppSent=confirmVolunteerWhatsAppSent;



async function changeVolunteerDepartment(v){
 if(!v || !v.id || !v.phone){
  alert('بيانات المتطوع غير مكتملة');
  return;
 }

 const choice=prompt(
  'اختر القسم:\n'+
  '1 - الميداني\n'+
  '2 - إدارة الموارد البشرية (HR)\n'+
  '3 - الأكاديمي\n'+
  '4 - العلاقات العامة\n'+
  '5 - التقني\n'+
  '6 - فكرة\n'+
  '7 - الإعلامي\n'+
  '8 - التيسير'
 );

 if(choice===null) return;

 const departments={
  '1':'الميداني',
  '2':'إدارة الموارد البشرية (HR)',
  '3':'الأكاديمي',
  '4':'العلاقات العامة',
  '5':'التقني',
  '6':'فكرة',
  '7':'الإعلامي',
  '8':'التيسير'
 };

 const department=departments[String(choice).trim()];

 if(!department){
  alert('اختيار غير صحيح');
  return;
 }

 if(department===v.department){
  alert('المتطوع موجود في هذا القسم أصلًا');
  return;
 }

 if(!confirm(
  'تغيير قسم '+(v.name||'المتطوع')+
  ' من '+(v.department||'غير محدد')+
  ' إلى '+department+' ؟'
 ))
  return;

 const departmentGroups={
  'الميداني':'https://chat.whatsapp.com/DGStqSESpgjAq3DxIrljUB?s=sw&p=i&mlu=4',
  'إدارة الموارد البشرية (HR)':'https://chat.whatsapp.com/Exl2HKLne4z1toK8sORvew?s=sw&p=i&mlu=4',
  'الأكاديمي':'https://chat.whatsapp.com/ENASFRdtXWu7KXOja2eZNq?s=sw&p=i&mlu=4',
  'العلاقات العامة':'https://chat.whatsapp.com/GrAuXBNMXPu40IWR4r2CJw?s=sw&p=i&mlu=4',
  'التقني':'https://chat.whatsapp.com/CqLWTkhVzPW0vsIMr2Xgar?s=sw&p=i&mlu=4',
  'فكرة':'https://chat.whatsapp.com/EuiNNbPQedBErniuShpYue?s=sw&p=i&mlu=4',
  'الإعلامي':'https://chat.whatsapp.com/If0dpI1IF2B8mdYot3UlsB?s=sw&p=i&mlu=4',
  'التيسير':'https://chat.whatsapp.com/HyCISufWvtC50xMfqDHppJ?s=sw&p=i&mlu=4'
 };

 try{
  await api('/api/admin/volunteers/'+v.id+'/department',{
   method:'PUT',
   body:JSON.stringify({department})
  });

  flash('✅ تم تغيير قسم المتطوع');

  const phone=normalizeWhatsAppPhone(v.phone);
  const groupUrl=departmentGroups[department] || '';

  const message=
   'مرحبًا '+(v.name||'')+' 💚\n\n'+
   'نود إعلامك بأنه تم تغيير قسمك في مبادرة روح إلى:\n'+
   '🏢 '+department+'\n\n'+
   (
    groupUrl
     ? '👥 رابط مجموعة القسم الجديد على واتساب:\n'+groupUrl+'\n\n'
     : ''
   )+
   'نتمنى لك التوفيق والاستمرار في صناعة الأثر معنا 🌱\n\n'+
   'فريق مبادرة روح';

  const url=
   'https://web.whatsapp.com/send?phone='+
   phone+
   '&type=phone_number&app_absent=0&text='+
   encodeURIComponent(message);

  const openMode=prompt(
   'كيف تريد فتح واتساب؟\n\n1 = WhatsApp Web\n2 = تطبيق WhatsApp',
   '1'
  );

  if(openMode===null) return;

  if(openMode.trim()==='2'){
   window.location.href=
    'whatsapp://send?phone='+
    phone+
    '&text='+
    encodeURIComponent(message);
  }else{
   window.open(url,'_blank');
  }

  await volunteers();

 }catch(e){
  alert(e.message);
 }
}

window.changeVolunteerDepartment=changeVolunteerDepartment;

async function toggleVolunteerAccount(id,active){
 const action=active ? 'تفعيل' : 'تعطيل';

 const ok=confirm(
  'هل تريد '+action+' حساب هذا المتطوع؟'
 );

 if(!ok) return;

 try{
  await api('/api/admin/volunteers/'+id+'/account-active',{
   method:'PUT',
   body:JSON.stringify({active})
  });

  flash(
   active
    ? '✅ تم تفعيل حساب المتطوع'
    : '⛔ تم تعطيل حساب المتطوع'
  );

  await volunteers();

 }catch(e){
  alert(e.message);
 }
}

window.toggleVolunteerAccount=toggleVolunteerAccount;

async function deleteVolunteerAccount(id){
 const ok=confirm(
  'هل تريد نقل حساب هذا المتطوع إلى سلة المحذوفات؟\n\n' +
  'لن يتم حذف طلب الانتساب أو بيانات المتطوع.'
 );

 if(!ok) return;

 try{
  const r=await api('/api/admin/volunteers/'+id+'/account',{
   method:'DELETE'
  });

  flash(r.message || 'تم نقل الحساب إلى سلة المحذوفات');
  await volunteers();
 }catch(e){
  alert(e.message);
 }
}

window.deleteVolunteerAccount=deleteVolunteerAccount;





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

   <div class="volunteerTableWrap">
    <table class="volunteerTable">
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

 if(status==='contacted'){
  const ok=confirm(
   'هل تواصلت مع هذا المتطوع وتريد تسجيل أنه تم التواصل معه؟'
  );

  if(!ok) return;

  try{
   await api('/api/admin/volunteers/'+id,{
    method:'PUT',
    body:JSON.stringify({status:'contacted'})
   });

   const data=await api('/api/admin/volunteers');
   const volunteer=data.items.find(v=>Number(v.id)===Number(id));

   if(volunteer && volunteer.phone){
    const phone=normalizeWhatsAppPhone(volunteer.phone);

    const message=
     'مرحبًا ' + (volunteer.name || '') + ' 👋\n\n' +
     'معك فريق إدارة الموارد البشرية في مبادرة روح 💚\n\n' +
     'نتواصل معك بخصوص طلب انضمامك إلى مبادرة روح، ' +
     'ونود التعرف عليك بشكل أفضل وتحديد القسم الأنسب لك ضمن فريق المبادرة.\n\n' +
     'يسعدنا التواصل معك والإجابة عن أي استفسار لديك 🌱\n\n' +
     'فريق مبادرة روح';

    const url=
     'https://web.whatsapp.com/send?phone='+
     phone+
     '&type=phone_number&app_absent=0&text='+
     encodeURIComponent(message);

    const openMode=prompt(
     'كيف تريد فتح واتساب؟\n\n1 = WhatsApp Web\n2 = تطبيق WhatsApp',
     '1'
    );

    if(openMode===null) return;

    if(openMode.trim()==='2'){
     window.location.href=
      'whatsapp://send?phone='+
      phone+
      '&text='+
      encodeURIComponent(message);
    }else{
     window.open(url,'_blank');
    }
   }

   flash('💬 تم تسجيل التواصل وفتح واتساب');
   await volunteers();

  }catch(e){
   alert(e.message);
  }

  return;
 }

 if(status==='route_to_department'){

  const departments={
   '1':'الميداني',
   '2':'إدارة الموارد البشرية (HR)',
   '3':'الأكاديمي',
   '4':'العلاقات العامة',
   '5':'التقني',
   '6':'فكرة',
   '7':'الإعلامي',
   '8':'التيسير',
   '7':'الإعلامي',
   '8':'التيسير'
  };

  const choice=prompt(
   'اختر القسم الذي تريد توجيه المتطوع إليه:\n\n' +
   '1 - الميداني\n' +
   '2 - إدارة الموارد البشرية (HR)\n' +
   '3 - الأكاديمي\n' +
   '4 - العلاقات العامة\n' +
   '5 - التقني\n' +
   '6 - فكرة 💡\n' +
   '7 - الإعلامي 🎬\n' +
   '8 - التيسير 🤝\n\n' +
   'اكتب رقم القسم:'
  );

  if(!choice || !departments[choice]){
   alert('يجب اختيار قسم صحيح');
   return;
  }

  const department=departments[choice];

  const ok=confirm(
   'توجيه المتطوع إلى قسم:\n\n' +
   department +
   '؟\n\n' +
   'بعدها سيكون بانتظار موافقة مسؤول القسم.'
  );

  if(!ok) return;

  try{
   await api('/api/admin/volunteers/'+id,{
    method:'PUT',
    body:JSON.stringify({
     status:'route_to_department',
     department
    })
   });

   flash('🏢 تم توجيه المتطوع إلى '+department);
   volunteers();

  }catch(e){
   alert(e.message);
  }

  return;
 }

 if(status==='department_accepted'){

  const ok=confirm(
   'هل تريد قبول هذا المتطوع رسميًا ضمن فريق القسم؟\n\n' +
   'بعد القبول سيصبح رابط إنشاء الحساب متاحًا.'
  );

  if(!ok) return;

  try{
   await api('/api/admin/volunteers/'+id,{
    method:'PUT',
    body:JSON.stringify({
     status:'department_accepted'
    })
   });

   flash('✅ تم قبول المتطوع ضمن الفريق');
   volunteers();

  }catch(e){
   alert(e.message);
  }

  return;
 }

 if(status==='department_rejected'){

  const ok=confirm(
   'هل تريد رفض انضمام هذا المتطوع إلى فريق القسم؟'
  );

  if(!ok) return;

  try{
   await api('/api/admin/volunteers/'+id,{
    method:'PUT',
    body:JSON.stringify({
     status:'department_rejected'
    })
   });

   flash('❌ تم رفض المتطوع من القسم');
   volunteers();

  }catch(e){
   alert(e.message);
  }

  return;
 }

 if(status==='cancel_department_acceptance'){

  const ok=confirm(
   'هل تريد إلغاء قبول هذا المتطوع من القسم؟\n\n' +
   'سيختفي من صفحة القسم ويرجع إلى HR بحالة عدم موافقة القسم.'
  );

  if(!ok) return;

  try{
   await api('/api/admin/volunteers/'+id,{
    method:'PUT',
    body:JSON.stringify({
     status:'cancel_department_acceptance'
    })
   });

   flash('↩️ تم إلغاء القبول وإرجاع المتطوع إلى HR');
   await volunteers();

  }catch(e){
   alert(e.message);
  }

  return;
 }

 if(status==='rejected'){

  const ok=confirm('هل تريد رفض هذا الطلب؟');

  if(!ok) return;

  try{
   await api('/api/admin/volunteers/'+id,{
    method:'PUT',
    body:JSON.stringify({
     status:'rejected'
    })
   });

   flash('تم رفض الطلب');
   volunteers();

  }catch(e){
   alert(e.message);
  }

  return;
 }
}

async function complaints(){
 const d=await api('/api/admin/complaints');

 const statusLabel={
  new:'جديدة',
  reviewing:'قيد المراجعة',
  handled:'تمت المعالجة',
  closed:'مغلقة'
 };

 content.innerHTML=d.items.length?d.items.map(x=>`
  <div class="panel">

   <div class="topbar">
    <div>
     <h3>شكوى #${x.id}</h3>
     <div class="muted">${esc(x.created_at)}</div>
    </div>

    <span class="badge">
     ${esc(statusLabel[x.status]||x.status)}
    </span>
   </div>

   <div class="formGrid">

    <div class="field">
     <label>الاسم</label>
     <input value="${esc(x.name)}" disabled>
    </div>

    <div class="field">
     <label>رقم الهاتف</label>
     <input value="${esc(x.phone)}" disabled>
    </div>

    <div class="field">
     <label>البريد الإلكتروني</label>
     <input value="${esc(x.email)}" disabled>
    </div>

    <div class="field">
     <label>الحالة</label>
     <select id="complaintStatus${x.id}">
      ${Object.entries(statusLabel).map(([k,v])=>`
       <option value="${k}" ${x.status===k?'selected':''}>${v}</option>
      `).join('')}
     </select>
    </div>

    <div class="field full">
     <label>الشكوى</label>
     <textarea disabled>${esc(x.complaint)}</textarea>
    </div>

    <div class="field full">
     <label>ملاحظات الإدارة</label>
     <textarea id="complaintNotes${x.id}">${esc(x.admin_notes||'')}</textarea>
    </div>

    <button class="btn green full" onclick="saveComplaint(${x.id})">
     حفظ التحديث
    </button>

   </div>
  </div>
 `).join(''):
 '<div class="panel"><p class="muted">لا توجد شكاوى مرسلة حتى الآن.</p></div>';
}

async function saveComplaint(id){
 try{
  const status=document.getElementById('complaintStatus'+id).value;
  const admin_notes=document.getElementById('complaintNotes'+id).value;

  await api('/api/admin/complaints/'+id,{
   method:'PUT',
   body:JSON.stringify({status,admin_notes})
  });

  flash('تم تحديث حالة الشكوى');
  complaints();

 }catch(e){
  flash(e.message,true);
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


async function departmentWork(){
 const isOwner=me.role==='owner';
 const isDeputy=me.system_role==='deputy_owner';
 const isHR=
  me.role==='admin' &&
  me.department==='إدارة الموارد البشرية (HR)';
 const canViewAll=isOwner || isDeputy || isHR;

 const departments=[
  'الميداني',
  'إدارة الموارد البشرية (HR)',
  'الأكاديمي',
  'العلاقات العامة',
  'التقني',
  'فكرة',
  'الإعلامي',
  'التيسير'
 ];

 let department=canViewAll
  ? (selectedDepartment==='all' ? '' : selectedDepartment)
  : me.department;

 const query=department
  ? '?department='+encodeURIComponent(department)
  : '';

 const d=await api('/api/admin/department-content'+query);

 const canEditDepartment=
  isOwner ||
  isDeputy ||
  (!isHR && department===me.department) ||
  (isHR && department===me.department);

 const departmentSelect=canViewAll
  ? `
   <div class="field">
    <label>القسم</label>
    <select id="departmentContentFilter">
     <option value="">كل الأقسام</option>
     ${departments.map(x=>`
      <option value="${esc(x)}"
       ${department===x?'selected':''}>
       ${esc(x)}
      </option>
     `).join('')}
    </select>
   </div>
  `
  : `
   <div class="notice">
    القسم: <strong>${esc(me.department||'غير محدد')}</strong>
   </div>
  `;

 content.innerHTML=`
  <div class="panel">
   <h3>📂 محتوى القسم</h3>

   ${departmentSelect}

   ${
    canEditDepartment
     ? `<div class="rowActions">
         <button class="btn green"
          onclick="departmentContentForm('${esc(department||'')}')">
          + إضافة محتوى
         </button>
        </div>`
     : '<div class="notice">👁️ عرض محتوى القسم فقط</div>'
   }
  </div>

  <div class="panel">
   ${
    d.items.length
     ? d.items.map(x=>`
      <div class="faq">
       <b>${esc(x.title)}</b>

       <p class="muted">
        🏢 ${esc(x.department)}
       </p>

       ${
        x.description
         ? `<p>${esc(x.description)}</p>`
         : ''
       }

       ${
        x.link_url
         ? `<p>
             🔗 <a href="${esc(x.link_url)}"
              target="_blank" rel="noopener">
              فتح المرفق / الرابط
             </a>
            </p>`
         : ''
       }

       <p class="muted">
        رفع بواسطة:
        ${esc(x.created_by_name||'غير محدد')}
       </p>

       ${
        isOwner || (!isHR && x.department===me.department) ||
        (isHR && x.department===me.department)
         ? `<div class="rowActions">
             <button class="btn light small"
              onclick='departmentContentForm(
               ${JSON.stringify(x).replaceAll("'","&#39;")}
              )'>
              تعديل
             </button>

             <button class="btn danger small"
              onclick="deleteDepartmentContent(${x.id})">
              حذف
             </button>
            </div>`
         : ''
       }
      </div>
     `).join('')
     : '<p class="muted">لا يوجد محتوى للقسم بعد.</p>'
   }
  </div>
 `;

 const filter=$('#departmentContentFilter');

 if(filter){
  filter.onchange=async e=>{
   selectedDepartment=e.target.value || 'all';
   await departmentWork();
  };
 }
}

window.departmentContentForm=item=>{
 const editing=
  typeof item==='object' && item && item.id;

 const departments=[
  'الميداني',
  'إدارة الموارد البشرية (HR)',
  'الأكاديمي',
  'العلاقات العامة',
  'التقني',
  'فكرة',
  'الإعلامي',
  'التيسير'
 ];

 const department=editing
  ? item.department
  : (
     typeof item==='string' && item
      ? item
      : (
         me.role==='owner'
          ? (
             selectedDepartment==='all'
              ? ''
              : selectedDepartment
            )
          : me.department
        )
    );

 content.innerHTML=`
  <div class="panel">
   <h3>
    ${editing?'تعديل':'إضافة'} محتوى للقسم
   </h3>

   <form id="departmentContentForm"
    class="formGrid">

    ${
     me.role==='owner'
      ? `
       <div class="field">
        <label>القسم</label>
        <select name="department" required>
         <option value="">اختر القسم</option>
         ${departments.map(x=>`
          <option value="${esc(x)}"
           ${department===x?'selected':''}>
           ${esc(x)}
          </option>
         `).join('')}
        </select>
       </div>
      `
      : `
       <input type="hidden"
        name="department"
        value="${esc(me.department||'')}">
      `
    }

    <div class="field full">
     <label>العنوان</label>
     <input name="title"
      value="${esc(editing?item.title:'')}"
      required>
    </div>

    <div class="field full">
     <label>الوصف</label>
     <textarea name="description">${
      esc(editing?item.description:'')
     }</textarea>
    </div>

    <div class="field full">
     <label>رابط ملف أو عمل</label>
     <input name="link_url"
      placeholder="https://..."
      value="${esc(editing?item.link_url:'')}">
    </div>

    <div class="full rowActions">
     <button class="btn green">
      حفظ
     </button>

     <button class="btn light"
      type="button"
      onclick="departmentWork()">
      إلغاء
     </button>
    </div>

   </form>
  </div>
 `;

 $('#departmentContentForm').onsubmit=async e=>{
  e.preventDefault();

  const o=Object.fromEntries(
   new FormData(e.target).entries()
  );

  try{
   await api(
    '/api/admin/department-content'+
    (editing?'/'+item.id:''),
    {
     method:editing?'PUT':'POST',
     body:JSON.stringify(o)
    }
   );

   flash('تم حفظ محتوى القسم');
   await departmentWork();

  }catch(ex){
   flash(ex.message,true);
  }
 };
};

window.deleteDepartmentContent=async id=>{
 if(!confirm('حذف هذا المحتوى من القسم؟'))
  return;

 try{
  const r=await api(
   '/api/admin/department-content/'+id,
   {method:'DELETE'}
  );

  flash(
   r.pendingApproval
    ? 'تم إرسال طلب الحذف للمالك'
    : 'تم حذف المحتوى'
  );
  await departmentWork();

 }catch(ex){
  flash(ex.message,true);
 }
};

async function loadNotifications(){
 try{
  const d=await api('/api/admin/notifications');
  const count=$('#notificationCount');
  const panel=$('#notificationPanel');

  if(!count || !panel) return;

  const signature=JSON.stringify(d.notifications);
  const seenKey=`rouh_notifications_seen_${me?.id||'user'}`;
  const seenSignature=localStorage.getItem(seenKey);

  const hasUnread=
   d.notifications.length>0 &&
   signature!==seenSignature;

  if(hasUnread){
   count.textContent=d.count;
   count.classList.remove('hidden');
  }else{
   count.classList.add('hidden');
  }

  panel.innerHTML=d.notifications.length
   ? d.notifications.map(n=>`
      <div class="notificationItem" data-tab="${esc(n.type)}">
       ${esc(n.text)}
      </div>
     `).join('')
   : '<div class="notificationEmpty">لا توجد إشعارات جديدة 🎉</div>';

  panel.querySelectorAll('.notificationItem').forEach(item=>{
   item.onclick=()=>{
    localStorage.setItem(seenKey,signature);
    count.classList.add('hidden');
    panel.classList.add('hidden');
    loadTab(item.dataset.tab);
   };
  });

 }catch(e){
  console.error('Notifications:',e);
 }
}

document.addEventListener('click',e=>{
 const btn=$('#notificationBtn');
 const panel=$('#notificationPanel');

 if(!btn || !panel) return;

 if(btn.contains(e.target)){
  panel.classList.toggle('hidden');
  return;
 }

 if(!panel.contains(e.target))
  panel.classList.add('hidden');
});

setInterval(()=>{
 if(me) loadNotifications();
},60000);
