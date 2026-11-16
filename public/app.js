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

/* =========================================
   ROUH MOTION ENGINE
========================================= */

(function initRouhMotion() {

  const reducedMotion =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reducedMotion || !('IntersectionObserver' in window)) {
    return;
  }

  /* Reveal Observer */

  const revealObserver = new IntersectionObserver(entries => {

    entries.forEach(entry => {

      if (!entry.isIntersecting) return;

      entry.target.classList.add('is-visible');

      revealObserver.unobserve(entry.target);

    });

  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -35px 0px'
  });

  /* Statistics Counter */

  const counterObserver = new IntersectionObserver(entries => {

    entries.forEach(entry => {

      if (!entry.isIntersecting) return;

      const element = entry.target;

      counterObserver.unobserve(element);

      const original = element.textContent.trim();
      const target = parseInt(original.replace(/[^\d]/g, ''), 10);

      if (!Number.isFinite(target)) return;

      const prefix = original.startsWith('+') ? '+' : '';
      const duration = 1600;
      const start = performance.now();

      function update(now) {

        const progress = Math.min((now - start) / duration, 1);

        const eased = 1 - Math.pow(1 - progress, 4);

        const current = Math.floor(target * eased);

        element.textContent = prefix + current.toLocaleString('en-US');

        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          element.textContent = prefix + target.toLocaleString('en-US');
        }

      }

      requestAnimationFrame(update);

    });

  }, {
    threshold: 0.5
  });

  /* Prepare elements */

  function prepare(root) {

    const selectors = [
      '.sectionTitle',
      '.split',
      '.card',
      '.stat',
      '.join',
      '.quote',
      '.footerGrid > div'
    ];

    if (root.nodeType !== 1) return;

    if (root.matches && root.matches(selectors.join(','))) {
      addReveal(root);
    }

    root.querySelectorAll?.(selectors.join(',')).forEach(addReveal);

    function addReveal(element) {

      if (!element.classList.contains('rouh-reveal')) {

        element.classList.add('rouh-reveal');

        revealObserver.observe(element);

      }

    }

    root.querySelectorAll?.('.stat b').forEach(element => {

      if (!element.dataset.rouhCounter) {

        element.dataset.rouhCounter = '1';

        counterObserver.observe(element);

      }

    });

  }

  /* Initial elements */

  prepare(document.body);

  /* Dynamic elements from API */

  const mutationObserver = new MutationObserver(records => {

    records.forEach(record => {

      record.addedNodes.forEach(node => {

        if (node.nodeType === 1) {
          prepare(node);
        }

      });

    });

  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

})();



/* ROUH 3D INTERACTION ENGINE */
(function initRouh3D() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  function attachTilt(root = document) {
    root.querySelectorAll('.card:not([data-rouh-tilt])').forEach(card => {
      card.dataset.rouhTilt = 'true';
      card.classList.add('rouh-tilt');

      card.addEventListener('pointermove', event => {
        const rect = card.getBoundingClientRect();

        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;

        const rotateY = (x - 0.5) * 10;
        const rotateX = (0.5 - y) * 10;

        card.style.setProperty('--rouh-rotate-x', `${rotateX}deg`);
        card.style.setProperty('--rouh-rotate-y', `${rotateY}deg`);
      });

      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--rouh-rotate-x', '0deg');
        card.style.setProperty('--rouh-rotate-y', '0deg');
      });
    });
  }

  attachTilt();

  const observer = new MutationObserver(() => attachTilt());
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
})();


/* =========================================
   ROUH LIVING ATMOSPHERE ENGINE
========================================= */

(function initRouhAtmosphere() {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  if (hero.querySelector('.rouh-atmosphere')) return;

  const layer = document.createElement('div');
  layer.className = 'rouh-atmosphere';
  layer.setAttribute('aria-hidden', 'true');

  const canvas = document.createElement('canvas');
  layer.appendChild(canvas);

  hero.prepend(layer);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const reducedMotion =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const mobile = window.matchMedia('(max-width: 768px)').matches;

  let width = 0;
  let height = 0;
  let animationId = null;

  const particles = [];

  function resize() {
    const rect = hero.getBoundingClientRect();
    width = rect.width;
    height = rect.height;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function createParticles() {
    particles.length = 0;

    const count = mobile ? 12 : 30;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.8 + .5,
        speed: Math.random() * .25 + .08,
        drift: (Math.random() - .5) * .25,
        alpha: Math.random() * .35 + .12,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    particles.forEach(p => {
      p.y -= p.speed;
      p.x += p.drift;

      if (p.y < -5) {
        p.y = height + 5;
        p.x = Math.random() * width;
      }

      if (p.x < -5) p.x = width + 5;
      if (p.x > width + 5) p.x = -5;

      p.phase += .012;

      const alpha = p.alpha * (
        .65 + Math.sin(p.phase) * .35
      );

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(190, 169, 124, ${alpha})`;
      ctx.fill();
    });

    animationId = requestAnimationFrame(draw);
  }

  resize();
  createParticles();

  if (!reducedMotion) {
    draw();
  } else {
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(190, 169, 124, ${p.alpha})`;
      ctx.fill();
    });
  }

  if (!mobile && !reducedMotion) {
    hero.addEventListener('pointermove', event => {
      const rect = hero.getBoundingClientRect();

      layer.style.setProperty(
        '--rouh-pointer-x',
        `${event.clientX - rect.left}px`
      );

      layer.style.setProperty(
        '--rouh-pointer-y',
        `${event.clientY - rect.top}px`
      );
    });
  }

  window.addEventListener('resize', () => {
    resize();
    createParticles();
  });

  if ('IntersectionObserver' in window && !reducedMotion) {
    const observer = new IntersectionObserver(entries => {
      const visible = entries[0].isIntersecting;

      if (visible && !animationId) {
        draw();
      } else if (!visible && animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    });

    observer.observe(hero);
  }
})();



/* ==========================================
   ROUH INTERACTIVE EXPERIENCE ENGINE PHASE 6
========================================== */

(function initRouhInteractivePhase6() {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const reducedMotion =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const finePointer =
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* Floating leaves */
  const atmosphere = hero.querySelector('.rouh-atmosphere');

  if (atmosphere && !atmosphere.querySelector('.rouh-floating-leaves')) {
    const leavesLayer = document.createElement('div');
    leavesLayer.className = 'rouh-floating-leaves';
    leavesLayer.setAttribute('aria-hidden', 'true');

    const count = window.innerWidth < 768 ? 5 : 11;

    for (let i = 0; i < count; i++) {
      const leaf = document.createElement('span');
      leaf.className = 'rouh-leaf';
      leaf.style.left = `${8 + (i * 79 / count)}%`;
      leaf.style.top = `${35 + ((i * 37) % 60)}%`;
      leaf.style.setProperty('--leaf-duration', `${12 + (i % 5) * 2}s`);
      leaf.style.setProperty('--leaf-delay', `${-i * 1.7}s`);
      leavesLayer.appendChild(leaf);
    }

    atmosphere.appendChild(leavesLayer);
  }

  /* Mouse parallax */
  if (!reducedMotion && finePointer) {
    let frame = null;

    hero.addEventListener('pointermove', event => {
      if (frame) cancelAnimationFrame(frame);

      frame = requestAnimationFrame(() => {
        const rect = hero.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - .5;
        const y = (event.clientY - rect.top) / rect.height - .5;

        hero.style.setProperty('--rouh-parallax-x', `${-x * 9}px`);
        hero.style.setProperty('--rouh-parallax-y', `${-y * 7}px`);
      });
    }, { passive: true });

    hero.addEventListener('pointerleave', () => {
      hero.style.setProperty('--rouh-parallax-x', '0px');
      hero.style.setProperty('--rouh-parallax-y', '0px');
    });
  }

  /* Button ripple */
  if (!reducedMotion) {
    document.addEventListener('click', event => {
      const button = event.target.closest(
        '.hero .actions .btn, .join .btn, #navJoin'
      );

      if (!button) return;

      const rect = button.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.5;

      const ripple = document.createElement('span');
      ripple.className = 'rouh-ripple';
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`;

      if (getComputedStyle(button).position === 'static') {
        button.style.position = 'relative';
      }

      button.style.overflow = 'hidden';
      button.appendChild(ripple);

      ripple.addEventListener('animationend', () => ripple.remove(), {
        once: true
      });
    });
  }
})();


// ROUH SMART SCROLL NAVIGATION V21
(() => {
  const nav = document.querySelector('.nav');
  if (!nav) return;

  nav.style.setProperty(
    'transition',
    'transform 420ms cubic-bezier(.22,1,.36,1), opacity 320ms ease',
    'important'
  );

  let lastY = window.scrollY;
  let direction = 0;
  let distance = 0;
  let hidden = false;

  function showNav() {
    if (!hidden) return;
    hidden = false;
    nav.classList.remove('rouh-nav-hidden');
  }

  function hideNav() {
    if (hidden) return;
    hidden = true;
    nav.classList.add('rouh-nav-hidden');
  }

  function onScroll() {
    const currentY = Math.max(0, window.scrollY);
    const delta = currentY - lastY;
    lastY = currentY;

    if (currentY <= 40) {
      direction = 0;
      distance = 0;
      showNav();
      return;
    }

    if (Math.abs(delta) < 0.5) return;

    const nextDirection = delta > 0 ? 1 : -1;

    if (nextDirection !== direction) {
      direction = nextDirection;
      distance = 0;
    }

    distance += Math.abs(delta);

    if (distance >= 3) {
      if (direction === 1) hideNav();
      else showNav();

      distance = 0;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
})();
