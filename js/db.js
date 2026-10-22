export const STORES=['meta','accounts','partners','goals','activityDays','tags','notes'];
export function openDB() {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('accountability-app',1);
    request.onupgradeneeded=()=>{
      const db=request.result;
      for(const name of STORES) db.createObjectStore(name,{keyPath:'id'});
      const tx=request.transaction;
      tx.objectStore('accounts').createIndex('byUsername','username',{unique:true});
      tx.objectStore('partners').createIndex('byAccount','accountId');
      tx.objectStore('goals').createIndex('byPartner','partnerId');
      tx.objectStore('activityDays').createIndex('byGoal','goalId');
      tx.objectStore('activityDays').createIndex('byGoalDate',['goalId','date'],{unique:true});
      tx.objectStore('tags').createIndex('byScope','goalId');
      tx.objectStore('notes').createIndex('byGoalDate',['goalId','date']);
      tx.objectStore('notes').createIndex('byTag','tagId');
      tx.objectStore('meta').put({id:'schemaVersion',value:1});
    };
    request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error('Close other Accountability tabs, then retry.'));
  });
}
export function read(db,store) {
  return new Promise((resolve,reject)=>{
    const r=db.transaction(store).objectStore(store).getAll();
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
}
export function write(db, operations) {
  return new Promise((resolve,reject)=>{
    const tx=db.transaction([...new Set(operations.map(o=>o.store))],'readwrite');
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error || new Error('Save cancelled.'));
    for(const op of operations) tx.objectStore(op.store)[op.remove?'delete':'put'](op.remove?op.id:op.value);
  });
}
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
export async function verifier(password,salt=hex(crypto.getRandomValues(new Uint8Array(16)))) {
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const hash=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:210000,hash:'SHA-256'},key,256);
  return {salt,hash:hex(new Uint8Array(hash)),iterations:210000};
}
