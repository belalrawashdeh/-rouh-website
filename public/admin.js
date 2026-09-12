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
$('#authForm').onsubmit=async e=>{
 e.preventDefault();

 const authView=$('#authView');
 const submitBtn=$('#authForm button[type="submit"]');
 const status=$('#authView .systemStatus');

 try{

  /* إعداد المالك لأول مرة يبقى كما هو */
  if(needsSetup){

   await api('/api/setup',{
    method:'POST',
    body:JSON.stringify({
     name:$('#authName').value,
     email:$('#authEmail').value,
     password:$('#authPassword').value
    })
   });

   needsSetup=false;

   $('#authMsg').innerHTML=
    '<div class="notice">تم إنشاء حساب المالك. سجّل الدخول الآن.</div>';

   showAuth();
   return;
  }

  /* ===== VERIFYING ===== */

  authView.classList.remove(
   'loginDenied',
   'accessGranted',
   'adminLoginExit'
  );

  authView.classList.add('adminVerifying');

  if(submitBtn){
   submitBtn.disabled=true;

   const text=submitBtn.querySelector('.buttonText');
   if(text) text.textContent='جارٍ التحقق من الهوية...';
  }

  if(status){
   status.innerHTML=
    '<span></span> VERIFYING ACCESS';
  }

  await api('/api/login',{
   method:'POST',
   body:JSON.stringify({
    email:$('#authEmail').value,
    password:$('#authPassword').value
   })
  });

  me=(await api('/api/me')).user;

  /* ===== ACCESS GRANTED ===== */

  authView.classList.remove('adminVerifying');
  authView.classList.add('accessGranted');

  if(status){
   status.innerHTML=
    '<span></span> ACCESS GRANTED';
  }

  const heroTitle=
   document.querySelector('#authView .controlHero h2');

  const heroText=
   document.querySelector('#authView .controlHero p');

  if(heroTitle){
   heroTitle.innerHTML=
    'تم منح الوصول<br><span>أهلاً بعودتك.</span>';
  }

  if(heroText){
   heroText.textContent=
    'تم التحقق من هويتك بنجاح. جارٍ تجهيز لوحة الإدارة الخاصة بك.';
  }

  /* شاشة النجاح لمدة قصيرة */
  await new Promise(resolve=>setTimeout(resolve,1250));

  /* خروج شاشة Login */
  authView.classList.add('adminLoginExit');

  await new Promise(resolve=>setTimeout(resolve,420));

  /* Dashboard الطبيعي */
  showAdmin();

  /* تنظيف الحالات للمرة القادمة */
  authView.classList.remove(
   'adminVerifying',
   'accessGranted',
   'adminLoginExit',
   'loginDenied'
  );

 }catch(ex){

  authView.classList.remove(
   'adminVerifying',
   'accessGranted',
   'adminLoginExit'
  );

  /* Shake */
  authView.classList.remove('loginDenied');
  void authView.offsetWidth;
  authView.classList.add('loginDenied');

  if(status){
   status.innerHTML=
    '<span></span> SYSTEM ONLINE';
  }

  if(submitBtn){
   submitBtn.disabled=false;

   const text=submitBtn.querySelector('.buttonText');
   if(text) text.textContent='دخول لوحة التحكم';
  }

  $('#authMsg').innerHTML=
   `<div class="notice error">${esc(ex.message)}</div>`;

  setTimeout(()=>{
   authView.classList.remove('loginDenied');
  },450);
 }
}
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
  'رواق',
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

function showAdmin(){
 $('#authView').classList.add('hidden');

 const welcome=document.getElementById('adminWelcome');
 const welcomeTitle=document.getElementById('adminWelcomeTitle');
 const welcomeText=document.getElementById('adminWelcomeText');

 if(welcome && welcomeTitle && welcomeText){
  const firstName=String(me.name||'').trim().split(/\s+/)[0] || 'صديق روح';

  welcomeTitle.textContent=`أهلًا بعودتك يا ${firstName} 👋`;

  if(me.role==='owner')
   welcomeText.textContent='هذه نظرة شاملة على روح 💚';
  else if(me.system_role==='deputy_owner')
   welcomeText.textContent='نظرة جديدة على روح بانتظارك 💚';
  else if(me.department==='إدارة الموارد البشرية (HR)')
   welcomeText.textContent='إليك آخر مستجدات فريق روح 💚';
  else
   welcomeText.textContent=me.department
    ? `قسم ${me.department} بانتظارك اليوم 💚`
    : 'قسمك بانتظارك اليوم 💚';

  welcome.style.display='block';
 }

$('#adminView').classList.remove('hidden');$('#userBox').innerHTML=`<p><b>${esc(me.name)}</b><br><span class="muted">${me.role==='owner'?'المالك':me.system_role==='deputy_owner'?'الريس':'مسؤول قسم'}</span></p>`;renderDepartmentBar();loadNotifications();document.querySelectorAll('[data-role]').forEach(x=>{const need=x.dataset.role;let allowed=true;if(need==='owner')allowed=me.role==='owner';else if(need==='management')allowed=me.role==='owner'||me.system_role==='deputy_owner';else if(need==='trash')allowed=me.role==='owner'||(me.role==='admin'&&me.system_role!=='deputy_owner'&&me.department==='إدارة الموارد البشرية (HR)');else if(need==='hr')allowed=me.role==='owner'||me.system_role==='deputy_owner'||(me.role==='admin'&&me.department==='إدارة الموارد البشرية (HR)');else allowed=['owner','admin'].includes(me.role);x.classList.toggle('hidden',!allowed)});loadTab('dashboard')}
$('#logoutBtn').onclick=async()=>{await api('/api/logout',{method:'POST'});me=null;showAuth()};
$('#menu').onclick=e=>{if(e.target.dataset.tab)loadTab(e.target.dataset.tab)};
async function loadTab(tab){current=tab;document.querySelectorAll('#menu button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));const titles={dashboard:'لوحة التحكم',events:'الفعاليات',achievements:'الإنجازات',ideas:'الأفكار',complaints:'الشكاوى',volunteers:'طلبات المتطوعين',tasks:'المهام',ai:'مساعد روح','department-work':'محتوى القسم','rejected-volunteers':'سجل المرفوضين',content:'محتوى الموقع',faqs:'الأسئلة الشائعة',trash:'سلة المحذوفات',approvals:'طلبات الموافقة',users:'المسؤولون والصلاحيات',audit:'سجل التعديلات'};$('#pageTitle').textContent=titles[tab];content.innerHTML='<div class="panel">جارٍ التحميل…</div>';try{if(tab==='dashboard')return dashboard();if(tab==='events')return listEntities('events');if(tab==='achievements')return listEntities('achievements');if(tab==='ideas')return ideas();if(tab==='complaints')return complaints();if(tab==='volunteers')return volunteers();if(tab==='tasks')return tasks();if(tab==='ai')return aiAssistant();if(tab==='department-work')return departmentWork();if(tab==='rejected-volunteers')return rejectedVolunteers();if(tab==='content')return editContent();if(tab==='faqs')return faqs();if(tab==='trash')return trash();if(tab==='approvals')return deletionRequests();if(tab==='users')return users();if(tab==='audit')return audit()}catch(e){content.innerHTML=`<div class="notice error">${esc(e.message)}</div>`}}
async function dashboard(){

 const d=await api('/api/admin/dashboard');

 const type=d.dashboardType;
 const counts=d.counts||{};

 const roleInfo={
  owner:{
   code:'OWNER COMMAND',
   title:'مركز قيادة روح',
   subtitle:'نظرة شاملة على المبادرة وإدارة الفريق والمحتوى.',
   badge:'OWNER',
   department:'الإدارة العليا'
  },

  deputy:{
   code:'DEPUTY COMMAND',
   title:'مركز قيادة روح',
   subtitle:'نظرة شاملة على إدارة المبادرة ومتابعة عمليات الفريق.',
   badge:'DEPUTY',
   department:'إدارة المبادرة'
  },

  hr:{
   code:'PEOPLE OPERATIONS',
   title:'إدارة الموارد البشرية',
   subtitle:'متابعة رحلة المتطوعين والحسابات وطلبات الفريق.',
   badge:'HR',
   department:'إدارة الموارد البشرية'
  },

  department:{
   code:'DEPARTMENT OPERATIONS',
   title:d.department||'لوحة القسم',
   subtitle:'متابعة فريق القسم ومهامه ومحتواه من مكان واحد.',
   badge:'DEPARTMENT',
   department:d.department||'القسم'
  }
 };

 const info=
  roleInfo[type]||
  roleInfo.department;


 let stats=[];


 if(type==='owner' || type==='deputy'){

  stats=[
   {
    code:'EVENTS',
    label:'الفعاليات',
    value:counts.events||0,
    icon:'◇',
    tone:'green'
   },
   {
    code:'ACHIEVEMENTS',
    label:'الإنجازات',
    value:counts.achievements||0,
    icon:'★',
    tone:'gold'
   },
   {
    code:'TEAM',
    label:type==='owner'
     ? 'المسؤولون'
     : 'المسؤولون الفعالون',
    value:counts.users||0,
    icon:'◎',
    tone:'blue'
   },
   {
    code:'VOLUNTEERS',
    label:'عدد المنضمين',
    value:counts.organizers||0,
    icon:'◌',
    tone:'green'
   },
   {
    code:'ACTIVE',
    label:'الحسابات الفعّالة',
    value:counts.activeAccounts||0,
    icon:'●',
    tone:'active'
   },
   {
    code:'PUBLISHED',
    label:'المحتوى المنشور',
    value:counts.published||0,
    icon:'▦',
    tone:'purple'
   }
  ];

 }


 if(type==='hr'){

  stats=[
   {
    code:'APPLICATIONS',
    label:'طلبات المتطوعين',
    value:counts.applications||0,
    icon:'◇',
    tone:'gold'
   },
   {
    code:'VOLUNTEERS',
    label:'عدد المنضمين',
    value:counts.organizers||0,
    icon:'◎',
    tone:'green'
   },
   {
    code:'ACTIVE',
    label:'الحسابات الفعّالة',
    value:counts.activeAccounts||0,
    icon:'●',
    tone:'active'
   },
   {
    code:'COMPLAINTS',
    label:'الشكاوى الجديدة',
    value:counts.newComplaints||0,
    icon:'!',
    tone:'red'
   }
  ];

 }


 if(type==='department'){

  stats=[
   {
    code:'TEAM MEMBERS',
    label:'المنضمون للقسم',
    value:counts.organizers||0,
    icon:'◎',
    tone:'green'
   },
   {
    code:'ACTIVE',
    label:'الحسابات الفعّالة',
    value:counts.activeAccounts||0,
    icon:'●',
    tone:'active'
   },
   {
    code:'CONTENT',
    label:'محتوى القسم',
    value:counts.departmentContent||0,
    icon:'▦',
    tone:'gold'
   }
  ];

 }


 const quickActions=[];


 if(type==='owner' || type==='deputy'){

  quickActions.push(
   {
    tab:'volunteers',
    code:'PEOPLE',
    title:'طلبات المتطوعين',
    desc:'متابعة رحلة الانضمام',
    icon:'◎'
   },
   {
    tab:'tasks',
    code:'OPERATIONS',
    title:'إدارة المهام',
    desc:'متابعة أعمال الفريق',
    icon:'✓'
   },
   {
    tab:'events',
    code:'ACTIVITIES',
    title:'الفعاليات',
    desc:'إدارة فعاليات المبادرة',
    icon:'◇'
   },
   {
    tab:'department-work',
    code:'DEPARTMENTS',
    title:'محتوى الأقسام',
    desc:'متابعة أعمال الأقسام',
    icon:'▦'
   }
  );

 }


 if(type==='owner'){

  quickActions.push(
   {
    tab:'approvals',
    code:'GOVERNANCE',
    title:'طلبات الموافقة',
    desc:'مراجعة طلبات الحذف',
    icon:'◈'
   },
   {
    tab:'users',
    code:'ACCESS',
    title:'المسؤولون',
    desc:'إدارة الحسابات والصلاحيات',
    icon:'⌘'
   }
  );

 }


 if(type==='hr'){

  quickActions.push(
   {
    tab:'volunteers',
    code:'APPLICATIONS',
    title:'طلبات المتطوعين',
    desc:'مراجعة وإدارة الطلبات',
    icon:'◎'
   },
   {
    tab:'tasks',
    code:'TASKS',
    title:'المهام',
    desc:'متابعة مهام المتطوعين',
    icon:'✓'
   },
   {
    tab:'complaints',
    code:'FEEDBACK',
    title:'الشكاوى',
    desc:'متابعة الشكاوى الجديدة',
    icon:'!'
   },
   {
    tab:'rejected-volunteers',
    code:'ARCHIVE',
    title:'سجل المرفوضين',
    desc:'مراجعة الطلبات السابقة',
    icon:'↺'
   }
  );

 }


 if(type==='department'){

  quickActions.push(
   {
    tab:'tasks',
    code:'TASKS',
    title:'المهام',
    desc:'إدارة ومتابعة مهام القسم',
    icon:'✓'
   },
   {
    tab:'volunteers',
    code:'TEAM',
    title:'المتطوعون',
    desc:'متابعة أعضاء القسم',
    icon:'◎'
   },
   {
    tab:'department-work',
    code:'WORKSPACE',
    title:'محتوى القسم',
    desc:'إدارة محتوى القسم',
    icon:'▦'
   },
   {
    tab:'ai',
    code:'ASSISTANT',
    title:'مساعد روح',
    desc:'مساعدك في إدارة العمل',
    icon:'✦'
   }
  );

 }


 const auditItems=
  type==='owner' &&
  Array.isArray(d.audit)
   ? d.audit
   : [];


 content.innerHTML=`

  <div class="executiveDashboard">


   <section class="executiveHero">

    <div class="executiveHeroMain">

     <span class="executiveCode">
      ROUH CONTROL CENTER /
      ${esc(info.code)}
     </span>


     <h1>
      ${esc(info.title)}
     </h1>


     <p>
      ${esc(info.subtitle)}
     </p>


     <div class="executiveIdentity">

      <span class="executiveOnline">
       <i></i>
       SYSTEM ONLINE
      </span>

      <span>
       ${esc(info.department)}
      </span>

     </div>

    </div>


    <div class="executiveCommand">

     <div class="executiveCommandRing">

      <div>
       <span>R</span>
      </div>

     </div>

     <strong>
      ${esc(info.badge)}
     </strong>

     <small>
      AUTHORIZED ACCESS
     </small>

    </div>

   </section>


   <section class="executiveStats">

    ${stats.map((stat,index)=>`

     <article
      class="executiveStat ${stat.tone}"
      style="--dash-index:${index}">

      <div class="executiveStatTop">

       <span>
        ${esc(stat.code)}
       </span>

       <i>
        ${stat.icon}
       </i>

      </div>

      <strong>
       ${Number(stat.value)||0}
      </strong>

      <small>
       ${esc(stat.label)}
      </small>

     </article>

    `).join('')}

   </section>


   <div class="
    executiveMainGrid
    ${auditItems.length?'hasAudit':''}
   ">


    <section class="executiveQuickPanel">

     <div class="executiveSectionHead">

      <div>

       <span>
        QUICK ACCESS
       </span>

       <h2>
        مركز العمليات
       </h2>

       <p>
        وصول سريع لأهم أدوات الإدارة.
       </p>

      </div>

      <b>
       ${quickActions.length}
      </b>

     </div>


     <div class="executiveQuickGrid">

      ${quickActions.map((action,index)=>`

       <button
        type="button"
        class="executiveQuickAction"
        style="--quick-index:${index}"
        onclick="loadTab('${action.tab}')">

        <span class="executiveQuickIcon">
         ${action.icon}
        </span>

        <span class="executiveQuickText">

         <small>
          ${action.code}
         </small>

         <strong>
          ${action.title}
         </strong>

         <i>
          ${action.desc}
         </i>

        </span>

        <b>
         ←
        </b>

       </button>

      `).join('')}

     </div>

    </section>


    ${
     auditItems.length
      ? `

       <section class="executiveActivityPanel">

        <div class="executiveSectionHead">

         <div>

          <span>
           LIVE ACTIVITY
          </span>

          <h2>
           آخر التعديلات
          </h2>

          <p>
           أحدث النشاطات المسجلة.
          </p>

         </div>

         <span class="activityPulse">
          <i></i>
          LIVE
         </span>

        </div>


        <div class="executiveTimeline">

         ${auditItems.slice(0,4).map((a,index)=>`

          <div
           class="executiveActivity"
           style="--activity-index:${index}">

           <span class="activityDot"></span>

           <div>

            <strong>
             ${esc(
              a.user_name||
              'النظام'
             )}
            </strong>

            <p>
             ${esc(a.action||'')}
             ${esc(a.entity||'')}
            </p>

            <small>
             ${esc(a.created_at||'')}
            </small>

           </div>

          </div>

         `).join('')}

        </div>


        <button
         class="executiveViewAudit"
         type="button"
         onclick="loadTab('audit')">

         فتح سجل التعديلات الكامل
         <span>←</span>

        </button>

       </section>

      `
      : ''
    }


   </div>


   <section class="executiveFooterBar">

    <div>

     <span class="executiveFooterDot"></span>

     <p>
      ROUH MANAGEMENT SYSTEM
     </p>

    </div>

    <span>
     SECURE CONTROL ENVIRONMENT
    </span>

   </section>


  </div>

 `;

}
const cfg={events:{title:'فعالية',date:'event_date',fields:[['title','اسم الفعالية'],['summary','وصف مختصر'],['description','الوصف الكامل'],['event_date','التاريخ','date'],['event_time','الوقت','time'],['location','المكان'],['registration_url','رابط التسجيل'],['event_state','الحالة الظاهرة']],image:'cover_image'},achievements:{title:'إنجاز',date:'achievement_date',fields:[['title','عنوان الإنجاز'],['summary','وصف مختصر'],['description','الوصف الكامل'],['achievement_date','التاريخ','date'],['volunteers','عدد المتطوعين','number'],['beneficiaries','عدد المستفيدين','number'],['volunteer_hours','الساعات التطوعية','number']],image:'cover_image'}};
async function listEntities(type){

 const d=await api('/api/admin/'+type);
 const items=d.items||[];
 const c=cfg[type];

 const isEvents=type==='events';

 const published=
  items.filter(x=>x.status==='published').length;

 const drafts=
  items.filter(x=>x.status!=='published').length;


 const info=isEvents
  ? {
     code:'ROUH / EVENTS',
     title:'مركز إدارة الفعاليات',
     subtitle:'أنشئ فعاليات المبادرة، تابع مواعيدها وتحكم بالمحتوى المنشور.',
     icon:'◇',
     itemLabel:'فعالية'
    }
  : {
     code:'ROUH / IMPACT',
     title:'مركز الإنجازات',
     subtitle:'وثّق أثر المبادرة واعرض الإنجازات والنتائج التي حققها الفريق.',
     icon:'★',
     itemLabel:'إنجاز'
    };


 content.innerHTML=`

  <div class="entityCenter"
       data-entity-type="${type}">


   <section class="entityHero">

    <div class="entityHeroContent">

     <span class="entityHeroCode">
      ${info.code}
     </span>

     <h2>
      ${info.title}
     </h2>

     <p>
      ${info.subtitle}
     </p>

     <button
      type="button"
      class="entityCreateButton"
      onclick="entityForm('${type}')">

      <span>＋</span>

      إضافة ${info.itemLabel}

     </button>

    </div>


    <div class="entityHeroSymbol">

     <div>
      ${info.icon}
     </div>

     <span>
      ${isEvents?'EVENTS':'IMPACT'}
     </span>

    </div>

   </section>


   <section class="entityStats">

    <article>

     <span>
      TOTAL
     </span>

     <strong>
      ${items.length}
     </strong>

     <small>
      إجمالي ${isEvents?'الفعاليات':'الإنجازات'}
     </small>

    </article>


    <article class="published">

     <span>
      PUBLISHED
     </span>

     <strong>
      ${published}
     </strong>

     <small>
      منشور على الموقع
     </small>

    </article>


    <article class="draft">

     <span>
      DRAFTS
     </span>

     <strong>
      ${drafts}
     </strong>

     <small>
      مسودة
     </small>

    </article>

   </section>


   <section class="entityLibrary">

    <div class="entityLibraryHead">

     <div>

      <span>
       CONTENT LIBRARY
      </span>

      <h3>
       ${isEvents?'سجل الفعاليات':'سجل الإنجازات'}
      </h3>

      <p>
       إدارة المحتوى الحالي وتعديله أو حذفه.
      </p>

     </div>


     <div class="entityLibraryTools">

      <label class="entitySearch">

       <span>⌕</span>

       <input
        id="entitySearchInput"
        type="search"
        placeholder="بحث بالعنوان..."
        autocomplete="off">

      </label>


      <select id="entityStatusFilter">

       <option value="all">
        جميع الحالات
       </option>

       <option value="published">
        المنشور
       </option>

       <option value="draft">
        المسودات
       </option>

      </select>

     </div>

    </div>


    <div class="entityCards">

     ${
      items.length
       ? items.map((x,index)=>{

          const status=
           x.status==='published'
            ? 'published'
            : 'draft';

          const statusText=
           status==='published'
            ? 'منشور'
            : 'مسودة';

          const date=
           x[c.date]||'بدون تاريخ';

          const searchText=[
           x.title||'',
           x.summary||'',
           date,
           statusText
          ].join(' ').toLowerCase();

          return `

           <article
            class="entityCard"
            data-entity-status="${status}"
            data-entity-search="${esc(searchText)}"
            style="--entity-index:${index}">


            <div class="entityCardMedia">

             ${
              x.cover_image
               ? `
                <img
                 src="${esc(x.cover_image)}"
                 alt="${esc(x.title||'')}">
               `
               : `
                <div class="entityMediaPlaceholder">
                 <span>
                  ${info.icon}
                 </span>
                 <small>
                  ROUH
                 </small>
                </div>
               `
             }


             <span class="
              entityStatusBadge
              ${status}
             ">
              <i></i>
              ${statusText}
             </span>

            </div>


            <div class="entityCardBody">

             <span class="entityCardCode">
              ${
               isEvents
                ? 'EVENT'
                : 'ACHIEVEMENT'
              }
              /
              ${String(x.id||index+1).padStart(2,'0')}
             </span>


             <h4>
              ${esc(x.title||'بدون عنوان')}
             </h4>


             ${
              x.summary
               ? `
                <p>
                 ${esc(x.summary)}
                </p>
               `
               : `
                <p class="entityEmptySummary">
                 لا يوجد وصف مختصر.
                </p>
               `
             }


             <div class="entityCardMeta">

              <span>
               <b>◷</b>
               ${esc(date)}
              </span>

              ${
               isEvents && x.location
                ? `
                 <span>
                  <b>⌖</b>
                  ${esc(x.location)}
                 </span>
                `
                : ''
              }

             </div>


             <div class="entityCardActions">

              <button
               type="button"
               class="entityEditButton"
               onclick='entityForm(
                "${type}",
                ${JSON.stringify(x).replaceAll("'","&#39;")}
               )'>

               تعديل

              </button>


              <button
               type="button"
               class="entityDeleteButton"
               onclick="
                removeEntity(
                 '${type}',
                 ${x.id}
                )
               ">

               حذف

              </button>

             </div>

            </div>

           </article>

          `;

         }).join('')
       : `

        <div class="entityEmptyState">

         <div>
          ${info.icon}
         </div>

         <h3>
          لا يوجد ${isEvents?'فعاليات':'إنجازات'} بعد
         </h3>

         <p>
          ابدأ بإضافة أول
          ${info.itemLabel}
          للمبادرة.
         </p>

         <button
          type="button"
          onclick="entityForm('${type}')">

          إضافة ${info.itemLabel}

         </button>

        </div>

       `
     }

    </div>


    ${
     items.length
      ? `
       <div
        id="entityNoResults"
        class="entityNoResults"
        hidden>

        لا توجد نتائج مطابقة للبحث.

       </div>
      `
      : ''
    }

   </section>


  </div>

 `;


 const search=
  document.getElementById(
   'entitySearchInput'
  );

 const filter=
  document.getElementById(
   'entityStatusFilter'
  );


 const applyFilters=()=>{

  const query=
   (search?.value||'')
   .trim()
   .toLowerCase();

  const status=
   filter?.value||'all';

  let visible=0;


  document
   .querySelectorAll('.entityCard')
   .forEach(card=>{

    const matchesSearch=
     !query ||
     (
      card.dataset.entitySearch||''
     ).includes(query);

    const matchesStatus=
     status==='all' ||
     card.dataset.entityStatus===status;

    const show=
     matchesSearch &&
     matchesStatus;

    card.hidden=!show;

    if(show) visible++;

   });


  const noResults=
   document.getElementById(
    'entityNoResults'
   );

  if(noResults){
   noResults.hidden=
    visible!==0;
  }

 };


 search?.addEventListener(
  'input',
  applyFilters
 );

 filter?.addEventListener(
  'change',
  applyFilters
 );

}
window.entityForm=(type,item={})=>{

 const c=cfg[type];

 if(!c) return;

 const isEvents=type==='events';
 const editing=Boolean(item.id);

 const info=isEvents
  ? {
     code:'EVENT EDITOR',
     title:editing
      ? 'تعديل الفعالية'
      : 'إنشاء فعالية جديدة',
     subtitle:editing
      ? 'حدّث تفاصيل الفعالية ومعلومات النشر.'
      : 'أضف تفاصيل الفعالية لتظهر ضمن محتوى المبادرة.',
     symbol:'◇'
    }
  : {
     code:'IMPACT EDITOR',
     title:editing
      ? 'تعديل الإنجاز'
      : 'توثيق إنجاز جديد',
     subtitle:editing
      ? 'حدّث بيانات الإنجاز والأثر المسجل.'
      : 'وثّق إنجاز المبادرة وأرقام الأثر المرتبطة به.',
     symbol:'★'
    };


 const field=(name,label,typeName='text',full=false)=>{

  const value=item[name]??'';

  const textarea=
   name==='summary' ||
   name==='description';

  if(textarea){

   return `
    <div class="
     entityEditorField
     ${full?'full':''}
    ">

     <label for="entity-${name}">
      ${label}
     </label>

     <textarea
      id="entity-${name}"
      name="${name}"
      ${name==='description'
       ? 'rows="7"'
       : 'rows="4"'}
     >${esc(value)}</textarea>

    </div>
   `;

  }

  return `
   <div class="
    entityEditorField
    ${full?'full':''}
   ">

    <label for="entity-${name}">
     ${label}
    </label>

    <input
     id="entity-${name}"
     name="${name}"
     type="${typeName}"
     value="${esc(value)}"
     ${name==='title'
      ? 'required'
      : ''}
    >

   </div>
  `;

 };


 let details='';


 if(isEvents){

  details=`

   ${field(
    'event_date',
    'تاريخ الفعالية',
    'date'
   )}

   ${field(
    'event_time',
    'وقت الفعالية',
    'time'
   )}

   ${field(
    'location',
    'المكان'
   )}

   ${field(
    'event_state',
    'الحالة الظاهرة'
   )}

   ${field(
    'registration_url',
    'رابط التسجيل',
    'url',
    true
   )}

  `;

 }else{

  details=`

   ${field(
    'achievement_date',
    'تاريخ الإنجاز',
    'date'
   )}

   ${field(
    'volunteers',
    'عدد المتطوعين',
    'number'
   )}

   ${field(
    'beneficiaries',
    'عدد المستفيدين',
    'number'
   )}

   ${field(
    'volunteer_hours',
    'الساعات التطوعية',
    'number'
   )}

  `;

 }


 content.innerHTML=`

  <div class="entityEditor">


   <section class="entityEditorHero">

    <button
     type="button"
     class="entityEditorBack"
     onclick="loadTab('${type}')">

     <span>→</span>
     العودة

    </button>


    <div>

     <span class="entityEditorCode">
      ROUH /
      ${info.code}
     </span>

     <h2>
      ${info.title}
     </h2>

     <p>
      ${info.subtitle}
     </p>

    </div>


    <div class="entityEditorSymbol">
     ${info.symbol}
    </div>

   </section>


   <form id="entityForm"
         class="entityEditorLayout">


    <main class="entityEditorMain">


     <section class="entityEditorSection">

      <div class="entityEditorSectionHead">

       <span>01</span>

       <div>

        <small>
         BASIC INFORMATION
        </small>

        <h3>
         المعلومات الأساسية
        </h3>

       </div>

      </div>


      <div class="entityEditorGrid">

       ${field(
        'title',
        isEvents
         ? 'اسم الفعالية'
         : 'عنوان الإنجاز',
        'text',
        true
       )}

       ${field(
        'summary',
        'وصف مختصر',
        'text',
        true
       )}

       ${field(
        'description',
        'الوصف الكامل',
        'text',
        true
       )}

      </div>

     </section>


     <section class="entityEditorSection">

      <div class="entityEditorSectionHead">

       <span>02</span>

       <div>

        <small>
         ${isEvents
          ? 'EVENT DETAILS'
          : 'IMPACT DETAILS'}
        </small>

        <h3>
         ${isEvents
          ? 'تفاصيل الفعالية'
          : 'بيانات الأثر'}
        </h3>

       </div>

      </div>


      <div class="entityEditorGrid">

       ${details}

      </div>

     </section>


    </main>


    <aside class="entityEditorSide">


     <section class="entityEditorSideCard">

      <div class="entityEditorSideHead">

       <span>03</span>

       <div>

        <small>
         COVER
        </small>

        <h3>
         صورة الغلاف
        </h3>

       </div>

      </div>


      <label
       class="
        entityImageUploader
        ${item.cover_image
         ? 'hasImage'
         : ''}
       "
       for="imgFile">

       <div
        id="entityImagePreview"
        class="entityImagePreview">

        ${
         item.cover_image
          ? `
           <img
            src="${esc(item.cover_image)}"
            alt="صورة الغلاف">
          `
          : `
           <span>＋</span>
           <strong>
            اختيار صورة
           </strong>
           <small>
            JPG / PNG / WEBP
           </small>
          `
        }

       </div>

      </label>


      <input
       id="imgFile"
       class="entityImageInput"
       type="file"
       accept="image/jpeg,image/png,image/webp">


      <input
       type="hidden"
       name="cover_image"
       value="${esc(
        item.cover_image||''
       )}">


      <p class="entityImageHint">
       يفضل استخدام صورة واضحة
       وعريضة لظهور أفضل على الموقع.
      </p>

     </section>


     <section class="entityEditorSideCard">

      <div class="entityEditorSideHead">

       <span>04</span>

       <div>

        <small>
         VISIBILITY
        </small>

        <h3>
         حالة النشر
        </h3>

       </div>

      </div>


      <div class="entityPublishOptions">

       <label>

        <input
         type="radio"
         name="status"
         value="published"
         ${item.status==='published'
          ? 'checked'
          : ''}>

        <span>

         <i class="published"></i>

         <b>
          منشور
         </b>

         <small>
          ظاهر على الموقع
         </small>

        </span>

       </label>


       <label>

        <input
         type="radio"
         name="status"
         value="draft"
         ${item.status!=='published'
          ? 'checked'
          : ''}>

        <span>

         <i class="draft"></i>

         <b>
          مسودة
         </b>

         <small>
          محفوظ وغير ظاهر
         </small>

        </span>

       </label>

      </div>

     </section>


     <section class="entityEditorActions">

      <button
       type="submit"
       class="entityEditorSave">

       <span>✓</span>

       ${editing
        ? 'حفظ التعديلات'
        : `إنشاء ${c.title}`}

      </button>


      <button
       type="button"
       class="entityEditorCancel"
       onclick="loadTab('${type}')">

       إلغاء والعودة

      </button>

     </section>


    </aside>


   </form>


  </div>

 `;


 const imageInput=
  document.getElementById(
   'imgFile'
  );

 const preview=
  document.getElementById(
   'entityImagePreview'
  );


 imageInput?.addEventListener(
  'change',
  ()=>{

   const file=imageInput.files?.[0];

   if(!file) return;

   const url=
    URL.createObjectURL(file);

   preview.innerHTML=`
    <img
     src="${url}"
     alt="معاينة الصورة">
   `;

   preview
    .closest('.entityImageUploader')
    ?.classList.add('hasImage');

  }
 );


 $('#entityForm').onsubmit=async e=>{

  e.preventDefault();

  const submit=
   e.target.querySelector(
    '.entityEditorSave'
   );

  const oldHTML=
   submit.innerHTML;

  try{

   submit.disabled=true;

   submit.innerHTML=`
    <span class="entitySaveSpinner"></span>
    جارٍ الحفظ...
   `;


   const fd=
    new FormData(e.target);

   const obj=
    Object.fromEntries(
     fd.entries()
    );


   const file=
    imageInput?.files?.[0];


   if(file){

    obj.cover_image=
     await upload(file);

   }


   await api(
    '/api/admin/'+
    type+
    (item.id
     ? '/'+item.id
     : ''),
    {
     method:item.id
      ? 'PUT'
      : 'POST',

     body:JSON.stringify(obj)
    }
   );


   flash(
    editing
     ? 'تم حفظ التعديلات'
     : `تمت إضافة ${c.title}`
   );


   loadTab(type);


  }catch(ex){

   flash(
    ex.message,
    true
   );

   submit.disabled=false;
   submit.innerHTML=oldHTML;

  }

 };

};
async function upload(file){const dataUrl=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)});return (await api('/api/admin/upload',{method:'POST',body:JSON.stringify({filename:file.name,dataUrl})})).url}
window.removeEntity=async(type,id)=>{if(!confirm(me.role==='owner'?'نقل العنصر إلى سلة المحذوفات؟':'إرسال طلب حذف إلى المالك؟'))return;try{const r=await api('/api/admin/'+type+'/'+id,{method:'DELETE'});flash(r.pendingApproval?'تم إرسال طلب الحذف للمالك':'تم النقل إلى سلة المحذوفات');loadTab(type)}catch(e){flash(e.message,true)}};
async function editContent(){

 const d=await api('/api/admin/content');
 const s=d.settings;
 const st=d.stats;


 content.innerHTML=`

  <form id="contentForm" class="contentStudio">


   <section class="contentStudioHero">

    <div>

     <span class="contentStudioCode">
      ROUH / CONTENT STUDIO
     </span>

     <h2>
      استوديو محتوى روح
     </h2>

     <p>
      تحكم بهوية الموقع، النصوص،
      روابط التواصل وأرقام الأثر
      من مساحة واحدة منظمة.
     </p>


     <div class="contentStudioState">

      <span>
       <i></i>
       CONTENT SYSTEM ACTIVE
      </span>

      <span>
       إعدادات الموقع العامة
      </span>

     </div>

    </div>


    <div class="contentStudioMark">

     <div>R</div>

     <small>
      EDITOR
     </small>

    </div>

   </section>


   <div class="contentStudioLayout">


    <main class="contentStudioMain">


     <section class="contentStudioPanel">

      <header class="contentStudioPanelHead">

       <div class="contentStudioPanelIcon">
        ◇
       </div>

       <div>

        <span>
         BRAND IDENTITY
        </span>

        <h3>
         هوية المبادرة
        </h3>

        <p>
         الاسم والشعار النصي الظاهر
         في الموقع.
        </p>

       </div>

      </header>


      <div class="contentStudioGrid">

       <label class="contentStudioField">

        <span>
         اسم المبادرة
        </span>

        <input
         name="initiative_name"
         value="${esc(s.initiative_name||'')}">

       </label>


       <label class="contentStudioField">

        <span>
         الشعار النصي
        </span>

        <input
         name="tagline"
         value="${esc(s.tagline||'')}">

       </label>

      </div>

     </section>


     <section class="contentStudioPanel">

      <header class="contentStudioPanelHead">

       <div class="contentStudioPanelIcon">
        ≡
       </div>

       <div>

        <span>
         WEBSITE COPY
        </span>

        <h3>
         نصوص الموقع
        </h3>

        <p>
         المحتوى الرئيسي الذي يعرّف
         الزائر بمبادرة روح.
        </p>

       </div>

      </header>


      <div class="contentStudioTextSections">

       ${[
        ['hero_text','نص الواجهة','النص الرئيسي في واجهة الموقع'],
        ['belief','عبارة الإيمان','العبارة التي تعبّر عن إيمان المبادرة'],
        ['about','من نحن','تعريف مختصر بمبادرة روح'],
        ['mission','الرسالة','رسالة المبادرة'],
        ['vision','الرؤية','رؤية المبادرة المستقبلية'],
        ['join_intro','نص الانضمام','المقدمة الظاهرة في قسم الانضمام']
       ].map(([name,title,hint])=>`

        <label class="contentStudioTextField">

         <div>

          <strong>
           ${title}
          </strong>

          <small>
           ${hint}
          </small>

         </div>

         <textarea
          name="${name}"
          rows="4">${esc(s[name]||'')}</textarea>

        </label>

       `).join('')}

      </div>

     </section>


     <section class="contentStudioPanel">

      <header class="contentStudioPanelHead">

       <div class="contentStudioPanelIcon">
        ↗
       </div>

       <div>

        <span>
         CONTACT & LINKS
        </span>

        <h3>
         التواصل والروابط
        </h3>

        <p>
         بيانات التواصل وروابط
         المنصات المستخدمة في الموقع.
        </p>

       </div>

      </header>


      <div class="contentStudioGrid">

       <label class="contentStudioField">

        <span>
         البريد الإلكتروني
        </span>

        <input
         type="email"
         name="email"
         value="${esc(s.email||'')}"
         placeholder="example@email.com">

       </label>


       <label class="contentStudioField">

        <span>
         رابط نموذج الانتساب
        </span>

        <input
         name="join_url"
         value="${esc(s.join_url||'')}"
         placeholder="https://...">

       </label>


       <label class="contentStudioField">

        <span>
         Instagram
        </span>

        <input
         name="instagram"
         value="${esc(s.instagram||'')}"
         placeholder="https://instagram.com/...">

       </label>


       <label class="contentStudioField">

        <span>
         Facebook
        </span>

        <input
         name="facebook"
         value="${esc(s.facebook||'')}"
         placeholder="https://facebook.com/...">

       </label>

      </div>

     </section>


     <section class="contentStudioPanel">

      <header class="contentStudioPanelHead">

       <div class="contentStudioPanelIcon">
        { }
       </div>

       <div>

        <span>
         STRUCTURED CONTENT
        </span>

        <h3>
         البيانات المنظمة
        </h3>

        <p>
         إعدادات JSON المتقدمة
         المستخدمة لبناء أقسام الموقع.
        </p>

       </div>

      </header>


      <div class="contentJsonNotice">

       <span>!</span>

       <div>

        <strong>
         إعدادات متقدمة
        </strong>

        <p>
         حافظ على صيغة JSON صحيحة عند
         تعديل هذه الحقول حتى لا يتأثر
         عرض المحتوى في الموقع.
        </p>

       </div>

      </div>


      <div class="contentStudioJsonGrid">

       <label class="contentStudioJsonField">

        <div>

         <strong>
          القيم
         </strong>

         <span>
          values_json
         </span>

        </div>

        <textarea
         name="values_json"
         rows="7"
         spellcheck="false">${esc(s.values_json||'')}</textarea>

       </label>


       <label class="contentStudioJsonField">

        <div>

         <strong>
          المجالات
         </strong>

         <span>
          fields_json
         </span>

        </div>

        <textarea
         name="fields_json"
         rows="7"
         spellcheck="false">${esc(s.fields_json||'')}</textarea>

       </label>


       <label class="contentStudioJsonField full">

        <div>

         <strong>
          أسباب الانضمام
         </strong>

         <span>
          join_reasons_json
         </span>

        </div>

        <textarea
         name="join_reasons_json"
         rows="7"
         spellcheck="false">${esc(s.join_reasons_json||'')}</textarea>

       </label>

      </div>

     </section>


    </main>


    <aside class="contentStudioSide">


     <section class="contentImpactPanel">

      <header>

       <span>
        IMPACT METRICS
       </span>

       <h3>
        أرقام الأثر
       </h3>

       <p>
        الأرقام الإحصائية المعروضة
        على الموقع.
       </p>

      </header>


      <label class="contentVisibility">

       <div>

        <strong>
         إظهار أرقام الأثر
        </strong>

        <small>
         التحكم بظهورها للزوار
        </small>

       </div>


       <select name="stats_visible">

        <option
         value="1"
         ${s.stats_visible==='1'
          ? 'selected'
          : ''}>
         ظاهر
        </option>

        <option
         value="0"
         ${s.stats_visible!=='1'
          ? 'selected'
          : ''}>
         مخفي
        </option>

       </select>

      </label>


      <div class="contentImpactGrid">

       ${[
        ['volunteers','المتطوعون','VOLUNTEERS','○'],
        ['events','الفعاليات','EVENTS','◇'],
        ['hours','ساعات التطوع','HOURS','◷'],
        ['beneficiaries','المستفيدون','BENEFICIARIES','◎']
       ].map(([key,title,code,icon])=>`

        <label class="contentImpactMetric">

         <div class="contentImpactMetricTop">

          <span>
           ${icon}
          </span>

          <small>
           ${code}
          </small>

         </div>

         <strong>
          ${title}
         </strong>

         <input
          type="number"
          name="stat_${key}"
          value="${esc(st[key]??0)}">

        </label>

       `).join('')}

      </div>

     </section>


     <section class="contentSavePanel">

      <div class="contentSaveState">

       <span>
        <i></i>
       </span>

       <div>

        <strong>
         جاهز للحفظ
        </strong>

        <small>
         ستُحدّث إعدادات الموقع
         وأرقام الأثر معًا.
        </small>

       </div>

      </div>


      <button
       class="contentStudioSave"
       type="submit">

       <span>
        ✓
       </span>

       حفظ تعديلات الموقع

      </button>

     </section>


    </aside>


   </div>


  </form>

 `;


 const form=
  document.getElementById(
   'contentForm'
  );


 form.onsubmit=async e=>{

  e.preventDefault();


  const button=
   form.querySelector(
    '.contentStudioSave'
   );


  const oldHtml=
   button.innerHTML;


  try{

   button.disabled=true;

   button.innerHTML=`
    <span>•••</span>
    جارٍ حفظ التعديلات
   `;


   const o=
    Object.fromEntries(
     new FormData(
      e.target
     ).entries()
    );


   const stats={};


   for(
    const k of [
     'volunteers',
     'events',
     'hours',
     'beneficiaries'
    ]
   ){

    stats[k]=
     o['stat_'+k];

    delete o['stat_'+k];

   }


   await api(
    '/api/admin/settings',
    {
     method:'PUT',
     body:JSON.stringify(o)
    }
   );


   await api(
    '/api/admin/stats',
    {
     method:'PUT',
     body:JSON.stringify(stats)
    }
   );


   flash(
    'تم تحديث محتوى الموقع'
   );


   button.innerHTML=`
    <span>✓</span>
    تم حفظ التعديلات
   `;


   setTimeout(()=>{

    button.innerHTML=
     oldHtml;

   },1400);


  }catch(ex){

   flash(
    ex.message,
    true
   );

   button.innerHTML=
    oldHtml;


  }finally{

   button.disabled=false;

  }

 };

}
async function faqs(){
 const d=await api('/api/admin/faqs');
 const items=d.items||[];
 const visible=items.filter(f=>Number(f.active)===1).length;
 const hidden=items.length-visible;

 content.innerHTML=`
 <section class="faqCenter">

  <div class="faqHero">
   <div>
    <span class="faqHeroCode">ROUH / KNOWLEDGE BASE</span>
    <h2>مركز الأسئلة الشائعة</h2>
    <p>إدارة الأسئلة والإجابات التي تظهر لزوار موقع مبادرة روح.</p>
   </div>

   <button class="faqAddBtn" onclick="faqForm()">
    <span>＋</span>
    إضافة سؤال
   </button>
  </div>

  <div class="faqStats">
   <div class="faqStat">
    <span>TOTAL</span>
    <strong>${items.length}</strong>
    <small>إجمالي الأسئلة</small>
   </div>

   <div class="faqStat">
    <span>VISIBLE</span>
    <strong>${visible}</strong>
    <small>أسئلة ظاهرة</small>
   </div>

   <div class="faqStat">
    <span>HIDDEN</span>
    <strong>${hidden}</strong>
    <small>أسئلة مخفية</small>
   </div>
  </div>

  <div class="faqToolbar">
   <div class="faqSearch">
    <span>⌕</span>
    <input id="faqSearchInput"
           placeholder="ابحث في الأسئلة أو الإجابات..."
           autocomplete="off">
   </div>

   <select id="faqStatusFilter">
    <option value="all">كل الحالات</option>
    <option value="visible">الظاهرة</option>
    <option value="hidden">المخفية</option>
   </select>
  </div>

  <div class="faqList" id="faqList">
   ${items.length ? items.map((f,index)=>{
     const encoded=encodeURIComponent(JSON.stringify(f));
     const active=Number(f.active)===1;

     return `
      <article class="faqManageCard"
       data-search="${esc(((f.question||'')+' '+(f.answer||'')).toLowerCase())}"
       data-active="${active?'visible':'hidden'}">

       <div class="faqCardNumber">
        ${String(index+1).padStart(2,'0')}
       </div>

       <div class="faqCardBody">
        <div class="faqCardTop">
         <div>
          <div class="faqCardMeta">
           <span class="faqStatus ${active?'isVisible':'isHidden'}">
            <i></i>
            ${active?'ظاهر':'مخفي'}
           </span>

           <span class="faqOrder">
            ترتيب ${Number(f.sort_order)||0}
           </span>
          </div>

          <h3>${esc(f.question||'بدون سؤال')}</h3>
        </div>

        <div class="faqCardActions">
         <button class="faqEditBtn"
          onclick="faqForm(JSON.parse(decodeURIComponent('${encoded}')))">
          تعديل
         </button>

         <button class="faqDeleteBtn"
          onclick="deleteFaq(${f.id})">
          حذف
         </button>
        </div>
       </div>

       <p>${esc(f.answer||'')}</p>
      </article>
     `;
   }).join('') : `
    <div class="faqEmpty">
     <strong>لا توجد أسئلة شائعة بعد</strong>
     <p>ابدأ بإضافة أول سؤال إلى قاعدة المعرفة.</p>
     <button class="faqAddBtn" onclick="faqForm()">＋ إضافة سؤال</button>
    </div>
   `}
  </div>

  <div class="faqNoResults" id="faqNoResults" hidden>
   <strong>لا توجد نتائج</strong>
   <p>جرّب كلمة بحث أو حالة مختلفة.</p>
  </div>

 </section>`;

 const search=$('#faqSearchInput');
 const filter=$('#faqStatusFilter');

 const applyFilters=()=>{
  const q=(search?.value||'').trim().toLowerCase();
  const status=filter?.value||'all';
  let shown=0;

  document.querySelectorAll('.faqManageCard').forEach(card=>{
   const matchesText=!q||(card.dataset.search||'').includes(q);
   const matchesStatus=status==='all'||card.dataset.active===status;
   const show=matchesText&&matchesStatus;

   card.hidden=!show;
   if(show) shown++;
  });

  const noResults=$('#faqNoResults');
  if(noResults) noResults.hidden=shown!==0 || !items.length;
 };

 search?.addEventListener('input',applyFilters);
 filter?.addEventListener('change',applyFilters);
}


window.faqForm=(f={})=>{
 const editing=!!f.id;

 content.innerHTML=`
 <section class="faqEditor">

  <div class="faqEditorHero">
   <button class="faqBackBtn" type="button" onclick="loadTab('faqs')">
    ← العودة
   </button>

   <div>
    <span>ROUH / KNOWLEDGE EDITOR</span>
    <h2>${editing?'تعديل السؤال':'إضافة سؤال جديد'}</h2>
    <p>${editing
      ?'حدّث السؤال أو الإجابة وإعدادات ظهوره على الموقع.'
      :'أنشئ سؤالًا جديدًا ليظهر ضمن الأسئلة الشائعة في الموقع.'}</p>
   </div>
  </div>

  <form id="faqForm" class="faqEditorForm">

   <div class="faqEditorMain">

    <div class="faqEditorPanel">
     <div class="faqEditorPanelHead">
      <span>01</span>
      <div>
       <h3>السؤال</h3>
       <p>اكتب السؤال بالطريقة التي سيراها زائر الموقع.</p>
      </div>
     </div>

     <label class="faqEditorField">
      <span>نص السؤال</span>
      <input
       name="question"
       value="${esc(f.question||'')}"
       placeholder="مثال: كيف يمكنني الانضمام إلى مبادرة روح؟"
       required>
     </label>
    </div>

    <div class="faqEditorPanel">
     <div class="faqEditorPanelHead">
      <span>02</span>
      <div>
       <h3>الإجابة</h3>
       <p>اكتب إجابة واضحة ومباشرة قدر الإمكان.</p>
      </div>
     </div>

     <label class="faqEditorField">
      <span>نص الإجابة</span>
      <textarea
       name="answer"
       rows="8"
       placeholder="اكتب الإجابة هنا..."
       required>${esc(f.answer||'')}</textarea>
     </label>
    </div>

   </div>

   <aside class="faqEditorSide">

    <div class="faqSettingsPanel">
     <span class="faqSettingsCode">PUBLISHING</span>
     <h3>إعدادات النشر</h3>
     <p>تحكم بظهور السؤال وترتيبه داخل الموقع.</p>

     <label class="faqEditorField">
      <span>الحالة</span>
      <select name="active">
       <option value="1">ظاهر على الموقع</option>
       <option value="0" ${Number(f.active)===0?'selected':''}>
        مخفي
       </option>
      </select>
     </label>

     <label class="faqEditorField">
      <span>الترتيب</span>
      <input
       name="sort_order"
       type="number"
       value="${Number(f.sort_order)||0}">
      <small>الأرقام الأقل تظهر أولًا.</small>
     </label>

     <div class="faqPublishState">
      <i></i>
      ${editing?'تعديل سؤال موجود':'سؤال جديد'}
     </div>

     <button class="faqSaveBtn" type="submit">
      ${editing?'حفظ التعديلات':'نشر السؤال'}
     </button>

     <button class="faqCancelBtn"
      type="button"
      onclick="loadTab('faqs')">
      إلغاء
     </button>
    </div>

   </aside>

  </form>
 </section>`;

 $('#faqForm').onsubmit=async e=>{
  e.preventDefault();

  const btn=e.target.querySelector('.faqSaveBtn');
  const old=btn.textContent;
  btn.disabled=true;
  btn.textContent='جارٍ الحفظ...';

  const o=Object.fromEntries(new FormData(e.target).entries());
  o.active=o.active==='1';

  try{
   await api('/api/admin/faqs'+(f.id?'/'+f.id:''),{
    method:f.id?'PUT':'POST',
    body:JSON.stringify(o)
   });

   flash(editing?'تم تحديث السؤال':'تمت إضافة السؤال');
   loadTab('faqs');
  }catch(ex){
   flash(ex.message,true);
   btn.disabled=false;
   btn.textContent=old;
  }
 };
}


window.deleteFaq=async id=>{if(confirm(me.role==='owner'?'حذف السؤال؟':'إرسال طلب حذف السؤال إلى المالك؟')){try{const r=await api('/api/admin/faqs/'+id,{method:'DELETE'});flash(r.pendingApproval?'تم إرسال طلب الحذف للمالك':'تم نقل السؤال إلى سلة المحذوفات');loadTab('faqs')}catch(e){flash(e.message,true)}}};
async function trash(){
 const isHR=
  me.role==='admin' &&
  me.department==='إدارة الموارد البشرية (HR)';

 let d={
  events:[],
  achievements:[],
  faqs:[],
  department_content:[],
  volunteer_applications:[]
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

       <button class="btn light small"
        onclick="restoreVolunteerAccount(${v.id})">
        ↩️ استعادة
       </button>

       <button class="btn danger small"
        onclick="permanentlyDeleteVolunteerAccount(${v.id})">
        🗑️ إزالة نهائيًا
       </button>
      </p>
     `).join('')||'<p class="muted">فارغة</p>'}
    </div>`;
  }catch(e){}
 }

 const deletedVolunteerApplications=
  me.role==='owner'
   ? `<div class="panel">
       <h3>المتطوعون المحذوفون</h3>

       ${d.volunteer_applications.map(v=>`
        <p>
         <b>${esc(v.name||'')}</b>
         — ${esc(v.phone||'-')}
         — ${esc(v.department||'-')}

         <button class="btn light small"
          onclick="restoreVolunteerApplication(${v.id})">
          ↩️ استعادة
         </button>

         <button class="btn danger small"
          onclick="permanentlyDeleteVolunteerApplication(${v.id})">
          🗑️ إزالة نهائيًا
         </button>
        </p>
       `).join('')||'<p class="muted">فارغة</p>'}
      </div>`
   : '';

 const generalTrash=
  me.role==='owner'
   ? group('الفعاليات','events',d.events)+
     group('الإنجازات','achievements',d.achievements)+
     group('الأسئلة','faqs',d.faqs)+
     group('محتوى الأقسام','department_content',d.department_content)+
     deletedVolunteerApplications
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
<option value="رواق" ${u.department==='رواق'?'selected':''}>رواق</option>
<option value="الإعلامي" ${u.department==='الإعلامي'?'selected':''}>الإعلامي</option>
<option value="التيسير" ${u.department==='التيسير'?'selected':''}>التيسير</option>
</select>
</div>${u.id?`<div class="field"><label>الحالة</label><select name="active"><option value="1" ${u.active?'selected':''}>فعال</option><option value="0" ${!u.active?'selected':''}>موقوف</option></select></div>`:''}<button class="btn green full">حفظ</button></form></div>`;$('#userForm').onsubmit=async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(e.target).entries());if(u.id)o.active=o.active==='1';try{await api('/api/admin/users'+(u.id?'/'+u.id:''),{method:u.id?'PUT':'POST',body:JSON.stringify(o)});flash('تم الحفظ');loadTab('users')}catch(ex){flash(ex.message,true)}}}

async function deletionRequests(){

 const d=await api(
  '/api/admin/deletion-requests'
 );

 const items=d.items||[];

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

 const entityIcons={
  department_content:'▦',
  events:'◇',
  achievements:'★',
  faq:'?',
  volunteer_application:'○'
 };

 const stats={
  total:items.length,
  pending:items.filter(
   r=>r.status==='pending'
  ).length,
  approved:items.filter(
   r=>r.status==='approved'
  ).length,
  rejected:items.filter(
   r=>r.status==='rejected'
  ).length
 };

 const ordered=[
  ...items.filter(r=>r.status==='pending'),
  ...items.filter(r=>r.status!=='pending')
 ];


 content.innerHTML=`

  <div class="approvalCenter">


   <section class="approvalHero">

    <div class="approvalHeroContent">

     <span class="approvalHeroCode">
      ROUH / GOVERNANCE
     </span>

     <h2>
      مركز طلبات الموافقة
     </h2>

     <p>
      راجع طلبات الحذف قبل تنفيذها،
      واحمِ محتوى المبادرة من الإجراءات
      غير المقصودة.
     </p>


     <div class="approvalHeroSecurity">

      <span>
       <i></i>
       OWNER APPROVAL REQUIRED
      </span>

      <small>
       لا يتم تنفيذ الحذف قبل اتخاذ القرار
      </small>

     </div>

    </div>


    <div class="approvalShield">

     <div>
      <span>✓</span>
     </div>

     <small>
      CONTROL
     </small>

    </div>

   </section>


   <div class="approvalStats">

    <div class="approvalStat">

     <span>ALL REQUESTS</span>

     <strong>
      ${stats.total}
     </strong>

     <small>
      إجمالي الطلبات
     </small>

    </div>


    <div class="approvalStat pending">

     <span>PENDING</span>

     <strong>
      ${stats.pending}
     </strong>

     <small>
      تحتاج قرارك
     </small>

    </div>


    <div class="approvalStat approved">

     <span>APPROVED</span>

     <strong>
      ${stats.approved}
     </strong>

     <small>
      تمت الموافقة
     </small>

    </div>


    <div class="approvalStat rejected">

     <span>REJECTED</span>

     <strong>
      ${stats.rejected}
     </strong>

     <small>
      تم رفضها
     </small>

    </div>

   </div>


   <section class="approvalControlBar">

    <div>

     <span>
      REQUEST QUEUE
     </span>

     <strong>
      طلبات الحذف
     </strong>

     <small id="approvalVisibleCount">
      ${items.length} طلب
     </small>

    </div>


    <div class="approvalFilters">

     <button
      class="approvalFilter active"
      type="button"
      data-approval-filter="all">
      الكل
     </button>

     <button
      class="approvalFilter"
      type="button"
      data-approval-filter="pending">
      معلقة
      <b>${stats.pending}</b>
     </button>

     <button
      class="approvalFilter"
      type="button"
      data-approval-filter="approved">
      مقبولة
     </button>

     <button
      class="approvalFilter"
      type="button"
      data-approval-filter="rejected">
      مرفوضة
     </button>

    </div>

   </section>


   <section class="approvalQueue">

    ${
     ordered.length
      ? ordered.map((r,index)=>{

       const status=
        r.status||'pending';

       const requesterInitial=
        (r.requester_name||'ر')
         .trim()
         .charAt(0)
         .toUpperCase();

       return `

        <article
         class="approvalRequestCard ${status}"
         data-approval-status="${esc(status)}"
         style="--approval-index:${index}"
        >


         <div class="approvalRequestMarker">

          <span>
           ${entityIcons[r.entity_type]||'•'}
          </span>

         </div>


         <div class="approvalRequestMain">


          <div class="approvalRequestTop">

           <div>

            <span class="approvalRequestCode">
             DELETE REQUEST /
             #${r.id}
            </span>

            <h3>
             ${esc(
              r.item_title ||
              ('#'+r.entity_id)
             )}
            </h3>

           </div>


           <span class="approvalStatus ${status}">

            <i></i>

            ${esc(
             statusNames[status] ||
             status
            )}

           </span>

          </div>


          <div class="approvalRequestMeta">


           <div class="approvalRequester">

            <span class="approvalRequesterAvatar">
             ${esc(requesterInitial)}
            </span>

            <div>
             <small>
              مقدم الطلب
             </small>

             <strong>
              ${esc(
               r.requester_name ||
               'غير محدد'
              )}
             </strong>
            </div>

           </div>


           <div class="approvalMetaItem">

            <small>
             القسم
            </small>

            <strong>
             ${esc(
              r.requester_department ||
              'غير محدد'
             )}
            </strong>

           </div>


           <div class="approvalMetaItem">

            <small>
             نوع العنصر
            </small>

            <strong>
             ${esc(
              names[r.entity_type] ||
              r.entity_type
             )}
            </strong>

           </div>


           <div class="approvalMetaItem">

            <small>
             وقت الطلب
            </small>

            <strong>
             ${esc(r.created_at||'—')}
            </strong>

           </div>


          </div>


          ${
           status==='pending'
            ? `

             <div class="approvalWarning">

              <span>!</span>

              <p>
               الموافقة ستسمح بتنفيذ حذف
               <strong>
                ${esc(
                 names[r.entity_type] ||
                 'العنصر'
                )}
               </strong>
               من النظام.
              </p>

             </div>

            `
            : `

             <div class="approvalDecisionInfo">

              <span>
               ${
                status==='approved'
                 ? '✓'
                 : '×'
               }
              </span>

              <div>

               <small>
                DECISION RECORDED
               </small>

               <strong>
                ${esc(
                 r.decided_by_name ||
                 'تم اتخاذ القرار'
                )}
               </strong>

              </div>

             </div>

            `
          }


         </div>


         <div class="approvalRequestActions">

          ${
           status==='pending'
            ? `

             <button
              class="approvalDecisionButton reject"
              type="button"
              onclick="
               decideDeletionRequest(
                ${r.id},
                'reject'
               )
              "
             >
              <span>رفض الطلب</span>
              <i>×</i>
             </button>


             <button
              class="approvalDecisionButton approve"
              type="button"
              onclick="
               decideDeletionRequest(
                ${r.id},
                'approve'
               )
              "
             >
              <span>الموافقة على الحذف</span>
              <i>✓</i>
             </button>

            `
            : `

             <div class="approvalRequestClosed">
              CLOSED
             </div>

            `
          }

         </div>


        </article>

       `;

      }).join('')

      : `

       <div class="approvalEmpty">

        <div>✓</div>

        <span>
         ALL CLEAR
        </span>

        <strong>
         لا توجد طلبات حذف
        </strong>

        <p>
         لا توجد طلبات موافقة مسجلة
         في النظام حاليًا.
        </p>

       </div>

      `
    }

   </section>


   <div
    id="approvalFilterEmpty"
    class="approvalFilterEmpty"
    hidden>

    لا توجد طلبات ضمن هذه الحالة.

   </div>


  </div>

 `;


 initApprovalCenterV2();

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



async function tasks(){
 const [vr,tr]=await Promise.all([
  api('/api/admin/tasks/volunteers'),
  api('/api/admin/tasks')
 ]);

 const volunteers=vr.items||[];
 const items=tr.items||[];

 window.currentAdminTasks=items;

 const statusLabel=status=>{
  if(status==='new')return '🆕 جديدة';
  if(status==='in_progress')return '⏳ قيد التنفيذ';
  if(status==='submitted')return '📥 تم التسليم';
  if(status==='revision_requested')return '↩️ مطلوب تعديل';
  if(status==='completed')return '✅ مكتملة';
  if(status==='not_completed')return '❌ لم يتم إنهاؤها';
  return status||'—';
 };

 const departments=[
  ...new Set(
   volunteers
    .map(v=>String(v.department||'').trim())
    .filter(Boolean)
  )
 ].sort((a,b)=>a.localeCompare(b,'ar'));

 const currentItems=items.filter(
  t=>!['completed','not_completed'].includes(t.status)
 );

 const archiveItems=items.filter(
  t=>['completed','not_completed'].includes(t.status)
 );

 const taskStats={
  total:items.length,
  new:items.filter(t=>t.status==='new').length,
  progress:items.filter(t=>
   t.status==='in_progress' ||
   t.status==='revision_requested'
  ).length,
  submitted:items.filter(t=>t.status==='submitted').length,
  completed:items.filter(t=>t.status==='completed').length
 };

 const taskStateClass=status=>{
  if(status==='new')return 'new';
  if(status==='in_progress')return 'progress';
  if(status==='submitted')return 'submitted';
  if(status==='revision_requested')return 'revision';
  if(status==='completed')return 'completed';
  if(status==='not_completed')return 'failed';
  return 'default';
 };

 const taskRow=(t,isArchive=false)=>`
  <tr
   class="taskV2Row"
   data-task-status="${esc(t.status||'')}"
  >

   <td>
    <div class="taskVolunteerIdentity">

     <span class="taskVolunteerAvatar">
      ${esc(
       (t.volunteer_name||'ر')
        .trim()
        .charAt(0)
        .toUpperCase()
      )}
     </span>

     <strong>
      ${esc(t.volunteer_name||'—')}
     </strong>

    </div>
   </td>

   <td>
    <span class="taskDepartmentBadge">
     ${esc(t.department||'—')}
    </span>
   </td>

   <td class="taskTitleCell">
    <b>${esc(t.title||'')}</b>

    ${t.description
     ? `<div class="muted" style="margin-top:5px">
         ${esc(t.description)}
        </div>`
     : ''}
   </td>

   <td>
    <span class="taskDueDate">
     <small>موعد التسليم</small>
     <b>${t.due_date?esc(t.due_date):'غير محدد'}</b>
    </span>
   </td>

   <td>

    <div class="taskStatusBadge ${taskStateClass(t.status)}">
     <i></i>
     ${statusLabel(t.status)}
    </div>

    ${t.status==='submitted'
     ? `
       <button class="btn"
        onclick="openTaskSubmissionReview(${t.id})">
        👁️ مراجعة التسليم
       </button>
      `
     : ''}

    ${t.status==='revision_requested' && t.revision_note
     ? `
       <div class="muted"
        style="margin-top:7px">
        <b>ملاحظة التعديل:</b>
        ${esc(t.revision_note)}
       </div>
      `
     : ''}

    ${t.status==='completed'
     ? `
       <button class="btn light"
        onclick="openTaskSubmissionReview(${t.id},true)">
        👁️ عرض العمل
       </button>
      `
     : ''}

    ${t.status==='not_completed'
     ? `
       <div class="muted">
        تم أرشفة المهمة كغير مكتملة.
       </div>
      `
     : ''}
   </td>

   <td>
    <span class="taskAssignedBy">
     ${esc(t.created_by_name||'—')}
    </span>
   </td>

  </tr>
 `;

 const currentRows=currentItems.length
  ? currentItems.map(t=>taskRow(t,false)).join('')
  : `
    <tr>
     <td colspan="6" class="muted">
      لا توجد مهام حالية.
     </td>
    </tr>
   `;

 const archiveRows=archiveItems.length
  ? archiveItems.map(t=>taskRow(t,true)).join('')
  : `
    <tr>
     <td colspan="6" class="muted">
      لا توجد مهام في الأرشيف حتى الآن.
     </td>
    </tr>
   `;


 content.innerHTML=`

  <div class="tasksV2">


   <div class="tasksHero">

    <div class="tasksHeroContent">

     <span class="tasksHeroCode">
      TEAM OPERATIONS / TASKS
     </span>

     <h2>مركز إدارة المهام</h2>

     <p>
      تابع عمل الفريق من لحظة إسناد المهمة
      وحتى مراجعة التسليم واعتماد الإنجاز.
     </p>

    </div>


    <div class="taskWorkflow">

     <div class="taskWorkflowStep">
      <i>01</i>
      <span>NEW</span>
     </div>

     <b>←</b>

     <div class="taskWorkflowStep">
      <i>02</i>
      <span>IN PROGRESS</span>
     </div>

     <b>←</b>

     <div class="taskWorkflowStep important">
      <i>03</i>
      <span>SUBMITTED</span>
     </div>

     <b>←</b>

     <div class="taskWorkflowStep completed">
      <i>04</i>
      <span>COMPLETED</span>
     </div>

    </div>

   </div>


   <div class="taskStatsGrid">

    <div class="taskStatCard">
     <span>ALL TASKS</span>
     <strong>${taskStats.total}</strong>
     <small>إجمالي المهام</small>
    </div>

    <div class="taskStatCard new">
     <span>NEW</span>
     <strong>${taskStats.new}</strong>
     <small>مهام جديدة</small>
    </div>

    <div class="taskStatCard progress">
     <span>IN PROGRESS</span>
     <strong>${taskStats.progress}</strong>
     <small>قيد التنفيذ</small>
    </div>

    <div class="taskStatCard submitted">
     <span>REVIEW</span>
     <strong>${taskStats.submitted}</strong>
     <small>بانتظار المراجعة</small>
    </div>

    <div class="taskStatCard completed">
     <span>DONE</span>
     <strong>${taskStats.completed}</strong>
     <small>مكتملة</small>
    </div>

   </div>


   <div class="taskCreatePanel">

    <button
     id="taskCreateToggle"
     class="taskCreateHeader"
     type="button"
    >

     <div class="taskCreateHeaderIcon">
      +
     </div>

     <div>
      <span>CREATE NEW TASK</span>
      <strong>إسناد مهمة جديدة</strong>
      <small>
       اختر القسم والمتطوع ثم حدد تفاصيل المهمة
      </small>
     </div>

     <i id="taskCreateChevron">
     ⌄
     </i>

    </button>


    <div id="taskCreateBody"
         class="taskCreateBody">

     ${
      volunteers.length
       ? `

       <form id="taskForm">

        <div class="taskFormGrid">


         <label class="taskV2Field">

          <span>
           01 / القسم
          </span>

          <select
           id="taskDepartment"
           required
          >

           <option value="">
            اختر القسم
           </option>

           ${departments.map(d=>
            `<option value="${esc(d)}">
              ${esc(d)}
             </option>`
           ).join('')}

          </select>

         </label>


         <label class="taskV2Field">

          <span>
           02 / المتطوع
          </span>

          <select
           id="taskVolunteer"
           required
           disabled
          >

           <option value="">
            اختر القسم أولًا
           </option>

          </select>

         </label>


         <label class="taskV2Field">

          <span>
           03 / عنوان المهمة
          </span>

          <input
           id="taskTitle"
           maxlength="200"
           required
           placeholder="مثال: تجهيز تقرير الفعالية"
          >

         </label>


         <label class="taskV2Field">

          <span>
           04 / موعد التسليم
          </span>

          <input
           id="taskDueDate"
           type="date"
          >

         </label>


         <label class="taskV2Field full">

          <span>
           05 / تفاصيل المهمة
          </span>

          <textarea
           id="taskDescription"
           rows="4"
           placeholder="اكتب تفاصيل المهمة المطلوبة..."
          ></textarea>

         </label>


        </div>


        <div class="taskFormFooter">

         <div>
          <span class="taskFormSecureDot"></span>
          سيتم إرسال المهمة مباشرة إلى حساب المتطوع
         </div>

         <button
          class="btn green taskAssignButton"
          type="submit"
         >
          <span>إسناد المهمة</span>
          <i>←</i>
         </button>

        </div>

       </form>

       `
       : `

        <div class="taskEmptyNotice">
         لا يوجد متطوعون متاحون لإسناد مهمة حاليًا.
        </div>

       `
     }

    </div>

   </div>


   <div class="taskListPanel">

    <div class="taskListHeader">

     <div>
      <span>ACTIVE WORK</span>
      <h3>المهام الحالية</h3>
      <p>
       المهام التي يعمل عليها الفريق أو تنتظر المراجعة.
      </p>
     </div>

     <div class="taskListCounter">
      ${currentItems.length}
      <small>مهمة</small>
     </div>

    </div>


    <div class="taskTableWrap">

     <table class="taskV2Table">

      <thead>
       <tr>
        <th>المتطوع</th>
        <th>القسم</th>
        <th>المهمة</th>
        <th>التسليم</th>
        <th>الحالة</th>
        <th>أُسندت بواسطة</th>
       </tr>
      </thead>

      <tbody>
       ${currentRows}
      </tbody>

     </table>

    </div>

   </div>


   <div class="taskArchivePanel">

    <button
     id="taskArchiveToggle"
     class="taskArchiveHeader"
     type="button"
    >

     <div>

      <span>
       TASK ARCHIVE
      </span>

      <h3>
       أرشيف المهام
      </h3>

      <p>
       الأعمال المقبولة والمهام المنتهية محفوظة هنا.
      </p>

     </div>


     <div class="taskArchiveRight">

      <strong>
       ${archiveItems.length}
      </strong>

      <small>
       مهمة مؤرشفة
      </small>

      <i id="taskArchiveChevron">
       ⌄
      </i>

     </div>

    </button>


    <div
     id="taskArchiveBody"
     class="taskArchiveBody"
    >

     <div class="taskTableWrap">

      <table class="taskV2Table">

       <thead>
        <tr>
         <th>المتطوع</th>
         <th>القسم</th>
         <th>المهمة</th>
         <th>التسليم</th>
         <th>الحالة</th>
         <th>أُسندت بواسطة</th>
        </tr>
       </thead>

       <tbody>
        ${archiveRows}
       </tbody>

      </table>

     </div>

    </div>

   </div>


  </div>

 `;

 initTasksV2();

 const departmentSelect=document.getElementById('taskDepartment');
 const volunteerSelect=document.getElementById('taskVolunteer');

 if(departmentSelect && volunteerSelect){
  departmentSelect.onchange=()=>{
   const department=departmentSelect.value;

   const filtered=volunteers.filter(v=>
    String(v.department||'').trim()===department
   );

   volunteerSelect.innerHTML=department
    ? `<option value="">اختر المتطوع</option>`+
      filtered.map(v=>
       `<option value="${v.id}">${esc(v.name)}</option>`
      ).join('')
    : '<option value="">اختر القسم أولًا</option>';

   volunteerSelect.disabled=!department;
  };

  if(departments.length===1){
   departmentSelect.value=departments[0];
   departmentSelect.dispatchEvent(new Event('change'));
  }
 }

 const form=document.getElementById('taskForm');

 if(form){
  form.onsubmit=async e=>{
   e.preventDefault();

   const volunteer_id=Number(
    document.getElementById('taskVolunteer').value
   );

   const title=
    document.getElementById('taskTitle').value.trim();

   const description=
    document.getElementById('taskDescription').value.trim();

   const due_date=
    document.getElementById('taskDueDate').value;

   if(!volunteer_id || !title){
    alert('اختر المتطوع واكتب عنوان المهمة');
    return;
   }

   try{
    await api('/api/admin/tasks',{
     method:'POST',
     headers:{'Content-Type':'application/json'},
     body:JSON.stringify({
      volunteer_id,
      title,
      description,
      due_date
     })
    });

    alert('✅ تم إسناد المهمة بنجاح');
    await tasks();

   }catch(err){
    alert(err.message||'تعذر إسناد المهمة');
   }
  };
 }
}

async function volunteerHours(){
 const d=await api('/api/admin/volunteer-hours');
 const items=d.items||[];

 const canReview=
  me.role==='owner' ||
  me.system_role==='deputy_owner' ||
  me.role==='admin';

 const status={
  pending:'⏳ بانتظار المراجعة',
  approved:'✅ معتمدة',
  rejected:'❌ مرفوضة'
 };

 content.innerHTML=`
  <div class="panel">
   <h3>⏱️ الساعات التطوعية</h3>

   <p class="muted">
    مراجعة الساعات التي سجلها المتطوعون واعتمادها أو رفضها.
   </p>

   ${
    !items.length
     ? '<div class="notice">لا توجد سجلات ساعات حاليًا.</div>'
     : `
      <div class="volunteerTableWrap">
       <table class="volunteerTable">
        <thead>
         <tr>
          <th>المتطوع</th>
          <th>القسم</th>
          <th>النشاط</th>
          <th>الساعات</th>
          <th>الوصف</th>
          <th>الحالة</th>
          <th>الإجراء</th>
         </tr>
        </thead>

        <tbody>
         ${items.map(h=>`
          <tr>
           <td>${esc(h.volunteer_name||'-')}</td>
           <td>${esc(h.department||'-')}</td>
           <td>${esc(h.activity||'-')}</td>
           <td><b>${Number(h.hours||0)}</b> ساعة</td>
           <td>${esc(h.description||'-')}</td>
           <td>${status[h.status]||h.status}</td>
           <td>
            ${
             canReview && h.status==='pending'
              ? `
               <div class="rowActions">
                <button class="btn green"
                 onclick="reviewVolunteerHours(${h.id},'approved')">
                 ✅ اعتماد
                </button>

                <button class="btn danger"
                 onclick="reviewVolunteerHours(${h.id},'rejected')">
                 ❌ رفض
                </button>
               </div>
              `
              : '<span class="muted">تمت المراجعة</span>'
            }
           </td>
          </tr>
         `).join('')}
        </tbody>
       </table>
      </div>
     `
   }
  </div>
 `;
}

async function reviewVolunteerHours(id,action){
 const message=
  action==='approved'
   ? 'هل تريد اعتماد هذه الساعات؟'
   : 'هل تريد رفض هذه الساعات؟';

 if(!confirm(message)) return;

 try{
  await api('/api/admin/volunteer-hours/'+id,{
   method:'PUT',
   body:JSON.stringify({action})
  });

  flash(
   action==='approved'
    ? 'تم اعتماد الساعات'
    : 'تم رفض الساعات'
  );

  await volunteerHours();

 }catch(e){
  flash(e.message||'تعذر مراجعة الساعات',true);
 }
}

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

 const volunteerStats={
  total:items.length,
  review:items.filter(v=>
   v.status==='pending' &&
   !v.contacted_at &&
   !v.department_approval
  ).length,
  department:items.filter(v=>
   v.department_approval==='pending'
  ).length,
  accepted:items.filter(v=>
   v.status==='accepted' &&
   v.department_approval==='accepted'
  ).length
 };

 content.innerHTML=`
  <div class="volunteersV2">

   <div class="volunteerSectionHero">

    <div class="volunteerHeroText">
     <span class="volunteerHeroCode">
      VOLUNTEER MANAGEMENT
     </span>

     <h2>إدارة رحلة المتطوع</h2>

     <p>
      تابع الطلب من لحظة وصوله، مرورًا بالتواصل
      وموافقة القسم، وحتى انضمام المتطوع للفريق.
     </p>
    </div>

    <div class="volunteerHeroFlow">
     <span>طلب جديد</span>
     <i>←</i>
     <span>HR</span>
     <i>←</i>
     <span>القسم</span>
     <i>←</i>
     <span>فريق روح</span>
    </div>

   </div>


   <div class="volunteerStatsGrid">

    <div class="volunteerStatCard">
     <span class="statMiniIcon">◎</span>
     <div>
      <small>إجمالي الطلبات</small>
      <strong>${volunteerStats.total}</strong>
     </div>
    </div>

    <div class="volunteerStatCard review">
     <span class="statMiniIcon">◷</span>
     <div>
      <small>بانتظار المراجعة</small>
      <strong>${volunteerStats.review}</strong>
     </div>
    </div>

    <div class="volunteerStatCard department">
     <span class="statMiniIcon">◇</span>
     <div>
      <small>بانتظار القسم</small>
      <strong>${volunteerStats.department}</strong>
     </div>
    </div>

    <div class="volunteerStatCard accepted">
     <span class="statMiniIcon">✓</span>
     <div>
      <small>مقبولون</small>
      <strong>${volunteerStats.accepted}</strong>
     </div>
    </div>

   </div>


   <div class="panel volunteerManagementPanel">

    <div class="volunteerToolbar">

     <div class="volunteerSearchBox">
      <span>⌕</span>

      <input
       id="volunteerSearch"
       type="search"
       placeholder="ابحث بالاسم، الهاتف، البريد أو التخصص..."
       autocomplete="off"
      >
     </div>

     <select id="volunteerStatusFilter"
             class="volunteerFilterSelect">

      <option value="all">
       جميع الحالات
      </option>

      <option value="review">
       قيد المراجعة
      </option>

      <option value="contacted">
       تم التواصل
      </option>

      <option value="department">
       بانتظار القسم
      </option>

      <option value="accepted">
       مقبول
      </option>

     </select>

     <div class="volunteerResultCount">
      <strong id="volunteerVisibleCount">
       ${items.length}
      </strong>
      <span>طلب</span>
     </div>

    </div>

    <div class="volunteerTableWrap">
    <table class="volunteerTable">
     <thead>
      <tr>
       <th>المتطوع</th>
       <th>معلومات التواصل</th>
       <th>الدراسة</th>
       <th>الحالة</th>
       <th>القسم</th>
       <th class="volunteerActionsHeading">الإجراءات</th>
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
         <button class="btn light"
          onclick="viewVolunteerProfile(${v.volunteer_id})">
          👁️ عرض الملف
         </button>

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

       let rowState='review';

       if(v.department_approval==='pending')
        rowState='department';

       else if(
        v.status==='accepted' &&
        v.department_approval==='accepted'
       )
        rowState='accepted';

       else if(
        v.contacted_at ||
        v.status==='contacted'
       )
        rowState='contacted';

       const searchText=[
        v.name,
        v.email,
        v.phone,
        v.major,
        v.level,
        v.city,
        v.department,
        stateText
       ].filter(Boolean).join(' ').toLowerCase();

       return `
        <tr
         data-volunteer-state="${rowState}"
         data-volunteer-search="${esc(searchText)}"
        >
         <td class="volunteerNameCell">

          <button
           type="button"
           class="volunteerNameButton"
           title="عرض تفاصيل الطلب"
           onclick="openVolunteerDrawer(
            '${encodeURIComponent(JSON.stringify(v))}'
           )">

           <span class="volunteerMiniAvatar">
            ${esc(
             (v.name||'ر')
              .trim()
              .charAt(0)
              .toUpperCase()
            )}
           </span>

           <span class="volunteerIdentityText">

            <strong>
             ${esc(v.name||'')}
            </strong>

            <small>
             عرض تفاصيل الطلب
            </small>

           </span>

          </button>

          ${
           v.status==='accepted' &&
           v.department_approval==='accepted' &&
           !v.volunteer_id &&
           !v.is_admin_user
            ? `
             <span class="accountWarning">
              ⚠ لم ينشئ حسابًا
             </span>
            `
            : ''
          }

         </td>


         <td>

          <div class="volunteerContactCell">

           <strong>
            ${esc(v.phone||'—')}
           </strong>

           <span title="${esc(v.email||'')}">
            ${esc(v.email||'لا يوجد بريد')}
           </span>

           ${
            v.city
             ? `<small>${esc(v.city)}</small>`
             : ''
           }

          </div>

         </td>


         <td>

          <div class="volunteerStudyCell">

           <strong>
            ${esc(v.major||'غير محدد')}
           </strong>

           <span>
            ${
             v.level
              ? `المستوى ${esc(v.level)}`
              : 'المستوى غير محدد'
            }
           </span>

          </div>

         </td>


         <td>

          <span
           class="volunteerStatusBadge ${rowState}">
           <i></i>
           ${esc(stateText)}
          </span>

         </td>


         <td>

          ${
           v.department
            ? `
             <span class="volunteerDepartmentBadge">
              ${esc(v.department)}
             </span>
            `
            : `
             <span class="volunteerDepartmentEmpty">
              لم يحدد بعد
             </span>
            `
          }

         </td>


         <td class="volunteerActionsCell">

          <div class="volunteerActionMenuWrap">

           <button
            type="button"
            class="volunteerActionTrigger"
            aria-label="إجراءات المتطوع"
            onclick="toggleVolunteerActionMenu(
             event,
             this
            )">
            <span>•••</span>
           </button>


           <div class="volunteerActionMenu">

            <div class="volunteerActionMenuHead">

             <span>
              ACTIONS
             </span>

             <strong>
              ${esc(v.name||'المتطوع')}
             </strong>

            </div>


            <div class="volunteerActionMenuBody">

             ${actions || `
              <span class="volunteerNoActions">
               لا توجد إجراءات متاحة
              </span>
             `}

            </div>

           </div>

          </div>

         </td>
        </tr>
       `;
      }).join('')}
     </tbody>
    </table>
   </div>
  </div>
 </div>
 `;

 initVolunteerTableV2();
}





function closeAdminTaskReview(){

 const modal=document.getElementById(
  'adminTaskReviewModal'
 );

 if(!modal)return;

 modal.classList.add('closing');
 modal.classList.remove('open');

 setTimeout(()=>{
  modal.remove();
 },260);

}

function formatTaskFileSize(size){
 const n=Number(size||0);

 if(!n)return '';

 if(n<1024)
  return `${n} B`;

 if(n<1024*1024)
  return `${(n/1024).toFixed(1)} KB`;

 return `${(n/(1024*1024)).toFixed(1)} MB`;
}

function openTaskSubmissionReview(id,readOnly=false){

 closeAdminTaskReview();

 const task=(window.currentAdminTasks||[])
  .find(t=>Number(t.id)===Number(id));

 if(!task){
  alert('تعذر العثور على المهمة');
  return;
 }

 const canReview=
  task.status==='submitted' &&
  !readOnly;

 const isCompleted=
  task.status==='completed';

 const hasSubmission=
  task.submission_note ||
  task.submission_url ||
  task.submission_file_name;

 const statusName=
  isCompleted
   ? 'COMPLETED'
   : canReview
     ? 'AWAITING REVIEW'
     : String(task.status||'TASK')
        .replaceAll('_',' ')
        .toUpperCase();

 const modal=document.createElement('div');

 modal.id='adminTaskReviewModal';
 modal.className='taskReviewOverlay';

 modal.innerHTML=`

  <div class="taskReviewWindow">

   <div class="taskReviewHeader">

    <div class="taskReviewHeading">

     <div class="taskReviewIcon">
      ${isCompleted ? '✓' : '↗'}
     </div>

     <div>

      <span class="taskReviewCode">
       ROUH / TASK REVIEW
      </span>

      <h2>
       ${
        isCompleted
         ? 'العمل المعتمد'
         : 'مراجعة تسليم المهمة'
       }
      </h2>

      <p>
       ${esc(task.volunteer_name||'')}
       ${task.department
        ? ` · ${esc(task.department)}`
        : ''}
      </p>

     </div>

    </div>

    <div class="taskReviewHeaderActions">

     <span class="taskReviewStatus ${
      isCompleted
       ? 'completed'
       : 'review'
     }">
      <i></i>
      ${statusName}
     </span>

     <button
      class="taskReviewClose"
      type="button"
      onclick="closeAdminTaskReview()"
      aria-label="إغلاق">
      ×
     </button>

    </div>

   </div>


   <div class="taskReviewProgress">

    <div class="reviewProgressStep done">
     <i>✓</i>
     <span>إسناد المهمة</span>
    </div>

    <b></b>

    <div class="reviewProgressStep done">
     <i>✓</i>
     <span>تنفيذ المتطوع</span>
    </div>

    <b></b>

    <div class="reviewProgressStep done">
     <i>✓</i>
     <span>تم التسليم</span>
    </div>

    <b></b>

    <div class="reviewProgressStep ${
     isCompleted ? 'done' : 'current'
    }">
     <i>${isCompleted ? '✓' : '4'}</i>
     <span>
      ${isCompleted ? 'تم الاعتماد' : 'المراجعة'}
     </span>
    </div>

   </div>


   <div class="taskReviewBody">


    <section class="taskReviewSection taskBriefSection">

     <div class="reviewSectionHead">
      <div>
       <span>01 / TASK BRIEF</span>
       <h3>تفاصيل المهمة</h3>
      </div>

      ${
       task.due_date
        ? `
         <div class="reviewDueDate">
          <small>موعد التسليم</small>
          <strong>
           ${esc(task.due_date)}
          </strong>
         </div>
        `
        : ''
      }
     </div>


     <div class="reviewTaskTitle">
      ${esc(task.title||'')}
     </div>


     ${
      task.description
       ? `
        <div class="reviewTaskDescription">
         ${esc(task.description)}
        </div>
       `
       : `
        <div class="reviewTaskDescription empty">
         لا توجد تفاصيل إضافية للمهمة.
        </div>
       `
     }


     ${
      task.submitted_at
       ? `
        <div class="reviewSubmittedTime">
         <span></span>
         تم التسليم:
         <strong>
          ${esc(task.submitted_at)}
         </strong>
        </div>
       `
       : ''
     }

    </section>


    <section class="taskReviewSection">

     <div class="reviewSectionHead">

      <div>
       <span>02 / SUBMISSION</span>
       <h3>تسليم المتطوع</h3>
      </div>

      ${
       hasSubmission
        ? `
         <span class="submissionAvailable">
          <i></i>
          تم استلام العمل
         </span>
        `
        : ''
      }

     </div>


     ${
      task.submission_note
       ? `
        <div class="submissionBlock">

         <div class="submissionBlockIcon">
          Aa
         </div>

         <div class="submissionBlockContent">

          <span>التقرير / العمل المكتوب</span>

          <div class="submissionText">
           ${esc(task.submission_note)}
          </div>

         </div>

        </div>
       `
       : ''
     }


     ${
      task.submission_url
       ? `
        <a
         class="submissionBlock submissionLink"
         href="${esc(task.submission_url)}"
         target="_blank"
         rel="noopener noreferrer"
        >

         <div class="submissionBlockIcon">
          ↗
         </div>

         <div class="submissionBlockContent">

          <span>رابط العمل</span>

          <strong>
           فتح رابط التسليم
          </strong>

         </div>

         <i class="submissionArrow">
          ←
         </i>

        </a>
       `
       : ''
     }


     ${
      task.submission_file_name
       ? `
        <a
         class="submissionBlock submissionLink"
         href="/api/tasks/${task.id}/submission-file"
         target="_blank"
        >

         <div class="submissionBlockIcon file">
          ↓
         </div>

         <div class="submissionBlockContent">

          <span>الملف المرفق</span>

          <strong>
           ${esc(task.submission_file_name)}
          </strong>

          ${
           task.submission_file_size
            ? `
             <small>
              ${formatTaskFileSize(
               task.submission_file_size
              )}
             </small>
            `
            : ''
          }

         </div>

         <i class="submissionArrow">
          فتح
         </i>

        </a>
       `
       : ''
     }


     ${
      !hasSubmission
       ? `
        <div class="reviewEmptySubmission">

         <div>○</div>

         <strong>
          لا توجد تفاصيل تسليم
         </strong>

         <span>
          لم يتم العثور على تقرير، رابط أو ملف
          محفوظ لهذه المهمة.
         </span>

        </div>
       `
       : ''
     }

    </section>


    ${
     isCompleted
      ? `
       <div class="taskApprovedBanner">

        <div class="approvedCheck">
         ✓
        </div>

        <div>
         <span>APPROVED WORK</span>
         <strong>
          تم اعتماد هذا الإنجاز
         </strong>
         <p>
          العمل محفوظ في أرشيف المهام
          ويمكن الرجوع إليه في أي وقت.
         </p>
        </div>

       </div>
      `
      : ''
    }


   </div>


   <div class="taskReviewFooter">

    <div class="reviewFooterSecurity">
     <i></i>

     ${
      canReview
       ? 'راجع العمل قبل اتخاذ القرار النهائي'
       : isCompleted
         ? 'وضع العرض فقط — المهمة معتمدة'
         : 'تفاصيل المهمة'
     }

    </div>


    <div class="reviewFooterActions">

     <button
      class="btn light"
      type="button"
      onclick="closeAdminTaskReview()">
      إغلاق
     </button>


     ${
      canReview
       ? `

        <button
         class="btn light reviewRevisionButton"
         type="button"
         onclick="reviewTaskFromModal(
          ${task.id},
          'revision_requested'
         )">
         ↩ طلب تعديل
        </button>

        <button
         class="btn green reviewApproveButton"
         type="button"
         onclick="reviewTaskFromModal(
          ${task.id},
          'completed'
         )">
         <span>اعتماد الإنجاز</span>
         <i>✓</i>
        </button>

       `
       : ''
     }

    </div>

   </div>


  </div>
 `;


 document.body.appendChild(modal);


 requestAnimationFrame(()=>{
  modal.classList.add('open');
 });


 modal.addEventListener('click',e=>{

  if(e.target===modal){
   closeAdminTaskReview();
  }

 });


 const escapeHandler=e=>{

  if(e.key==='Escape'){

   closeAdminTaskReview();

   document.removeEventListener(
    'keydown',
    escapeHandler
   );

  }

 };

 document.addEventListener(
  'keydown',
  escapeHandler
 );

}
async function reviewTaskFromModal(id,action){
 const ok=await reviewVolunteerTask(
  id,
  action
 );

 if(ok){
  closeAdminTaskReview();
 }
}


async function reviewVolunteerTask(id,action){
 try{
  let revisionNote='';

  if(action==='completed'){
   const ok=confirm(
    'هل تريد اعتماد هذه المهمة كمكتملة؟'
   );

   if(!ok)return;
  }

  if(action==='revision_requested'){
   revisionNote=prompt(
    'اكتب التعديل المطلوب من المتطوع:'
   );

   if(revisionNote===null)return;

   revisionNote=revisionNote.trim();

   if(!revisionNote){
    alert('يجب كتابة التعديل المطلوب');
    return;
   }
  }

  await api(`/api/admin/tasks/${id}/review`,{
   method:'PUT',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({
    action,
    revision_note:revisionNote
   })
  });

  await tasks();

  return true;

 }catch(e){
  alert(e.message||'تعذر مراجعة المهمة');
  return false;
 }
}

async function viewVolunteerProfile(id){
 try{
  const d=await api('/api/admin/volunteers/'+id);

  const v=d.volunteer;
  const st=v.task_stats||{
   total:0,
   new:0,
   in_progress:0,
   completed:0,
   submitted:0,
   revision_requested:0,
   not_completed:0,
   completion_rate:0,
   last_activity:null
  };

  content.innerHTML=`
   <div class="panel volunteerProfile">

    <div class="profileHeader">
     <button class="btn light" onclick="loadTab('volunteers')">
      ← العودة للمتطوعين
     </button>

     <div>
      <h2>${esc(v.name||'متطوع')}</h2>
      <p class="muted">
       ${v.department
        ? '🏢 '+esc(v.department)
        : 'لم يتم تحديد القسم'}
      </p>
     </div>
    </div>

    <div class="profileInfoGrid">

     <div class="profileInfo">
      <span>📧 البريد الإلكتروني</span>
      <b>${esc(v.email||'-')}</b>
     </div>

     <div class="profileInfo">
      <span>📱 رقم الهاتف</span>
      <b>${esc(v.phone||'-')}</b>
     </div>

     <div class="profileInfo">
      <span>👤 اسم المستخدم</span>
      <b>${esc(v.username||'-')}</b>
     </div>

     <div class="profileInfo">
      <span>📅 تاريخ الانضمام</span>
      <b>${esc(v.created_at||'-')}</b>
     </div>

    </div>

    <div class="profileSection">
     <h3>📊 أداء المتطوع</h3>

     <div class="profileStats">

      <div class="profileStat">
       <strong>${st.total}</strong>
       <span>إجمالي المهام</span>
      </div>

      <div class="profileStat">
       <strong>${st.new}</strong>
       <span>مهام جديدة</span>
      </div>

      <div class="profileStat">
       <strong>${st.in_progress}</strong>
       <span>قيد التنفيذ</span>
      </div>

      <div class="profileStat">
       <strong>${st.submitted||0}</strong>
       <span>بانتظار المراجعة</span>
      </div>

      <div class="profileStat">
       <strong>${st.revision_requested||0}</strong>
       <span>مطلوب تعديل</span>
      </div>

      <div class="profileStat">
       <strong>${st.completed}</strong>
       <span>مكتملة</span>
      </div>

      <div class="profileStat">
       <strong>${st.not_completed||0}</strong>
       <span>لم يتم إنهاؤها</span>
      </div>

     </div>

     <div class="completionBox">
      <div>
       <b>نسبة إنجاز المهام</b>
       <strong>${st.completion_rate}%</strong>
      </div>

      <div class="progressBar">
       <span style="width:${st.completion_rate}%"></span>
      </div>
     </div>

     <p class="muted">
      🕒 آخر نشاط:
      ${esc(st.last_activity||'لا يوجد نشاط بعد')}
     </p>

    </div>

   </div>
  `;

 }catch(e){
  content.innerHTML=`
   <div class="panel">
    <div class="notice error">
     ${esc(e.message||'تعذر تحميل ملف المتطوع')}
    </div>
    <button class="btn light" onclick="loadTab('volunteers')">
     ← العودة
    </button>
   </div>
  `;
 }
}

function chooseWhatsAppMode(){
 return new Promise(resolve=>{
  const overlay=document.createElement('div');

  overlay.style.cssText=`
   position:fixed;
   inset:0;
   background:rgba(20,30,38,.48);
   backdrop-filter:blur(6px);
   display:flex;
   align-items:center;
   justify-content:center;
   z-index:99999;
   padding:20px;
  `;

  overlay.innerHTML=`
   <div class="rouhWhatsAppDialog">
    <div class="rouhWhatsAppIcon">💬</div>

    <h2>اختر طريقة فتح الواتساب</h2>
    <p>كيف تود فتح رابط التواصل؟</p>

    <label class="rouhWhatsAppOption">
     <input type="radio" name="rouhWhatsappMode" value="web">
     <span class="rouhRadio"></span>
     <span class="rouhWhatsAppText">
      <strong>واتساب ويب</strong>
      <small>فتح المحادثة في المتصفح</small>
     </span>
    </label>

    <label class="rouhWhatsAppOption">
     <input type="radio" name="rouhWhatsappMode" value="app">
     <span class="rouhRadio"></span>
     <span class="rouhWhatsAppText">
      <strong>واتساب تطبيق</strong>
      <small>فتح المحادثة في تطبيق واتساب</small>
     </span>
    </label>

    <div class="rouhWhatsAppActions">
     <button type="button" data-cancel>إلغاء</button>
     <button type="button" data-confirm disabled>فتح واتساب</button>
    </div>
   </div>
  `;

  const style=document.createElement('style');

  style.textContent=`
   .rouhWhatsAppDialog{
    width:min(430px,100%);
    background:#fff;
    border-radius:30px;
    padding:30px;
    box-shadow:0 25px 80px rgba(0,0,0,.25);
    direction:rtl;
    font-family:inherit;
   }

   .rouhWhatsAppIcon{
    width:52px;
    height:52px;
    display:grid;
    place-items:center;
    background:#edf5ed;
    border-radius:16px;
    font-size:27px;
    margin-bottom:15px;
   }

   .rouhWhatsAppDialog h2{
    margin:0 0 5px;
    color:#263747;
    font-size:24px;
   }

   .rouhWhatsAppDialog>p{
    margin:0 0 22px;
    color:#6f777d;
    font-size:14px;
   }

   .rouhWhatsAppOption{
    display:flex;
    align-items:center;
    gap:15px;
    padding:17px;
    margin:10px 0;
    border:2px solid #e8ded1;
    border-radius:19px;
    cursor:pointer;
    transition:.18s;
   }

   .rouhWhatsAppOption:hover,
   .rouhWhatsAppOption.selected{
    border-color:#7f9880;
    background:#f1f6f0;
   }

   .rouhWhatsAppOption input{
    position:absolute;
    opacity:0;
    pointer-events:none;
   }

   .rouhRadio{
    width:23px;
    height:23px;
    min-width:23px;
    border:3px solid #a4adb3;
    border-radius:50%;
    position:relative;
   }

   .rouhWhatsAppOption.selected .rouhRadio{
    border-color:#718b73;
   }

   .rouhWhatsAppOption.selected .rouhRadio:after{
    content:"";
    position:absolute;
    width:11px;
    height:11px;
    border-radius:50%;
    background:#718b73;
    top:3px;
    left:3px;
   }

   .rouhWhatsAppText strong{
    display:block;
    color:#263747;
    font-size:16px;
   }

   .rouhWhatsAppText small{
    display:block;
    color:#6f777d;
    font-size:12px;
    margin-top:3px;
   }

   .rouhWhatsAppActions{
    display:flex;
    gap:10px;
    justify-content:flex-start;
    margin-top:23px;
   }

   .rouhWhatsAppActions button{
    border-radius:999px;
    padding:11px 22px;
    cursor:pointer;
    font:inherit;
   }

   .rouhWhatsAppActions [data-cancel]{
    background:#fff;
    color:#263747;
    border:1px solid #e8ded1;
   }

   .rouhWhatsAppActions [data-confirm]{
    background:#6f826f;
    color:#fff;
    border:0;
   }

   .rouhWhatsAppActions [data-confirm]:disabled{
    opacity:.45;
    cursor:not-allowed;
   }

   @media(max-width:500px){
    .rouhWhatsAppDialog{
     padding:23px;
     border-radius:24px;
    }
   }
  `;

  document.head.appendChild(style);
  document.body.appendChild(overlay);

  const options=overlay.querySelectorAll('.rouhWhatsAppOption');
  const confirm=overlay.querySelector('[data-confirm]');

  options.forEach(option=>{
   option.addEventListener('click',()=>{
    options.forEach(x=>x.classList.remove('selected'));
    option.classList.add('selected');
    option.querySelector('input').checked=true;
    confirm.disabled=false;
   });
  });

  overlay.querySelector('[data-cancel]').onclick=()=>{
   overlay.remove();
   style.remove();
   resolve(null);
  };

  confirm.onclick=()=>{
   const selected=overlay.querySelector(
    'input[name="rouhWhatsappMode"]:checked'
   );

   if(!selected) return;

   overlay.remove();
   style.remove();

   resolve(selected.value);
  };
 });
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
  'رواق':'https://chat.whatsapp.com/EuiNNbPQedBErniuShpYue?s=sw&p=i&mlu=4',
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

 const openMode=await chooseWhatsAppMode();

 if(openMode===null) return;

 if(openMode==='app'){
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
  '6 - رواق\n'+
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
  '6':'رواق',
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
  'رواق':'https://chat.whatsapp.com/EuiNNbPQedBErniuShpYue?s=sw&p=i&mlu=4',
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

  const openMode=await chooseWhatsAppMode();

  if(openMode===null) return;

  if(openMode==='app'){
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

 const items=(d.items||[])
  .filter(v=>v.status==='rejected');


 content.innerHTML=`

  <div class="rejectedArchive">


   <section class="rejectedHero">

    <div>

     <span class="rejectedHeroCode">
      ROUH / APPLICATION ARCHIVE
     </span>

     <h2>
      سجل الطلبات المرفوضة
     </h2>

     <p>
      أرشيف منظم لطلبات الانضمام التي
      انتهت بالرفض، مع الاحتفاظ ببياناتها
      كسجل إداري دون حذفها.
     </p>


     <div class="rejectedHeroState">

      <span>
       <i></i>
       ARCHIVE ACTIVE
      </span>

      <span>
       ${items.length} طلب مرفوض
      </span>

     </div>

    </div>


    <div class="rejectedHeroMark">

     <div>
      ×
     </div>

     <small>
      ARCHIVE
     </small>

    </div>

   </section>


   <section class="rejectedStats">

    <article>

     <span>
      REJECTED APPLICATIONS
     </span>

     <strong>
      ${items.length}
     </strong>

     <small>
      إجمالي الطلبات المرفوضة
     </small>

    </article>


    <article>

     <span>
      RECORD STATUS
     </span>

     <strong class="rejectedTextStat">
      محفوظ
     </strong>

     <small>
      تبقى البيانات في السجل
     </small>

    </article>


    <article>

     <span>
      ARCHIVE MODE
     </span>

     <strong class="rejectedTextStat">
      READ ONLY
     </strong>

     <small>
      السجل مخصص للمراجعة
     </small>

    </article>

   </section>


   <section class="rejectedRegistry">


    <header class="rejectedRegistryHead">

     <div>

      <span>
       REJECTED REGISTRY
      </span>

      <h3>
       أرشيف الطلبات
      </h3>

      <p>
       ابحث داخل السجل باستخدام
       الاسم أو الهاتف أو التخصص.
      </p>

     </div>


     ${
      items.length
       ? `

        <label class="rejectedSearch">

         <span>⌕</span>

         <input
          id="rejectedSearchInput"
          type="search"
          placeholder="ابحث في السجل..."
          autocomplete="off">

        </label>

       `
       : ''
     }

    </header>


    ${
     items.length
      ? `

       <div class="rejectedTableWrap">

        <table class="rejectedTable">

         <thead>

          <tr>

           <th>
            المتقدم
           </th>

           <th>
            التواصل
           </th>

           <th>
            الدراسة
           </th>

           <th>
            المدينة
           </th>

           <th>
            تاريخ الرفض
           </th>

           <th>
            الحالة
           </th>

          </tr>

         </thead>


         <tbody>

          ${items.map((v,index)=>{

           const searchText=[
            v.name||'',
            v.email||'',
            v.phone||'',
            v.major||'',
            v.level||'',
            v.city||''
           ].join(' ').toLowerCase();

           return `

            <tr
             class="rejectedRow"
             data-rejected-search="${esc(searchText)}"
             style="--rejected-index:${index}">


             <td>

              <div class="rejectedPerson">

               <div class="rejectedAvatar">

                ${esc(
                 String(v.name||'R')
                  .trim()
                  .charAt(0)
                  .toUpperCase()
                )}

               </div>


               <div>

                <strong>
                 ${esc(v.name||'-')}
                </strong>

                <small>
                 APPLICATION #${v.id}
                </small>

               </div>

              </div>

             </td>


             <td>

              <div class="rejectedContact">

               <strong>
                ${esc(v.phone||'-')}
               </strong>

               <small>
                ${esc(v.email||'-')}
               </small>

              </div>

             </td>


             <td>

              <div class="rejectedStudy">

               <strong>
                ${esc(v.major||'-')}
               </strong>

               <small>
                المستوى:
                ${esc(v.level||'-')}
               </small>

              </div>

             </td>


             <td>

              <span class="rejectedCity">
               ${esc(v.city||'-')}
              </span>

             </td>


             <td>

              <div class="rejectedDate">

               <span>
                REJECTED
               </span>

               <strong>
                ${esc(v.rejected_at||'-')}
               </strong>

              </div>

             </td>


             <td>

              <span class="rejectedBadge">

               <i></i>

               مرفوض

              </span>

             </td>


            </tr>

           `;

          }).join('')}

         </tbody>

        </table>

       </div>


       <div
        id="rejectedNoResults"
        class="rejectedNoResults"
        hidden>

        <div>⌕</div>

        <strong>
         لا توجد نتائج
        </strong>

        <span>
         جرّب البحث بكلمة أخرى.
        </span>

       </div>

      `
      : `

       <div class="rejectedEmpty">

        <div class="rejectedEmptyIcon">
         ✓
        </div>

        <span>
         ARCHIVE CLEAR
        </span>

        <h3>
         لا توجد طلبات مرفوضة
        </h3>

        <p>
         لا يحتوي السجل على طلبات
         مرفوضة حتى الآن.
        </p>

       </div>

      `
    }


   </section>


  </div>

 `;


 const search=
  document.getElementById(
   'rejectedSearchInput'
  );


 if(search){

  search.addEventListener(
   'input',
   ()=>{

    const query=
     search.value
      .trim()
      .toLowerCase();


    let visible=0;


    document
     .querySelectorAll('.rejectedRow')
     .forEach(row=>{

      const match=
       !query ||
       (
        row.dataset.rejectedSearch||''
       ).includes(query);


      row.hidden=!match;

      if(match) visible++;

     });


    const empty=
     document.getElementById(
      'rejectedNoResults'
     );


    if(empty){

     empty.hidden=
      visible!==0;

    }

   }
  );

 }

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

    const openMode=await chooseWhatsAppMode();

    if(openMode===null) return;

    if(openMode==='app'){
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
   '6':'رواق',
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
   '6 - رواق 💡\n' +
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
 const items=d.items||[];

 const statusLabel={
  new:'جديدة',
  reviewing:'قيد المراجعة',
  handled:'تمت المعالجة',
  closed:'مغلقة'
 };

 const stats={
  total:items.length,
  new:items.filter(x=>x.status==='new').length,
  reviewing:items.filter(x=>x.status==='reviewing').length,
  resolved:items.filter(x=>
   x.status==='handled' ||
   x.status==='closed'
  ).length
 };


 content.innerHTML=`

  <div class="complaintsCenter">


   <section class="complaintsHero">

    <div>

     <span class="complaintsHeroCode">
      ROUH / CASE MANAGEMENT
     </span>

     <h2>
      مركز الشكاوى
     </h2>

     <p>
      مساحة مخصصة لمراجعة الشكاوى،
      متابعة حالتها، وتوثيق إجراءات
      الإدارة حتى إغلاق الحالة.
     </p>


     <div class="complaintsHeroStatus">

      <span>
       <i></i>
       CASE SYSTEM ACTIVE
      </span>

      <span>
       ${items.length} حالة مسجلة
      </span>

     </div>

    </div>


    <div class="complaintsHeroMark">

     <div>!</div>

     <small>
      CASES
     </small>

    </div>

   </section>


   <section class="complaintsStats">

    <article>

     <span>TOTAL CASES</span>

     <strong>${stats.total}</strong>

     <small>إجمالي الشكاوى</small>

    </article>


    <article class="new">

     <span>NEW CASES</span>

     <strong>${stats.new}</strong>

     <small>بانتظار المراجعة</small>

    </article>


    <article class="reviewing">

     <span>IN REVIEW</span>

     <strong>${stats.reviewing}</strong>

     <small>قيد المراجعة</small>

    </article>


    <article class="resolved">

     <span>RESOLVED</span>

     <strong>${stats.resolved}</strong>

     <small>تمت معالجتها أو إغلاقها</small>

    </article>

   </section>


   <section class="complaintsWorkspace">


    <div class="complaintsWorkspaceHead">

     <div>

      <span>
       CASE REGISTRY
      </span>

      <h3>
       سجل الشكاوى
      </h3>

      <p>
       اختر أي حالة لعرض التفاصيل
       ومتابعة إجراء الإدارة.
      </p>

     </div>


     <div class="complaintsTools">

      <label class="complaintsSearch">

       <span>⌕</span>

       <input
        id="complaintsSearchInput"
        type="search"
        placeholder="بحث بالاسم أو رقم الحالة..."
        autocomplete="off">

      </label>


      <select id="complaintsStatusFilter">

       <option value="all">
        جميع الحالات
       </option>

       ${Object.entries(statusLabel)
        .map(([k,v])=>`
         <option value="${k}">
          ${v}
         </option>
        `).join('')}

      </select>

     </div>

    </div>


    <div class="complaintsList">

     ${
      items.length
       ? items.map((x,index)=>{

          const state=
           statusLabel[x.status]
            ? x.status
            : 'new';

          const encoded=
           encodeURIComponent(
            JSON.stringify(x)
           );

          const searchText=[
           x.id||'',
           x.name||'',
           x.phone||'',
           x.email||'',
           x.complaint||'',
           statusLabel[x.status]||''
          ].join(' ').toLowerCase();

          return `

           <article
            class="complaintCase"
            data-complaint-status="${state}"
            data-complaint-search="${esc(searchText)}"
            style="--case-index:${index}">


            <div class="complaintCaseNumber">

             <span>
              CASE
             </span>

             <strong>
              #${String(
               x.id||index+1
              ).padStart(3,'0')}
             </strong>

            </div>


            <div class="complaintCasePerson">

             <div class="complaintCaseAvatar">

              ${esc(
               String(
                x.name||'R'
               )
               .trim()
               .charAt(0)
               .toUpperCase()
              )}

             </div>


             <div>

              <strong>
               ${esc(
                x.name||
                'غير معروف'
               )}
              </strong>

              <small>
               ${esc(
                x.phone||
                x.email||
                'لا توجد وسيلة تواصل'
               )}
              </small>

             </div>

            </div>


            <div class="complaintCaseSummary">

             <span>
              COMPLAINT
             </span>

             <p>
              ${esc(
               x.complaint||
               'لا يوجد وصف للشكوى.'
              )}
             </p>

            </div>


            <div class="complaintCaseDate">

             <span>
              SUBMITTED
             </span>

             <strong>
              ${esc(
               x.created_at||
               '-'
              )}
             </strong>

            </div>


            <div>

             <span class="
              complaintStatus
              ${state}
             ">

              <i></i>

              ${esc(
               statusLabel[x.status]||
               x.status
              )}

             </span>

            </div>


            <button
             type="button"
             class="complaintOpen"
             onclick="
              openComplaintDrawer(
               '${encoded}'
              )
             ">

             مراجعة
             <span>←</span>

            </button>


           </article>

          `;

         }).join('')
       : `

        <div class="complaintsEmpty">

         <div>✓</div>

         <h3>
          لا توجد شكاوى
         </h3>

         <p>
          لا توجد حالات مسجلة
          في الوقت الحالي.
         </p>

        </div>

       `
     }

    </div>


    ${
     items.length
      ? `
       <div
        id="complaintsNoResults"
        class="complaintsNoResults"
        hidden>

        لا توجد شكاوى مطابقة للبحث.

       </div>
      `
      : ''
    }


   </section>


  </div>


  <div
   id="complaintDrawerBackdrop"
   class="complaintDrawerBackdrop"
   onclick="closeComplaintDrawer()">
  </div>


  <aside
   id="complaintDrawer"
   class="complaintDrawer">

   <div id="complaintDrawerContent"></div>

  </aside>

 `;


 const search=
  document.getElementById(
   'complaintsSearchInput'
  );

 const filter=
  document.getElementById(
   'complaintsStatusFilter'
  );


 const applyFilters=()=>{

  const query=
   (search?.value||'')
    .trim()
    .toLowerCase();

  const status=
   filter?.value||'all';

  let visible=0;


  document
   .querySelectorAll(
    '.complaintCase'
   )
   .forEach(card=>{

    const searchMatch=
     !query ||
     (
      card.dataset.complaintSearch||''
     ).includes(query);

    const statusMatch=
     status==='all' ||
     card.dataset.complaintStatus===status;

    const show=
     searchMatch &&
     statusMatch;

    card.hidden=!show;

    if(show) visible++;

   });


  const noResults=
   document.getElementById(
    'complaintsNoResults'
   );

  if(noResults){
   noResults.hidden=
    visible!==0;
  }

 };


 search?.addEventListener(
  'input',
  applyFilters
 );

 filter?.addEventListener(
  'change',
  applyFilters
 );

}


window.openComplaintDrawer=(encoded)=>{

 let x;

 try{

  x=JSON.parse(
   decodeURIComponent(encoded)
  );

 }catch{

  return;

 }


 const statusLabel={
  new:'جديدة',
  reviewing:'قيد المراجعة',
  handled:'تمت المعالجة',
  closed:'مغلقة'
 };


 const drawer=
  document.getElementById(
   'complaintDrawer'
  );

 const backdrop=
  document.getElementById(
   'complaintDrawerBackdrop'
  );

 const body=
  document.getElementById(
   'complaintDrawerContent'
  );


 if(
  !drawer ||
  !backdrop ||
  !body
 ) return;


 body.innerHTML=`

  <div class="complaintDrawerHeader">

   <div>

    <span>
     CASE REVIEW /
     ${String(
      x.id||''
     ).padStart(3,'0')}
    </span>

    <h2>
     مراجعة الشكوى
    </h2>

   </div>


   <button
    type="button"
    onclick="closeComplaintDrawer()">

    ×

   </button>

  </div>


  <div class="complaintDrawerBody">


   <section class="complaintIdentity">

    <div class="complaintIdentityAvatar">

     ${esc(
      String(
       x.name||'R'
      )
      .trim()
      .charAt(0)
      .toUpperCase()
     )}

    </div>


    <div>

     <span>
      SUBMITTED BY
     </span>

     <strong>
      ${esc(
       x.name||
       'غير معروف'
      )}
     </strong>

     <small>
      تم إرسال الشكوى
      ${esc(x.created_at||'')}
     </small>

    </div>

   </section>


   <section class="complaintContact">

    <div>

     <span>
      PHONE
     </span>

     <strong>
      ${esc(
       x.phone||
       'غير متوفر'
      )}
     </strong>

    </div>


    <div>

     <span>
      EMAIL
     </span>

     <strong>
      ${esc(
       x.email||
       'غير متوفر'
      )}
     </strong>

    </div>

   </section>


   <section class="complaintText">

    <span>
     COMPLAINT DETAILS
    </span>

    <h3>
     تفاصيل الشكوى
    </h3>

    <p>
     ${esc(
      x.complaint||
      'لا يوجد وصف.'
     )}
    </p>

   </section>


   <section class="complaintManagement">

    <div class="complaintManagementHead">

     <span>
      CASE MANAGEMENT
     </span>

     <h3>
      متابعة الحالة
     </h3>

     <p>
      حدّث حالة الشكوى وسجل
      ملاحظات الإدارة.
     </p>

    </div>


    <label>

     <span>
      حالة الشكوى
     </span>

     <select
      id="complaintStatus${x.id}">

      ${Object.entries(statusLabel)
       .map(([k,v])=>`

        <option
         value="${k}"
         ${x.status===k
          ? 'selected'
          : ''}>

         ${v}

        </option>

       `).join('')}

     </select>

    </label>


    <label>

     <span>
      ملاحظات الإدارة
     </span>

     <textarea
      id="complaintNotes${x.id}"
      rows="6"
      placeholder="سجّل الإجراء أو الملاحظات الخاصة بالحالة..."
     >${esc(
      x.admin_notes||
      ''
     )}</textarea>

    </label>


    <button
     type="button"
     class="complaintSave"
     onclick="
      saveComplaint(${x.id})
     ">

     <span>✓</span>

     حفظ تحديث الحالة

    </button>

   </section>


  </div>

 `;


 backdrop.classList.add('open');
 drawer.classList.add('open');

 document.body.classList.add(
  'complaintDrawerOpen'
 );

};


window.closeComplaintDrawer=()=>{

 document
  .getElementById(
   'complaintDrawer'
  )
  ?.classList.remove('open');


 document
  .getElementById(
   'complaintDrawerBackdrop'
  )
  ?.classList.remove('open');


 document.body.classList.remove(
  'complaintDrawerOpen'
 );

};
async function saveComplaint(id){
 try{
  const status=document.getElementById('complaintStatus'+id).value;
  const admin_notes=document.getElementById('complaintNotes'+id).value;

  await api('/api/admin/complaints/'+id,{
   method:'PUT',
   body:JSON.stringify({status,admin_notes})
  });

  flash('تم تحديث حالة الشكوى');
  closeComplaintDrawer();
  complaints();

 }catch(e){
  flash(e.message,true);
 }
}


async function ideas(){

 const d=await api('/api/admin/ideas');
 const items=d.items||[];

 const statusLabel={
  new:'جديدة',
  reviewing:'قيد الدراسة',
  accepted:'مقبولة',
  rejected:'مرفوضة',
  implemented:'تم تنفيذها'
 };

 const statusCode={
  new:'NEW',
  reviewing:'REVIEW',
  accepted:'ACCEPTED',
  rejected:'REJECTED',
  implemented:'IMPLEMENTED'
 };

 const stats={
  total:items.length,
  new:items.filter(x=>x.status==='new').length,
  reviewing:items.filter(x=>x.status==='reviewing').length,
  accepted:items.filter(x=>
   x.status==='accepted' ||
   x.status==='implemented'
  ).length
 };


 content.innerHTML=`

  <div class="ideasCenter">


   <section class="ideasHero">

    <div class="ideasHeroContent">

     <span class="ideasHeroCode">
      ROUH / INNOVATION HUB
     </span>

     <h2>
      مركز الأفكار
     </h2>

     <p>
      راجع أفكار المجتمع، قيّم أثرها،
      وتابع رحلة الفكرة من الاقتراح
      حتى التنفيذ.
     </p>


     <div class="ideasHeroState">

      <span>
       <i></i>
       IDEAS PIPELINE ACTIVE
      </span>

      <span>
       ${items.length} فكرة مسجلة
      </span>

     </div>

    </div>


    <div class="ideasHeroMark">

     <div>
      ✦
     </div>

     <span>
      INNOVATION
     </span>

    </div>

   </section>


   <section class="ideasStats">

    <article>

     <span>TOTAL IDEAS</span>

     <strong>
      ${stats.total}
     </strong>

     <small>
      إجمالي الأفكار
     </small>

    </article>


    <article class="new">

     <span>NEW</span>

     <strong>
      ${stats.new}
     </strong>

     <small>
      أفكار جديدة
     </small>

    </article>


    <article class="reviewing">

     <span>IN REVIEW</span>

     <strong>
      ${stats.reviewing}
     </strong>

     <small>
      قيد الدراسة
     </small>

    </article>


    <article class="accepted">

     <span>PROGRESS</span>

     <strong>
      ${stats.accepted}
     </strong>

     <small>
      مقبولة أو منفذة
     </small>

    </article>

   </section>


   <section class="ideasInbox">

    <div class="ideasInboxHead">

     <div>

      <span>
       IDEA INBOX
      </span>

      <h3>
       صندوق الأفكار
      </h3>

      <p>
       افتح أي فكرة لمراجعة تفاصيلها
       وتحديث حالتها.
      </p>

     </div>


     <div class="ideasTools">

      <label class="ideasSearch">

       <span>⌕</span>

       <input
        id="ideasSearchInput"
        type="search"
        placeholder="ابحث عن فكرة..."
        autocomplete="off">

      </label>


      <select id="ideasStatusFilter">

       <option value="all">
        جميع الحالات
       </option>

       ${Object.entries(statusLabel)
        .map(([k,v])=>`
         <option value="${k}">
          ${v}
         </option>
        `).join('')}

      </select>

     </div>

    </div>


    <div class="ideasGrid">

     ${
      items.length
       ? items.map((x,index)=>{

          const state=
           statusLabel[x.status]
            ? x.status
            : 'new';

          const searchText=[
           x.title||'',
           x.name||'',
           x.contact||'',
           x.category||'',
           x.description||'',
           statusLabel[x.status]||''
          ].join(' ').toLowerCase();

          const encoded=
           encodeURIComponent(
            JSON.stringify(x)
           );

          return `

           <article
            class="ideaCard"
            data-idea-status="${state}"
            data-idea-search="${esc(searchText)}"
            style="--idea-index:${index}">


            <div class="ideaCardTop">

             <span class="
              ideaStatus
              ${state}
             ">

              <i></i>

              ${
               esc(
                statusLabel[x.status]||
                x.status
               )
              }

             </span>


             <span class="ideaNumber">
              IDEA /
              ${String(
               x.id||index+1
              ).padStart(3,'0')}
             </span>

            </div>


            <div class="ideaCategory">
             ${esc(
              x.category||
              'غير محدد'
             )}
            </div>


            <h3>
             ${esc(
              x.title||
              'فكرة بدون عنوان'
             )}
            </h3>


            <p>
             ${esc(
              x.description||
              'لا يوجد وصف للفكرة.'
             )}
            </p>


            <div class="ideaAuthor">

             <span>
              ${esc(
               String(
                x.name||
                'R'
               )
               .trim()
               .charAt(0)
               .toUpperCase()
              )}
             </span>

             <div>

              <strong>
               ${esc(
                x.name||
                'غير معروف'
               )}
              </strong>

              <small>
               ${esc(
                x.created_at||
                ''
               )}
              </small>

             </div>

            </div>


            <button
             type="button"
             class="ideaOpenButton"
             onclick="
              openIdeaDrawer(
               '${encoded}'
              )
             ">

             <span>
              مراجعة الفكرة
             </span>

             <b>
              ←
             </b>

            </button>


           </article>

          `;

         }).join('')
       : `

        <div class="ideasEmpty">

         <div>✦</div>

         <h3>
          لا توجد أفكار مرسلة
         </h3>

         <p>
          ستظهر الأفكار الجديدة هنا
          عند إرسالها.
         </p>

        </div>

       `
     }

    </div>


    ${
     items.length
      ? `
       <div
        id="ideasNoResults"
        class="ideasNoResults"
        hidden>

        لا توجد أفكار مطابقة للبحث.

       </div>
      `
      : ''
    }

   </section>


  </div>


  <div
   id="ideaDrawerBackdrop"
   class="ideaDrawerBackdrop"
   onclick="closeIdeaDrawer()">
  </div>


  <aside
   id="ideaDrawer"
   class="ideaDrawer">

   <div id="ideaDrawerContent"></div>

  </aside>

 `;


 const search=
  document.getElementById(
   'ideasSearchInput'
  );

 const filter=
  document.getElementById(
   'ideasStatusFilter'
  );


 const applyFilters=()=>{

  const query=
   (search?.value||'')
    .trim()
    .toLowerCase();

  const status=
   filter?.value||'all';

  let visible=0;


  document
   .querySelectorAll('.ideaCard')
   .forEach(card=>{

    const searchMatch=
     !query ||
     (
      card.dataset.ideaSearch||''
     ).includes(query);

    const statusMatch=
     status==='all' ||
     card.dataset.ideaStatus===status;

    const show=
     searchMatch &&
     statusMatch;

    card.hidden=!show;

    if(show) visible++;

   });


  const noResults=
   document.getElementById(
    'ideasNoResults'
   );

  if(noResults){
   noResults.hidden=
    visible!==0;
  }

 };


 search?.addEventListener(
  'input',
  applyFilters
 );

 filter?.addEventListener(
  'change',
  applyFilters
 );

}


window.openIdeaDrawer=(encoded)=>{

 let x;

 try{
  x=JSON.parse(
   decodeURIComponent(encoded)
  );
 }catch{
  return;
 }


 const statusLabel={
  new:'جديدة',
  reviewing:'قيد الدراسة',
  accepted:'مقبولة',
  rejected:'مرفوضة',
  implemented:'تم تنفيذها'
 };


 const drawer=
  document.getElementById(
   'ideaDrawer'
  );

 const backdrop=
  document.getElementById(
   'ideaDrawerBackdrop'
  );

 const body=
  document.getElementById(
   'ideaDrawerContent'
  );


 if(
  !drawer ||
  !backdrop ||
  !body
 ) return;


 body.innerHTML=`

  <div class="ideaDrawerHeader">

   <div>

    <span>
     IDEA REVIEW /
     ${String(x.id||'').padStart(3,'0')}
    </span>

    <h2>
     ${esc(
      x.title||
      'فكرة بدون عنوان'
     )}
    </h2>

   </div>


   <button
    type="button"
    onclick="closeIdeaDrawer()">

    ×

   </button>

  </div>


  <div class="ideaDrawerBody">


   <section class="ideaDrawerIdentity">

    <div class="ideaDrawerAvatar">

     ${esc(
      String(
       x.name||
       'R'
      )
      .trim()
      .charAt(0)
      .toUpperCase()
     )}

    </div>


    <div>

     <span>
      SUBMITTED BY
     </span>

     <strong>
      ${esc(
       x.name||
       'غير معروف'
      )}
     </strong>

     <small>
      ${esc(
       x.contact||
       'لا توجد وسيلة تواصل'
      )}
     </small>

    </div>

   </section>


   <div class="ideaDrawerMeta">

    <div>

     <span>
      CATEGORY
     </span>

     <strong>
      ${esc(
       x.category||
       'غير محدد'
      )}
     </strong>

    </div>


    <div>

     <span>
      SUBMITTED
     </span>

     <strong>
      ${esc(
       x.created_at||
       '-'
      )}
     </strong>

    </div>

   </div>


   <section class="ideaDetailBlock">

    <span>
     IDEA DESCRIPTION
    </span>

    <h3>
     وصف الفكرة
    </h3>

    <p>
     ${esc(
      x.description||
      'لا يوجد وصف.'
     )}
    </p>

   </section>


   <section class="ideaDetailBlock">

    <span>
     PROBLEM
    </span>

    <h3>
     المشكلة التي تحاول حلها
    </h3>

    <p>
     ${esc(
      x.problem||
      'لم يتم تحديد المشكلة.'
     )}
    </p>

   </section>


   <section class="ideaDetailBlock">

    <span>
     EXPECTED IMPACT
    </span>

    <h3>
     الأثر المتوقع
    </h3>

    <p>
     ${esc(
      x.expected_impact||
      'لم يتم تحديد الأثر المتوقع.'
     )}
    </p>

   </section>


   <section class="ideaReviewControl">

    <div class="ideaReviewHead">

     <span>
      MANAGEMENT REVIEW
     </span>

     <h3>
      قرار الإدارة
     </h3>

    </div>


    <label>

     <span>
      حالة الفكرة
     </span>

     <select
      id="ideaStatus${x.id}">

      ${Object.entries(statusLabel)
       .map(([k,v])=>`

        <option
         value="${k}"
         ${x.status===k
          ? 'selected'
          : ''}>

         ${v}

        </option>

       `).join('')}

     </select>

    </label>


    <label>

     <span>
      ملاحظات الإدارة
     </span>

     <textarea
      id="ideaNotes${x.id}"
      rows="5"
      placeholder="أضف ملاحظات حول الفكرة..."
     >${esc(
      x.admin_notes||
      ''
     )}</textarea>

    </label>


    <button
     type="button"
     class="ideaSaveButton"
     onclick="
      saveIdea(${x.id})
     ">

     <span>✓</span>
     حفظ التحديث

    </button>

   </section>


  </div>

 `;


 backdrop.classList.add('open');
 drawer.classList.add('open');

 document.body.classList.add(
  'ideaDrawerOpen'
 );

};


window.closeIdeaDrawer=()=>{

 document
  .getElementById(
   'ideaDrawer'
  )
  ?.classList.remove('open');

 document
  .getElementById(
   'ideaDrawerBackdrop'
  )
  ?.classList.remove('open');

 document.body.classList.remove(
  'ideaDrawerOpen'
 );

};
async function saveIdea(id){
 try{
  const status=document.getElementById('ideaStatus'+id).value;
  const admin_notes=document.getElementById('ideaNotes'+id).value;

  await api('/api/admin/ideas/'+id,{
   method:'PUT',
   body:JSON.stringify({status,admin_notes})
  });

  flash('تم تحديث حالة الفكرة');
  closeIdeaDrawer();
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

 const canViewAll=
  isOwner || isDeputy || isHR;


 const departments=[
  'الميداني',
  'إدارة الموارد البشرية (HR)',
  'الأكاديمي',
  'العلاقات العامة',
  'التقني',
  'رواق',
  'الإعلامي',
  'التيسير'
 ];


 let department=canViewAll
  ? (
     selectedDepartment==='all'
      ? ''
      : selectedDepartment
    )
  : me.department;


 const query=department
  ? '?department='+
    encodeURIComponent(department)
  : '';


 const d=await api(
  '/api/admin/department-content'+query
 );


 const items=d.items||[];


 const canEditDepartment=
  isOwner ||
  isDeputy ||
  (!isHR && department===me.department) ||
  (isHR && department===me.department);


 const workspaceName=
  department ||
  (
   canViewAll
    ? 'جميع الأقسام'
    : me.department || 'القسم'
  );


 const linkedItems=
  items.filter(x=>x.link_url).length;


 const describedItems=
  items.filter(x=>
   String(x.description||'').trim()
  ).length;


 const creators=
  new Set(
   items
    .map(x=>x.created_by_name)
    .filter(Boolean)
  ).size;


 content.innerHTML=`

  <div class="departmentWorkspace">


   <section class="departmentWorkspaceHero">

    <div class="departmentHeroMain">

     <span class="departmentHeroCode">
      ROUH / DEPARTMENT WORKSPACE
     </span>

     <h2>
      ${esc(workspaceName)}
     </h2>

     <p>
      مساحة موحدة لتنظيم أعمال القسم،
      الملفات، الروابط والمحتوى الداخلي.
     </p>


     <div class="departmentHeroAccess">

      <span>
       <i></i>

       ${
        canEditDepartment
         ? 'صلاحية الإدارة والتعديل'
         : 'صلاحية العرض'
       }

      </span>

      <span>
       ${items.length} عنصر
      </span>

     </div>

    </div>


    <div class="departmentHeroMark">

     <div class="departmentMarkRing">
      <span>R</span>
     </div>

     <small>
      DEPARTMENT
     </small>

    </div>

   </section>


   <div class="departmentStats">

    <div class="departmentStat">

     <div class="departmentStatIcon">
      ▦
     </div>

     <div>
      <span>CONTENT</span>
      <strong>${items.length}</strong>
      <small>إجمالي المحتوى</small>
     </div>

    </div>


    <div class="departmentStat">

     <div class="departmentStatIcon link">
      ↗
     </div>

     <div>
      <span>ATTACHMENTS</span>
      <strong>${linkedItems}</strong>
      <small>روابط ومرفقات</small>
     </div>

    </div>


    <div class="departmentStat">

     <div class="departmentStatIcon documented">
      ≡
     </div>

     <div>
      <span>DOCUMENTED</span>
      <strong>${describedItems}</strong>
      <small>محتوى موثق</small>
     </div>

    </div>


    <div class="departmentStat">

     <div class="departmentStatIcon team">
      ◇
     </div>

     <div>
      <span>CONTRIBUTORS</span>
      <strong>${creators}</strong>
      <small>مساهمون</small>
     </div>

    </div>

   </div>


   <section class="departmentControlPanel">

    <div class="departmentControlInfo">

     <span>WORKSPACE CONTROL</span>

     <strong>
      إدارة محتوى القسم
     </strong>

     <small>
      اختر مساحة العمل واعرض المحتوى الخاص بها
     </small>

    </div>


    <div class="departmentControlActions">

     ${
      canViewAll
       ? `
        <label class="departmentSelectWrap">

         <small>
          القسم
         </small>

         <select id="departmentContentFilter">

          <option value="">
           كل الأقسام
          </option>

          ${departments.map(x=>`
           <option
            value="${esc(x)}"
            ${department===x?'selected':''}
           >
            ${esc(x)}
           </option>
          `).join('')}

         </select>

        </label>
       `
       : `
        <div class="departmentLocked">

         <span>القسم الحالي</span>

         <strong>
          ${esc(me.department||'غير محدد')}
         </strong>

        </div>
       `
     }


     ${
      canEditDepartment
       ? `
        <button
         class="btn green departmentAddButton"
         type="button"
         onclick="departmentContentForm(
          '${esc(department||'')}'
         )"
        >
         <span>+</span>
         إضافة محتوى
        </button>
       `
       : `
        <span class="departmentViewOnly">
         ◉ عرض فقط
        </span>
       `
     }

    </div>

   </section>


   <section class="departmentContentSection">

    <div class="departmentContentHeader">

     <div>

      <span>
       DEPARTMENT CONTENT
      </span>

      <h3>
       محتوى مساحة العمل
      </h3>

      <p>
       الأعمال والمراجع والروابط المحفوظة للقسم.
      </p>

     </div>


     <div class="departmentContentCount">

      <strong>
       ${items.length}
      </strong>

      <small>
       عنصر
      </small>

     </div>

    </div>


    ${
     items.length
      ? `

       <div class="departmentContentGrid">

        ${items.map((x,index)=>`

         <article
          class="departmentContentCard"
          style="--department-card-index:${index}"
         >


          <div class="departmentCardTop">

           <div class="departmentCardNumber">
            ${String(index+1).padStart(2,'0')}
           </div>


           <span class="departmentCardDepartment">
            ${esc(x.department||'القسم')}
           </span>

          </div>


          <div class="departmentCardBody">

           <h4>
            ${esc(x.title)}
           </h4>


           ${
            x.description
             ? `
              <p>
               ${esc(x.description)}
              </p>
             `
             : `
              <p class="departmentNoDescription">
               لا يوجد وصف إضافي لهذا المحتوى.
              </p>
             `
           }

          </div>


          ${
           x.link_url
            ? `
             <a
              class="departmentAttachment"
              href="${esc(x.link_url)}"
              target="_blank"
              rel="noopener"
             >

              <span class="departmentAttachmentIcon">
               ↗
              </span>

              <span>
               <small>ATTACHMENT / LINK</small>
               <strong>فتح المرفق أو الرابط</strong>
              </span>

              <i>←</i>

             </a>
            `
            : ''
          }


          <div class="departmentCardFooter">

           <div class="departmentCreator">

            <span class="departmentCreatorAvatar">
             ${esc(
              (x.created_by_name||'ر')
               .trim()
               .charAt(0)
               .toUpperCase()
             )}
            </span>

            <span>
             <small>رفع بواسطة</small>
             <strong>
              ${esc(x.created_by_name||'غير محدد')}
             </strong>
            </span>

           </div>


           ${
            isOwner ||
            (!isHR && x.department===me.department) ||
            (isHR && x.department===me.department)
             ? `
              <div class="departmentCardActions">

               <button
                class="departmentCardButton"
                type="button"
                onclick='departmentContentForm(
                 ${JSON.stringify(x).replaceAll("'","&#39;")}
                )'
               >
                تعديل
               </button>

               <button
                class="departmentCardButton danger"
                type="button"
                onclick="deleteDepartmentContent(${x.id})"
               >
                حذف
               </button>

              </div>
             `
             : ''
           }

          </div>


         </article>

        `).join('')}

       </div>

      `
      : `

       <div class="departmentEmptyState">

        <div class="departmentEmptyIcon">
         +
        </div>

        <span>
         EMPTY WORKSPACE
        </span>

        <strong>
         لا يوجد محتوى للقسم بعد
        </strong>

        <p>
         ${
          canEditDepartment
           ? 'ابدأ بإضافة أول عمل أو ملف إلى مساحة القسم.'
           : 'لم تتم إضافة محتوى إلى هذه المساحة حتى الآن.'
         }
        </p>

        ${
         canEditDepartment
          ? `
           <button
            class="btn green"
            onclick="departmentContentForm(
             '${esc(department||'')}'
            )"
           >
            إضافة أول محتوى
           </button>
          `
          : ''
        }

       </div>

      `
    }

   </section>


  </div>

 `;


 const filter=
  $('#departmentContentFilter');


 if(filter){

  filter.onchange=async e=>{

   selectedDepartment=
    e.target.value || 'all';

   await departmentWork();

  };

 }

}
window.departmentContentForm=item=>{

 closeDepartmentContentEditor();

 const editing=
  typeof item==='object' &&
  item &&
  item.id;

 const departments=[
  'الميداني',
  'إدارة الموارد البشرية (HR)',
  'الأكاديمي',
  'العلاقات العامة',
  'التقني',
  'رواق',
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


 const wrapper=
  document.createElement('div');

 wrapper.id='departmentContentEditor';
 wrapper.className='departmentEditorOverlay';


 wrapper.innerHTML=`

  <div
   class="departmentEditorBackdrop"
   onclick="closeDepartmentContentEditor()">
  </div>


  <aside class="departmentEditorDrawer">


   <header class="departmentEditorHeader">

    <div>

     <span class="departmentEditorCode">
      ROUH / CONTENT EDITOR
     </span>

     <h2>
      ${editing
       ? 'تعديل محتوى القسم'
       : 'إضافة محتوى جديد'}
     </h2>

     <p>
      ${
       editing
        ? 'حدّث بيانات المحتوى المحفوظ في مساحة القسم.'
        : 'أضف عملاً، مرجعاً أو رابطاً إلى مساحة القسم.'
      }
     </p>

    </div>


    <button
     type="button"
     class="departmentEditorClose"
     onclick="closeDepartmentContentEditor()"
     aria-label="إغلاق">
     ×
    </button>

   </header>


   <div class="departmentEditorContext">

    <div class="departmentEditorContextIcon">
     ${editing ? '✎' : '+'}
    </div>

    <div>
     <span>
      ${editing ? 'EDITING CONTENT' : 'NEW CONTENT'}
     </span>

     <strong>
      ${esc(
       department ||
       'اختر القسم'
      )}
     </strong>
    </div>

   </div>


   <form
    id="departmentContentForm"
    class="departmentEditorForm">


    <section class="departmentEditorSection">

     <div class="departmentEditorSectionTitle">

      <span>01</span>

      <div>
       <strong>القسم</strong>
       <small>
        مساحة العمل التي سيظهر فيها المحتوى
       </small>
      </div>

     </div>


     ${
      me.role==='owner'
       ? `
        <label class="departmentEditorField">

         <span>القسم</span>

         <select
          name="department"
          required>

          <option value="">
           اختر القسم
          </option>

          ${departments.map(x=>`
           <option
            value="${esc(x)}"
            ${department===x?'selected':''}
           >
            ${esc(x)}
           </option>
          `).join('')}

         </select>

        </label>
       `
       : `
        <input
         type="hidden"
         name="department"
         value="${esc(me.department||'')}">

        <div class="departmentEditorLocked">

         <span>القسم الحالي</span>

         <strong>
          ${esc(me.department||'غير محدد')}
         </strong>

         <i>محدد حسب صلاحية الحساب</i>

        </div>
       `
     }

    </section>


    <section class="departmentEditorSection">

     <div class="departmentEditorSectionTitle">

      <span>02</span>

      <div>
       <strong>بيانات المحتوى</strong>
       <small>
        العنوان والوصف الداخلي للعمل
       </small>
      </div>

     </div>


     <label class="departmentEditorField">

      <span>
       العنوان
       <b>مطلوب</b>
      </span>

      <input
       name="title"
       placeholder="مثال: خطة عمل الفريق للشهر القادم"
       value="${esc(editing?item.title:'')}"
       required>

     </label>


     <label class="departmentEditorField">

      <span>الوصف</span>

      <textarea
       name="description"
       rows="6"
       placeholder="اكتب وصفاً مختصراً للمحتوى أو العمل...">${esc(editing?item.description:'')}</textarea>

      <small class="departmentFieldHint">
       يمكنك ترك الوصف فارغاً إذا كان العنوان كافياً.
      </small>

     </label>

    </section>


    <section class="departmentEditorSection">

     <div class="departmentEditorSectionTitle">

      <span>03</span>

      <div>
       <strong>المرفق</strong>
       <small>
        رابط ملف، مستند أو عمل خارجي
       </small>
      </div>

     </div>


     <label class="departmentEditorField">

      <span>رابط الملف أو العمل</span>

      <div class="departmentUrlInput">

       <i>↗</i>

       <input
        name="link_url"
        type="url"
        placeholder="https://..."
        value="${esc(editing?item.link_url:'')}">

      </div>

      <small class="departmentFieldHint">
       اختياري — استخدم رابطاً يبدأ بـ https://
      </small>

     </label>

    </section>


    <div class="departmentEditorFooter">

     <button
      type="button"
      class="btn light"
      onclick="closeDepartmentContentEditor()">
      إلغاء
     </button>

     <button
      class="btn green departmentEditorSave"
      type="submit">

      <span>
       ${editing ? 'حفظ التعديلات' : 'إضافة المحتوى'}
      </span>

      <i>✓</i>

     </button>

    </div>


   </form>

  </aside>
 `;


 document.body.appendChild(wrapper);


 requestAnimationFrame(()=>{
  wrapper.classList.add('open');
 });


 const form=
  wrapper.querySelector(
   '#departmentContentForm'
  );


 form.onsubmit=async e=>{

  e.preventDefault();


  const submitButton=
   form.querySelector(
    '.departmentEditorSave'
   );


  const oldHTML=
   submitButton.innerHTML;


  submitButton.disabled=true;

  submitButton.innerHTML=`
   <span>جاري الحفظ...</span>
   <i class="departmentSavingDot"></i>
  `;


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


   closeDepartmentContentEditor();

   flash(
    editing
     ? 'تم تحديث محتوى القسم'
     : 'تم إضافة محتوى القسم'
   );


   setTimeout(()=>{
    departmentWork();
   },180);


  }catch(ex){

   submitButton.disabled=false;
   submitButton.innerHTML=oldHTML;

   flash(ex.message,true);

  }

 };


 const escapeHandler=e=>{

  if(
   e.key==='Escape' &&
   document.getElementById(
    'departmentContentEditor'
   )
  ){

   closeDepartmentContentEditor();

   document.removeEventListener(
    'keydown',
    escapeHandler
   );

  }

 };


 document.addEventListener(
  'keydown',
  escapeHandler
 );

};



window.closeDepartmentContentEditor=()=>{

 const wrapper=
  document.getElementById(
   'departmentContentEditor'
  );

 if(!wrapper)return;

 wrapper.classList.add('closing');
 wrapper.classList.remove('open');

 setTimeout(()=>{
  wrapper.remove();
 },260);

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


async function aiAssistant(){

 content.innerHTML=`

  <div class="rouhAiCenter">


   <section class="rouhAiHero">

    <div class="rouhAiHeroContent">

     <span class="rouhAiCode">
      ROUH / INTELLIGENCE
     </span>

     <h2>
      مساعد روح الذكي
     </h2>

     <p>
      مساحة ذكية لتحليل بيانات روح،
      تلخيص العمل، ومساعدتك في إعداد
      التقارير والمسودات.
     </p>


     <div class="rouhAiSafety">

      <span>
       <i></i>
       READ ONLY
      </span>

      <span>
       لا يعدّل بيانات النظام
      </span>

     </div>

    </div>


    <div class="rouhAiOrb">

     <div class="rouhAiOrbRing">

      <span>R</span>

     </div>

     <small>
      ROUH AI
     </small>

    </div>

   </section>


   <div class="rouhAiLayout">


    <aside class="rouhAiSidebar">


     <div class="rouhAiSideHead">

      <span>
       QUICK INTELLIGENCE
      </span>

      <h3>
       اختصارات ذكية
      </h3>

     </div>


     <button
      class="rouhAiQuick"
      type="button"
      data-q="اعطيني ملخص سريع عن وضع روح حاليًا">

      <span class="rouhAiQuickIcon">
       ◫
      </span>

      <div>
       <strong>
        ملخص روح
       </strong>
       <small>
        نظرة شاملة على الوضع الحالي
       </small>
      </div>

      <b>←</b>

     </button>


     <button
      class="rouhAiQuick"
      type="button"
      data-q="لخص لي وضع طلبات التطوع الحالية">

      <span class="rouhAiQuickIcon">
       ◇
      </span>

      <div>
       <strong>
        طلبات التطوع
       </strong>
       <small>
        تحليل الطلبات والحالات
       </small>
      </div>

      <b>←</b>

     </button>


     <button
      class="rouhAiQuick"
      type="button"
      data-q="لخص لي وضع المهام الحالية">

      <span class="rouhAiQuickIcon">
       ✓
      </span>

      <div>
       <strong>
        تحليل المهام
       </strong>
       <small>
        التقدم والمهام المتأخرة
       </small>
      </div>

      <b>←</b>

     </button>


     <button
      class="rouhAiQuick"
      type="button"
      data-q="هل توجد شكاوى تحتاج متابعة؟ لخصها بدون معلومات شخصية">

      <span class="rouhAiQuickIcon">
       !
      </span>

      <div>
       <strong>
        متابعة الشكاوى
       </strong>
       <small>
        الحالات التي تحتاج اهتمام
       </small>
      </div>

      <b>←</b>

     </button>


     <button
      id="aiServices"
      class="rouhAiServices"
      type="button">

      <span>✦</span>

      ماذا يستطيع مساعد روح؟

     </button>


     <div class="rouhAiPrivacy">

      <span>◉</span>

      <div>

       <strong>
        وضع القراءة فقط
       </strong>

       <small>
        المساعد يحلل ويقترح،
        لكنه لا يغيّر بيانات النظام.
       </small>

      </div>

     </div>


    </aside>


    <section class="rouhAiChatShell">


     <header class="rouhAiChatHeader">

      <div class="rouhAiAssistantIdentity">

       <div class="rouhAiMiniOrb">
        R
       </div>

       <div>

        <strong>
         مساعد روح
        </strong>

        <span>
         <i></i>
         متصل وجاهز للمساعدة
        </span>

       </div>

      </div>


      <div class="rouhAiMode">
       ROUH INTELLIGENCE
      </div>

     </header>


     <div
      id="aiChat"
      class="rouhAiChat">


      <div class="rouhAiWelcome">

       <div class="rouhAiWelcomeIcon">
        ✦
       </div>

       <span>
        ROUH AI ASSISTANT
       </span>

       <h3>
        أهلًا، كيف أقدر أساعدك؟
       </h3>

       <p>
        اسألني عن المتطوعين، المهام،
        الفعاليات، الإنجازات، الأفكار
        أو اطلب مني إعداد ملخص أو مسودة.
       </p>

      </div>


     </div>


     <form
      id="aiForm"
      class="rouhAiComposer">


      <div class="rouhAiInputWrap">

       <textarea
        id="aiMessage"
        rows="1"
        maxlength="2000"
        placeholder="اكتب سؤالك لمساعد روح..."
        required
       ></textarea>


       <button
        id="aiSend"
        type="submit"
        aria-label="إرسال">

        <span>↑</span>

       </button>

      </div>


      <div class="rouhAiComposerMeta">

       <span>
        ENTER للإرسال
      </span>

       <span>
        2000 حرف كحد أقصى
       </span>

      </div>


     </form>


    </section>


   </div>


  </div>

 `;


 const form=$('#aiForm');
 const input=$('#aiMessage');
 const chat=$('#aiChat');
 const sendBtn=$('#aiSend');
 const servicesBtn=$('#aiServices');


 const scrollChat=()=>{

  requestAnimationFrame(()=>{

   chat.scrollTo({
    top:chat.scrollHeight,
    behavior:'smooth'
   });

  });

 };


 const addUserMessage=(message)=>{

  chat.insertAdjacentHTML(
   'beforeend',
   `

    <div class="rouhAiMessage user">

     <div class="rouhAiMessageAvatar">
      أنت
     </div>

     <div class="rouhAiBubble">

      <span class="rouhAiMessageName">
       أنت
      </span>

      <div>
       ${esc(message)}
      </div>

     </div>

    </div>

   `
  );

  scrollChat();

 };


 const addAssistantMessage=(answer)=>{

  const box=
   document.createElement('div');

  box.className=
   'rouhAiMessage assistant';

  box.innerHTML=`

   <div class="rouhAiMessageAvatar">
    R
   </div>

   <div class="rouhAiBubble">

    <span class="rouhAiMessageName">
     مساعد روح
    </span>

    <div>
     ${
      esc(answer)
       .replace(
        /\*\*(.*?)\*\*/g,
        '<strong>$1</strong>'
       )
       .replace(
        /\n/g,
        '<br>'
       )
     }
    </div>

   </div>

  `;

  chat.appendChild(box);

  scrollChat();

 };


 document
  .querySelectorAll('.rouhAiQuick')
  .forEach(btn=>{

   btn.addEventListener(
    'click',
    ()=>{

     input.value=
      btn.dataset.q||'';

     input.focus();

     input.dispatchEvent(
      new Event('input')
     );

    }
   );

  });


 servicesBtn.addEventListener(
  'click',
  ()=>{

   addAssistantMessage(
`أقدر أساعدك في:

**المتطوعون:** تحليل العدد، الأقسام والحسابات الفعالة.

**طلبات التطوع:** تلخيص الحالات وتحليل الطلبات.

**المهام:** متابعة الجديدة، قيد التنفيذ، المكتملة والمتأخرة.

**الفعاليات والإنجازات:** تلخيص المحتوى وتحليل الأثر.

**الأفكار والشكاوى:** تحليل الحالات التي تحتاج متابعة حسب صلاحيتك.

**الأقسام:** تحليل البيانات والمحتوى المتاح لك.

**التقارير والكتابة:** إعداد ملخصات، تقارير، رسائل، إعلانات ومسودات.

أنا للقراءة والتحليل والاقتراح فقط، ولا أعدّل بيانات النظام.`
   );

  }
 );


 input.addEventListener(
  'input',
  ()=>{

   input.style.height='auto';

   input.style.height=
    Math.min(
     input.scrollHeight,
     130
    )+'px';

  }
 );


 input.addEventListener(
  'keydown',
  e=>{

   if(
    e.key==='Enter' &&
    !e.shiftKey
   ){

    e.preventDefault();

    if(
     input.value.trim() &&
     !sendBtn.disabled
    ){

     form.requestSubmit();

    }

   }

  }
 );


 form.addEventListener(
  'submit',
  async e=>{

   e.preventDefault();


   const message=
    input.value.trim();


   if(!message) return;


   addUserMessage(message);


   input.value='';
   input.style.height='auto';

   sendBtn.disabled=true;


   const thinking=
    document.createElement('div');

   thinking.className=
    'rouhAiMessage assistant thinking';

   thinking.innerHTML=`

    <div class="rouhAiMessageAvatar">
     R
    </div>

    <div class="rouhAiBubble">

     <span class="rouhAiMessageName">
      مساعد روح
     </span>

     <div class="rouhAiThinking">

      <i></i>
      <i></i>
      <i></i>

     </div>

    </div>

   `;


   chat.appendChild(thinking);

   scrollChat();


   try{

    const r=
     await fetch(
      '/api/admin/ai',
      {
       method:'POST',

       headers:{
        'Content-Type':
         'application/json'
       },

       body:JSON.stringify({
        message
       })
      }
     );


    const data=
     await r.json();


    thinking.remove();


    if(!r.ok){

     throw new Error(
      data.error||
      'تعذر تشغيل مساعد روح'
     );

    }


    addAssistantMessage(
     data.answer
    );


   }catch(err){

    thinking.remove();


    chat.insertAdjacentHTML(
     'beforeend',
     `

      <div class="rouhAiError">

       <span>!</span>

       ${esc(err.message)}

      </div>

     `
    );


    scrollChat();


   }finally{

    sendBtn.disabled=false;

    input.focus();

   }

  }
 );

}
window.restoreVolunteerAccount=async id=>{
 if(!confirm('هل تريد استعادة حساب هذا المتطوع؟')) return;

 try{
  const r=await api('/api/admin/volunteer-accounts/'+id+'/restore',{
   method:'POST'
  });

  flash(r.message || 'تم استرجاع حساب المتطوع');
  loadTab('trash');
 }catch(e){
  flash(e.message,true);
 }
};


window.deleteVolunteer=async id=>{
 if(!confirm('هل تريد نقل هذا المتطوع إلى سلة المحذوفات؟')) return;

 try{
  const r=await api('/api/admin/volunteers/'+id,{
   method:'DELETE'
  });

  flash(
   r.pendingApproval
    ? 'تم إرسال طلب الحذف للمالك'
    : (r.message || 'تم نقل المتطوع إلى سلة المحذوفات')
  );

  loadTab('volunteers');
 }catch(e){
  flash(e.message,true);
 }
};

window.restoreVolunteerApplication=async id=>{
 if(!confirm('هل تريد استعادة هذا المتطوع؟')) return;

 try{
  const r=await api(
   '/api/admin/trash/volunteer_application/'+id+'/restore',
   {method:'POST'}
  );

  flash(r.message || 'تم استعادة المتطوع');
  loadTab('trash');
 }catch(e){
  flash(e.message,true);
 }
};

window.permanentlyDeleteVolunteerApplication=async id=>{
 if(!confirm(
  'هل تريد إزالة هذا المتطوع نهائيًا؟\n\n' +
  'لا يمكن التراجع عن هذا الإجراء.'
 )) return;

 try{
  const r=await api(
   '/api/admin/trash/volunteer_application/'+id+'/permanent',
   {method:'DELETE'}
  );

  flash(r.message || 'تم حذف المتطوع نهائيًا');
  loadTab('trash');
 }catch(e){
  flash(e.message,true);
 }
};


/* ==================================================
   VOLUNTEERS V2
   ================================================== */

function initVolunteerTableV2(){

 const search=document.getElementById(
  'volunteerSearch'
 );

 const filter=document.getElementById(
  'volunteerStatusFilter'
 );

 const count=document.getElementById(
  'volunteerVisibleCount'
 );

 if(!search || !filter)return;


 function applyVolunteerFilters(){

  const query=
   search.value
    .trim()
    .toLowerCase();

  const state=filter.value;

  const rows=[
   ...document.querySelectorAll(
    '.volunteerTable tbody tr'
   )
  ];

  let visible=0;

  rows.forEach(row=>{

   const text=
    row.dataset.volunteerSearch || '';

   const rowState=
    row.dataset.volunteerState || '';

   const matchesSearch=
    !query ||
    text.includes(query);

   const matchesState=
    state==='all' ||
    rowState===state;

   const show=
    matchesSearch &&
    matchesState;

   row.classList.toggle(
    'volunteerRowHidden',
    !show
   );

   if(show)visible++;

  });

  if(count)
   count.textContent=visible;

 }


 search.addEventListener(
  'input',
  applyVolunteerFilters
 );

 filter.addEventListener(
  'change',
  applyVolunteerFilters
 );

}


/* ==================================================
   VOLUNTEERS V2
   ================================================== */

function initVolunteerTableV2(){

 const search=document.getElementById(
  'volunteerSearch'
 );

 const filter=document.getElementById(
  'volunteerStatusFilter'
 );

 const count=document.getElementById(
  'volunteerVisibleCount'
 );

 if(!search || !filter)return;


 function applyVolunteerFilters(){

  const query=
   search.value
    .trim()
    .toLowerCase();

  const state=filter.value;

  const rows=[
   ...document.querySelectorAll(
    '.volunteerTable tbody tr'
   )
  ];

  let visible=0;

  rows.forEach(row=>{

   const text=
    row.dataset.volunteerSearch || '';

   const rowState=
    row.dataset.volunteerState || '';

   const matchesSearch=
    !query ||
    text.includes(query);

   const matchesState=
    state==='all' ||
    rowState===state;

   const show=
    matchesSearch &&
    matchesState;

   row.classList.toggle(
    'volunteerRowHidden',
    !show
   );

   if(show)visible++;

  });

  if(count)
   count.textContent=visible;

 }


 search.addEventListener(
  'input',
  applyVolunteerFilters
 );

 filter.addEventListener(
  'change',
  applyVolunteerFilters
 );

}


/* ==================================================
   VOLUNTEER APPLICATION DRAWER
   ================================================== */

function closeVolunteerDrawer(){

 const drawer=document.getElementById(
  'volunteerApplicationDrawer'
 );

 if(!drawer)return;

 drawer.classList.add('closing');

 setTimeout(()=>{
  drawer.remove();
 },260);

}


function openVolunteerDrawer(encoded){

 let v;

 try{
  v=JSON.parse(
   decodeURIComponent(encoded)
  );
 }catch(e){
  return;
 }


 closeVolunteerDrawer();


 const statusText={
  pending:'قيد المراجعة',
  contacted:'تم التواصل معه',
  accepted:'مقبول',
  rejected:'مرفوض'
 };


 let state=
  statusText[v.status] ||
  v.status ||
  'غير محدد';


 let stateClass='review';


 if(
  v.status==='pending' &&
  v.contacted_at &&
  !v.department_approval
 ){
  state='تم التواصل معه';
  stateClass='contacted';
 }


 if(v.department_approval==='pending'){
  state='بانتظار موافقة القسم';
  stateClass='department';
 }


 if(v.department_approval==='accepted'){
  state='مقبول من القسم';
  stateClass='accepted';
 }


 if(v.department_approval==='rejected'){
  state='مرفوض من القسم';
  stateClass='rejected';
 }


 const accountState=
  v.volunteer_id && !v.volunteer_deleted_at
   ? (
      v.volunteer_active
       ? 'حساب فعال'
       : 'حساب معطل'
     )
   : 'لم ينشئ حسابًا';


 const accountClass=
  v.volunteer_id &&
  !v.volunteer_deleted_at &&
  v.volunteer_active
   ? 'active'
   : 'inactive';


 const wrapper=
  document.createElement('div');

 wrapper.id='volunteerApplicationDrawer';

 wrapper.className=
  'volunteerDrawerOverlay';


 wrapper.innerHTML=`

  <div class="volunteerDrawerBackdrop"
       onclick="closeVolunteerDrawer()">
  </div>


  <aside class="volunteerDrawer">

   <div class="volunteerDrawerTop">

    <div>

     <span class="drawerCode">
      VOLUNTEER PROFILE
     </span>

     <h2>
      ${esc(v.name || 'متطوع')}
     </h2>

     <p>
      طلب الانضمام إلى فريق مبادرة روح
     </p>

    </div>


    <button
     class="drawerClose"
     type="button"
     onclick="closeVolunteerDrawer()"
     aria-label="إغلاق">
     ×
    </button>

   </div>


   <div class="drawerIdentity">

    <div class="drawerAvatar">
     ${esc(
       (v.name || 'ر')
        .trim()
        .charAt(0)
        .toUpperCase()
     )}
    </div>

    <div>

     <strong>
      ${esc(v.name || '-')}
     </strong>

     <span>
      ${esc(v.major || 'التخصص غير محدد')}
     </span>

    </div>

   </div>


   <div class="drawerStatusRow">

    <span class="volunteerStatusBadge ${stateClass}">
     <i></i>
     ${esc(state)}
    </span>

    <span class="drawerAccountState ${accountClass}">
     ${esc(accountState)}
    </span>

   </div>


   <div class="drawerSection">

    <div class="drawerSectionTitle">
     <span>01</span>
     معلومات التواصل
    </div>


    <div class="drawerInfoGrid">

     <div class="drawerInfoCard">
      <small>البريد الإلكتروني</small>
      <strong>
       ${esc(v.email || '-')}
      </strong>
     </div>


     <div class="drawerInfoCard">
      <small>رقم الهاتف</small>
      <strong dir="ltr">
       ${esc(v.phone || '-')}
      </strong>
     </div>

    </div>

   </div>


   <div class="drawerSection">

    <div class="drawerSectionTitle">
     <span>02</span>
     المعلومات الأكاديمية
    </div>


    <div class="drawerInfoGrid three">

     <div class="drawerInfoCard">
      <small>التخصص</small>
      <strong>
       ${esc(v.major || '-')}
      </strong>
     </div>


     <div class="drawerInfoCard">
      <small>المستوى</small>
      <strong>
       ${esc(v.level || '-')}
      </strong>
     </div>


     <div class="drawerInfoCard">
      <small>المدينة</small>
      <strong>
       ${esc(v.city || '-')}
      </strong>
     </div>

    </div>

   </div>


   <div class="drawerSection">

    <div class="drawerSectionTitle">
     <span>03</span>
     رحلة الانضمام
    </div>


    <div class="drawerJourney">

     <div class="journeyStep done">
      <i>✓</i>
      <div>
       <strong>تم استلام الطلب</strong>
       <span>وصل الطلب إلى إدارة روح</span>
      </div>
     </div>


     <div class="journeyStep ${
       v.contacted_at ||
       v.status==='contacted' ||
       v.status==='accepted'
        ? 'done'
        : 'current'
     }">

      <i>
       ${
        v.contacted_at ||
        v.status==='contacted' ||
        v.status==='accepted'
         ? '✓'
         : '2'
       }
      </i>

      <div>
       <strong>التواصل مع المتطوع</strong>
       <span>
        ${
         v.contacted_at
          ? 'تم تسجيل التواصل'
          : 'بانتظار التواصل'
        }
       </span>
      </div>

     </div>


     <div class="journeyStep ${
       v.department_approval==='accepted'
        ? 'done'
        : v.department_approval==='pending'
          ? 'current'
          : ''
     }">

      <i>
       ${
        v.department_approval==='accepted'
         ? '✓'
         : '3'
       }
      </i>

      <div>
       <strong>موافقة القسم</strong>

       <span>
        ${
         v.department
          ? esc(v.department)
          : 'لم يتم تحديد القسم'
        }
       </span>
      </div>

     </div>


     <div class="journeyStep ${
       v.status==='accepted' &&
       v.department_approval==='accepted'
        ? 'done'
        : ''
     }">

      <i>
       ${
        v.status==='accepted' &&
        v.department_approval==='accepted'
         ? '✓'
         : '4'
       }
      </i>

      <div>
       <strong>الانضمام للفريق</strong>

       <span>
        ${
         v.volunteer_id
          ? 'تم إنشاء حساب المتطوع'
          : 'بانتظار إكمال الانضمام'
        }
       </span>
      </div>

     </div>

    </div>

   </div>


   <div class="drawerSection">

    <div class="drawerSectionTitle">
     <span>04</span>
     القسم
    </div>


    <div class="drawerDepartment">

     <span>القسم الحالي</span>

     <strong>
      ${
       v.department
        ? esc(v.department)
        : 'لم يحدد بعد'
      }
     </strong>

    </div>

   </div>


   <div class="drawerFooter">

    <button
     class="btn light"
     type="button"
     onclick="closeVolunteerDrawer()">
     إغلاق
    </button>

    ${
     v.volunteer_id &&
     !v.volunteer_deleted_at
      ? `
       <button
        class="btn green"
        type="button"
        onclick="
         closeVolunteerDrawer();
         viewVolunteerProfile(${Number(v.volunteer_id)})
        ">
        عرض الحساب الكامل
       </button>
      `
      : ''
    }

   </div>

  </aside>
 `;


 document.body.appendChild(wrapper);


 requestAnimationFrame(()=>{
  wrapper.classList.add('open');
 });


 const escHandler=e=>{

  if(e.key==='Escape'){

   closeVolunteerDrawer();

   document.removeEventListener(
    'keydown',
    escHandler
   );

  }

 };

 document.addEventListener(
  'keydown',
  escHandler
 );

}


window.openVolunteerDrawer=
 openVolunteerDrawer;

window.closeVolunteerDrawer=
 closeVolunteerDrawer;


/* ==================================================
   TASKS V2 INTERACTIONS
   ================================================== */

function initTasksV2(){

 const createToggle=
  document.getElementById(
   'taskCreateToggle'
  );

 const createBody=
  document.getElementById(
   'taskCreateBody'
  );

 const createChevron=
  document.getElementById(
   'taskCreateChevron'
  );


 if(
  createToggle &&
  createBody
 ){

  createToggle.onclick=()=>{

   const open=
    createBody.classList.toggle(
     'open'
    );

   createToggle.classList.toggle(
    'open',
    open
   );

   if(createChevron)
    createChevron.textContent=
     open ? '⌃' : '⌄';

  };

 }


 const archiveToggle=
  document.getElementById(
   'taskArchiveToggle'
  );

 const archiveBody=
  document.getElementById(
   'taskArchiveBody'
  );

 const archiveChevron=
  document.getElementById(
   'taskArchiveChevron'
  );


 if(
  archiveToggle &&
  archiveBody
 ){

  archiveToggle.onclick=()=>{

   const open=
    archiveBody.classList.toggle(
     'open'
    );

   archiveToggle.classList.toggle(
    'open',
    open
   );

   if(archiveChevron)
    archiveChevron.textContent=
     open ? '⌃' : '⌄';

  };

 }

}


function initApprovalCenterV2(){

 const buttons=[
  ...document.querySelectorAll(
   '[data-approval-filter]'
  )
 ];

 const cards=[
  ...document.querySelectorAll(
   '.approvalRequestCard'
  )
 ];

 const counter=
  document.getElementById(
   'approvalVisibleCount'
  );

 const empty=
  document.getElementById(
   'approvalFilterEmpty'
  );


 buttons.forEach(button=>{

  button.addEventListener('click',()=>{

   buttons.forEach(x=>
    x.classList.remove('active')
   );

   button.classList.add('active');


   const filter=
    button.dataset.approvalFilter;


   let visible=0;


   cards.forEach(card=>{

    const show=
     filter==='all' ||
     card.dataset.approvalStatus===
     filter;

    card.hidden=!show;

    if(show)visible++;

   });


   if(counter){
    counter.textContent=
     `${visible} طلب`;
   }


   if(empty){
    empty.hidden=
     visible!==0;
   }

  });

 });

}


/* ==================================================
   VOLUNTEER ACTION MENU V3
   ================================================== */

window.toggleVolunteerActionMenu=(event,button)=>{

 event.stopPropagation();

 const menu=
  button
   .closest('.volunteerActionMenuWrap')
   ?.querySelector('.volunteerActionMenu');

 if(!menu)return;


 const alreadyOpen=
  menu.classList.contains('open');


 closeVolunteerActionMenus();


 if(alreadyOpen)return;


 menu.classList.add('open');


 const rect=
  button.getBoundingClientRect();


 const menuWidth=270;

 let left=
  rect.right-menuWidth;


 if(left<12)
  left=12;


 if(left+menuWidth>
    window.innerWidth-12){

  left=
   window.innerWidth-
   menuWidth-
   12;

 }


 menu.style.position='fixed';
 menu.style.top=
  `${rect.bottom+7}px`;

 menu.style.left=
  `${left}px`;

 menu.style.right='auto';


 requestAnimationFrame(()=>{

  const menuRect=
   menu.getBoundingClientRect();


  if(
   menuRect.bottom>
   window.innerHeight-12
  ){

   menu.style.top=
    `${Math.max(
     12,
     rect.top-
     menuRect.height-
     7
    )}px`;

  }

 });

};


window.closeVolunteerActionMenus=()=>{

 document
  .querySelectorAll(
   '.volunteerActionMenu.open'
  )
  .forEach(menu=>
   menu.classList.remove('open')
  );

};


document.addEventListener('click',e=>{

 if(
  !e.target.closest(
   '.volunteerActionMenu'
  ) &&
  !e.target.closest(
   '.volunteerActionTrigger'
  )
 ){
  closeVolunteerActionMenus();
 }

});


window.addEventListener(
 'resize',
 closeVolunteerActionMenus
);


window.addEventListener(
 'scroll',
 closeVolunteerActionMenus,
 true
);
