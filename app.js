// ===== Keys =====
const KEY = 'checkins';
const WKEY = 'workouts';
const MKEY = 'meds';          // meds master list
const MDAY = 'meds_today';    // daily ticks
const METKEY = 'metrics';     // vitals/sleep entries
const DB_NAME = 'health-binder-db';
const FILE_STORE = 'files';
const PIN_KEY = 'pin_hash';
const TEN_HOURS_MS = 10*60*60*1000;

// ===== Helpers =====
function fmt(n){ return (n===null||n===undefined||n==='') ? '' : String(n); }
function toDateStr(ts){ const d = new Date(ts); return d.toLocaleString(); }
function todayKey(){ return new Date(new Date().toDateString()).getTime(); }

// ===== Passcode lock =====
async function sha256(text) { const enc = new TextEncoder(); const buf = await crypto.subtle.digest('SHA-256', enc.encode(text)); return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join(''); }
async function tryUnlock() {
  const stored = localStorage.getItem(PIN_KEY);
  if (!stored) { document.getElementById('lockTitle').textContent = 'Set a 6-digit Passcode'; document.getElementById('unlockBtn').style.display = 'none'; document.getElementById('setupBtn').textContent = 'Set PIN'; document.getElementById('lockScreen').classList.remove('hidden'); return; }
  document.getElementById('lockTitle').textContent = 'Enter Passcode';
  document.getElementById('unlockBtn').style.display = 'inline-block'; document.getElementById('setupBtn').textContent = 'Change PIN'; document.getElementById('lockScreen').classList.remove('hidden');
}
async function unlockFlow(){ const pin = (document.getElementById('pinInput').value||'').trim(); if (pin.length<4){showLockMsg('Enter PIN');return;} const h = await sha256(pin); if (h===localStorage.getItem(PIN_KEY)){ document.getElementById('lockScreen').classList.add('hidden'); document.getElementById('pinInput').value=''; } else showLockMsg('Incorrect PIN'); }
async function setupFlow(){ const pin = (document.getElementById('pinInput').value||'').trim(); if (pin.length<4){showLockMsg('Use at least 4 digits');return;} const h = await sha256(pin); localStorage.setItem(PIN_KEY,h); showLockMsg('PIN saved.'); setTimeout(()=>{ document.getElementById('lockScreen').classList.add('hidden'); document.getElementById('pinInput').value=''; },600); }
function showLockMsg(t){ document.getElementById('lockMsg').textContent=t; }

// ===== IndexedDB for files =====
let db;
function openDB(){ return new Promise((resolve,reject)=>{ const req = indexedDB.open(DB_NAME,1); req.onupgradeneeded=(e)=>{ db=e.target.result; if(!db.objectStoreNames.contains(FILE_STORE)){ db.createObjectStore(FILE_STORE,{keyPath:'id',autoIncrement:true}); } }; req.onsuccess=(e)=>{ db=e.target.result; resolve(); }; req.onerror=(e)=>reject(e); }); }
async function saveFilesToDB(files){ await openDB(); const tx=db.transaction(FILE_STORE,'readwrite'); const store=tx.objectStore(FILE_STORE); for(const f of files){ const buf=await f.arrayBuffer(); await new Promise((res,rej)=>{ const req=store.add({name:f.name,type:f.type,blob:new Blob([buf],{type:f.type}),date:new Date().toISOString()}); req.onsuccess=()=>res(); req.onerror=(e)=>rej(e); }); } await tx.done; }
async function listFiles(){ await openDB(); const tx=db.transaction(FILE_STORE,'readonly'); const store=tx.objectStore(FILE_STORE); const files=[]; await new Promise((res,rej)=>{ const req=store.openCursor(); req.onsuccess=(e)=>{ const c=e.target.result; if(c){ files.push({id:c.key,...c.value}); c.continue(); } else res(); }; req.onerror=(e)=>rej(e); }); return files; }
async function exportAllFiles(){ const files=await listFiles(); for(const f of files){ const url=URL.createObjectURL(f.blob); const a=document.createElement('a'); a.href=url; a.download=f.name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); } }
function renderFileList(){ listFiles().then(files=>{ const ul=document.getElementById('fileList'); ul.innerHTML=''; files.sort((a,b)=>new Date(b.date)-new Date(a.date)).forEach(f=>{ const li=document.createElement('li'); const date=new Date(f.date).toLocaleString(); li.textContent=`${f.name} • ${f.type||'file'} • saved ${date}`; ul.appendChild(li); }); }); }

// ===== Check-ins =====
function loadCheckins(){ try{return JSON.parse(localStorage.getItem(KEY)||'[]');}catch{return [];} }
function saveCheckin(c){ const arr=loadCheckins(); arr.unshift(c); localStorage.setItem(KEY,JSON.stringify(arr)); renderHistory(); drawCharts(); }
function exportCheckinsJSON(){ const data=JSON.stringify(loadCheckins(),null,2); const blob=new Blob([data],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='checkins.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
function exportCheckinsCSV(){ const rows=[['timestamp','energy','exercise','symptoms','notes']]; loadCheckins().forEach(c=>rows.push([c.ts,c.energy,c.exercise,(c.symptoms||'').replace(/,/g,';'),(c.notes||'').replace(/,/g,';')])); const csv=rows.map(r=>r.join(',')).join('\n'); const blob=new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='checkins.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
function importCheckinsJSON(file){ const fr=new FileReader(); fr.onload=()=>{ try{ const arr=JSON.parse(fr.result); if(Array.isArray(arr)){ localStorage.setItem(KEY,JSON.stringify(arr)); renderHistory(); drawCharts(); alert('Imported check-ins'); } }catch(e){alert('Invalid JSON');} }; fr.readAsText(file); }
function renderHistory(){ const tbody=document.querySelector('#history tbody'); tbody.innerHTML=''; loadCheckins().forEach(c=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${toDateStr(c.ts)}</td><td>${c.energy}</td><td>${c.exercise}</td><td>${c.symptoms||''}</td><td>${c.notes||''}</td>`; tbody.appendChild(tr); }); }

// ===== Medicines =====
function loadMeds(){ try{return JSON.parse(localStorage.getItem(MKEY)||'[]');}catch{return [];} }
function saveMedsList(arr){ localStorage.setItem(MKEY,JSON.stringify(arr)); renderMedList(); renderMedChecklist(); }
function loadMedsToday(){ const obj=JSON.parse(localStorage.getItem(MDAY)||'{}'); const key=todayKey(); return obj[key]||{}; }
function saveMedsToday(state){ const obj=JSON.parse(localStorage.getItem(MDAY)||'{}'); const key=todayKey(); obj[key]=state; localStorage.setItem(MDAY,JSON.stringify(obj)); renderMedChecklist(); showAdherence(); }
function renderMedList(){ const ul=document.getElementById('medList'); ul.innerHTML=''; loadMeds().forEach((m,idx)=>{ const li=document.createElement('li'); li.textContent=`${m.name} — ${m.dose}`; const b=document.createElement('button'); b.textContent='Delete'; b.className='danger'; b.onclick=()=>{ const arr=loadMeds(); arr.splice(idx,1); saveMedsList(arr); }; li.appendChild(b); ul.appendChild(li); }); }
function renderMedChecklist(){ const box=document.getElementById('medChecklist'); box.innerHTML=''; const meds=loadMeds(); const today=loadMedsToday(); meds.forEach((m,i)=>{ const id='med_'+i; const div=document.createElement('div'); div.className='checkbox'; div.innerHTML=`<input type="checkbox" id="${id}" ${today[id]?'checked':''}><label for="${id}">${m.name} <small>(${m.dose})</small></label>`; box.appendChild(div); }); }
function showAdherence(){ const meds=loadMeds(); const today=loadMedsToday(); const total=meds.length||1; const taken=Object.values(today).filter(Boolean).length; const pct=Math.round(taken/total*100); document.getElementById('adherenceMsg').textContent = `Today’s adherence: ${taken}/${total} (${pct}%)`; }

// ===== Workouts (+ calories) & BetterMe streak =====
function loadWorkouts(){ try{return JSON.parse(localStorage.getItem(WKEY)||'[]');}catch{return [];} }
function saveWorkout(w){ const arr=loadWorkouts(); arr.unshift(w); localStorage.setItem(WKEY,JSON.stringify(arr)); renderWorkoutHistory(); updateStreak(); drawCharts(); }
function renderWorkoutHistory(){ const tbody=document.querySelector('#workoutHistory tbody'); tbody.innerHTML=''; loadWorkouts().forEach(w=>{ const d=new Date(w.ts); const tr=document.createElement('tr'); tr.innerHTML=`<td>${d.toLocaleDateString()}</td><td>${w.betterme?'✓':''}</td><td>${w.strength?'✓':''}</td><td>${w.mobility?'✓':''}</td><td>${w.cardio?'✓':''}</td><td>${fmt(w.steps)}</td><td>${fmt(w.cal)}</td><td>${fmt(w.notes)}</td>`; tbody.appendChild(tr); }); }
function exportWorkoutsCSV(){ const rows=[['timestamp','betterme','strength','mobility','cardio','steps','calories','notes']]; loadWorkouts().forEach(w=>rows.push([w.ts,w.betterme?'yes':'no',w.strength?'yes':'no',w.mobility?'yes':'no',w.cardio?'yes':'no',fmt(w.steps),fmt(w.cal),(w.notes||'').replace(/,/g,';')])); const csv=rows.map(r=>r.join(',')).join('\n'); const blob=new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='workouts.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
function importWorkoutsJSON(file){ const fr=new FileReader(); fr.onload=()=>{ try{ const arr=JSON.parse(fr.result); if(Array.isArray(arr)){ localStorage.setItem(WKEY,JSON.stringify(arr)); renderWorkoutHistory(); updateStreak(); drawCharts(); alert('Imported workouts'); } }catch(e){alert('Invalid JSON');} }; fr.readAsText(file); }
function updateStreak(){ const ws=loadWorkouts(); const days=new Set(ws.filter(w=>w.betterme).map(w=> new Date(new Date(w.ts).toDateString()).getTime())); let streak=0; let cur=new Date(); cur=new Date(cur.toDateString()); while(days.has(cur.getTime())){ streak++; cur.setDate(cur.getDate()-1); } if(streak===0 && days.has(new Date(new Date(Date.now()-86400000).toDateString()).getTime())){ let c=new Date(new Date(Date.now()-86400000).toDateString()); while(days.has(c.getTime())){ streak++; c.setDate(c.getDate()-1); } } document.getElementById('streakCount').textContent=String(streak); }

// ===== Metrics (weight, vitals, sleep) =====
function loadMetrics(){ try{return JSON.parse(localStorage.getItem(METKEY)||'[]');}catch{return [];} }
function saveMetric(m){ const arr=loadMetrics(); arr.unshift(m); localStorage.setItem(METKEY,JSON.stringify(arr)); renderMetricHistory(); }
function renderMetricHistory(){ const tbody=document.querySelector('#metricHistory tbody'); tbody.innerHTML=''; loadMetrics().forEach(m=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${toDateStr(m.ts)}</td><td>${fmt(m.weight)}</td><td>${fmt(m.rhr)}</td><td>${fmt(m.spo2)}</td><td>${fmt(m.hrv)}</td><td>${fmt(m.bp)}</td><td>${fmt(m.sleep)}</td>`; tbody.appendChild(tr); }); }
function exportMetricsCSV(){ const rows=[['timestamp','weight','resting_hr','spo2','hrv','bp','sleep_minutes']]; loadMetrics().forEach(m=>rows.push([m.ts,fmt(m.weight),fmt(m.rhr),fmt(m.spo2),fmt(m.hrv),fmt(m.bp),fmt(m.sleep)])); const csv=rows.map(r=>r.join(',')).join('\n'); const blob=new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='metrics.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
function downloadTemplate(){ const csv = 'timestamp,weight,resting_hr,spo2,hrv,bp,sleep_minutes\n'; const blob=new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='metrics_template.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
function importMetrics(file){ const name=(file.name||'').toLowerCase(); if(name.endsWith('.json')) return importMetricsJSON(file); return importMetricsCSV(file); }
function importMetricsJSON(file){ const fr=new FileReader(); fr.onload=()=>{ try{ const arr=JSON.parse(fr.result); if(Array.isArray(arr)){ const clean = arr.map(x=>({ ts: x.ts || Date.now(), weight: x.weight||'', rhr: x.resting_hr||x.rhr||'', spo2: x.spo2||'', hrv: x.hrv||'', bp: x.bp||'', sleep: x.sleep_minutes||x.sleep||'' })); const cur=loadMetrics(); localStorage.setItem(METKEY, JSON.stringify(clean.concat(cur))); renderMetricHistory(); alert('Imported metrics (JSON).'); } }catch(e){ alert('Invalid JSON'); } }; fr.readAsText(file); }
function importMetricsCSV(file){ const fr=new FileReader(); fr.onload=()=>{ const text=fr.result; const lines=text.trim().split(/\r?\n/); const header=lines.shift().split(',').map(s=>s.trim()); const idx=(name)=> header.indexOf(name); const i_ts=idx('timestamp'), i_w=idx('weight'), i_r=idx('resting_hr'), i_s=idx('spo2'), i_h=idx('hrv'), i_bp=idx('bp'), i_sl=idx('sleep_minutes'); const rows=lines.map(l=>l.split(',')).map(cols=>({ ts: parseInt(cols[i_ts]||Date.now(),10), weight: cols[i_w]||'', rhr: cols[i_r]||'', spo2: cols[i_s]||'', hrv: cols[i_h]||'', bp: cols[i_bp]||'', sleep: cols[i_sl]||'' })); const cur=loadMetrics(); localStorage.setItem(METKEY, JSON.stringify(rows.concat(cur))); renderMetricHistory(); alert('Imported metrics (CSV).'); }; fr.readAsText(file); }

// ===== Insights (local analysis) =====
function analyzeInsights(){
  const now = Date.now();
  const d24 = now - 24*3600000;
  const d7  = now - 7*24*3600000;
  const mets = loadMetrics();
  const last24 = mets.filter(m=> m.ts>=d24);
  const last7  = mets.filter(m=> m.ts>=d7);
  const ckins = loadCheckins().filter(c=> c.ts>=d24);
  // Aggregates
  const avg = (arr,sel)=> arr.length? (arr.reduce((s,x)=>s+(parseFloat(sel(x))||0),0)/arr.length): null;
  const sum = (arr,sel)=> arr.reduce((s,x)=>s+(parseFloat(sel(x))||0),0);
  const latest = (arr,sel)=> arr.length? sel(arr[0]) : '';
  const sleepMin = sum(last24, x=>x.sleep||0);
  const rhrAvg = avg(last7, x=>x.rhr||null);
  const rhrLatest = latest(last24, x=>x.rhr||'');
  const hrvAvg = avg(last7, x=>x.hrv||null);
  const spo2Min = mets.filter(m=>m.ts>=d7 && m.spo2).reduce((m,v)=> Math.min(m, parseFloat(v.spo2)), 100) || null;
  const weightLatest = latest(mets, x=>x.weight||'');
  const energyAvg = avg(ckins, x=>x.energy||null);
  // Workouts
  const ws = loadWorkouts().filter(w=> w.ts>=d24);
  const steps24 = sum(ws, x=>x.steps||0);
  const cals24 = sum(ws, x=>x.cal||0);
  const bettermeDone = ws.some(w=>w.betterme);

  // Build cards
  const cards = [];
  // Sleep
  cards.push({ title: 'Sleep (last 24h)', value: sleepMin? (sleepMin+' min'):'—', tone: sleepMin>=420 ? 'good' : (sleepMin? 'warn':'bad'), msg: sleepMin>=420? 'Good sleep duration.' : 'Aim for 7+ hours (420+ min).'});
  // Resting HR
  cards.push({ title: 'Resting HR (7d avg)', value: rhrAvg? rhrAvg.toFixed(0)+' bpm':'—', tone: rhrAvg && rhrAvg<75 ? 'good':'warn', msg: rhrAvg? 'Lower is generally better (fitness & recovery).':'Add RHR in Metrics.'});
  // HRV
  cards.push({ title: 'HRV (7d avg)', value: hrvAvg? hrvAvg.toFixed(0)+' ms':'—', tone: hrvAvg && hrvAvg>=40? 'good':'warn', msg: hrvAvg? 'Consistency matters more than absolute value.':'Add HRV in Metrics.' });
  // SpO2
  cards.push({ title: 'SpO₂ (7d min)', value: spo2Min? spo2Min.toFixed(0)+'%':'—', tone: spo2Min && spo2Min>=95 ? 'good':'warn', msg: spo2Min? (spo2Min<94?'Consider checking with a doctor if persistent.':'Looks fine.'):'Add SpO₂ in Metrics.' });
  // Weight
  cards.push({ title: 'Weight (latest)', value: weightLatest? weightLatest+' kg':'—', tone: 'good', msg: 'Track weekly to see trend.' });
  // Energy
  cards.push({ title: 'Energy (24h avg)', value: energyAvg? energyAvg.toFixed(1)+'/10':'—', tone: energyAvg && energyAvg>=6 ? 'good':'warn', msg: energyAvg? (energyAvg<5?'Rest & nutrition focus today.':'Nice energy!'): 'Log a check‑in today.' });
  // Activity
  cards.push({ title: 'Activity (24h)', value: `${steps24||0} steps • ${cals24||0} kcal`, tone: steps24>=6000?'good':'warn', msg: bettermeDone? 'BetterMe done. Keep streak going!':'Try a light session today.' });

  const box = document.getElementById('insightCards');
  box.innerHTML='';
  cards.forEach(c=>{
    const div = document.createElement('div'); div.className='cardlet '+c.tone;
    div.innerHTML = `<h4>${c.title}</h4><div><strong>${c.value}</strong></div><small>${c.msg}</small>`;
    box.appendChild(div);
  });
}

// ===== Charts (vanilla canvas) =====
function drawLine(ctx, points, color){ ctx.save(); ctx.strokeStyle=color||'#0b5ed7'; ctx.lineWidth=2; ctx.beginPath(); points.forEach((p,i)=>{ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); }); ctx.stroke(); ctx.restore(); }
function drawAxes(ctx,w,h,padding=30){ ctx.strokeStyle='#cbd5e1'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(padding,h-padding); ctx.lineTo(w-padding,h-padding); ctx.stroke(); ctx.beginPath(); ctx.moveTo(padding,padding); ctx.lineTo(padding,h-padding); ctx.stroke(); }
function drawEnergyChart(){ const c=document.getElementById('energyChart'); const ctx=c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height); drawAxes(ctx,c.width,c.height); const data=loadCheckins().slice(0,30).reverse(); if(!data.length) return; const xs=data.map((_,i)=>i); const ys=data.map(d=> Math.max(0,Math.min(10,parseFloat(d.energy)||0))); const padding=30, w=c.width, h=c.height; const xscale=(w-padding*2)/Math.max(1,xs.length-1); const yscale=(h-padding*2)/10; const points=xs.map((x,i)=>({x:padding+x*i*xscale, y:h-padding-ys[i]*yscale})); drawLine(ctx,points,'#0b5ed7'); ctx.fillStyle='#0b5ed7'; points.forEach(p=>{ ctx.beginPath(); ctx.arc(p.x,p.y,2.5,0,Math.PI*2); ctx.fill(); }); }
function weekKey(ts){ const d=new Date(ts); const onejan=new Date(d.getFullYear(),0,1); const dayms=86400000; const week=Math.ceil((((d-onejan)/dayms)+onejan.getDay()+1)/7); return `${d.getFullYear()}-W${week}`; }
function drawWeeklyChart(){ const c=document.getElementById('weeklyChart'); const ctx=c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height); drawAxes(ctx,c.width,c.height); const ws=loadWorkouts(); const map=new Map(); ws.forEach(w=>{ const k=weekKey(w.ts); const o=map.get(k)||{count:0,steps:0,cal:0}; o.count += (w.betterme||w.strength||w.mobility||w.cardio)?1:0; o.steps += (w.steps||0); o.cal += (w.cal||0); map.set(k,o); }); const entries=Array.from(map.entries()).slice(-12); if(!entries.length) return; const padding=30, w=c.width, h=c.height; const barW=(w-padding*2)/(entries.length*2); const counts=entries.map(e=>e[1].count); const steps=entries.map(e=>e[1].steps); const cals=entries.map(e=>e[1].cal); const maxCount=Math.max(3,...counts); const maxSteps=Math.max(5000,...steps); const maxCal=Math.max(500,...cals); // bars: counts; line1: steps; line2: cals
  // Bars
  ctx.fillStyle='#0b5ed7';
  entries.forEach((e,i)=>{ const x=padding+i*2*barW+barW*0.2; const ch=(h-padding*2)*(counts[i]/maxCount); ctx.fillRect(x,h-padding-ch,barW*0.6,ch); });
  // Steps line
  const points1=entries.map((e,i)=>({ x: padding+i*2*barW+barW, y: h - padding - (h - padding*2) * (steps[i]/maxSteps) })); drawLine(ctx,points1,'#4caf50'); ctx.fillStyle='#4caf50'; points1.forEach(p=>{ ctx.beginPath(); ctx.arc(p.x,p.y,2.5,0,Math.PI*2); ctx.fill(); });
  // Calories line
  const points2=entries.map((e,i)=>({ x: padding+i*2*barW+barW, y: h - padding - (h - padding*2) * (cals[i]/maxCal) })); drawLine(ctx,points2,'#ff9800'); ctx.fillStyle='#ff9800'; points2.forEach(p=>{ ctx.beginPath(); ctx.arc(p.x,p.y,2.5,0,Math.PI*2); ctx.fill(); });
  // Legend
  ctx.fillStyle='#1c2430'; ctx.font='12px sans-serif'; ctx.fillText('Bars: Workout days / week', padding+5, 14); ctx.fillStyle='#4caf50'; ctx.fillText('Line: Steps / week', padding+210, 14); ctx.fillStyle='#ff9800'; ctx.fillText('Line: Calories / week', padding+370, 14);
}
function drawCharts(){ drawEnergyChart(); drawWeeklyChart(); }

// ===== Notifications & reminders =====
let reminderTimer;
async function requestNotificationPermission(){ if(!('Notification' in window)){alert('Notifications not supported');return;} const perm=await Notification.requestPermission(); if(perm!=='granted'){alert('Please allow notifications');} else { scheduleReminder(); navigator.serviceWorker?.ready.then(reg=>{ reg.showNotification('Reminders enabled',{body:'You will get a reminder every ~10 hours while the app is active.'}); }); } }
function scheduleReminder(){ clearTimeout(reminderTimer); const last=parseInt(localStorage.getItem('lastReminderTs')||'0',10); const now=Date.now(); const delay=Math.max(0,TEN_HOURS_MS-(now-last)); const hrs=Math.round(delay/3600000); const el=document.getElementById('lastReminder'); if(el) el.textContent=`Next reminder in ~${hrs} hours.`; reminderTimer=setTimeout(fireReminder, delay || TEN_HOURS_MS); }
function fireReminder(){ localStorage.setItem('lastReminderTs',''+Date.now()); navigator.serviceWorker?.ready.then(reg=>{ reg.showNotification('Health Check‑In Reminder',{body:'Time to record check‑in, meds & workout.', tag:'checkin'}); }); scheduleReminder(); }

// ===== PWA install & ICS =====
let deferredPrompt; window.addEventListener('beforeinstallprompt',(e)=>{ e.preventDefault(); deferredPrompt=e; document.getElementById('installBtn').style.display='inline-block'; });
document.getElementById('installBtn').addEventListener('click', async ()=>{ if(deferredPrompt){ deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; document.getElementById('installBtn').style.display='none'; } });
function buildICS(){ const start=new Date(); start.setMinutes(start.getMinutes()+5); const dtstamp=start.toISOString().replace(/[-:]/g,'').split('.')[0]+'Z'; const ics=`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//My Health Binder//EN
BEGIN:VEVENT
DTSTART:${dtstamp}
RRULE:FREQ=HOURLY;INTERVAL=10
DESCRIPTION:Record your health check‑in, meds & workout
END:VEVENT
END:VCALENDAR`; const blob=new Blob([ics],{type:'text/calendar'}); const url=URL.createObjectURL(blob); const link=document.getElementById('icsLink'); if(link) link.href=url; }

// ===== UI wiring =====
document.getElementById('unlockBtn').addEventListener('click', unlockFlow);
document.getElementById('setupBtn').addEventListener('click', setupFlow);

// Check‑In
document.getElementById('checkinForm').addEventListener('submit',(e)=>{ e.preventDefault(); const c={ energy:(document.getElementById('energy').value||'').trim(), symptoms:(document.getElementById('symptoms').value||'').trim(), exercise:document.getElementById('exercise').value, notes:(document.getElementById('notes').value||'').trim(), ts:Date.now() }; if(!c.energy){ alert('Please enter energy (1–10)'); return; } saveCheckin(c); document.getElementById('checkinForm').reset(); });
document.getElementById('exportData').addEventListener('click', exportCheckinsJSON);
document.getElementById('exportCSV').addEventListener('click', exportCheckinsCSV);
document.getElementById('importData').addEventListener('change',(e)=>{ const f=e.target.files[0]; if(f) importCheckinsJSON(f); });

// Meds
document.getElementById('medForm').addEventListener('submit',(e)=>{ e.preventDefault(); const name=(document.getElementById('medName').value||'').trim(); const dose=(document.getElementById('medDose').value||'').trim(); if(!name) return; const arr=loadMeds(); arr.push({name,dose}); saveMedsList(arr); document.getElementById('medForm').reset(); });
document.getElementById('saveMeds').addEventListener('click', ()=>{ const meds=loadMeds(); const today={}; meds.forEach((m,i)=>{ const id='med_'+i; today[id]=document.getElementById(id)?.checked||false; }); saveMedsToday(today); });
function initMeds(){ renderMedList(); renderMedChecklist(); showAdherence(); }

// Workout
document.getElementById('workoutForm').addEventListener('submit',(e)=>{ e.preventDefault(); const w={ betterme:document.getElementById('wm_betterme').checked, strength:document.getElementById('wm_strength').checked, mobility:document.getElementById('wm_mobility').checked, cardio:document.getElementById('wm_cardio').checked, steps: document.getElementById('wm_steps').value ? parseInt(document.getElementById('wm_steps').value,10):null, cal: document.getElementById('wm_cal').value ? parseInt(document.getElementById('wm_cal').value,10):null, notes:(document.getElementById('wm_notes').value||'').trim(), ts:Date.now() }; saveWorkout(w); document.getElementById('workoutForm').reset(); });
document.getElementById('exportWorkout').addEventListener('click', exportWorkoutsCSV);
document.getElementById('importWorkout').addEventListener('change',(e)=>{ const f=e.target.files[0]; if(f) importWorkoutsJSON(f); });
document.getElementById('clearWorkout').addEventListener('click', ()=>{ if(confirm('Clear all workouts?')){ localStorage.removeItem(WKEY); renderWorkoutHistory(); updateStreak(); drawCharts(); }});

// Metrics
document.getElementById('metricForm').addEventListener('submit',(e)=>{ e.preventDefault(); const m={ ts:Date.now(), weight:(document.getElementById('mt_weight').value||''), rhr:(document.getElementById('mt_rhr').value||''), spo2:(document.getElementById('mt_spo2').value||''), hrv:(document.getElementById('mt_hrv').value||''), bp:(document.getElementById('mt_bp').value||''), sleep:(document.getElementById('mt_sleep').value||'') }; saveMetric(m); document.getElementById('metricForm').reset(); });
document.getElementById('exportMetrics').addEventListener('click', exportMetricsCSV);
document.getElementById('downloadTemplate').addEventListener('click', downloadTemplate);
document.getElementById('importMetrics').addEventListener('change',(e)=>{ const f=e.target.files[0]; if(f) importMetrics(f); });

// Files
document.getElementById('saveFiles').addEventListener('click', async ()=>{ const inp=document.getElementById('fileInput'); if(!inp.files.length){ alert('Select files first'); return; } await saveFilesToDB(inp.files); renderFileList(); inp.value=''; alert('Files saved on this device.'); });
document.getElementById('exportFiles').addEventListener('click', exportAllFiles);

// Reminders
document.getElementById('enableNotif').addEventListener('click', requestNotificationPermission);
document.getElementById('testNotif').addEventListener('click', ()=>{ navigator.serviceWorker?.ready.then(reg=>{ reg.showNotification('Test Notification',{body:'This is how your reminder will look.'}); }); });
document.getElementById('refreshInsights').addEventListener('click', analyzeInsights);

// Init
window.addEventListener('load', async ()=>{
  if('serviceWorker' in navigator){ try{ await navigator.serviceWorker.register('sw.js'); }catch(e){ console.error('SW failed', e); } }
  renderHistory();
  initMeds();
  renderWorkoutHistory();
  updateStreak();
  renderMetricHistory();
  renderFileList();
  scheduleReminder();
  buildICS();
  tryUnlock();
  drawCharts();
  analyzeInsights();
});
