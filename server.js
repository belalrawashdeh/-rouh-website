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
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('owner','admin','editor')),
 active INTEGER NOT NULL DEFAULT 1,
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
 join_url: 'https://docs.google.com/forms/d/e/1FAIpQLSd4rVoHJSSY3RWIGHKJB3Dv0mq0dQPKN8a6e7qd-e5NZPD91Q/viewform?usp=header',
 email: 'rouhjadara@gmail.com',
 instagram: 'https://www.instagram.com/rouh.jadara?igsi=Z2ZlZ2VvaXNtYzlu&utm_source=qr',
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
 const token=parseCookies(req).rouh_session; if(!token) return null;
 const row=db.prepare(`SELECT u.id,u.name,u.email,u.role,u.active,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?`).get(token);
 if(!row || !row.active || new Date(row.expires_at)<new Date()){ if(token) db.prepare('DELETE FROM sessions WHERE token=?').run(token); return null; } return row;
}
function requireUser(req,res,roles=null){ const u=currentUser(req); if(!u){send(res,401,{error:'يجب تسجيل الدخول'}); return null;} if(roles && !roles.includes(u.role)){send(res,403,{error:'لا تملك الصلاحية'}); return null;} return u; }
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
 let url=decodeURIComponent(req.url.split('?')[0]); if(url==='/') url='/index.html'; if(url==='/admin') url='/admin.html'; if(url==='/volunteer-register') url='/volunteer-register.html';
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
   const b=await body(req); const u=db.prepare('SELECT * FROM users WHERE email=?').get(String(b.email||'').toLowerCase());
   if(!u||!u.active||!verifyPassword(String(b.password||''),u.password_hash)) return send(res,401,{error:'بيانات الدخول غير صحيحة'});
   const token=crypto.randomBytes(32).toString('hex'); const exp=new Date(Date.now()+7*86400000).toISOString(); db.prepare('INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)').run(token,u.id,exp);
   res.setHeader('Set-Cookie',`rouh_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${process.env.NODE_ENV==='production'?'; Secure':''}`); audit(u,'login','session',''); return send(res,200,{ok:true,user:{id:u.id,name:u.name,email:u.email,role:u.role}});
  }
  if(pathname==='/api/logout' && req.method==='POST'){
   const token=parseCookies(req).rouh_session; const u=currentUser(req); if(token) db.prepare('DELETE FROM sessions WHERE token=?').run(token); res.setHeader('Set-Cookie','rouh_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'); if(u)audit(u,'logout','session',''); return send(res,200,{ok:true});
  }
  if(pathname==='/api/me' && req.method==='GET'){ const u=currentUser(req); return send(res,200,{user:u?{id:u.id,name:u.name,email:u.email,role:u.role}:null}); }



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
    db.prepare(`
     UPDATE volunteer_applications
     SET name=?,
         phone=?,
         major=?,
         level=?,
         city=?,
         updated_at=CURRENT_TIMESTAMP
     WHERE id=?
    `).run(name,phone,major,level,city,existing.id);

    return send(res,200,{
     ok:true,
     existing:true,
     id:existing.id
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
    SELECT id,name,email,phone,status,invite_token
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
     phone:app.phone
    }
   });
  }

  if(pathname==='/api/volunteer/register' && req.method==='POST'){
   const b=await body(req);

   const token=String(b.token||'').trim();
   const password=String(b.password||'');

   if(!token)
    return send(res,400,{error:'رابط الدعوة غير صحيح'});

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

   try{
    const result=db.prepare(`
     INSERT INTO volunteers(
      application_id,
      name,
      email,
      phone,
      password_hash
     )
     VALUES(?,?,?,?,?)
    `).run(
     app.id,
     app.name,
     app.email
      ? String(app.email).toLowerCase()
      : `phone-${String(app.phone).replace(/\D/g,'')}@volunteer.rouh.local`,
     app.phone,
     hashPassword(password)
    );

    db.prepare(`
     UPDATE volunteer_applications
     SET invite_token=NULL,
         updated_at=CURRENT_TIMESTAMP
     WHERE id=?
    `).run(app.id);

    return send(res,201,{
     ok:true,
     volunteer:{
      id:Number(result.lastInsertRowid),
      name:app.name,
      phone:app.phone
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

  if(pathname.startsWith('/api/admin/')){
   const user=requireUser(req,res); if(!user) return;
   if(pathname==='/api/admin/ideas' && req.method==='GET'){
    const items=db.prepare('SELECT * FROM ideas ORDER BY id DESC').all();
    return send(res,200,{items});
   }

   const ideaMatch=pathname.match(/^\/api\/admin\/ideas\/(\d+)$/);
   if(ideaMatch && req.method==='PUT'){
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


   // Volunteer applications - Owner/Admin only
   if(pathname==='/api/admin/volunteers' && req.method==='GET'){
    if(!['owner','admin'].includes(user.role))
     return send(res,403,{error:'لا تملك الصلاحية'});

    const items=db.prepare(`
     SELECT *
     FROM volunteer_applications
     ORDER BY
      CASE status
       WHEN 'pending' THEN 1
       WHEN 'accepted' THEN 2
       WHEN 'rejected' THEN 3
       ELSE 4
      END,
      id DESC
    `).all();

    return send(res,200,{items});
   }

   const volunteerMatch=pathname.match(/^\/api\/admin\/volunteers\/(\d+)$/);

   if(volunteerMatch && req.method==='PUT'){
    if(!['owner','admin'].includes(user.role))
     return send(res,403,{error:'لا تملك الصلاحية'});

    const id=volunteerMatch[1];
    const b=await body(req);

    if(!['accepted','rejected'].includes(b.status))
     return send(res,400,{error:'حالة الطلب غير صحيحة'});

    const item=db.prepare(
     'SELECT * FROM volunteer_applications WHERE id=?'
    ).get(id);

    if(!item)
     return send(res,404,{error:'طلب المتطوع غير موجود'});

    if(b.status==='accepted'){
     const inviteToken=crypto.randomBytes(32).toString('hex');

     db.prepare(`
      UPDATE volunteer_applications
      SET status='accepted',
          accepted_at=CURRENT_TIMESTAMP,
          rejected_at=NULL,
          invite_token=?,
          updated_at=CURRENT_TIMESTAMP
      WHERE id=?
     `).run(inviteToken,id);
    }

    if(b.status==='rejected'){
     db.prepare(`
      UPDATE volunteer_applications
      SET status='rejected',
          rejected_at=CURRENT_TIMESTAMP,
          accepted_at=NULL,
          updated_at=CURRENT_TIMESTAMP
      WHERE id=?
     `).run(id);
    }

    audit(user,'update','volunteer_application',id,b.status);

    return send(res,200,{
     ok:true,
     status:b.status
    });
   }

   if(pathname==='/api/admin/dashboard' && req.method==='GET'){
    return send(res,200,{counts:{events:db.prepare('SELECT COUNT(*) c FROM events WHERE deleted_at IS NULL').get().c,achievements:db.prepare('SELECT COUNT(*) c FROM achievements WHERE deleted_at IS NULL').get().c,users:db.prepare('SELECT COUNT(*) c FROM users WHERE active=1').get().c,published:db.prepare("SELECT (SELECT COUNT(*) FROM events WHERE status='published' AND deleted_at IS NULL)+(SELECT COUNT(*) FROM achievements WHERE status='published' AND deleted_at IS NULL) c").get().c},audit:db.prepare('SELECT a.*,u.name user_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 15').all()});
   }
   if(pathname==='/api/admin/content' && req.method==='GET'){
    if(!['owner','admin'].includes(user.role)) return send(res,403,{error:'لا تملك الصلاحية'}); return send(res,200,{settings:settingsObj(),stats:statsObj(),faqs:db.prepare('SELECT * FROM faqs WHERE deleted_at IS NULL ORDER BY sort_order,id').all()});
   }
   if(pathname==='/api/admin/settings' && req.method==='PUT'){
    if(!['owner','admin'].includes(user.role)) return send(res,403,{error:'لا تملك الصلاحية'}); const b=await body(req); const st=db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
    for(const [k,v] of Object.entries(b)) st.run(k,typeof v==='string'?v:JSON.stringify(v)); audit(user,'update','settings','',Object.keys(b).join(',')); return send(res,200,{ok:true});
   }
   if(pathname==='/api/admin/stats' && req.method==='PUT'){
    if(!['owner','admin'].includes(user.role)) return send(res,403,{error:'لا تملك الصلاحية'}); const b=await body(req); const st=db.prepare('INSERT INTO stats(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'); for(const k of ['volunteers','events','hours','beneficiaries']) if(k in b) st.run(k,Number(b[k])||0); audit(user,'update','stats',''); return send(res,200,{ok:true});
   }
   if(pathname==='/api/admin/upload' && req.method==='POST'){
    const b=await body(req); const m=String(b.dataUrl||'').match(/^data:(image\/(jpeg|png|webp));base64,(.+)$/); if(!m) return send(res,400,{error:'صيغة الصورة غير مدعومة'}); const buf=Buffer.from(m[3],'base64'); if(buf.length>6*1024*1024) return send(res,400,{error:'حجم الصورة أكبر من 6MB'}); const ext=m[2]==='jpeg'?'jpg':m[2]; const name=`${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`; fs.writeFileSync(path.join(UPLOADS,name),buf); audit(user,'upload','image',name); return send(res,201,{url:`/uploads/${name}`});
   }
   const entMatch=pathname.match(/^\/api\/admin\/(events|achievements)(?:\/(\d+))?$/);
   if(entMatch){
    const entity=entMatch[1], id=entMatch[2], cfg=entityConfig(entity);
    if(req.method==='GET'&&!id){ const rows=db.prepare(`SELECT * FROM ${cfg.table} WHERE deleted_at IS NULL ORDER BY id DESC`).all().map(r=>({...r,gallery:safeJson(r.gallery)})); return send(res,200,{items:rows}); }
    if(req.method==='POST'&&!id){ const b=await body(req); const fields=cfg.fields.filter(f=>f in b); if(!b.title) return send(res,400,{error:'العنوان مطلوب'}); const vals=fields.map(f=>f==='gallery'?JSON.stringify(b[f]||[]):b[f]); const qs=fields.map(()=>'?').join(','); const r=db.prepare(`INSERT INTO ${cfg.table}(${fields.join(',')},created_by) VALUES(${qs},?)`).run(...vals,user.id); audit(user,'create',entity,r.lastInsertRowid,b.title); return send(res,201,{id:r.lastInsertRowid}); }
    if(req.method==='PUT'&&id){ const b=await body(req); const fields=cfg.fields.filter(f=>f in b); if(!fields.length) return send(res,400,{error:'لا توجد تعديلات'}); const vals=fields.map(f=>f==='gallery'?JSON.stringify(b[f]||[]):b[f]); db.prepare(`UPDATE ${cfg.table} SET ${fields.map(f=>`${f}=?`).join(',')},updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL`).run(...vals,id); audit(user,'update',entity,id,b.title||''); return send(res,200,{ok:true}); }
    if(req.method==='DELETE'&&id){ db.prepare(`UPDATE ${cfg.table} SET deleted_at=CURRENT_TIMESTAMP WHERE id=?`).run(id); audit(user,'trash',entity,id); return send(res,200,{ok:true}); }
   }
   const faqMatch=pathname.match(/^\/api\/admin\/faqs(?:\/(\d+))?$/);
   if(faqMatch){ if(!['owner','admin'].includes(user.role)) return send(res,403,{error:'لا تملك الصلاحية'}); const id=faqMatch[1]; if(req.method==='GET'&&!id)return send(res,200,{items:db.prepare('SELECT * FROM faqs WHERE deleted_at IS NULL ORDER BY sort_order,id').all()}); const b=await body(req); if(req.method==='POST'&&!id){const r=db.prepare('INSERT INTO faqs(question,answer,sort_order,active) VALUES(?,?,?,?)').run(b.question,b.answer,Number(b.sort_order)||0,b.active===false?0:1);audit(user,'create','faq',r.lastInsertRowid);return send(res,201,{id:r.lastInsertRowid});} if(req.method==='PUT'&&id){db.prepare('UPDATE faqs SET question=?,answer=?,sort_order=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(b.question,b.answer,Number(b.sort_order)||0,b.active===false?0:1,id);audit(user,'update','faq',id);return send(res,200,{ok:true});} if(req.method==='DELETE'&&id){db.prepare('UPDATE faqs SET deleted_at=CURRENT_TIMESTAMP WHERE id=?').run(id);audit(user,'trash','faq',id);return send(res,200,{ok:true});}
   }
   if(pathname==='/api/admin/trash'&&req.method==='GET'){ if(!['owner','admin'].includes(user.role))return send(res,403,{error:'لا تملك الصلاحية'}); return send(res,200,{events:db.prepare('SELECT id,title,deleted_at FROM events WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC').all(),achievements:db.prepare('SELECT id,title,deleted_at FROM achievements WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC').all(),faqs:db.prepare('SELECT id,question title,deleted_at FROM faqs WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC').all()}); }
   const restore=pathname.match(/^\/api\/admin\/trash\/(events|achievements|faqs)\/(\d+)\/restore$/); if(restore&&req.method==='POST'){ if(!['owner','admin'].includes(user.role))return send(res,403,{error:'لا تملك الصلاحية'}); db.prepare(`UPDATE ${restore[1]} SET deleted_at=NULL WHERE id=?`).run(restore[2]);audit(user,'restore',restore[1],restore[2]);return send(res,200,{ok:true}); }
   if(pathname==='/api/admin/users'&&req.method==='GET'){ if(user.role!=='owner')return send(res,403,{error:'للمالك فقط'}); return send(res,200,{items:db.prepare('SELECT id,name,email,role,active,created_at FROM users ORDER BY id').all()}); }
   if(pathname==='/api/admin/users'&&req.method==='POST'){ if(user.role!=='owner')return send(res,403,{error:'للمالك فقط'}); const b=await body(req); if(!['admin','editor'].includes(b.role)||!b.name||!b.email||!b.password||b.password.length<8)return send(res,400,{error:'تحقق من البيانات وكلمة المرور'}); try{const r=db.prepare('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)').run(b.name,b.email.toLowerCase(),hashPassword(b.password),b.role);audit(user,'create','user',r.lastInsertRowid,b.email);return send(res,201,{id:r.lastInsertRowid});}catch{return send(res,409,{error:'البريد مستخدم مسبقًا'});} }
   const um=pathname.match(/^\/api\/admin\/users\/(\d+)$/); if(um&&req.method==='PUT'){ if(user.role!=='owner')return send(res,403,{error:'للمالك فقط'}); const b=await body(req); const target=db.prepare('SELECT * FROM users WHERE id=?').get(um[1]); if(!target)return send(res,404,{error:'غير موجود'}); if(target.role==='owner')return send(res,400,{error:'لا يمكن تعديل حساب المالك من هنا'}); if(b.role&&!['admin','editor'].includes(b.role))return send(res,400,{error:'صلاحية غير صحيحة'}); db.prepare('UPDATE users SET name=?,role=?,active=? WHERE id=?').run(b.name||target.name,b.role||target.role,b.active===false?0:1,um[1]);audit(user,'update','user',um[1]);return send(res,200,{ok:true}); }
   if(pathname==='/api/admin/audit'&&req.method==='GET'){ if(!['owner','admin'].includes(user.role))return send(res,403,{error:'لا تملك الصلاحية'}); return send(res,200,{items:db.prepare('SELECT a.*,u.name user_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 200').all()}); }
   return send(res,404,{error:'المسار غير موجود'});
  }
  if(!serveStatic(req,res)) send(res,404,'Not found','text/plain');
 } catch(e){ console.error(e); if(!res.headersSent) send(res,500,{error:'حدث خطأ داخلي'}); }
});
server.listen(PORT,'0.0.0.0',()=>console.log(`Rouh website: http://localhost:${PORT}`));
