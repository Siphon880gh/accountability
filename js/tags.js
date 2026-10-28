export const TAG_COLORS=['#3267a8','#9d4d36','#447557','#7654a3','#986d13','#9a4672','#287782','#636b77'];
export function noteTagIds(note){return [...new Set(Array.isArray(note.tagIds)?note.tagIds:(note.tagId?[note.tagId]:[]))];}
export function tagColor(tag){
 if(/^#[0-9a-f]{6}$/i.test(tag.color||''))return tag.color;
 let hash=0;for(const c of tag.label||'')hash=(hash*31+c.codePointAt(0))>>>0;
 return TAG_COLORS[hash%TAG_COLORS.length];
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function tagDot(tag){return `<i class="tag-dot" style="--tag-color:${tagColor(tag)}" aria-hidden="true"></i>`;}
export function tagBadge(tag){return `<span class="tag-chip" style="--tag-color:${tagColor(tag)}">${tagDot(tag)}${esc(tag.label)}</span>`;}
export function tagsForDate(notes,tags,goalId,date){
 const ids=new Set(notes.filter(n=>n.goalId===goalId&&n.date===date).flatMap(noteTagIds));
 return tags.filter(t=>t.goalId===goalId&&ids.has(t.id));
}
export function pickerHTML(id,selected=[]){
 return `<div class="tag-picker" data-selected="${esc(JSON.stringify(selected))}"><div class="tag-picker-row"><span class="tag-picker-label" id="${id}-label">Tags <small>optional</small></span><div class="selected-tags"></div><input id="${id}" type="text" maxlength="40" placeholder="Find or create a tag…" aria-labelledby="${id}-label" autocomplete="off"></div><div class="tag-options" hidden></div><p class="tag-picker-status" role="status"></p></div>`;
}
export function bindTagPicker(root,catalog){
 const selectedIds=JSON.parse(root.dataset.selected||'[]');
 root.tagSelection=catalog.filter(t=>selectedIds.includes(t.id)).map(t=>({...t}));
 const input=root.querySelector('input'),options=root.querySelector('.tag-options'),chips=root.querySelector('.selected-tags'),status=root.querySelector('.tag-picker-status');
 function drawChips(){
   chips.replaceChildren();
   for(const tag of root.tagSelection){const b=document.createElement('button');b.type='button';b.className='tag-chip removable';b.style.setProperty('--tag-color',tagColor(tag));b.innerHTML=`${tagDot(tag)}${esc(tag.label)} <span aria-hidden="true">×</span>`;b.setAttribute('aria-label',`Remove ${tag.label} tag`);b.onclick=()=>{root.tagSelection=root.tagSelection.filter(t=>t.id!==tag.id);drawChips();drawOptions();input.focus();};chips.append(b);}
 }
 function select(tag){if(!root.tagSelection.some(t=>t.id===tag.id))root.tagSelection.push({...tag});input.value='';status.textContent='';drawChips();drawOptions();input.focus();}
 function create(){const label=input.value.trim();if(!label)return;const existing=catalog.find(t=>t.label.toLowerCase()===label.toLowerCase())||root.tagSelection.find(t=>t.label.toLowerCase()===label.toLowerCase());select(existing||{id:crypto.randomUUID(),label,color:tagColor({label}),isNew:true});}
 function drawOptions(){
   const term=input.value.trim().toLowerCase();options.replaceChildren();
   const matches=catalog.filter(t=>t.label.toLowerCase().includes(term)&&!root.tagSelection.some(s=>s.id===t.id));
   for(const tag of matches){const b=document.createElement('button');b.type='button';b.innerHTML=tagBadge(tag);b.setAttribute('aria-label',`Add ${tag.label} tag`);b.onclick=()=>select(tag);options.append(b);}
   if(term&&!catalog.some(t=>t.label.toLowerCase()===term)&&!root.tagSelection.some(t=>t.label.toLowerCase()===term)){const b=document.createElement('button');b.type='button';b.textContent=`+ Create “${input.value.trim()}”`;b.onclick=create;options.append(b);}
   if(!options.children.length){const p=document.createElement('span');p.className='fine';p.textContent=term?'This tag is already selected.':'Type a name to create a tag.';options.append(p);}
 }
 input.onfocus=()=>{options.hidden=false;drawOptions();};input.onclick=input.onfocus;input.oninput=()=>{options.hidden=false;drawOptions();};
 input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();create();}if(e.key==='Escape'){e.preventDefault();options.hidden=true;}};
 root.addEventListener('focusout',()=>setTimeout(()=>{if(!root.contains(document.activeElement))options.hidden=true;},0));
 root.commitPendingTag=()=>{if(input.value.trim())create();};
 drawChips();if(document.activeElement===input){options.hidden=false;drawOptions();}
}
export function selectedTags(root){root.commitPendingTag();return root.tagSelection;}
