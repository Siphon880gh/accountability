import {read,write} from './db.js';
export const IMAGE_ID=/^[a-f0-9]{64}\.(png|jpg|gif|webp)$/;
let libraryKey='';
export async function initImages(db,accountId) {
  const id=`imageLibrary:${accountId}`,meta=await read(db,'meta');
  let saved=meta.find(m=>m.id===id);
  if(!saved){saved={id,value:Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('')};await write(db,[{store:'meta',value:saved}]);}
  libraryKey=saved.value;
}
export function imageURL(id) {
  if(!IMAGE_ID.test(id)||!libraryKey)return '';
  return `api.php?action=image&id=${encodeURIComponent(id)}&key=${libraryKey}`;
}
async function request(action,options={}) {
  const response=await fetch(`api.php?action=${action}`,{...options,headers:{'X-Library-Key':libraryKey},credentials:'omit'});
  let result;
  try{result=await response.json();}catch{throw Error('The image endpoint did not return JSON. Serve this app with PHP and check upload limits.');}
  if(!response.ok)throw Error(result.error||'Image request failed.');
  return result;
}
export async function uploadImage(file) {
  if(!['image/png','image/jpeg','image/gif','image/webp'].includes(file.type))throw Error('Use a PNG, JPEG, GIF, or WebP image.');
  if(file.size>8*1024*1024)throw Error('Choose an image smaller than 8 MB.');
  const form=new FormData();form.append('image',file);
  return (await request('upload',{method:'POST',body:form})).image;
}
export async function listImages(){return (await request('list')).images;}
export async function deleteImage(id){
  if(!IMAGE_ID.test(id))throw Error('Invalid image.');
  await request(`delete&id=${encodeURIComponent(id)}`,{method:'POST'});
}
