import {IMAGE_ID,imageURL,uploadImage,listImages} from './images.js';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const allowed=new Set(['P','BR','DIV','STRONG','B','EM','I','U','S','UL','OL','LI','BLOCKQUOTE','H3','A']);
export function cleanHTML(html,{display=false}={}) {
  const source=document.createElement('template');source.innerHTML=html;
  const output=document.createElement('div');
  function copy(node,parent){
    if(node.nodeType===Node.TEXT_NODE){parent.append(document.createTextNode(node.textContent));return;}
    if(node.nodeType!==Node.ELEMENT_NODE)return;
    if(['SCRIPT','STYLE','IFRAME','OBJECT','SVG','MATH','FORM','INPUT','BUTTON','TEMPLATE'].includes(node.tagName))return;
    if(node.tagName==='IMG'){
      const id=node.getAttribute('data-image-id');
      if(!IMAGE_ID.test(id||''))return;
      const image=document.createElement('img');image.dataset.imageId=id;image.alt=(node.getAttribute('alt')||'Uploaded image').slice(0,200);
      if(display){image.src=imageURL(id);image.loading='lazy';image.referrerPolicy='no-referrer';}
      parent.append(image);return;
    }
    if(!allowed.has(node.tagName)){node.childNodes.forEach(n=>copy(n,parent));return;}
    const element=document.createElement(node.tagName.toLowerCase());
    if(node.tagName==='A'){
      try{const url=new URL(node.getAttribute('href'));if(['http:','https:','mailto:'].includes(url.protocol)){element.href=url.href;element.target='_blank';element.rel='noopener noreferrer';}}catch{}
    }
    parent.append(element);node.childNodes.forEach(n=>copy(n,element));
  }
  source.content.childNodes.forEach(n=>copy(n,output));return output.innerHTML;
}
export function noteHTML(note){return note.html?cleanHTML(note.html,{display:true}):escape(note.text||'').replace(/\n/g,'<br>');}
export function imageIds(html){const t=document.createElement('template');t.innerHTML=cleanHTML(html);return [...new Set([...t.content.querySelectorAll('img')].map(i=>i.dataset.imageId))];}
export function richEditor(id,label,html='') {
 return `<div class="rich-field"><span id="${id}-label" class="field-label">${label}</span><div class="rich-toolbar" role="toolbar" aria-label="Note formatting">${[['bold','Bold'],['italic','Italic'],['underline','Underline'],['insertUnorderedList','Bullet list'],['insertOrderedList','Numbered list']].map(([c,l])=>`<button type="button" data-command="${c}">${l}</button>`).join('')}<button type="button" data-link>Link</button><button type="button" data-upload>Add image</button><button type="button" data-reuse>My images</button><button type="button" data-expand aria-label="Expand note editor" title="Open a larger writing space">⤢ Expand editor</button><input type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden></div><div class="rich-body" id="${id}" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="${id}-label">${cleanHTML(html,{display:true})}</div><div class="rich-picker" hidden></div><p class="editor-help">Paste an image or add one from your library. PNG, JPEG, GIF, WebP · up to 8 MB.</p><p class="upload-status" role="status"></p></div>`;
}
export function bindEditor(root) {
 const body=root.querySelector('.rich-body'),status=root.querySelector('.upload-status'),fileInput=root.querySelector('input[type=file]');
 let bookmark=null,pending=0;
 const capture=()=>{const s=getSelection();if(s.rangeCount&&body.contains(s.anchorNode))bookmark=s.getRangeAt(0).cloneRange();};
 body.addEventListener('keyup',capture);body.addEventListener('mouseup',capture);body.addEventListener('input',capture);
 function restore(){body.focus();const s=getSelection();s.removeAllRanges();if(bookmark&&body.contains(bookmark.startContainer)){s.addRange(bookmark);}else{const r=document.createRange();r.selectNodeContents(body);r.collapse(false);s.addRange(r);}}
 function insert(html){restore();document.execCommand('insertHTML',false,html);capture();}
 function insertImage(image){insert(`<img data-image-id="${image.id}" src="${escape(imageURL(image.id))}" alt="Uploaded image" referrerpolicy="no-referrer"><br>`);}
 async function upload(files){
   capture();pending++;root.dataset.uploading='true';status.textContent='Uploading image…';
   try{for(const file of files){const image=await uploadImage(file);if(!body.isConnected)return;insertImage(image);}status.textContent='Image ready. Save the note to keep its reference.';}
   catch(err){status.textContent=err.message;}
   finally{pending--;root.dataset.uploading=pending?'true':'false';}
 }
 root.querySelector('[data-expand]').onclick=()=>{
   capture();
   const placeholder=document.createComment('editor position');root.before(placeholder);
   const modal=document.createElement('dialog');modal.className='editor-expanded';
   const headingId=`${body.id}-expanded-heading`;
   modal.setAttribute('aria-labelledby',headingId);
   modal.innerHTML=`<div class="expanded-heading"><div><h2 id="${headingId}">Write your reflection</h2><p>Your draft stays with the note. Save it after you return.</p></div><button type="button" class="primary" data-done>Done editing ↙</button></div>`;
   modal.append(root);document.body.append(modal);
   modal.querySelector('[data-done]').onclick=()=>modal.close();
   modal.addEventListener('close',()=>{
     if(placeholder.isConnected){placeholder.replaceWith(root);}
     modal.remove();body.focus();capture();
   },{once:true});
   modal.showModal();restore();
 };
 root.querySelectorAll('[data-command]').forEach(b=>{b.onmousedown=e=>e.preventDefault();b.onclick=()=>{restore();document.execCommand(b.dataset.command);capture();};});
 root.querySelector('[data-link]').onclick=()=>{const href=prompt('Link URL (https://…)');if(!href)return;try{const u=new URL(href);if(!['http:','https:','mailto:'].includes(u.protocol))throw Error();restore();document.execCommand('createLink',false,u.href);capture();}catch{status.textContent='Enter a valid HTTP, HTTPS, or email link.';}};
 root.querySelector('[data-upload]').onclick=()=>{capture();fileInput.click();};
 fileInput.onchange=()=>{if(fileInput.files.length)upload([...fileInput.files]);fileInput.value='';};
 body.onpaste=e=>{
   const files=[...e.clipboardData.items].filter(i=>i.kind==='file'&&i.type.startsWith('image/')).map(i=>i.getAsFile()).filter(Boolean);
   e.preventDefault();
   if(files.length){upload(files);return;}
   const html=e.clipboardData.getData('text/html'),text=e.clipboardData.getData('text/plain');
   insert(html?cleanHTML(html,{display:true}):escape(text).replace(/\n/g,'<br>'));
 };
 body.ondragover=e=>e.preventDefault();body.ondrop=e=>{e.preventDefault();if(e.dataTransfer.files.length)upload([...e.dataTransfer.files]);};
 root.querySelector('[data-reuse]').onclick=async()=>{
   capture();const picker=root.querySelector('.rich-picker');if(!picker.hidden){picker.hidden=true;return;}
   picker.hidden=false;picker.textContent='Loading your images…';
   try{const images=await listImages();picker.replaceChildren();if(!images.length)picker.textContent='No uploaded images yet.';
     for(const image of images){const b=document.createElement('button');b.type='button';b.title='Insert this image';const img=document.createElement('img');img.src=imageURL(image.id);img.alt='Insert uploaded image';img.referrerPolicy='no-referrer';b.append(img);b.onclick=()=>{insertImage(image);picker.hidden=true;};picker.append(b);}
   }catch(err){picker.textContent=err.message;}
 };
}
export function editorValue(root){
 if(root.dataset.uploading==='true')throw Error('Wait for the image upload to finish before saving.');
 const html=cleanHTML(root.querySelector('.rich-body').innerHTML),t=document.createElement('div');t.innerHTML=html;
 const text=t.textContent.trim(),ids=imageIds(html);
 if(!text&&!ids.length)throw Error('Write a note or add an image.');
 if(text.length>5000||html.length>100000)throw Error('Keep notes under 5,000 text characters.');
 return {text,html,imageIds:ids};
}
