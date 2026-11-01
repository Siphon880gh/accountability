import {openDB,read,write,verifier,STORES} from './db.js';
import {today,streaks,heatmapDates,validDate} from './dates.js';
import {seedDemo} from './seed.js';
import {initImages,listImages,imageURL,deleteImage} from './images.js';
import {richEditor,bindEditor,editorValue,noteHTML,imageIds} from './richText.js';
import {monthDays,yearMonths} from './timeline.js';
import {noteTagIds,tagColor,tagDot,tagBadge,tagsForDate,pickerHTML,bindTagPicker,selectedTags} from './tags.js';
import {summarizeGoals,normalizeGoalName} from './goalSummary.js';
import {DEMO_USERNAME,DEMO_PASSWORD,ensureDemoAccount,usesDemoCredentials,enableDemoCredentials} from './demoAccount.js';
let demoAutofill=false;
const app=document.querySelector('#app'),editor=document.querySelector('#editor');
let db,account=null,data={},partnerId=null,goalId=null,selectedDate=today(),showArchived=false;
const slides={};
const goalFilters=new Set();
let libraryOpen=false,libraryImages=null,libraryError='',expandedImage=null,libraryUnusedOnly=false,timelineZoom='days',timelineYear=Number(today().slice(0,4));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>crypto.randomUUID();
const button=(label,action,id='',cls='')=>`<button ${action==='previous'?'aria-label="Previous goal"':action==='next'?'aria-label="Next goal"':''} class="${cls}" data-action="${action}" data-id="${esc(id)}">${label}</button>`;
let noticeTimer;
const notice=message=>{clearTimeout(noticeTimer);document.querySelector('#status').textContent=message;noticeTimer=setTimeout(()=>{document.querySelector('#status').textContent='';},7000);};
const activeGoals=id=>data.goals.filter(g=>g.partnerId===id&&!g.archived).sort((a,b)=>a.sortOrder-b.sortOrder);
const goalDays=id=>data.activityDays.filter(d=>d.goalId===id).map(d=>d.date);
const format=date=>new Date(`${date}T12:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric'});
async function refresh(){for(const name of STORES)data[name]=await read(db,name);}
async function save(ops,message='Saved.'){await write(db,ops);await refresh();render();notice(message);}
function row(store,value){return {store,value};}
function userRow(fields){return {id:uid(),origin:'user',createdAt:new Date().toISOString(),...fields};}
function heatmap(goal){
 const dates=heatmapDates(goal.startDate),active=new Set(goalDays(goal.id));
 const pad=new Date(`${dates[0]||today()}T12:00:00`).getDay();
 return `<div class="heatmap-scroll" tabindex="0" aria-label="${esc(goal.name)} activity calendar"><div class="heatmap" role="img" aria-label="${active.size} active days. ${esc(goal.name)}.">${'<span class="cell spacer"></span>'.repeat(pad)}${dates.map(d=>`<span class="cell ${active.has(d)?'done':''}" data-goal="${esc(goal.id)}" data-date="${d}"></span>`).join('')}</div></div><div class="legend"><span>${dates.length?format(dates[0]):'Today'} — ${format(today())}</span><span>Less <i class="cell"></i><i class="cell done"></i> More</span></div>`;
}
function cellTip(){let tip=document.querySelector('#cell-tip');if(!tip){tip=document.createElement('div');tip.id='cell-tip';tip.setAttribute('role','tooltip');tip.hidden=true;document.body.append(tip);}return tip;}
function hideCellTip(){document.querySelector('#cell-tip')?.setAttribute('hidden','');}
function showCellTip(cell){
 const date=cell.dataset.date;if(!date||!account)return;
 const done=cell.classList.contains('done'),tags=tagsForDate(data.notes,data.tags,cell.dataset.goal,date);
 const label=new Date(`${date}T12:00:00`).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'});
 const tip=cellTip();
 tip.classList.toggle('is-done',done);
 tip.innerHTML=`<strong>${esc(label)}</strong><span class="cell-tip-status"><i class="cell${done?' done':''}"></i>${done?'Checked in':'No check-in'}</span>${tags.length?`<span class="cell-tip-tags">${tags.map(tagBadge).join('')}</span>`:''}`;
 tip.style.left='-9999px';tip.hidden=false;
 const rect=cell.getBoundingClientRect(),gap=8,width=tip.offsetWidth,height=tip.offsetHeight;
 let left=rect.left+rect.width/2-width/2,top=rect.top-height-gap;
 if(top<8)top=rect.bottom+gap;
 left=Math.max(8,Math.min(left,innerWidth-width-8));
 if(top+height>innerHeight-8)top=Math.max(8,innerHeight-height-8);
 tip.style.left=`${Math.round(left)}px`;tip.style.top=`${Math.round(top)}px`;
}
function summary(goal){const s=streaks(goalDays(goal.id));return s.current?`<div class="streak"><strong>${s.current}</strong><span>day${s.current===1?'':'s'} on a streak <small>Keep showing up.</small></span></div>`:`<div class="history"><span>${s.history.length?'Recent streaks':'A fresh start'}</span><p>${s.history.length?s.history.map(r=>`<b>${r.length} day${r.length===1?'':'s'}</b> · ended ${format(r.end)}`).join('<br>'):'Your first check-in starts the story.'}</p></div>`;}
function partnerCard(p){
 const goals=activeGoals(p.id);slides[p.id]=Math.min(slides[p.id]||0,Math.max(0,goals.length-1));const i=slides[p.id],g=goals[i];
 const matches=matchesGoalFilters(p.id);
 return `<article data-partner-id="${esc(p.id)}" class="partner-card ${matches?'':'is-muted'}" ${matches?'':'aria-label="Does not match selected goals"'}><div class="card-head"><div class="avatar">${esc(p.name.split(' ').map(w=>w[0]).slice(0,2).join(''))}</div><div><h2>${esc(p.name)}</h2><span class="muted">${goals.length} active goal${goals.length===1?'':'s'}${matches?'':' · No match'}</span></div></div><section ${goals.length>1?'aria-roledescription="carousel"':''} aria-label="${esc(p.name)} goals"><div class="goal-slide" aria-live="polite">${g?`<h3>${esc(g.name)}</h3>${heatmap(g)}${summary(g)}`:'<div class="empty">No goals yet.<p>Add a goal to start tracking progress.</p></div>'}</div>${goals.length>1?`<div class="carousel">${button('←','previous',p.id,'icon')}<span>${i+1} / ${goals.length}</span>${button('→','next',p.id,'icon')}</div>`:''}</section>${button('Open workspace ↗','open-partner',p.id,'open-workspace')}</article>`;
}
function login(){
 const demo=data.accounts.find(a=>a.username===DEMO_USERNAME);
 app.innerHTML=`<section class="login"><div class="eyebrow">SMALL STEPS. SHARED PROGRESS.</div><h1>Keep showing up.</h1><p class="muted">Sign in to follow your goals and shared progress.</p><form id="login-form"><h2>Welcome back</h2><label>Username<input name="username" autocomplete="username" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button class="primary" type="submit">Sign in</button><p class="form-error" role="alert"></p></form><section class="demo-login" aria-label="Demo account"><strong>Demo-only credentials</strong>${demoAutofill?`<button type="button" class="demo-row" id="fill-demo"><span><code>${esc(DEMO_USERNAME)}</code> / <code>${esc(DEMO_PASSWORD)}</code></span><small>Sample accountability partners · Click to fill</small></button>`:`<p class="fine">This browser already has a password you chose for admin. Sign in with that password, or switch this local demo account to the public demo credentials.</p>${demo?.isDemo?'<button type="button" id="enable-demo">Use demo credentials</button>':''}`}</section><p class="fine">Local demo only. Notes stay in this browser; uploaded images are saved on this PHP server. Clearing site data removes notes and access to this image library. This sign-in is not a security boundary.</p></section>`;
 const form=document.querySelector('#login-form');
 function fillDemo(){form.elements.username.value=DEMO_USERNAME;form.elements.password.value=DEMO_PASSWORD;form.querySelector('.form-error').textContent='';form.elements.username.focus();}
 document.querySelector('#fill-demo')?.addEventListener('click',fillDemo);
 document.querySelector('#enable-demo')?.addEventListener('click',async()=>{
   if(!confirm('Replace the password you chose for this local demo account with the public demo credentials? Your partners, goals, and notes will stay.'))return;
   try{await enableDemoCredentials(db,demo);demoAutofill=true;await refresh();login();document.querySelector('#fill-demo').click();}catch(err){form.querySelector('.form-error').textContent=err.message;}
 });
 form.onsubmit=async e=>{
   e.preventDefault();const submit=form.querySelector('[type="submit"]');submit.disabled=true;
   try{
     const values=new FormData(form),username=values.get('username').trim(),password=values.get('password');
     const found=data.accounts.find(a=>a.username===username);
     if(!found||(await verifier(password,found.passwordVerifier.salt)).hash!==found.passwordVerifier.hash)throw Error('Username or password is incorrect.');
     account=found;await seedDemo(db);await refresh();render();
   }catch(err){form.querySelector('.form-error').textContent=err.message;submit.disabled=false;}
 };
}
function matchesGoalFilters(id){
 const keys=new Set(activeGoals(id).map(g=>normalizeGoalName(g.name)));
 return [...goalFilters].every(key=>keys.has(key));
}
function goalSummary(){
 const goals=summarizeGoals(data.goals,data.partners,account.id);
 for(const key of goalFilters)if(!goals.some(g=>g.key===key))goalFilters.delete(key);
 const matching=data.partners.filter(p=>p.accountId===account.id&&matchesGoalFilters(p.id)).length;
 return `<section class="goal-summary" aria-labelledby="goal-summary-heading"><div class="section-heading"><h2 id="goal-summary-heading">Goals across your circle</h2><span class="muted">Select a goal to find partners</span></div>${goals.length?`<ul class="goal-summary-list">${goals.map(g=>`<li><button data-action="filter-goal" data-id="${esc(g.key)}" aria-pressed="${goalFilters.has(g.key)}"><span>${esc(g.label)}</span><span class="goal-summary-count" aria-label="${g.count} partner${g.count===1?'':'s'}">${g.count}</span></button></li>`).join('')}</ul>`:'<p class="muted">No active goals yet. Add a goal in a partner’s workspace to get started.</p>'}${goalFilters.size?`<div class="filter-bar" role="status"><span><strong>Filter on</strong> · ${matching} matching partner${matching===1?'':'s'} · Goal: ${goals.filter(g=>goalFilters.has(g.key)).map(g=>esc(g.label)).join(', ')}</span><button data-action="clear-filters" aria-label="Clear all goal filters">× Clear filters</button></div>`:''}</section>`;
}
function render(){
 hideCellTip();
 document.querySelector('#account-actions').innerHTML=account?button('Image library','image-library')+button('Reset demo','reset')+button('Sign out','logout'):'';
 if(!account){login();return;}
 if(libraryOpen){renderImageLibrary();return;}
 const partner=data.partners.find(p=>p.id===partnerId&&p.accountId===account.id);
 if(!partner){partnerId=null;app.innerHTML=`<section class="page-heading"><div><div class="eyebrow">YOUR CIRCLE</div><h1>Put in the days.</h1><p class="muted">Choose a goal. Keep a record. Show up for each other.</p></div>${button('+ Add partner','add-partner','','primary')}</section>${goalSummary()}<div class="section-heading"><h2>Partners</h2><span class="muted">${data.partners.length} in your circle</span></div><div class="partner-grid">${data.partners.filter(p=>p.accountId===account.id).map(partnerCard).join('')||'<p class="empty">Add your first accountability partner.</p>'}</div><p class="fine footer-note">A record of showing up. Open a partner to check in, reflect, or look back.</p>`;return;}
 const goals=data.goals.filter(g=>g.partnerId===partnerId&&(showArchived||!g.archived)).sort((a,b)=>a.sortOrder-b.sortOrder);
 let goal=goals.find(g=>g.id===goalId)||goals[0];goalId=goal?.id;
 app.innerHTML=`<nav class="breadcrumb">${button('← Partners','back')}<span>/ ${esc(partner.name)}</span></nav><div class="section-heading"><h1>${esc(partner.name)}</h1><div>${button('Edit partner','edit-partner',partner.id)}${button('Delete partner','delete-partner',partner.id,'danger')}</div></div><div class="workspace"><aside><div class="section-heading"><h2>Goals</h2>${button('+ Add','add-goal')}</div><div class="goal-list">${goals.map(g=>button(`${esc(g.name)}${g.archived?' <small>Archived</small>':''}`,'select-goal',g.id,g.id===goalId?'selected':'')).join('')||'<p class="muted">No goals yet.</p>'}</div><label class="check"><input id="archived" type="checkbox" ${showArchived?'checked':''}> Show archived goals</label></aside><section class="goal-detail">${goal?goalView(goal):'<div class="empty"><h2>What will you work toward?</h2><p>Add a goal to begin your daily check-ins.</p></div>'}</section></div>`;
 document.querySelector('#archived').onchange=e=>{showArchived=e.target.checked;render();};
 const date=document.querySelector('#day');if(date)date.onchange=e=>{if(validDate(e.target.value)&&e.target.value<=today()){selectedDate=e.target.value;render();}};
 const noteForm=document.querySelector('#note-form');if(noteForm){bindTagPicker(noteForm.querySelector('.tag-picker'),data.tags.filter(t=>t.goalId===goalId));bindEditor(noteForm.querySelector('.rich-field'));const hint=noteForm.querySelector('.check-in-note'),mark=noteForm.elements.mark;if(hint&&mark)mark.onchange=()=>{hint.hidden=!mark.checked;};noteForm.onsubmit=e=>addNote(e).catch(err=>notice(`Could not save: ${err.message}`));}
}
function timelineControls(g){
 const monthLabel=new Date(`${selectedDate.slice(0,7)}-01T12:00:00`).toLocaleDateString(undefined,{month:'long',year:'numeric'});
 const months=yearMonths(timelineYear,g.startDate);
 return `<section class="timeline"><div class="timeline-heading"><h3>${timelineZoom==='months'?'The long view':monthLabel}</h3><div class="segmented" aria-label="Timeline scale"><button data-action="zoom" data-id="months" aria-pressed="${timelineZoom==='months'}">Months</button><button data-action="zoom" data-id="days" aria-pressed="${timelineZoom==='days'}">Days</button></div></div>${timelineZoom==='months'?`<div class="year-navigation"><button data-action="timeline-year" data-id="${timelineYear-1}" ${timelineYear<=Number(g.startDate.slice(0,4))?'disabled':''} aria-label="Previous year">←</button><strong>${timelineYear}</strong><button data-action="timeline-year" data-id="${timelineYear+1}" ${timelineYear>=Number(today().slice(0,4))?'disabled':''} aria-label="Next year">→</button></div><div class="month-grid">${months.map(m=>{const dates=monthDays(m,g.startDate),activity=new Set(goalDays(g.id)),count=dates.filter(d=>activity.has(d)).length,notes=data.notes.filter(n=>n.goalId===g.id&&n.date.startsWith(m)).length;return `<button data-action="month" data-id="${m}" aria-label="${new Date(`${m}-01T12:00:00`).toLocaleDateString(undefined,{month:'long',year:'numeric'})}, ${count} check-ins, ${notes} notes"><strong>${new Date(`${m}-01T12:00:00`).toLocaleDateString(undefined,{month:'short'})}</strong><div class="month-meter" aria-hidden="true">${dates.map(d=>`<i class="${activity.has(d)?'active':''}"></i>`).join('')}</div><span>${count} check-ins · ${notes} notes</span></button>`;}).join('')}</div>`:''}</section>`;
}
function imageReferences(id){
 return data.notes.filter(n=>imageIds(n.html||'').includes(id)).map(note=>({note,goal:data.goals.find(g=>g.id===note.goalId)})).filter(r=>r.goal).map(r=>({...r,partner:data.partners.find(p=>p.id===r.goal.partnerId)})).filter(r=>r.partner?.accountId===account.id&&r.partner.id===partnerId);
}
async function loadImageLibrary(){
 const requestedPartner=partnerId;
 try{const images=await listImages();if(partnerId!==requestedPartner)return;libraryImages=images;libraryError='';}catch(err){if(partnerId!==requestedPartner)return;libraryError=err.message;}
 if(libraryOpen&&account)render();
}
function jumpToNote(id){
 const note=data.notes.find(n=>n.id===id),goal=data.goals.find(g=>g.id===note?.goalId);
 if(!note||!goal)return notice('This note no longer exists.');
 libraryOpen=false;partnerId=goal.partnerId;goalId=goal.id;showArchived=!!goal.archived;selectedDate=note.date;timelineZoom='days';render();
 const target=document.getElementById(`note-${id}`);target?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});target?.focus({preventScroll:true});
}
function renderImageLibrary(){
 if(!partnerId){app.innerHTML=`<nav class="breadcrumb">${button('← Partners','back')}</nav><section class="page-heading"><div><div class="eyebrow">YOUR RECORD</div><h1>Image libraries</h1><p class="muted">Choose a partner to view their uploads and linked notes.</p></div></section><div class="library-partners">${data.partners.filter(p=>p.accountId===account.id).map(p=>button(`${esc(p.name)} <span>View image library ↗</span>`,'partner-library',p.id)).join('')||'<p>Add a partner to start an image library.</p>'}</div>`;return;}
 const libraryPartner=data.partners.find(p=>p.id===partnerId);
 const refs=expandedImage?imageReferences(expandedImage):[];
 const unusedCount=libraryImages?.filter(image=>!imageReferences(image.id).length).length;
 const visible=libraryImages?.filter(image=>!libraryUnusedOnly||!imageReferences(image.id).length);
 const libraryBody=libraryError?`<p role="alert">${esc(libraryError)}</p>`:!libraryImages?'<p role="status">Loading images…</p>':!libraryImages.length?'<div class="empty"><h2>Start with a moment worth keeping.</h2><p>Paste or upload an image while writing a note. It will appear here.</p></div>':!visible.length?'<div class="empty"><h2>Every image is in a note.</h2><p>Images that aren’t saved in a note will show up here.</p></div>':`<div class="image-grid">${visible.map(image=>{const uses=imageReferences(image.id);return `<article class="image-card"><button class="image-preview" data-action="library-image" data-id="${image.id}" aria-label="${uses.length?`View ${uses.length} notes using this image`:'This image is not used in a saved note'}"><img src="${esc(imageURL(image.id))}" alt="Uploaded image" loading="lazy" referrerpolicy="no-referrer"></button><div><strong>${uses.length} note${uses.length===1?'':'s'}</strong><span>${image.width} × ${image.height} · ${Math.ceil(image.bytes/1024)} KB</span></div>${uses.length===0?`<p class="fine">Not used in a saved note. Reuse it from “My images” in the editor.</p>${button('Delete image','delete-image',image.id,'danger')}`:''}</article>`;}).join('')}</div>`;
 app.innerHTML=`<nav class="breadcrumb">${button('← Partners','back')}</nav><section class="page-heading"><div><div class="eyebrow">YOUR RECORD</div><h1>${esc(libraryPartner?.name)}’s images</h1><p class="muted">This partner’s uploads, and the notes they belong to.</p></div><div class="library-actions"><button data-action="toggle-unused" aria-pressed="${libraryUnusedOnly}">Not in a note${unusedCount==null?'':` (${unusedCount})`}</button>${button('Refresh','image-library')}</div></section>${libraryBody}${expandedImage?`<section id="image-references" tabindex="-1"><h2>Notes using this image</h2>${refs.map(r=>button(`${esc(r.partner.name)} / ${esc(r.goal.name)} · ${esc(r.note.date)}<small>${esc(r.note.text.slice(0,100)||'Image note')}</small>`,'jump-note',r.note.id)).join('')||`<p>This image is not used in a saved note.</p>${button('Delete image','delete-image',expandedImage,'danger')}`}</section>`:''}`;
}
function goalView(g){
 const days=goalDays(g.id),checked=days.includes(selectedDate),notes=data.notes.filter(n=>n.goalId===g.id&&n.date===selectedDate);
 const dates=monthDays(selectedDate.slice(0,7),g.startDate);
 const tags=data.tags.filter(t=>t.goalId===g.id);
 const selectedLabel=new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'});
 return `<div class="section-heading goal-header"><div><div class="eyebrow">${g.archived?'ARCHIVED GOAL':'CURRENT GOAL'}</div><h2>${esc(g.name)}</h2>${g.description?`<p class="muted">${esc(g.description)}</p>`:''}</div><div class="goal-actions">${button('Edit','edit-goal',g.id)}${button(g.archived?'Restore':'Archive','archive-goal',g.id)}${button('Delete','delete-goal',g.id,'danger')}</div></div><nav class="workspace-jumps" aria-label="Goal sections"><a href="#goal-progress">Progress</a><a href="#goal-calendar">Choose a day</a><a href="#goal-notes">Notes & reflection</a></nav><section class="progress-section" id="goal-progress" aria-labelledby="progress-heading"><div class="workspace-section-heading"><h3 id="progress-heading">Progress</h3><span>Activity across this goal</span></div><div class="progress-panel">${summary(g)}<div class="progress-calendar">${heatmap(g)}</div></div></section><section class="date-workspace" id="goal-calendar" aria-labelledby="calendar-heading"><div class="workspace-section-heading"><div><h3 id="calendar-heading">Choose a day</h3><p>Select a date to check in and see its notes.</p></div></div><div class="day-heading"><div class="selected-day"><span>Selected day</span><strong>${esc(selectedLabel)}</strong></div><label>Date<input id="day" type="date" value="${selectedDate}" min="${g.startDate}" max="${today()}"></label>${button(checked?'✓ Checked in · Undo':'Check in','check-in',g.id,checked?'checked':'primary')}</div>${timelineControls(g)}<div class="date-chips" ${timelineZoom==='months'?'hidden':''}>${dates.map((d,index)=>{const dateTags=tagsForDate(data.notes,tags,g.id,d);return button(`${days.includes(d)?'● ':''}${new Date(`${d}T12:00:00`).toLocaleDateString(undefined,{weekday:'short'})} ${Number(d.slice(-2))} ${dateTags.length?`<span class="date-tag-dots" role="img" aria-label="Tags: ${esc(dateTags.map(t=>t.label).join(', '))}" title="${esc(dateTags.map(t=>t.label).join(', '))}">${dateTags.map(tagDot).join('')}</span>`:''}`,'date',d,d===selectedDate?'selected':'')+(new Date(`${d}T12:00:00`).getDay()===0&&index<dates.length-1?'<span class="week-divider" role="separator" aria-orientation="vertical" aria-label="New week"></span>':'');}).join('')}</div><div class="tag-legend" aria-label="Tag color legend"><span>Tag colors</span><div>${tags.map(tagBadge).join('')||'<span class="fine">No tags yet</span>'}</div>${button('Manage tags','manage-tags',g.id)}</div></section><section class="reflection-section" id="goal-notes" aria-labelledby="notes-heading"><div class="workspace-section-heading reflection-heading"><div><h3 id="notes-heading">Notes & reflection</h3><p>${esc(selectedLabel)}</p></div><span class="saved-note-count">${notes.length} saved note${notes.length===1?'':'s'}</span></div><div class="notes">${notes.map(n=>`<article class="note" id="note-${esc(n.id)}" tabindex="-1"><div class="note-meta"><div class="note-tags">${tags.filter(t=>noteTagIds(n).includes(t.id)).map(tagBadge).join('')}</div><div class="note-actions">${button('Edit note','edit-note',n.id)}${button('Delete','delete-note',n.id,'danger')}</div></div><div class="note-content">${noteHTML(n)}</div></article>`).join('')||`<p class="muted">${checked?'You showed up. Add a note to remember how it went.':'No notes for this day. Check in or add a reflection below.'}</p>`}</div><form id="note-form" class="note-composer"><div class="composer-heading"><h4>Add a reflection</h4><span>For ${format(selectedDate)}</span></div><div class="note-inputs">${pickerHTML('new-note-tags')}${richEditor('new-note','Your note')}</div><label class="check"><input name="mark" type="checkbox" checked> Also check in for this day</label><button class="primary">Add note</button>${checked?'':`<p class="muted check-in-note">Saving this note will check you in for this day.</p>`}</form></section>`;
}
function activity(goal,date){return userRow({id:`${goal.id}|${date}`,goalId:goal.id,date,source:'check-in'});}
function tagOperations(root,currentGoalId){
 const chosen=selectedTags(root),operations=[],ids=[];
 for(const tag of chosen){
   const existing=data.tags.find(t=>t.goalId===currentGoalId&&t.label.toLowerCase()===tag.label.toLowerCase());
   const value=existing||userRow({id:tag.id,goalId:currentGoalId,label:tag.label,color:tagColor(tag)});
   if(!existing)operations.push(row('tags',value));ids.push(value.id);
 }
 return {operations,tagIds:[...new Set(ids)]};
}
async function addNote(e){
 e.preventDefault();const f=new FormData(e.currentTarget),content=editorValue(e.currentTarget.querySelector('.rich-field'));
 const g=data.goals.find(g=>g.id===goalId);if(selectedDate<g.startDate||selectedDate>today())return notice('Choose a date between the goal start and today.');
 const {operations,tagIds}=tagOperations(e.currentTarget.querySelector('.tag-picker'),goalId);
 operations.push(row('notes',userRow({goalId,date:selectedDate,tagIds,...content})));
 if(f.has('mark')&&!goalDays(goalId).includes(selectedDate))operations.push(row('activityDays',activity(g,selectedDate)));
 await save(operations,'Reflection saved.');
}

function formDialog(title,fields,onSave){
 editor.innerHTML=`<form><h2>${esc(title)}</h2>${fields}<p class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" id="cancel">Cancel</button><button class="primary">Save</button></div></form>`;editor.showModal();editor.querySelectorAll('.rich-field').forEach(bindEditor);editor.querySelectorAll('.tag-picker').forEach(root=>bindTagPicker(root,data.tags.filter(t=>t.goalId===goalId)));editor.querySelector('#cancel').onclick=()=>editor.close();editor.querySelector('form').onsubmit=async e=>{e.preventDefault();try{await onSave(new FormData(e.currentTarget));editor.close();}catch(err){editor.querySelector('.form-error').textContent=err.message;}};
}
function manageTags(currentGoalId){
 const tags=data.tags.filter(t=>t.goalId===currentGoalId);
 const fields=`<p class="fine">Tags belong to this goal. Rename or recolor a tag here to update every note using it.</p><div class="tag-manager">${tags.map(t=>`<div class="tag-manager-row" data-tag-row="${esc(t.id)}"><label class="tag-name-label">Name<input name="label-${esc(t.id)}" value="${esc(t.label)}" maxlength="40" required></label><label class="tag-color-label">Color<input type="color" name="color-${esc(t.id)}" value="${tagColor(t)}" aria-label="Color for ${esc(t.label)}"></label><small>${data.notes.filter(n=>noteTagIds(n).includes(t.id)).length} notes</small><button type="button" class="danger" data-action="delete-tag" data-id="${esc(t.id)}">Remove</button></div>`).join('')||'<p class="muted">No tags yet. Create your first one below.</p>'}</div><div class="new-tag-row"><label>New tag<input name="new-label" maxlength="40" placeholder="e.g. Milestone"></label><label>Color<input type="color" name="new-color" value="#3267a8" aria-label="New tag color"></label></div>`;
 formDialog('Manage tags',fields,async f=>{
   const operations=[],labels=new Set();
   for(const t of tags){const label=required(f,`label-${t.id}`),key=label.toLowerCase();if(labels.has(key))throw Error('Each tag needs a different name.');labels.add(key);operations.push(row('tags',{...t,label,color:f.get(`color-${t.id}`)}));}
   const label=f.get('new-label').trim();if(label){if(labels.has(label.toLowerCase()))throw Error('A tag with this name already exists.');operations.push(row('tags',userRow({goalId:currentGoalId,label,color:f.get('new-color')})));}
   if(operations.length)await save(operations,'Tags updated.');
 });
}
const input=(label,name,value='',type='text')=>`<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" maxlength="100" ${type==='date'?`max="${today()}"`:''} required></label>`;
function required(f,key){const v=f.get(key).trim();if(!v)throw Error('Please fill in all fields.');return v;}
function cascade(goals,partners=[]){const ids=new Set(goals.map(g=>g.id));return [...partners.map(p=>({store:'partners',remove:true,id:p.id})),...['goals','activityDays','tags','notes'].flatMap(store=>data[store].filter(r=>ids.has(store==='goals'?r.id:r.goalId)).map(r=>({store,remove:true,id:r.id})))];}
async function action(name,id,target){
 const p=data.partners.find(p=>p.id===id),g=data.goals.find(g=>g.id===id);
 if(name==='logout'){goalFilters.clear();libraryOpen=false;libraryImages=null;libraryUnusedOnly=false;account=null;partnerId=null;render();}
 if(name==='back'){libraryOpen=false;libraryUnusedOnly=false;partnerId=null;render();}
 if(name==='open-partner'){await initImages(db,`${account.id}:${id}`);partnerId=id;goalId=null;selectedDate=today();render();}
 if(name==='select-goal'){goalId=id;selectedDate=today();render();}
 if(name==='date'){selectedDate=id;render();document.querySelector(`[data-action="date"][data-id="${id}"]`)?.focus();}
 if(name==='zoom'){timelineZoom=id;timelineYear=Number(selectedDate.slice(0,4));render();document.querySelector(`[data-action="zoom"][data-id="${id}"]`)?.focus();}
 if(name==='timeline-year'){timelineYear=Number(id);render();}
 if(name==='month'){const current=data.goals.find(g=>g.id===goalId),days=monthDays(id,current.startDate);if(days.length){selectedDate=id===today().slice(0,7)?today():days[0];timelineZoom='days';render();document.querySelector(`[data-action="date"][data-id="${selectedDate}"]`)?.focus();}}
 if(name==='image-library'){libraryOpen=true;libraryImages=null;libraryError='';expandedImage=null;render();if(partnerId)loadImageLibrary();}
 if(name==='partner-library'){await initImages(db,`${account.id}:${id}`);partnerId=id;libraryOpen=true;libraryUnusedOnly=false;libraryImages=null;libraryError='';expandedImage=null;render();loadImageLibrary();}
 if(name==='filter-goal'){const wasSelected=goalFilters.has(id);goalFilters.clear();if(!wasSelected)goalFilters.add(id);for(const partner of data.partners){if(matchesGoalFilters(partner.id)){const goals=activeGoals(partner.id),preferred=goalFilters.has(id)?id:[...goalFilters].at(-1),index=goals.findIndex(g=>normalizeGoalName(g.name)===preferred);if(index>=0)slides[partner.id]=index;}}render();document.querySelector(`[data-action="filter-goal"][data-id="${id}"]`)?.focus();}
 if(name==='clear-filters'){goalFilters.clear();render();document.querySelector('[data-action="filter-goal"]')?.focus();}
 if(name==='library-image'){const refs=imageReferences(id);if(refs.length===1)jumpToNote(refs[0].note.id);else{expandedImage=id;render();document.querySelector('#image-references')?.focus();}}
 if(name==='toggle-unused'){libraryUnusedOnly=!libraryUnusedOnly;if(expandedImage&&libraryUnusedOnly&&imageReferences(expandedImage).length)expandedImage=null;render();document.querySelector('[data-action="toggle-unused"]')?.focus();}
 if(name==='delete-image'){
  if(imageReferences(id).length)return notice('This image is used in a saved note.');
  if(!confirm('Delete this image? It is not used in a saved note.'))return;
  await deleteImage(id);
  libraryImages=libraryImages?.filter(image=>image.id!==id)??null;
  if(expandedImage===id)expandedImage=null;
  render();notice('Image deleted.');
 }
 if(name==='jump-note')jumpToNote(id);
 if(name==='next'||name==='previous'){const n=activeGoals(id).length;slides[id]=((slides[id]||0)+(name==='next'?1:-1)+n)%n;render();document.querySelector(`[data-action="${name}"][data-id="${id}"]`)?.focus();}
 if(name==='add-partner'||name==='edit-partner')formDialog(p?'Edit partner':'Add partner',input('Name','name',p?.name),async f=>save([row('partners',p?{...p,name:required(f,'name')}:userRow({accountId:account.id,name:required(f,'name')}))]));
 if(name==='add-goal'||name==='edit-goal')formDialog(g?'Edit goal':'Add goal',input('Goal','name',g?.name)+`<label>Description<textarea name="description" maxlength="1000">${esc(g?.description)}</textarea></label>`+input('Start date','startDate',g?.startDate||today(),'date'),async f=>{const startDate=required(f,'startDate');if(!validDate(startDate)||startDate>today())throw Error('Choose a valid start date no later than today.');const existingDates=g?[...goalDays(g.id),...data.notes.filter(n=>n.goalId===g.id).map(n=>n.date)]:[];if(existingDates.some(d=>d<startDate))throw Error('Start date must be on or before existing activity and notes.');const value={...(g||userRow({partnerId,archived:false,sortOrder:data.goals.length})),name:required(f,'name'),description:f.get('description').trim(),startDate};goalId=value.id;await save([row('goals',value)]);});
 if(name==='archive-goal')await save([row('goals',{...g,archived:!g.archived})]);
 if(name==='delete-goal'&&confirm(`Delete “${g.name}” and all of its activity and notes?`))await save(cascade([g]));
 if(name==='delete-partner'&&confirm(`Delete ${p.name} and all their goals, activity and notes?`))await save(cascade(data.goals.filter(g=>g.partnerId===id),[p]));
 if(name==='check-in'){if(selectedDate<g.startDate||selectedDate>today())return notice('Choose a date between the goal start and today.');const key=`${id}|${selectedDate}`;await save(goalDays(id).includes(selectedDate)?[{store:'activityDays',remove:true,id:key}]:[row('activityDays',activity(g,selectedDate))]);}
 if(name==='delete-note'&&confirm('Delete this note? The daily check-in will stay.'))await save([{store:'notes',remove:true,id}]);
 if(name==='edit-note'){
 const n=data.notes.find(n=>n.id===id);
 formDialog('Edit note',pickerHTML('edit-note-tags',noteTagIds(n))+richEditor('edit-note-body','Note',noteHTML(n)),async()=>{
   const content=editorValue(editor.querySelector('.rich-field')),{operations,tagIds}=tagOperations(editor.querySelector('.tag-picker'),n.goalId);
   const value={...n,tagIds,...content,updatedAt:new Date().toISOString()};delete value.tagId;
   await save([...operations,row('notes',value)]);
 });
 }
 if(name==='manage-tags')manageTags(id);
 if(name==='delete-tag'){
   const tag=data.tags.find(t=>t.id===id);if(!tag)return;
   const affected=data.notes.filter(n=>n.goalId===tag.goalId&&noteTagIds(n).includes(id));
   if(!confirm(`Remove “${tag.label}” from ${affected.length} note(s) and delete this tag? The notes themselves will stay.`))return;
   const operations=[{store:'tags',remove:true,id}];
   for(const n of affected){const value={...n,tagIds:noteTagIds(n).filter(t=>t!==id)};delete value.tagId;operations.push(row('notes',value));}
   await save(operations,'Tag removed. Notes kept.');editor.close();manageTags(tag.goalId);
 }

 if(name==='reset'&&confirm('Restore the demo examples? Only seeded records are replaced; your own records and password stay.')){await seedDemo(db,true);await refresh();render();notice('Demo examples restored.');}
}
let cardPointer=null,cardWasDragged=false;
document.addEventListener('pointerover',e=>{const cell=e.target.closest?.('.heatmap .cell[data-date]');if(cell)showCellTip(cell);else hideCellTip();});
document.addEventListener('scroll',hideCellTip,true);
document.addEventListener('pointerdown',e=>{cardPointer=e.target.closest('.partner-card')?{x:e.clientX,y:e.clientY}:null;cardWasDragged=false;});
document.addEventListener('pointerup',e=>{if(cardPointer)cardWasDragged=Math.hypot(e.clientX-cardPointer.x,e.clientY-cardPointer.y)>6;});
document.addEventListener('click',e=>{
 const t=e.target.closest('[data-action]');
 if(t){action(t.dataset.action,t.dataset.id,t).catch(err=>notice(`Could not save: ${err.message}`));return;}
 const card=e.target.closest('.partner-card[data-partner-id]');
 if(!card||e.defaultPrevented||cardWasDragged||getSelection()?.toString())return;
 if(e.target.closest('button,a,input,textarea,select,summary,[contenteditable=true],[tabindex],[role=button]'))return;
 action('open-partner',card.dataset.partnerId,card).catch(err=>notice(`Could not open workspace: ${err.message}`));
});
window.addEventListener('focus',()=>{if(db&&account&&!document.querySelector('.rich-field')&&!editor.open&&!document.activeElement?.matches('input,textarea,[contenteditable=true]')&&!document.querySelector('[data-uploading=true]'))refresh().then(render).catch(err=>notice(err.message));});
let renderedDay=today();
setInterval(()=>{if(today()!==renderedDay){renderedDay=today();if(account&&!document.activeElement?.matches('input,textarea,[contenteditable=true]'))render();}},60000);
async function boot(){try{db=await openDB();await ensureDemoAccount(db);await seedDemo(db);await refresh();demoAutofill=await usesDemoCredentials(data.accounts.find(a=>a.username===DEMO_USERNAME));render();}catch(err){app.innerHTML='<section class="login"><h1>Could not open your workspace</h1><p>Browser storage is unavailable. Check your storage or private browsing settings, then retry.</p><button id="retry">Retry</button></section>';notice(err.message);document.querySelector('#retry').onclick=boot;}}
boot();
