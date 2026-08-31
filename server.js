const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const UPLOADS = path.join(PUBLIC, 'uploads');
const DATA = path.join(ROOT, 'data');
fs.mkdirSync(UPLOADS, { recursive: true });
fs.mkdirSync(DATA, { recursive: true });

const db = new DatabaseSync(path.join(DATA, 'rouh.db'));
db.exec(`
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 email TEXT UNIQUE NOT NULL,
 phone TEXT NOT NULL DEFAULT '',
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('owner','admin','editor')),
 active INTEGER NOT NULL DEFAULT 1,
 department TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS volunteers (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 application_id INTEGER NOT NULL UNIQUE,
 name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE,
 phone TEXT NOT NULL,
 password_hash TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(application_id) REFERENCES volunteer_applications(id)
);

CREATE TABLE IF NOT EXISTS sessions (
 token TEXT PRIMARY KEY,
 user_id INTEGER NOT NULL,
 expires_at TEXT NOT NULL,
 FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL,
 summary TEXT DEFAULT '',
 description TEXT DEFAULT '',
 event_date TEXT DEFAULT '',
 event_time TEXT DEFAULT '',
 location TEXT DEFAULT '',
 cover_image TEXT DEFAULT '',
 gallery TEXT DEFAULT '[]',
 registration_url TEXT DEFAULT '',
 event_state TEXT DEFAULT 'upcoming',
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
 deleted_at TEXT,
 created_by INTEGER,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS achievements (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL,
 achievement_date TEXT DEFAULT '',
 summary TEXT DEFAULT '',
 description TEXT DEFAULT '',
 cover_image TEXT DEFAULT '',
 gallery TEXT DEFAULT '[]',
 volunteers INTEGER DEFAULT 0,
 beneficiaries INTEGER DEFAULT 0,
 volunteer_hours INTEGER DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
 deleted_at TEXT,
 created_by INTEGER,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS faqs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 question TEXT NOT NULL,
 answer TEXT NOT NULL,
 sort_order INTEGER DEFAULT 0,
 active INTEGER DEFAULT 1,
 deleted_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS settings (
 key TEXT PRIMARY KEY,
 value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS stats (
 key TEXT PRIMARY KEY,
 value INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS ideas (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 contact TEXT NOT NULL,
 title TEXT NOT NULL,
 category TEXT DEFAULT '',
 description TEXT NOT NULL,
 problem TEXT DEFAULT '',
 expected_impact TEXT DEFAULT '',
 status TEXT NOT NULL DEFAULT 'new',
 admin_notes TEXT DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS complaints (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 phone TEXT NOT NULL,
 email TEXT NOT NULL,
 complaint TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'new',
 admin_notes TEXT DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS volunteer_applications (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE,
 phone TEXT NOT NULL,
 major TEXT DEFAULT '',
 level TEXT DEFAULT '',
 city TEXT DEFAULT '',
 status TEXT NOT NULL DEFAULT 'pending'
   CHECK(status IN ('pending','accepted','rejected')),
 accepted_at TEXT,
 rejected_at TEXT,
 invite_token TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS audit_log (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER,
 action TEXT NOT NULL,
 entity TEXT NOT NULL,
 entity_id TEXT,
 details TEXT DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

try {
 db.exec("ALTER TABLE volunteers ADD COLUMN department TEXT DEFAULT ''");
} catch(e) {
 if (!String(e.message).includes("duplicate column name")) throw e;
}

try {
 db.exec("ALTER TABLE volunteers ADD COLUMN deleted_at TEXT DEFAULT NULL");
} catch(e) {
 if (!String(e.message).includes("duplicate column name")) throw e;
}

try {
 db.exec("ALTER TABLE volunteer_applications ADD COLUMN department TEXT DEFAULT ''");
} catch(e) {
 if (!String(e.message).includes("duplicate column name")) throw e;
}

try {
 db.exec("ALTER TABLE volunteer_applications ADD COLUMN contacted_at TEXT DEFAULT NULL");
} catch(e) {
 if (!String(e.message).includes("duplicate column name")) throw e;
}

try {
 db.exec("ALTER TABLE volunteer_applications ADD COLUMN department_approval TEXT NOT NULL DEFAULT ''");
} catch(e) {
 if (!String(e.message).includes("duplicate column name")) throw e;
}

try {
 db.exec("ALTER TABLE volunteer_applications ADD COLUMN department_decided_at TEXT DEFAULT NULL");
} catch(e) {
 if (!String(e.message).includes("duplicate column name")) throw e;
}

try {
 db.exec("ALTER TABLE volunteer_applications ADD COLUMN department_decided_by INTEGER DEFAULT NULL");
} catch(e) {
 if (!String(e.message).includes("duplicate column name")) throw e;
}

const defaults = {
 initiative_name: 'مبادرة روح',
 tagline: 'نزرع الأثر… ونصنع التغيير.',
 hero_text: 'مبادرة شبابية تطوعية تسعى إلى تمكين الشباب، وتعزيز ثقافة العمل التطوعي، وتحويل الأفكار والمبادرات إلى أثر حقيقي ومستدام في المجتمع.',
 belief: 'نؤمن أن التغيير يبدأ من روحٍ تؤمن، وشخصٍ يبادر، وفريقٍ يعمل معًا.',
 about: 'مبادرة روح هي مبادرة شبابية تطوعية تهدف إلى إيجاد بيئة تجمع الشباب حول العمل التطوعي والمبادرات المجتمعية، وتمنحهم مساحة لاكتشاف قدراتهم، وتطوير مهاراتهم، وتحويل أفكارهم إلى مبادرات وأعمال تترك أثرًا إيجابيًا في المجتمع.',
 mission: 'أن نكون مساحة تجمع الشباب حول العمل التطوعي، وتمنحهم الفرصة للتعلم، والمشاركة، والتطوير، وصناعة أثر إيجابي في مجتمعهم.',
 vision: 'أن تصبح روح بيئة شبابية رائدة في العمل التطوعي وصناعة المبادرات، تسهم في تمكين الشباب وتحويل طاقاتهم وأفكارهم إلى أثر إيجابي ومستدام في المجتمع.',
 values_json: JSON.stringify([
  ['المبادرة','نؤمن أن التغيير يبدأ بخطوة، وأن كل شخص يستطيع أن يبدأ بصناعة الأثر.'],
  ['التعاون','الإنجاز الحقيقي يصنعه فريق يؤمن بهدف مشترك ويعمل معًا لتحقيقه.'],
  ['المسؤولية','نلتزم تجاه الفريق والمجتمع، ونسعى إلى أن يكون لكل عمل نقوم به قيمة وأثر.'],
  ['التطور','نعتبر كل تجربة فرصة للتعلم واكتساب مهارات وخبرات جديدة.'],
  ['الإبداع','نشجع الأفكار الجديدة ونمنح الشباب المساحة لتحويلها إلى مبادرات قابلة للتنفيذ.'],
  ['الاستدامة','نسعى إلى مبادرات تستمر نتائجها وتترك قيمة حقيقية.']
 ]),
 fields_json: JSON.stringify([
  ['العمل التطوعي والمجتمعي','تنظيم والمشاركة في الأنشطة التي تخدم المجتمع وتعزز ثقافة التطوع.'],
  ['التدريب والتطوير','ورش ودورات وتجارب تساعد أعضاء المبادرة على تطوير مهاراتهم الشخصية والعملية.'],
  ['المبادرات والأفكار','استقبال الأفكار الشبابية والعمل على تطوير المناسب منها إلى مبادرات قابلة للتنفيذ.'],
  ['الفعاليات','تنظيم فعاليات وأنشطة تجمع بين الفائدة والتفاعل والتعلم والعمل الجماعي.'],
  ['تمكين الشباب','مساعدة الشباب على اكتشاف مهاراتهم وقدراتهم وتوجيهها إلى المجال المناسب.']
 ]),
 join_intro: 'روح ليست مجرد مبادرة… روح هي مساحة لك لتكون جزءًا من شيء أكبر. إذا كنت تمتلك شغفًا بالتطوع، أو مهارة ترغب في تطويرها، أو فكرة تريد تحويلها إلى واقع، فنحن نرحب بك.',
 join_reasons_json: JSON.stringify(['فرصة للمشاركة في فعاليات ومبادرات متنوعة.','تطوير مهارات التواصل والعمل الجماعي.','اكتساب خبرات عملية.','التعرف على أشخاص يشاركونك الاهتمام بالتطوع.','المشاركة في صناعة أثر حقيقي.','الحصول على فرص للتدريب والتطوير.','اكتشاف قدراتك وتوظيفها في المكان المناسب.']),
 join_url: '/volunteer-register',
 email: 'rouhjadara@gmail.com',
 instagram: 'https://www.instagram.com/rouhjadara?igsi=aTBnaWhmdTBhcXA4',
 facebook: 'https://www.facebook.com/share/1JUpNSKiX7/?mibextid=wwXIfr',
 stats_visible: '0',
 footer_text: '© مبادرة روح — جميع الحقوق محفوظة.'
};
const insSetting = db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)');
for (const [k,v] of Object.entries(defaults)) insSetting.run(k,String(v));
for (const k of ['volunteers','events','hours','beneficiaries']) db.prepare('INSERT OR IGNORE INTO stats(key,value) VALUES(?,0)').run(k);
const faqCount = db.prepare('SELECT COUNT(*) c FROM faqs').get().c;
if (!faqCount) {
 const f = db.prepare('INSERT INTO faqs(question,answer,sort_order) VALUES(?,?,?)');
 [
  ['هل أحتاج إلى خبرة سابقة للانضمام؟','لا، لا يشترط وجود خبرة سابقة. الأهم هو الرغبة في التعلم والمشاركة والعمل ضمن الفريق.'],
  ['ماذا يحدث بعد تعبئة نموذج الانتساب؟','يتم الاطلاع على بياناتك واهتماماتك ومهاراتك، ثم التواصل معك وإرشادك إلى الخطوة التالية.'],
  ['هل أستطيع المشاركة إذا لم أمتلك مهارة محددة؟','نعم. روح مساحة لاكتشاف مهارات جديدة وتطويرها أيضًا.'],
  ['هل أستطيع اقتراح فكرة أو مبادرة؟','بالتأكيد. نرحب بالأفكار والمقترحات التي يمكن أن تسهم في صناعة أثر إيجابي.']
 ].forEach((x,i)=>f.run(x[0],x[1],i+1));
}

function send(res, code, data, type='application/json; charset=utf-8') {
 res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
 res.end(type.startsWith('application/json') ? JSON.stringify(data) : data);
}
function parseCookies(req){
 const out={}; (req.headers.cookie||'').split(';').forEach(p=>{const i=p.indexOf('='); if(i>0) out[p.slice(0,i).trim()]=decodeURIComponent(p.slice(i+1).trim())}); return out;
}
async function body(req){
 return await new Promise((resolve,reject)=>{let s=''; req.on('data',d=>{s+=d; if(s.length>12*1024*1024){reject(new Error('too large'));req.destroy();}}); req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(e)}}); req.on('error',reject)});
}
function hashPassword(password, salt=crypto.randomBytes(16).toString('hex')){
 const hash=crypto.scryptSync(password,salt,64).toString('hex'); return `${salt}:${hash}`;
}
function verifyPassword(password, stored){
 const [salt,hash]=stored.split(':'); const test=crypto.scryptSync(password,salt,64); const expected=Buffer.from(hash,'hex'); return expected.length===test.length && crypto.timingSafeEqual(expected,test);
}
function currentUser(req){
 const token=parseCookies(req).rouh_session;
 if(!token) return null;

 const row=db.prepare(`
  SELECT u.id,u.name,u.email,u.phone,u.role,u.department,u.active,s.expires_at
  FROM sessions s
  JOIN users u ON u.id=s.user_id
  WHERE s.token=?
 `).get(token);

 if(!row) return null;

 if(new Date(row.expires_at)<new Date()){
  db.prepare('DELETE FROM sessions WHERE token=?').run(token);
  return null;
 }

 if(!row.active)
  return {...row,suspended:true};

 return row;
}

function requireUser(req,res,roles=null){
 const u=currentUser(req);

 if(!u){
  send(res,401,{error:'يجب تسجيل الدخول'});
  return null;
 }

 if(u.suspended){
  send(res,403,{
   error:'حسابك موقوف من قِبل المالك',
   code:'ACCOUNT_SUSPENDED'
  });
  return null;
 }

 if(roles && !roles.includes(u.role)){
  send(res,403,{error:'لا تملك الصلاحية'});
  return null;
 }

 return u;
}
function audit(user,action,entity,entityId='',details=''){ db.prepare('INSERT INTO audit_log(user_id,action,entity,entity_id,details) VALUES(?,?,?,?,?)').run(user?.id||null,action,entity,String(entityId||''),details); }
function settingsObj(){ const o={}; for(const r of db.prepare('SELECT key,value FROM settings').all()) o[r.key]=r.value; return o; }
function statsObj(){ const o={}; for(const r of db.prepare('SELECT key,value FROM stats').all()) o[r.key]=r.value; return o; }
function safeJson(s,fallback=[]){ try{return JSON.parse(s)}catch{return fallback} }
function publicData(){
 const settings=settingsObj(); settings.values=safeJson(settings.values_json); settings.fields=safeJson(settings.fields_json); settings.join_reasons=safeJson(settings.join_reasons_json);
 const events=db.prepare("SELECT * FROM events WHERE deleted_at IS NULL AND status='published' ORDER BY event_date DESC,id DESC").all().map(r=>({...r,gallery:safeJson(r.gallery)}));
 const achievements=db.prepare("SELECT * FROM achievements WHERE deleted_at IS NULL AND status='published' ORDER BY achievement_date DESC,id DESC").all().map(r=>({...r,gallery:safeJson(r.gallery)}));
 const faqs=db.prepare('SELECT * FROM faqs WHERE deleted_at IS NULL AND active=1 ORDER BY sort_order,id').all();
 return {settings,stats:statsObj(),events,achievements,faqs};
}
function mime(file){ const ext=path.extname(file).toLowerCase(); return ({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.jpeg':'image/jpeg','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'}[ext]||'application/octet-stream'); }
function serveStatic(req,res){
 let url=decodeURIComponent(req.url.split('?')[0]); if(url==='/') url='/index.html'; if(url==='/admin') url='/admin.html'; if(url==='/volunteer-apply') url='/volunteer-apply.html'; if(url==='/volunteer-register') url='/volunteer-register.html'; if(url==='/volunteer-login') url='/volunteer-login.html'; if(url==='/volunteer-account') url='/volunteer-account.html';
 const file=path.normalize(path.join(PUBLIC,url)); if(!file.startsWith(PUBLIC)) return send(res,403,'Forbidden','text/plain');
 if(fs.existsSync(file)&&fs.statSync(file).isFile()){res.writeHead(200,{'Content-Type':mime(file)}); fs.createReadStream(file).pipe(res); return true;} return false;
}
function entityConfig(name){
 if(name==='events') return {table:'events',fields:['title','summary','description','event_date','event_time','location','cover_image','gallery','registration_url','event_state','status']};
 if(name==='achievements') return {table:'achievements',fields:['title','achievement_date','summary','description','cover_image','gallery','volunteers','beneficiaries','volunteer_hours','status']};
 return null;
}

const server=http.createServer(async (req,res)=>{
 try{
  const pathname=req.url.split('?')[0];
  if(pathname==='/api/public' && req.method==='GET') return send(res,200,publicData());
  if(pathname==='/api/setup/status' && req.method==='GET') return send(res,200,{needsSetup:db.prepare('SELECT COUNT(*) c FROM users').get().c===0});
  if(pathname==='/api/setup' && req.method==='POST'){
   if(db.prepare('SELECT COUNT(*) c FROM users').get().c>0) return send(res,409,{error:'تم إعداد الموقع مسبقًا'});
   const b=await body(req); if(!b.name||!b.email||!b.password||b.password.length<8) return send(res,400,{error:'أدخل الاسم والبريد وكلمة مرور من 8 أحرف على الأقل'});
   const r=db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,'owner')").run(b.name,b.email.toLowerCase(),hashPassword(b.password));
   audit({id:r.lastInsertRowid},'setup','user',r.lastInsertRowid,'إنشاء حساب المالك الأول'); return send(res,201,{ok:true});
  }
  if(pathname==='/api/login' && req.method==='POST'){
   const b=await body(req);
   const u=db.prepare('SELECT * FROM users WHERE email=?')
    .get(String(b.email||'').toLowerCase());

   if(!u || !verifyPassword(String(b.password||''),u.password_hash))
    return send(res,401,{error:'بيانات الدخول غير صحيحة'});

   if(!u.active)
    return send(res,403,{
     error:'⛔ حسابك موقوف من قِبل المالك. يرجى التواصل مع إدارة مبادرة روح.',
     code:'ACCOUNT_SUSPENDED'
    });
   const token=crypto.randomBytes(32).toString('hex'); const exp=new Date(Date.now()+7*86400000).toISOString(); db.prepare('INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)').run(token,u.id,exp);
   res.setHeader('Set-Cookie',`rouh_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${process.env.NODE_ENV==='production'?'; Secure':''}`); audit(u,'login','session',''); return send(res,200,{ok:true,user:{id:u.id,name:u.name,email:u.email,phone:u.phone,role:u.role,department:u.department}});
  }
  if(pathname==='/api/volunteer/login' && req.method==='POST'){
   const b=await body(req);

   const username=String(b.username||'').trim().toLowerCase();
   const password=String(b.password||'');

   if(!username || !password)
    return send(res,400,{error:'أدخل اسم المستخدم وكلمة المرور'});

   const v=db.prepare(`
    SELECT *
    FROM volunteers
    WHERE username=? AND active=1 AND deleted_at IS NULL
   `).get(username);

   if(!v || !verifyPassword(password,v.password_hash))
    return send(res,401,{error:'اسم المستخدم أو كلمة المرور غير صحيحة'});

   const token=crypto.randomBytes(32).toString('hex');
   const exp=new Date(Date.now()+7*86400000).toISOString();

   db.prepare(`
    CREATE TABLE IF NOT EXISTS volunteer_sessions (
     token TEXT PRIMARY KEY,
     volunteer_id INTEGER NOT NULL,
     expires_at TEXT NOT NULL,
     FOREIGN KEY(volunteer_id) REFERENCES volunteers(id)
    )
   `).run();

   db.prepare(`
    INSERT INTO volunteer_sessions(token,volunteer_id,expires_at)
    VALUES(?,?,?)
   `).run(token,v.id,exp);

   res.setHeader(
    'Set-Cookie',
    `rouh_volunteer_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${process.env.NODE_ENV==='production'?'; Secure':''}`
   );

   return send(res,200,{
    ok:true,
    volunteer:{
     id:v.id,
     name:v.name,
     username:v.username,
     email:v.email,
     phone:v.phone,
     department:v.department || ''
    }
   });
  }

  if(pathname==='/api/volunteer/me' && req.method==='GET'){
   const token=parseCookies(req).rouh_volunteer_session;

   if(!token)
    return send(res,200,{volunteer:null});

   const row=db.prepare(`
    SELECT v.id,v.name,v.email,v.phone,v.username,v.department
    FROM volunteer_sessions s
    JOIN volunteers v ON v.id=s.volunteer_id
    WHERE s.token=? AND s.expires_at>CURRENT_TIMESTAMP
      AND v.active=1
      AND v.deleted_at IS NULL
      AND v.deleted_at IS NULL
   `).get(token);

   if(!row)
    return send(res,200,{volunteer:null});

   return send(res,200,{volunteer:row});
  }

  if(pathname==='/api/volunteer/logout' && req.method==='POST'){
   const token=parseCookies(req).rouh_volunteer_session;

   if(token)
    db.prepare('DELETE FROM volunteer_sessions WHERE token=?').run(token);

   res.setHeader(
    'Set-Cookie',
    'rouh_volunteer_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'
   );

   return send(res,200,{ok:true});
  }

  if(pathname==='/api/logout' && req.method==='POST'){
   const token=parseCookies(req).rouh_session; const u=currentUser(req); if(token) db.prepare('DELETE FROM sessions WHERE token=?').run(token); res.setHeader('Set-Cookie','rouh_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'); if(u)audit(u,'logout','session',''); return send(res,200,{ok:true});
  }
  if(pathname==='/api/me' && req.method==='GET'){
   const u=currentUser(req);

   if(u && u.suspended)
    return send(res,200,{
     user:null,
     suspended:true,
     message:'⛔ حسابك موقوف من قِبل المالك. يرجى التواصل مع إدارة مبادرة روح.'
    });

   return send(res,200,{
    user:u?{
     id:u.id,
     name:u.name,
     email:u.email,
     phone:u.phone,
     role:u.role,
     department:u.department
    }:null
   });
  }



  if(pathname==='/api/volunteer/apply' && req.method==='POST'){
   const b=await body(req);

   const name=String(b.name||'').trim();
   const email=String(b.email||'').trim().toLowerCase();
   const phone=String(b.phone||'').trim();
   const major=String(b.major||'').trim();
   const level=String(b.level||'').trim();
   const city=String(b.city||'').trim();

   if(!name || !phone)
    return send(res,400,{error:'الاسم ورقم الهاتف مطلوبان'});

   const phoneDigits=phone.replace(/\D/g,'');

   if(phoneDigits.length<9)
    return send(res,400,{error:'رقم الهاتف غير صحيح'});

   const internalEmail=`phone-${phoneDigits}@volunteer.rouh.local`;

   const existing=db.prepare(`
    SELECT id,status
    FROM volunteer_applications
    WHERE email=?
   `).get(internalEmail);

   if(existing){
    if(existing.status==='rejected'){
     db.prepare(`
      UPDATE volunteer_applications
      SET name=?,
          phone=?,
          major=?,
          level=?,
          city=?,
          status='pending',
          department='',
          department_approval='',
          department_decided_at=NULL,
          department_decided_by=NULL,
          contacted_at=NULL,
          invite_token=NULL,
          accepted_at=NULL,
          rejected_at=NULL,
          whatsapp_sent_at=NULL,
          updated_at=CURRENT_TIMESTAMP
      WHERE id=?
     `).run(name,phone,major,level,city,existing.id);

     return send(res,200,{
      ok:true,
      existing:true,
      resubmitted:true,
      id:Number(existing.id)
     });
    }

    return send(res,409,{
     error:existing.status==='accepted'
      ? 'تم قبول طلبك مسبقًا بهذا الرقم'
      : 'لديك طلب قيد المراجعة بالفعل'
    });
   }

   const result=db.prepare(`
    INSERT INTO volunteer_applications
     (name,email,phone,major,level,city,status)
    VALUES
     (?,?,?,?,?,?,'pending')
   `).run(
    name,
    email || internalEmail,
    phone,
    major,
    level,
    city
   );

   return send(res,201,{
    ok:true,
    id:Number(result.lastInsertRowid)
   });
  }

  if(pathname==='/api/volunteer/form-submit' && req.method==='POST'){
   const b=await body(req);

   const secret=String(req.headers['x-rouh-secret']||'');
   const expected=String(process.env.VOLUNTEER_SYNC_SECRET||'');

   if(!expected || secret!==expected)
    return send(res,401,{error:'غير مصرح'});

   const name=String(b.name||'').trim();
   const phone=String(b.phone||'').trim();
   const major=String(b.major||'').trim();
   const level=String(b.level||'').trim();
   const city=String(b.city||'').trim();

   if(!name || !phone)
    return send(res,400,{error:'الاسم ورقم الهاتف مطلوبان'});

   const phoneDigits=phone.replace(/\D/g,'');

   if(phoneDigits.length<9)
    return send(res,400,{error:'رقم الهاتف غير صحيح'});

   const internalEmail=`phone-${phoneDigits}@volunteer.rouh.local`;

   const existing=db.prepare(`
    SELECT id,status
    FROM volunteer_applications
    WHERE email=?
   `).get(internalEmail);

   if(existing){
    if(existing.status==='rejected'){
     db.prepare(`
      UPDATE volunteer_applications
      SET name=?,
          phone=?,
          major=?,
          level=?,
          city=?,
          status='pending',
          department='',
          department_approval='',
          department_decided_at=NULL,
          department_decided_by=NULL,
          contacted_at=NULL,
          invite_token=NULL,
          accepted_at=NULL,
          rejected_at=NULL,
          whatsapp_sent_at=NULL,
          updated_at=CURRENT_TIMESTAMP
      WHERE id=?
     `).run(name,phone,major,level,city,existing.id);

     return send(res,200,{
      ok:true,
      existing:true,
      resubmitted:true,
      id:existing.id
     });
    }

    return send(res,409,{
     error:existing.status==='accepted'
      ? 'تم قبول طلبك مسبقًا، ولا يمكنك تقديم طلب جديد بنفس رقم الهاتف'
      : 'لديك طلب قيد المراجعة بالفعل بنفس رقم الهاتف'
    });
   }

   const result=db.prepare(`
    INSERT INTO volunteer_applications
     (name,email,phone,major,level,city,status)
    VALUES
     (?,?,?,?,?,?,'pending')
   `).run(
    name,
    internalEmail,
    phone,
    major,
    level,
    city
   );

   return send(res,201,{
    ok:true,
    id:Number(result.lastInsertRowid)
   });
  }

  if(pathname==='/api/volunteer/invite' && req.method==='GET'){
   const url=new URL(req.url,'http://localhost');
   const token=String(url.searchParams.get('token')||'').trim();

   if(!token)
    return send(res,400,{error:'رابط الدعوة غير صحيح'});

   const app=db.prepare(`
    SELECT id,name,email,phone,status,invite_token,department
    FROM volunteer_applications
    WHERE invite_token=?
   `).get(token);

   if(!app || app.status!=='accepted')
    return send(res,404,{error:'رابط الدعوة غير صالح أو لم يعد متاحًا'});

   const existing=db.prepare(
    'SELECT id FROM volunteers WHERE application_id=?'
   ).get(app.id);

   if(existing)
    return send(res,409,{error:'تم إنشاء حساب لهذا المتطوع مسبقًا'});

   return send(res,200,{
    ok:true,
    volunteer:{
     name:app.name,
     phone:app.phone,
     department:app.department || ''
    }
   });
  }

  if(pathname==='/api/volunteer/register' && req.method==='POST'){
   const b=await body(req);

   const token=String(b.token||'').trim();
   const username=String(b.username||'').trim().toLowerCase();
   const password=String(b.password||'');

   if(!token)
    return send(res,400,{error:'رابط الدعوة غير صحيح'});

   if(!/^[a-z0-9_]{3,30}$/.test(username))
    return send(res,400,{error:'اسم المستخدم يجب أن يكون 3-30 حرفًا، ويحتوي على أحرف إنجليزية أو أرقام أو _ فقط'});

   if(password.length<8)
    return send(res,400,{error:'كلمة المرور يجب أن تكون 8 أحرف على الأقل'});

   const app=db.prepare(`
    SELECT *
    FROM volunteer_applications
    WHERE invite_token=?
   `).get(token);

   if(!app || app.status!=='accepted')
    return send(res,404,{error:'رابط الدعوة غير صالح أو لم يعد متاحًا'});

   const existing=db.prepare(
    'SELECT id FROM volunteers WHERE application_id=? OR phone=?'
   ).get(app.id,app.phone);

   if(existing)
    return send(res,409,{error:'تم إنشاء حساب لهذا المتطوع مسبقًا'});

   const usernameExists=db.prepare(
    'SELECT id FROM volunteers WHERE username=?'
   ).get(username);

   if(usernameExists)
    return send(res,409,{error:'اسم المستخدم مستخدم مسبقًا، اختر اسمًا آخر'});

   try{
    const result=db.prepare(`
     INSERT INTO volunteers(
      application_id,
      name,
      email,
      phone,
      password_hash,
      username,
      department
     )
     VALUES(?,?,?,?,?,?,?)
    `).run(
     app.id,
     app.name,
     app.email || `phone-${String(app.phone).replace(/\D/g,'')}@volunteer.rouh.local`,
     app.phone,
     hashPassword(password),
     username,
     app.department || ''
    );

    db.prepare(`
     UPDATE volunteer_applications
     SET invite_token=NULL,
         updated_at=CURRENT_TIMESTAMP
     WHERE id=?
    `).run(app.id);

    const sessionToken=crypto.randomBytes(32).toString('hex');
    const sessionExp=new Date(Date.now()+7*86400000).toISOString();

    db.prepare(`
     CREATE TABLE IF NOT EXISTS volunteer_sessions (
      token TEXT PRIMARY KEY,
      volunteer_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY(volunteer_id) REFERENCES volunteers(id)
     )
    `).run();

    db.prepare(`
     INSERT INTO volunteer_sessions(token,volunteer_id,expires_at)
     VALUES(?,?,?)
    `).run(sessionToken,Number(result.lastInsertRowid),sessionExp);

    res.setHeader(
     'Set-Cookie',
     `rouh_volunteer_session=${sessionToken}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${process.env.NODE_ENV==='production'?'; Secure':''}`
    );

    return send(res,201,{
     ok:true,
     volunteer:{
      id:Number(result.lastInsertRowid),
      name:app.name,
      email:app.email,
      phone:app.phone,
      username
     }
    });

   }catch(e){
    console.error(e);
    return send(res,409,{error:'تعذر إنشاء الحساب'});
   }
  }

  if(pathname==='/api/ideas' && req.method==='POST'){
   const b=await body(req);

   const name=String(b.name||'').trim();
   const contact=String(b.contact||'').trim();
   const title=String(b.title||'').trim();
   const category=String(b.category||'').trim();
   const description=String(b.description||'').trim();
   const problem=String(b.problem||'').trim();
   const expectedImpact=String(b.expected_impact||'').trim();

   if(!name||!contact||!title||!description)
    return send(res,400,{error:'الاسم ووسيلة التواصل وعنوان الفكرة ووصفها مطلوبة'});

   if(name.length>100||contact.length>150||title.length>150||description.length>3000||problem.length>2000||expectedImpact.length>2000)
    return send(res,400,{error:'بعض البيانات أطول من الحد المسموح'});

   const r=db.prepare(`INSERT INTO ideas
    (name,contact,title,category,description,problem,expected_impact)
    VALUES(?,?,?,?,?,?,?)`)
    .run(name,contact,title,category,description,problem,expectedImpact);

   return send(res,201,{
    ok:true,
    id:r.lastInsertRowid,
    message:'تم استلام فكرتك بنجاح'
   });
  }


  if(pathname==='/api/complaints' && req.method==='POST'){
   const b=await body(req);

   const name=String(b.name||'').trim();
   const phone=String(b.phone||'').trim();
   const email=String(b.email||'').trim().toLowerCase();
   const complaint=String(b.complaint||'').trim();

   if(!name||!phone||!email||!complaint)
    return send(res,400,{error:'الاسم ورقم الهاتف والبريد الإلكتروني والشكوى مطلوبة'});

   if(!email.includes('@'))
    return send(res,400,{error:'يرجى إدخال بريد إلكتروني صحيح'});

   if(name.length>100||phone.length>30||email.length>150||complaint.length>5000)
    return send(res,400,{error:'بعض البيانات أطول من الحد المسموح'});

   const r=db.prepare(`
    INSERT INTO complaints(name,phone,email,complaint)
    VALUES(?,?,?,?)
   `).run(name,phone,email,complaint);

   return send(res,201,{
    ok:true,
    id:r.lastInsertRowid,
    message:'تم استلام شكواك بنجاح'
   });
  }


  if(pathname==='/api/volunteer/department' && req.method==='GET'){
   const token=parseCookies(req).rouh_volunteer_session;

   if(!token)
    return send(res,401,{error:'يجب تسجيل الدخول'});

   const volunteer=db.prepare(`
    SELECT v.id,v.name,v.department
    FROM volunteer_sessions s
    JOIN volunteers v ON v.id=s.volunteer_id
    WHERE s.token=?
      AND s.expires_at>CURRENT_TIMESTAMP
      AND v.active=1
   `).get(token);

   if(!volunteer)
    return send(res,401,{error:'انتهت الجلسة'});

   const department=String(volunteer.department||'').trim();

   if(!department)
    return send(res,200,{
     department:'',
     admins:[],
     items:[]
    });

   const admins=db.prepare(`
    SELECT id,name
    FROM users
    WHERE role='admin'
      AND active=1
      AND department=?
    ORDER BY name
   `).all(department);

   const items=db.prepare(`
    SELECT dc.id,
           dc.title,
           dc.description,
           dc.link_url,
           dc.created_at,
           u.name created_by_name
    FROM department_content dc
    LEFT JOIN users u ON u.id=dc.created_by
    WHERE dc.department=?
      AND dc.deleted_at IS NULL
    ORDER BY dc.id DESC
   `).all(department);

   return send(res,200,{
    department,
    admins,
    items
   });
  }

  if(pathname.startsWith('/api/admin/')){
   const user=requireUser(req,res); if(!user) return;

   if(pathname==='/api/admin/department-content' && req.method==='GET'){
    if(!['owner','admin'].includes(user.role))
     return send(res,403,{error:'لا تملك الصلاحية'});

    const urlObj=new URL(req.url,'http://localhost');
    let department=String(urlObj.searchParams.get('department')||'').trim();

    const isHRAdmin=
     user.role==='admin' &&
     user.department==='إدارة الموارد البشرية (HR)';

    if(user.role!=='owner' && !isHRAdmin)
     department=user.department || '';

    let items;

    if((user.role==='owner' || isHRAdmin) && !department){
     items=db.prepare(`
      SELECT dc.*,
             u.name created_by_name
      FROM department_content dc
      LEFT JOIN users u ON u.id=dc.created_by
      WHERE dc.deleted_at IS NULL
      ORDER BY dc.id DESC
     `).all();
    }else{
     items=db.prepare(`
      SELECT dc.*,
             u.name created_by_name
      FROM department_content dc
      LEFT JOIN users u ON u.id=dc.created_by
      WHERE dc.department=?
        AND dc.deleted_at IS NULL
      ORDER BY dc.id DESC
     `).all(department);
    }

    return send(res,200,{items});
   }

   if(pathname==='/api/admin/department-content' && req.method==='POST'){
    if(!['owner','admin'].includes(user.role))
     return send(res,403,{error:'لا تملك الصلاحية'});

    const b=await body(req);

    const title=String(b.title||'').trim();
    const description=String(b.description||'').trim();
    const linkUrl=String(b.link_url||'').trim();

    let department=user.role==='owner'
     ? String(b.department||'').trim()
     : String(user.department||'').trim();

    if(!department)
     return send(res,400,{error:'يجب تحديد القسم'});

    if(!title)
     return send(res,400,{error:'عنوان المحتوى مطلوب'});

    const r=db.prepare(`
     INSERT INTO department_content
      (department,title,description,link_url,created_by)
     VALUES(?,?,?,?,?)
    `).run(
     department,
     title,
     description,
     linkUrl,
     user.id
    );

    audit(
     user,
     'create',
     'department_content',
     r.lastInsertRowid,
     department+' - '+title
    );

    return send(res,201,{
     ok:true,
     id:Number(r.lastInsertRowid)
    });
   }

   const departmentContentMatch=
    pathname.match(/^\/api\/admin\/department-content\/(\d+)$/);

   if(departmentContentMatch){
    const id=departmentContentMatch[1];

    const item=db.prepare(`
     SELECT *
     FROM department_content
     WHERE id=?
       AND deleted_at IS NULL
    `).get(id);

    if(!item)
     return send(res,404,{error:'المحتوى غير موجود'});

    const canManage=
     user.role==='owner' ||
     (
      user.role==='admin' &&
      item.department===user.department
     );

    if(!canManage)
     return send(res,403,{error:'لا يمكنك إدارة محتوى قسم آخر'});

    if(req.method==='PUT'){
     const b=await body(req);

     const title=String(b.title??item.title).trim();
     const description=String(
      b.description??item.description
     ).trim();
     const linkUrl=String(
      b.link_url??item.link_url
     ).trim();

     if(!title)
      return send(res,400,{error:'عنوان المحتوى مطلوب'});

     db.prepare(`
      UPDATE department_content
      SET title=?,
          description=?,
          link_url=?,
          updated_at=CURRENT_TIMESTAMP
      WHERE id=?
     `).run(
      title,
      description,
      linkUrl,
      id
     );

     audit(
      user,
      'update',
      'department_content',
      id,
      item.department+' - '+title
     );

     return send(res,200,{ok:true});
    }

    if(req.method==='DELETE'){
     if(user.role!=='owner'){
      const existing=db.prepare(`
       SELECT id FROM deletion_requests
       WHERE entity_type='department_content'
         AND entity_id=?
         AND status='pending'
      `).get(id);

      if(existing)
       return send(res,409,{error:'يوجد طلب حذف بانتظار موافقة المالك بالفعل'});

      const r=db.prepare(`
       INSERT INTO deletion_requests
        (requester_id,requester_department,entity_type,entity_id,item_title)
       VALUES(?,?,?,?,?)
      `).run(
       user.id,
       user.department||item.department||'',
       'department_content',
       id,
       item.title||''
      );

      audit(user,'request_delete','department_content',id,item.title||'');

      return send(res,200,{
       ok:true,
       pendingApproval:true,
       requestId:Number(r.lastInsertRowid),
       message:'تم إرسال طلب الحذف للمالك'
      });
     }

     db.prepare(`
      UPDATE department_content
      SET deleted_at=CURRENT_TIMESTAMP,
          updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND deleted_at IS NULL
     `).run(id);

     audit(
      user,
      'trash',
      'department_content',
      id,
      item.department+' - '+item.title
     );

     return send(res,200,{ok:true,pendingApproval:false});
    }
   }


   if(pathname==='/api/admin/complaints' && req.method==='GET'){
    const canAccessComplaints=
     user.role==='owner' ||
     (
      user.role==='admin' &&
      user.department==='إدارة الموارد البشرية (HR)'
     );

    if(!canAccessComplaints)
     return send(res,403,{error:'الشكاوى متاحة للمالك والموارد البشرية فقط'});

    const items=db.prepare(`
     SELECT *
     FROM complaints
     ORDER BY
      CASE status
       WHEN 'new' THEN 1
       WHEN 'reviewing' THEN 2
       WHEN 'handled' THEN 3
       WHEN 'closed' THEN 4
       ELSE 5
      END,
      id DESC
    `).all();

    return send(res,200,{items});
   }

   const complaintMatch=pathname.match(/^\/api\/admin\/complaints\/(\d+)$/);

   if(complaintMatch && req.method==='PUT'){
    const canAccessComplaints=
     user.role==='owner' ||
     (
      user.role==='admin' &&
      user.department==='إدارة الموارد البشرية (HR)'
     );

    if(!canAccessComplaints)
     return send(res,403,{error:'الشكاوى متاحة للمالك والموارد البشرية فقط'});

    const id=complaintMatch[1];
    const b=await body(req);

    const allowed=['new','reviewing','handled','closed'];
    if(!allowed.includes(b.status))
     return send(res,400,{error:'حالة الشكوى غير صحيحة'});

    const item=db.prepare('SELECT * FROM complaints WHERE id=?').get(id);
    if(!item)
     return send(res,404,{error:'الشكوى غير موجودة'});

    const notes=String(b.admin_notes||'').trim();

    db.prepare(`
     UPDATE complaints
     SET status=?,admin_notes=?,updated_at=CURRENT_TIMESTAMP
     WHERE id=?
    `).run(b.status,notes,id);

    audit(user,'update','complaint',id,b.status);

    return send(res,200,{ok:true});
   }

   if(pathname==='/api/admin/ideas' && req.method==='GET'){
    if(user.role!=='owner')
     return send(res,403,{error:'الأفكار متاحة للمالك فقط'});

    const items=db.prepare('SELECT * FROM ideas ORDER BY id DESC').all();
    return send(res,200,{items});
   }

   const ideaMatch=pathname.match(/^\/api\/admin\/ideas\/(\d+)$/);
   if(ideaMatch && req.method==='PUT'){
    if(user.role!=='owner')
     return send(res,403,{error:'إدارة الأفكار من صلاحية المالك فقط'});

    const id=ideaMatch[1];
    const b=await body(req);

    const allowed=['new','reviewing','accepted','rejected','implemented'];
    const status=allowed.includes(b.status)?b.status:'new';
    const notes=String(b.admin_notes||'').trim();

    const item=db.prepare('SELECT * FROM ideas WHERE id=?').get(id);
    if(!item) return send(res,404,{error:'الفكرة غير موجودة'});

    db.prepare('UPDATE ideas SET status=?,admin_notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(status,notes,id);

    audit(user,'update','idea',id,status);
    return send(res,200,{ok:true});
   }



   function canManageVolunteer(user,item){
    if(user.role==='owner') return true;

    const isHRAdmin=
     user.role==='admin' &&
     user.department==='إدارة الموارد البشرية (HR)';

    if(isHRAdmin) return true;

    return (
     user.role==='admin' &&
     item &&
     item.department===user.department
    );
   }

   // Volunteer applications - Owner/Admin only
   if(pathname==='/api/admin/volunteers' && req.method==='GET'){
    const isHRAdmin=
     user.role==='admin' &&
     user.department==='إدارة الموارد البشرية (HR)';

    let items;

    if(user.role==='owner' || isHRAdmin){
     items=db.prepare(`
      SELECT
       va.*,
       v.id AS volunteer_id,
       v.username AS volunteer_username,
       v.active AS volunteer_active,
       v.deleted_at AS volunteer_deleted_at,
       CASE
        WHEN EXISTS (
         SELECT 1
         FROM users u
         WHERE u.phone != ''
          AND REPLACE(REPLACE(REPLACE(u.phone,' ',''),'-',''),'+','')
              = REPLACE(REPLACE(REPLACE(va.phone,' ',''),'-',''),'+','')
          AND u.active=1
          AND u.role IN ('owner','admin')
        ) THEN 1
        ELSE 0
       END AS is_admin_user
      FROM volunteer_applications va
      LEFT JOIN volunteers v
       ON v.application_id=va.id
      ORDER BY
       CASE va.status
        WHEN 'pending' THEN 1
        WHEN 'accepted' THEN 2
        WHEN 'rejected' THEN 3
        ELSE 4
       END,
       va.id DESC
     `).all();
    }else{
     items=db.prepare(`
      SELECT
       va.*,
       v.id AS volunteer_id,
       v.username AS volunteer_username,
       v.active AS volunteer_active,
       v.deleted_at AS volunteer_deleted_at,
       CASE
        WHEN EXISTS (
         SELECT 1
         FROM users u
         WHERE u.phone != ''
          AND REPLACE(REPLACE(REPLACE(u.phone,' ',''),'-',''),'+','')
              = REPLACE(REPLACE(REPLACE(va.phone,' ',''),'-',''),'+','')
          AND u.active=1
          AND u.role IN ('owner','admin')
        ) THEN 1
        ELSE 0
       END AS is_admin_user
      FROM volunteer_applications va
      LEFT JOIN volunteers v
       ON v.application_id=va.id
      WHERE va.department=?
      ORDER BY
       CASE va.status
        WHEN 'pending' THEN 1
        WHEN 'accepted' THEN 2
        WHEN 'rejected' THEN 3
        ELSE 4
       END,
       va.id DESC
     `).all(user.department||'');
    }

    if(user.role!=='owner' && !isHRAdmin){
     items=items.map(item=>({
      ...item,
      invite_token:null,
      whatsapp_sent_at:null
     }));
    }

    return send(res,200,{items});
   }

   const volunteerMatch=pathname.match(/^\/api\/admin\/volunteers\/(\d+)$/);

   if(volunteerMatch && req.method==='PUT'){
    if(!['owner','admin'].includes(user.role))
     return send(res,403,{error:'لا تملك الصلاحية'});

    const id=volunteerMatch[1];
    const b=await body(req);

    const allowedActions=[
     'contacted',
     'route_to_department',
     'department_accepted',
     'department_rejected',
     'cancel_department_acceptance',
     'rejected'
    ];

    if(!allowedActions.includes(b.status))
     return send(res,400,{error:'حالة الطلب غير صحيحة'});

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

    const item=db.prepare(
     'SELECT * FROM volunteer_applications WHERE id=?'
    ).get(id);

    if(!item)
     return send(res,404,{error:'طلب المتطوع غير موجود'});

    const isHRAdmin=
     user.role==='admin' &&
     user.department==='إدارة الموارد البشرية (HR)';

    const isOwnerOrHR=
     user.role==='owner' || isHRAdmin;

    if(b.status==='contacted'){
     if(!isOwnerOrHR)
      return send(res,403,{error:'التواصل الأولي من صلاحية المالك أو HR فقط'});

     db.prepare(`
      UPDATE volunteer_applications
      SET status='pending',
          contacted_at=CURRENT_TIMESTAMP,
          updated_at=CURRENT_TIMESTAMP
      WHERE id=?
     `).run(id);

     audit(user,'update','volunteer_application',id,'contacted');

     return send(res,200,{
      ok:true,
      status:'contacted'
     });
    }

    if(b.status==='route_to_department'){
     if(!isOwnerOrHR)
      return send(res,403,{error:'توجيه المتطوع للأقسام من صلاحية المالك أو HR فقط'});

     const department=String(b.department||'').trim();

     if(!departments.includes(department))
      return send(res,400,{error:'يجب اختيار قسم صحيح'});

     db.prepare(`
      UPDATE volunteer_applications
      SET status='pending',
          department=?,
          department_approval='pending',
          department_decided_at=NULL,
          department_decided_by=NULL,
          accepted_at=NULL,
          rejected_at=NULL,
          invite_token=NULL,
          updated_at=CURRENT_TIMESTAMP
      WHERE id=?
     `).run(department,id);

     audit(
      user,
      'update',
      'volunteer_application',
      id,
      'route_to_department:'+department
     );

     return send(res,200,{
      ok:true,
      status:'contacted',
      department,
      department_approval:'pending'
     });
    }

    if(
     b.status==='department_accepted' ||
     b.status==='department_rejected'
    ){
     if(item.department_approval!=='pending')
      return send(res,400,{error:'هذا الطلب ليس بانتظار موافقة القسم'});

     const canDepartmentDecide =
      user.role==='owner' ||
      (
       user.role==='admin' &&
       item.department===user.department
      );

     if(!canDepartmentDecide)
      return send(res,403,{error:'هذا الطلب تابع لقسم آخر'});

     if(b.status==='department_accepted'){
      const inviteToken=crypto.randomBytes(32).toString('hex');

      db.prepare(`
       UPDATE volunteer_applications
       SET status='accepted',
           department_approval='accepted',
           department_decided_at=CURRENT_TIMESTAMP,
           department_decided_by=?,
           accepted_at=CURRENT_TIMESTAMP,
           rejected_at=NULL,
           invite_token=?,
           updated_at=CURRENT_TIMESTAMP
       WHERE id=?
      `).run(user.id,inviteToken,id);

      audit(
       user,
       'update',
       'volunteer_application',
       id,
       'department_accepted'
      );

      return send(res,200,{
       ok:true,
       status:'accepted',
       department_approval:'accepted'
      });
     }

     db.prepare(`
      UPDATE volunteer_applications
      SET status='pending',
          department_approval='rejected',
          department_decided_at=CURRENT_TIMESTAMP,
          department_decided_by=?,
          rejected_at=NULL,
          accepted_at=NULL,
          invite_token=NULL,
          whatsapp_sent_at=NULL,
          updated_at=CURRENT_TIMESTAMP
      WHERE id=?
     `).run(user.id,id);

     audit(
      user,
      'update',
      'volunteer_application',
      id,
      'department_rejected'
     );

     return send(res,200,{
      ok:true,
      status:'pending',
      department_approval:'rejected'
     });
    }

    if(b.status==='cancel_department_acceptance'){
     const canCancelAcceptance =
      user.role==='owner' ||
      isHRAdmin ||
      (
       user.role==='admin' &&
       item.department===user.department
      );

     if(!canCancelAcceptance)
      return send(res,403,{error:'لا تملك صلاحية إلغاء هذا القبول'});

     if(
      item.status!=='accepted' ||
      item.department_approval!=='accepted'
     )
      return send(res,400,{error:'المتطوع ليس مقبولًا من القسم'});

     const volunteerAccount=db.prepare(
      'SELECT id FROM volunteers WHERE application_id=?'
     ).get(id);

     if(volunteerAccount)
      return send(res,400,{
       error:'المتطوع أنشأ حسابه بالفعل، عطّل الحساب أولًا'
      });

     db.prepare(`
      UPDATE volunteer_applications
      SET status='pending',
          department_approval='rejected',
          department_decided_at=CURRENT_TIMESTAMP,
          department_decided_by=?,
          accepted_at=NULL,
          rejected_at=NULL,
          invite_token=NULL,
          whatsapp_sent_at=NULL,
          updated_at=CURRENT_TIMESTAMP
      WHERE id=?
     `).run(user.id,id);

     audit(
      user,
      'update',
      'volunteer_application',
      id,
      'cancel_department_acceptance'
     );

     return send(res,200,{
      ok:true,
      status:'pending',
      department_approval:'rejected'
     });
    }

    if(b.status==='rejected'){
     if(!isOwnerOrHR)
      return send(res,403,{error:'الرفض قبل التوجيه من صلاحية المالك أو HR فقط'});

     db.prepare(`
      UPDATE volunteer_applications
      SET status='rejected',
          department_approval='',
          rejected_at=CURRENT_TIMESTAMP,
          accepted_at=NULL,
          invite_token=NULL,
          updated_at=CURRENT_TIMESTAMP
      WHERE id=?
     `).run(id);

     audit(
      user,
      'update',
      'volunteer_application',
      id,
      'rejected'
     );

     return send(res,200,{
      ok:true,
      status:'rejected'
     });
    }
   }

   const volunteerDeleteMatch=pathname.match(/^\/api\/admin\/volunteers\/(\d+)$/);

   if(volunteerDeleteMatch && req.method==='DELETE'){
    if(!['owner','admin'].includes(user.role))
     return send(res,403,{error:'لا تملك الصلاحية'});

    const id=volunteerDeleteMatch[1];

    const item=db.prepare(`
     SELECT *
     FROM volunteer_applications
     WHERE id=?
    `).get(id);

    if(!item)
     return send(res,404,{error:'طلب المتطوع غير موجود'});

    if(!canManageVolunteer(user,item))
     return send(res,403,{error:'لا يمكنك إدارة متطوع من قسم آخر'});

    const account=db.prepare(`
     SELECT id
     FROM volunteers
     WHERE application_id=?
    `).get(id);

    if(account)
     return send(res,409,{
      error:'لا يمكن حذف الطلب لأن المتطوع لديه حساب فعليًا'
     });

    /* أي مسؤول غير المالك يرسل طلب موافقة */
    if(user.role!=='owner'){
     const existing=db.prepare(`
      SELECT id
      FROM deletion_requests
      WHERE entity_type='volunteer_application'
        AND entity_id=?
        AND status='pending'
     `).get(id);

     if(existing)
      return send(res,409,{
       error:'يوجد طلب حذف بانتظار موافقة المالك بالفعل'
      });

     const r=db.prepare(`
      INSERT INTO deletion_requests
       (
        requester_id,
        requester_department,
        entity_type,
        entity_id,
        item_title
       )
      VALUES(?,?,?,?,?)
     `).run(
      user.id,
      user.department||item.department||'',
      'volunteer_application',
      id,
      item.name||''
     );

     audit(
      user,
      'request_delete',
      'volunteer_application',
      id,
      item.name||''
     );

     return send(res,200,{
      ok:true,
      pendingApproval:true,
      requestId:Number(r.lastInsertRowid),
      message:'تم إرسال طلب حذف المتطوع للمالك'
     });
    }

    /* المالك يحذف مباشرة */
    db.prepare(`
     DELETE FROM volunteer_applications
     WHERE id=?
    `).run(id);

    audit(
     user,
     'delete',
     'volunteer_application',
     id,
     'allow_reapply'
    );

    return send(res,200,{
     ok:true,
     pendingApproval:false,
     message:'تم حذف الطلب والسماح بالتقديم من جديد'
    });
   }


   const volunteerDepartmentMatch=pathname.match(/^\/api\/admin\/volunteers\/(\d+)\/department$/);

   if(volunteerDepartmentMatch && req.method==='PUT'){
    if(!['owner','admin'].includes(user.role))
     return send(res,403,{error:'لا تملك الصلاحية'});

    const id=volunteerDepartmentMatch[1];
    const b=await body(req);

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

    const department=String(b.department||'').trim();

    if(!departments.includes(department))
     return send(res,400,{error:'القسم غير صحيح'});

    const item=db.prepare(`
     SELECT id,status
     FROM volunteer_applications
     WHERE id=?
    `).get(id);

    if(!item)
     return send(res,404,{error:'طلب المتطوع غير موجود'});

    const isHRAdmin=
     user.role==='admin' &&
     user.department==='إدارة الموارد البشرية (HR)';

    if(user.role!=='owner' && !isHRAdmin)
     return send(res,403,{error:'تغيير قسم المتطوع متاح للمالك أو HR فقط'});

    if(item.status!=='accepted')
     return send(res,400,{error:'يجب أن يكون المتطوع مقبولًا أولًا'});

    db.prepare(`
     UPDATE volunteer_applications
     SET department=?,
         updated_at=CURRENT_TIMESTAMP
     WHERE id=?
    `).run(department,id);

    db.prepare(`
     UPDATE volunteers
     SET department=?
     WHERE application_id=?
    `).run(department,id);

    audit(
     user,
     'update',
     'volunteer_department',
     id,
     department
    );

    return send(res,200,{
     ok:true,
     department
    });
   }


   if(pathname==='/api/admin/volunteer-accounts/trash' && req.method==='GET'){
    const isHRAdmin=
     user.role==='admin' &&
     user.department==='إدارة الموارد البشرية (HR)';

    if(user.role!=='owner' && !isHRAdmin)
     return send(res,403,{error:'سلة حسابات المتطوعين متاحة للمالك والموارد البشرية فقط'});

    const items=db.prepare(`
     SELECT
      v.id,
      v.application_id,
      v.name,
      v.email,
      v.phone,
      v.username,
      v.department,
      v.created_at,
      v.deleted_at
     FROM volunteers v
     WHERE v.deleted_at IS NOT NULL
     ORDER BY v.deleted_at DESC
    `).all();

    return send(res,200,{items});
   }

   const volunteerAccountToggleMatch=pathname.match(/^\/api\/admin\/volunteers\/(\d+)\/account-active$/);

   if(volunteerAccountToggleMatch && req.method==='PUT'){
    const canManageVolunteerAccount=
     user.role==='owner' ||
     (
      user.role==='admin' &&
      user.department==='إدارة الموارد البشرية (HR)'
     );

    if(!canManageVolunteerAccount)
     return send(res,403,{error:'إدارة حساب المتطوع متاحة للمالك والموارد البشرية فقط'});

    const id=volunteerAccountToggleMatch[1];
    const b=await body(req);
    const active=b.active ? 1 : 0;

    const item=db.prepare(`
     SELECT *
     FROM volunteer_applications
     WHERE id=?
    `).get(id);

    if(!item)
     return send(res,404,{error:'طلب المتطوع غير موجود'});

    if(!canManageVolunteer(user,item))
     return send(res,403,{error:'لا يمكنك إدارة متطوع من قسم آخر'});

    const account=db.prepare(`
     SELECT v.id
     FROM volunteers v
     WHERE v.application_id=?
    `).get(id);

    if(!account)
     return send(res,404,{error:'لا يوجد حساب لهذا المتطوع'});

    db.prepare(`
     UPDATE volunteers
     SET active=?
     WHERE id=?
    `).run(active,account.id);

    if(!active){
     db.prepare(`
      DELETE FROM volunteer_sessions
      WHERE volunteer_id=?
     `).run(account.id);
    }

    audit(
     user,
     'update',
     'volunteer_account',
     account.id,
     active ? 'active' : 'disabled'
    );

    return send(res,200,{
     ok:true,
     active
    });
   }


   const volunteerAccountDeleteMatch=pathname.match(/^\/api\/admin\/volunteers\/(\d+)\/account$/);

   if(volunteerAccountDeleteMatch && req.method==='DELETE'){
    const isHRAdmin=
     user.role==='admin' &&
     user.department==='إدارة الموارد البشرية (HR)';

    if(user.role!=='owner' && !isHRAdmin)
     return send(res,403,{error:'حذف حساب المتطوع متاح للمالك والموارد البشرية فقط'});

    const applicationId=volunteerAccountDeleteMatch[1];

    const account=db.prepare(`
     SELECT id,name,username,deleted_at
     FROM volunteers
     WHERE application_id=?
    `).get(applicationId);

    if(!account)
     return send(res,404,{error:'لا يوجد حساب لهذا المتطوع'});

    if(account.deleted_at)
     return send(res,409,{error:'الحساب موجود أصلًا في سلة المحذوفات'});

    db.prepare(`
     UPDATE volunteers
     SET active=0,
         deleted_at=CURRENT_TIMESTAMP
     WHERE id=?
    `).run(account.id);

    db.prepare(`
     DELETE FROM volunteer_sessions
     WHERE volunteer_id=?
    `).run(account.id);

    audit(
     user,
     'delete',
     'volunteer_account',
     account.id,
     'soft_delete'
    );

    return send(res,200,{
     ok:true,
     message:'تم نقل حساب المتطوع إلى سلة المحذوفات'
    });
   }


   const volunteerAccountRestoreMatch=pathname.match(/^\/api\/admin\/volunteer-accounts\/(\d+)\/restore$/);

   if(volunteerAccountRestoreMatch && req.method==='POST'){
    const isHRAdmin=
     user.role==='admin' &&
     user.department==='إدارة الموارد البشرية (HR)';

    if(user.role!=='owner' && !isHRAdmin)
     return send(res,403,{error:'استرجاع الحساب متاح للمالك والموارد البشرية فقط'});

    const volunteerId=volunteerAccountRestoreMatch[1];

    const account=db.prepare(`
     SELECT id
     FROM volunteers
     WHERE id=? AND deleted_at IS NOT NULL
    `).get(volunteerId);

    if(!account)
     return send(res,404,{error:'الحساب غير موجود في سلة المحذوفات'});

    db.prepare(`
     UPDATE volunteers
     SET deleted_at=NULL,
         active=1
     WHERE id=?
    `).run(volunteerId);

    audit(
     user,
     'restore',
     'volunteer_account',
     volunteerId,
     'restore_from_trash'
    );

    return send(res,200,{
     ok:true,
     message:'تم استرجاع حساب المتطوع'
    });
   }

   const whatsappSentMatch=pathname.match(/^\/api\/admin\/volunteers\/(\d+)\/whatsapp-sent$/);

   if(whatsappSentMatch && req.method==='PUT'){
    const isHRAdmin =
     user.role==='admin' &&
     user.department==='إدارة الموارد البشرية (HR)';

    if(user.role!=='owner' && !isHRAdmin)
     return send(res,403,{error:'إرسال رسالة القبول من صلاحية المالك أو HR فقط'});

    const id=whatsappSentMatch[1];

    const item=db.prepare(
     'SELECT * FROM volunteer_applications WHERE id=?'
    ).get(id);

    if(!item)
     return send(res,404,{error:'طلب المتطوع غير موجود'});

    if(item.status!=='accepted')
     return send(res,400,{error:'يجب قبول المتطوع أولاً'});

    db.prepare(`
     UPDATE volunteer_applications
     SET whatsapp_sent_at=CURRENT_TIMESTAMP,
         updated_at=CURRENT_TIMESTAMP
     WHERE id=?
    `).run(id);

    audit(user,'update','volunteer_application',id,'whatsapp_sent');

    return send(res,200,{ok:true});
   }


   if(pathname==='/api/admin/notifications' && req.method==='GET'){
    const isHRAdmin=
     user.role==='admin' &&
     user.department==='إدارة الموارد البشرية (HR)';

    const notifications=[];

    if(user.role==='owner' || isHRAdmin){
     const pendingApplications=db.prepare(`
      SELECT COUNT(*) c
      FROM volunteer_applications
      WHERE status='pending'
     `).get().c;

     const acceptedWithoutAccount=db.prepare(`
      SELECT COUNT(*) c
      FROM volunteer_applications va
      LEFT JOIN volunteers v ON v.application_id=va.id
      WHERE va.status='accepted'
       AND va.department_approval='accepted'
       AND v.id IS NULL
     `).get().c;

     const newComplaints=db.prepare(`
      SELECT COUNT(*) c
      FROM complaints
      WHERE status='new'
     `).get().c;

     if(pendingApplications)
      notifications.push({
       type:'volunteers',
       text:`${pendingApplications} طلب تطوع بانتظار المراجعة`
      });

     if(acceptedWithoutAccount)
      notifications.push({
       type:'volunteers',
       text:`${acceptedWithoutAccount} متطوع مقبول لم ينشئ حسابًا`
      });

     if(newComplaints)
      notifications.push({
       type:'complaints',
       text:`${newComplaints} شكوى جديدة`
      });
    }

    if(user.role==='admin' && !isHRAdmin){
     const departmentPending=db.prepare(`
      SELECT COUNT(*) c
      FROM volunteer_applications
      WHERE department=?
       AND department_approval='pending'
     `).get(user.department||'').c;

     if(departmentPending)
      notifications.push({
       type:'volunteers',
       text:`${departmentPending} طلب بانتظار قرار القسم`
      });
    }

    return send(res,200,{
     count:notifications.length,
     notifications
    });
   }

   if(pathname==='/api/admin/dashboard' && req.method==='GET'){
    // Owner: global dashboard
    if(user.role==='owner'){
     const dashboardAudit=db.prepare(
      'SELECT a.*,u.name user_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 15'
     ).all();

     return send(res,200,{
      dashboardType:'owner',
      counts:{
       events:db.prepare('SELECT COUNT(*) c FROM events WHERE deleted_at IS NULL').get().c,
       achievements:db.prepare('SELECT COUNT(*) c FROM achievements WHERE deleted_at IS NULL').get().c,
       users:db.prepare('SELECT COUNT(*) c FROM users WHERE active=1').get().c,
       published:db.prepare("SELECT (SELECT COUNT(*) FROM events WHERE status='published' AND deleted_at IS NULL)+(SELECT COUNT(*) FROM achievements WHERE status='published' AND deleted_at IS NULL) c").get().c
      },
      audit:dashboardAudit
     });
    }

    const isHR=
     user.role==='admin' &&
     user.department==='إدارة الموارد البشرية (HR)';

    // HR: volunteer and complaint overview
    if(isHR){
     return send(res,200,{
      dashboardType:'hr',
      counts:{
       applications:db.prepare(
        "SELECT COUNT(*) c FROM volunteer_applications WHERE status!='rejected'"
       ).get().c,
       activeVolunteers:db.prepare(
        "SELECT COUNT(*) c FROM volunteers WHERE active=1 AND deleted_at IS NULL"
       ).get().c,
       newComplaints:db.prepare(
        "SELECT COUNT(*) c FROM complaints WHERE status='new'"
       ).get().c
      },
      audit:[]
     });
    }

    // Department Admin: own department only
    if(user.role==='admin'){
     return send(res,200,{
      dashboardType:'department',
      department:user.department||'',
      counts:{
       volunteers:db.prepare(
        "SELECT COUNT(*) c FROM volunteers WHERE department=? AND active=1 AND deleted_at IS NULL"
       ).get(user.department||'').c,
       departmentContent:db.prepare(
        "SELECT COUNT(*) c FROM department_content WHERE department=?"
       ).get(user.department||'').c
      },
      audit:[]
     });
    }

    return send(res,403,{error:'لا تملك الصلاحية'});
   }
   if(pathname==='/api/admin/content' && req.method==='GET'){
    if(user.role!=='owner') return send(res,403,{error:'محتوى الموقع متاح للمالك فقط'}); return send(res,200,{settings:settingsObj(),stats:statsObj(),faqs:db.prepare('SELECT * FROM faqs WHERE deleted_at IS NULL ORDER BY sort_order,id').all()});
   }
   if(pathname==='/api/admin/settings' && req.method==='PUT'){
    if(user.role!=='owner') return send(res,403,{error:'تعديل إعدادات الموقع من صلاحية المالك فقط'}); const b=await body(req); const st=db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
    for(const [k,v] of Object.entries(b)) st.run(k,typeof v==='string'?v:JSON.stringify(v)); audit(user,'update','settings','',Object.keys(b).join(',')); return send(res,200,{ok:true});
   }
   if(pathname==='/api/admin/stats' && req.method==='PUT'){
    if(user.role!=='owner') return send(res,403,{error:'تعديل الإحصائيات من صلاحية المالك فقط'}); const b=await body(req); const st=db.prepare('INSERT INTO stats(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'); for(const k of ['volunteers','events','hours','beneficiaries']) if(k in b) st.run(k,Number(b[k])||0); audit(user,'update','stats',''); return send(res,200,{ok:true});
   }
   if(pathname==='/api/admin/upload' && req.method==='POST'){
    if(user.role!=='owner')
     return send(res,403,{error:'رفع صور الموقع من صلاحية المالك فقط'});

    const b=await body(req); const m=String(b.dataUrl||'').match(/^data:(image\/(jpeg|png|webp));base64,(.+)$/); if(!m) return send(res,400,{error:'صيغة الصورة غير مدعومة'}); const buf=Buffer.from(m[3],'base64'); if(buf.length>6*1024*1024) return send(res,400,{error:'حجم الصورة أكبر من 6MB'}); const ext=m[2]==='jpeg'?'jpg':m[2]; const name=`${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`; fs.writeFileSync(path.join(UPLOADS,name),buf); audit(user,'upload','image',name); return send(res,201,{url:`/uploads/${name}`});
   }
   const entMatch=pathname.match(/^\/api\/admin\/(events|achievements)(?:\/(\d+))?$/);
   if(entMatch){
    if(user.role!=='owner')
     return send(res,403,{error:'إدارة الفعاليات والإنجازات من صلاحية المالك فقط'});

    const entity=entMatch[1], id=entMatch[2], cfg=entityConfig(entity);
    if(req.method==='GET'&&!id){ const rows=db.prepare(`SELECT * FROM ${cfg.table} WHERE deleted_at IS NULL ORDER BY id DESC`).all().map(r=>({...r,gallery:safeJson(r.gallery)})); return send(res,200,{items:rows}); }
    if(req.method==='POST'&&!id){ const b=await body(req); const fields=cfg.fields.filter(f=>f in b); if(!b.title) return send(res,400,{error:'العنوان مطلوب'}); const vals=fields.map(f=>f==='gallery'?JSON.stringify(b[f]||[]):b[f]); const qs=fields.map(()=>'?').join(','); const r=db.prepare(`INSERT INTO ${cfg.table}(${fields.join(',')},created_by) VALUES(${qs},?)`).run(...vals,user.id); audit(user,'create',entity,r.lastInsertRowid,b.title); return send(res,201,{id:r.lastInsertRowid}); }
    if(req.method==='PUT'&&id){ const b=await body(req); const fields=cfg.fields.filter(f=>f in b); if(!fields.length) return send(res,400,{error:'لا توجد تعديلات'}); const vals=fields.map(f=>f==='gallery'?JSON.stringify(b[f]||[]):b[f]); db.prepare(`UPDATE ${cfg.table} SET ${fields.map(f=>`${f}=?`).join(',')},updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL`).run(...vals,id); audit(user,'update',entity,id,b.title||''); return send(res,200,{ok:true}); }
    if(req.method==='DELETE'&&id){
     const item=db.prepare(`SELECT * FROM ${cfg.table} WHERE id=? AND deleted_at IS NULL`).get(id);
     if(!item) return send(res,404,{error:'العنصر غير موجود'});

     if(user.role!=='owner'){
      const existing=db.prepare(`
       SELECT id FROM deletion_requests
       WHERE entity_type=? AND entity_id=? AND status='pending'
      `).get(entity,id);

      if(existing)
       return send(res,409,{error:'يوجد طلب حذف بانتظار موافقة المالك بالفعل'});

      const r=db.prepare(`
       INSERT INTO deletion_requests
        (requester_id,requester_department,entity_type,entity_id,item_title)
       VALUES(?,?,?,?,?)
      `).run(
       user.id,
       user.department||'',
       entity,
       id,
       item.title||''
      );

      audit(user,'request_delete',entity,id,item.title||'');

      return send(res,200,{
       ok:true,
       pendingApproval:true,
       requestId:Number(r.lastInsertRowid),
       message:'تم إرسال طلب الحذف للمالك'
      });
     }

     db.prepare(`UPDATE ${cfg.table} SET deleted_at=CURRENT_TIMESTAMP WHERE id=?`).run(id);
     audit(user,'trash',entity,id);

     return send(res,200,{ok:true,pendingApproval:false});
    }
   }
   const faqMatch=pathname.match(/^\/api\/admin\/faqs(?:\/(\d+))?$/);
   if(faqMatch){ if(user.role!=='owner') return send(res,403,{error:'إدارة الأسئلة الشائعة من صلاحية المالك فقط'}); const id=faqMatch[1]; if(req.method==='GET'&&!id)return send(res,200,{items:db.prepare('SELECT * FROM faqs WHERE deleted_at IS NULL ORDER BY sort_order,id').all()}); const b=await body(req); if(req.method==='POST'&&!id){const r=db.prepare('INSERT INTO faqs(question,answer,sort_order,active) VALUES(?,?,?,?)').run(b.question,b.answer,Number(b.sort_order)||0,b.active===false?0:1);audit(user,'create','faq',r.lastInsertRowid);return send(res,201,{id:r.lastInsertRowid});} if(req.method==='PUT'&&id){db.prepare('UPDATE faqs SET question=?,answer=?,sort_order=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(b.question,b.answer,Number(b.sort_order)||0,b.active===false?0:1,id);audit(user,'update','faq',id);return send(res,200,{ok:true});} if(req.method==='DELETE'&&id){
      const item=db.prepare('SELECT * FROM faqs WHERE id=? AND deleted_at IS NULL').get(id);
      if(!item)return send(res,404,{error:'السؤال غير موجود'});

      if(user.role!=='owner'){
       const existing=db.prepare(`
        SELECT id FROM deletion_requests
        WHERE entity_type='faq' AND entity_id=? AND status='pending'
       `).get(id);

       if(existing)
        return send(res,409,{error:'يوجد طلب حذف بانتظار موافقة المالك بالفعل'});

       const r=db.prepare(`
        INSERT INTO deletion_requests
         (requester_id,requester_department,entity_type,entity_id,item_title)
        VALUES(?,?,?,?,?)
       `).run(
        user.id,
        user.department||'',
        'faq',
        id,
        b.question||item.question||''
       );

       audit(user,'request_delete','faq',id,item.question||'');

       return send(res,200,{
        ok:true,
        pendingApproval:true,
        requestId:Number(r.lastInsertRowid),
        message:'تم إرسال طلب الحذف للمالك'
       });
      }

      db.prepare('UPDATE faqs SET deleted_at=CURRENT_TIMESTAMP WHERE id=?').run(id);
      audit(user,'trash','faq',id);
      return send(res,200,{ok:true,pendingApproval:false});
     }
   }
   if(pathname==='/api/admin/trash'&&req.method==='GET'){
    if(user.role!=='owner')
     return send(res,403,{error:'سلة المحذوفات العامة متاحة للمالك فقط'});

    return send(res,200,{
     events:db.prepare(
      'SELECT id,title,deleted_at FROM events WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC'
     ).all(),
     achievements:db.prepare(
      'SELECT id,title,deleted_at FROM achievements WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC'
     ).all(),
     faqs:db.prepare(
      'SELECT id,question title,deleted_at FROM faqs WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC'
     ).all(),
     department_content:db.prepare(
      'SELECT id,title,department,deleted_at FROM department_content WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC'
     ).all()
    });
   }

   const restore=pathname.match(
    /^\/api\/admin\/trash\/(events|achievements|faqs|department_content)\/(\d+)\/restore$/
   );

   if(restore&&req.method==='POST'){
    if(user.role!=='owner')
     return send(res,403,{error:'استرجاع المحتوى من صلاحية المالك فقط'});

    db.prepare(
     `UPDATE ${restore[1]} SET deleted_at=NULL WHERE id=?`
    ).run(restore[2]);

    audit(
     user,
     'restore',
     restore[1],
     restore[2],
     'restore_from_trash'
    );

    return send(res,200,{ok:true});
   }
   if(pathname==='/api/admin/department-admins'&&req.method==='GET'){
    if(!['owner','admin'].includes(user.role))
     return send(res,403,{error:'لا تملك الصلاحية'});

    const isHR=
     user.role==='admin' &&
     user.department==='إدارة الموارد البشرية (HR)';

    if(user.role==='owner' || isHR){
     return send(res,200,{
      items:db.prepare(
       "SELECT id,name,department FROM users WHERE role='admin' AND active=1 AND department<>'' ORDER BY department,name"
      ).all()
     });
    }

    return send(res,200,{
     items:db.prepare(
      "SELECT id,name,department FROM users WHERE role='admin' AND active=1 AND department=? ORDER BY name"
     ).all(user.department)
    });
   }

   if(pathname==='/api/admin/users'&&req.method==='GET'){ if(user.role!=='owner')return send(res,403,{error:'للمالك فقط'}); return send(res,200,{items:db.prepare('SELECT id,name,email,phone,role,active,department,created_at FROM users ORDER BY id').all()}); }
   if(pathname==='/api/admin/users'&&req.method==='POST'){ if(user.role!=='owner')return send(res,403,{error:'للمالك فقط'}); const b=await body(req); if(b.role!=='admin'||!b.name||!b.phone||!b.email||!b.password||b.password.length<8)return send(res,400,{error:'تحقق من البيانات وكلمة المرور'}); try{const r=db.prepare('INSERT INTO users(name,email,phone,password_hash,role,department) VALUES(?,?,?,?,?,?)').run(
 b.name,
 b.email.toLowerCase(),
 String(b.phone||'').trim(),
 hashPassword(b.password),
 b.role,
 String(b.department||'')
);audit(user,'create','user',r.lastInsertRowid,b.email);return send(res,201,{id:r.lastInsertRowid});}catch{return send(res,409,{error:'البريد مستخدم مسبقًا'});} }
   const um=pathname.match(/^\/api\/admin\/users\/(\d+)$/); if(um&&req.method==='PUT'){ if(user.role!=='owner')return send(res,403,{error:'للمالك فقط'}); const b=await body(req); const target=db.prepare('SELECT * FROM users WHERE id=?').get(um[1]); if(!target)return send(res,404,{error:'غير موجود'}); if(target.role==='owner')return send(res,400,{error:'لا يمكن تعديل حساب المالك من هنا'}); if(b.role&&b.role!=='admin')return send(res,400,{error:'صلاحية غير صحيحة'}); db.prepare('UPDATE users SET name=?,email=?,phone=?,role=?,active=?,department=? WHERE id=?').run(
 b.name||target.name,
 String(b.email||target.email).trim().toLowerCase(),
 String(b.phone??target.phone??'').trim(),
 b.role||target.role,
 b.active===false?0:1,
 String(b.department??target.department??''),
 um[1]
);audit(user,'update','user',um[1]);return send(res,200,{ok:true}); }

   if(pathname==='/api/admin/deletion-requests' && req.method==='GET'){
    if(user.role!=='owner')
     return send(res,403,{error:'طلبات الموافقة متاحة للمالك فقط'});

    const items=db.prepare(`
     SELECT
      r.*,
      u.name requester_name,
      d.name decided_by_name
     FROM deletion_requests r
     LEFT JOIN users u ON u.id=r.requester_id
     LEFT JOIN users d ON d.id=r.decided_by
     ORDER BY
      CASE r.status WHEN 'pending' THEN 0 ELSE 1 END,
      r.id DESC
    `).all();

    return send(res,200,{items});
   }

   const deletionDecisionMatch=
    pathname.match(/^\/api\/admin\/deletion-requests\/(\d+)$/);

   if(deletionDecisionMatch && req.method==='PUT'){
    if(user.role!=='owner')
     return send(res,403,{error:'اعتماد طلبات الحذف من صلاحية المالك فقط'});

    const requestId=deletionDecisionMatch[1];
    const b=await body(req);

    if(!['approve','reject'].includes(b.action))
     return send(res,400,{error:'القرار غير صحيح'});

    const request=db.prepare(`
     SELECT *
     FROM deletion_requests
     WHERE id=?
    `).get(requestId);

    if(!request)
     return send(res,404,{error:'طلب الحذف غير موجود'});

    if(request.status!=='pending')
     return send(res,409,{error:'تم اتخاذ قرار على هذا الطلب مسبقًا'});

    if(b.action==='reject'){
     db.prepare(`
      UPDATE deletion_requests
      SET status='rejected',
          decided_by=?,
          decided_at=CURRENT_TIMESTAMP
      WHERE id=?
     `).run(user.id,requestId);

     audit(
      user,
      'reject_delete_request',
      request.entity_type,
      request.entity_id,
      request.item_title
     );

     return send(res,200,{ok:true,status:'rejected'});
    }

    if(request.entity_type==='department_content'){
     const result=db.prepare(`
      UPDATE department_content
      SET deleted_at=CURRENT_TIMESTAMP,
          updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND deleted_at IS NULL
     `).run(request.entity_id);

     if(Number(result.changes)===0)
      return send(res,404,{
       error:'محتوى القسم لم يعد موجودًا أو تم حذفه مسبقًا'
      });
    }
    else if(request.entity_type==='volunteer_application'){
     const account=db.prepare(`
      SELECT id
      FROM volunteers
      WHERE application_id=?
     `).get(request.entity_id);

     if(account)
      return send(res,409,{
       error:'لا يمكن اعتماد الحذف لأن المتطوع أصبح لديه حساب'
      });

     const application=db.prepare(`
      SELECT id
      FROM volunteer_applications
      WHERE id=?
     `).get(request.entity_id);

     if(!application)
      return send(res,404,{
       error:'طلب المتطوع لم يعد موجودًا'
      });

     db.prepare(`
      DELETE FROM volunteer_applications
      WHERE id=?
     `).run(request.entity_id);
    }
    else if(request.entity_type==='events'){
     db.prepare(`
      UPDATE events
      SET deleted_at=CURRENT_TIMESTAMP
      WHERE id=? AND deleted_at IS NULL
     `).run(request.entity_id);
    }
    else if(request.entity_type==='achievements'){
     db.prepare(`
      UPDATE achievements
      SET deleted_at=CURRENT_TIMESTAMP
      WHERE id=? AND deleted_at IS NULL
     `).run(request.entity_id);
    }
    else if(request.entity_type==='faq'){
     db.prepare(`
      UPDATE faqs
      SET deleted_at=CURRENT_TIMESTAMP
      WHERE id=? AND deleted_at IS NULL
     `).run(request.entity_id);
    }
    else{
     return send(res,400,{error:'نوع العنصر غير مدعوم'});
    }

    db.prepare(`
     UPDATE deletion_requests
     SET status='approved',
         decided_by=?,
         decided_at=CURRENT_TIMESTAMP
     WHERE id=?
    `).run(user.id,requestId);

    audit(
     user,
     'approve_delete_request',
     request.entity_type,
     request.entity_id,
     request.item_title
    );

    return send(res,200,{ok:true,status:'approved'});
   }

   if(pathname==='/api/admin/audit'&&req.method==='GET'){ if(user.role!=='owner')return send(res,403,{error:'سجل التعديلات متاح للمالك فقط'}); return send(res,200,{items:db.prepare('SELECT a.*,u.name user_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 200').all()}); }
   return send(res,404,{error:'المسار غير موجود'});
  }
  if(!serveStatic(req,res)) send(res,404,'Not found','text/plain');
 } catch(e){ console.error(e); if(!res.headersSent) send(res,500,{error:'حدث خطأ داخلي'}); }
});

// Department content
db.exec(`
 CREATE TABLE IF NOT EXISTS department_content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  department TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  link_url TEXT NOT NULL DEFAULT '',
  deleted_at TEXT DEFAULT NULL,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(created_by) REFERENCES users(id)
 )
`);


db.exec(`
CREATE TABLE IF NOT EXISTS deletion_requests (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 requester_id INTEGER NOT NULL,
 requester_department TEXT DEFAULT '',
 entity_type TEXT NOT NULL,
 entity_id INTEGER NOT NULL,
 item_title TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'pending'
   CHECK(status IN ('pending','approved','rejected')),
 decided_by INTEGER,
 decided_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(requester_id) REFERENCES users(id),
 FOREIGN KEY(decided_by) REFERENCES users(id)
);
`);

// Database migrations for existing installations
try{
 const departmentContentColumns=db.prepare(
  'PRAGMA table_info(department_content)'
 ).all();

 if(!departmentContentColumns.some(c=>c.name==='deleted_at')){
  db.exec(
   "ALTER TABLE department_content ADD COLUMN deleted_at TEXT DEFAULT NULL"
  );
  console.log('Database migration: department_content.deleted_at added');
 }
}catch(e){
 console.error('Department content migration error:',e);
}

try{
 const userColumns=db.prepare('PRAGMA table_info(users)').all();

 if(!userColumns.some(c=>c.name==='phone')){
  db.exec("ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT ''");
  console.log('Database migration: users.phone added');
 }

 if(!userColumns.some(c=>c.name==='department')){
  db.exec("ALTER TABLE users ADD COLUMN department TEXT NOT NULL DEFAULT ''");
  console.log('Database migration: users.department added');
 }
}catch(e){
 console.error('Database migration error:',e);
}

server.listen(PORT,'0.0.0.0',()=>console.log(`Rouh website: http://localhost:${PORT}`));
