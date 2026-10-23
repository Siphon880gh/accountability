import {today,shift} from './dates.js';
import {read,write} from './db.js';
export const SEED_VERSION=1;
export function seedPack(anchor=today()) {
  const createdAt=new Date().toISOString(), origin='demo-seed';
  const pack={partners:[],goals:[],tags:[],notes:[],activityDays:[]};
  for(const [id,name] of [['alex','Alex Rivers'],['blair','Blair Nguyen'],['casey','Casey Ortiz']]) pack.partners.push({id:`partner-${id}`,accountId:'acct-demo-admin',name,createdAt,origin});
  const definitions=[['lift','alex','Strength training',[0,-1,-2,-3,-4,-10,-11,-12]],['read','alex','Reading',[-3,-4,-5,-6,-12,-13,-14,-15,-16,-17,-18,-25,-26]],['meditate','alex','Meditation',[-3,-8,-14,-22,-35,-50,-61]],['jobs','blair','Job applications',[0,-1,-8]],['language','casey','Language practice',[]]];
  for(const [id,partner,name,offsets] of definitions) {
    const goalId=`goal-${id}`;
    pack.goals.push({id:goalId,partnerId:`partner-${partner}`,name,description:'',startDate:shift(anchor,-83),createdAt,origin,archived:false,sortOrder:pack.goals.length});
    for(const offset of offsets){const date=shift(anchor,offset);pack.activityDays.push({id:`${goalId}|${date}`,goalId,date,source:'check-in',createdAt,origin});}
  }
  for(const [goal,label,text,offset] of [['lift','Win','Hit all my sets. Felt stronger than last week.',0],['lift','Focus','A good night’s sleep made a difference.',-1],['read','Mood','A quiet evening and a chapter worth slowing down for.',-3],['jobs','Blocker','Reworked my resume before sending the next application.',-8]]) {
    const goalId=`goal-${goal}`,tagId=`tag-${goal}-${label.toLowerCase()}`;
    pack.tags.push({id:tagId,goalId,label,createdAt,origin});
    pack.notes.push({id:`note-${tagId}`,goalId,tagId,text,date:shift(anchor,offset),createdAt,origin});
  }
  return pack;
}
export async function seedDemo(db, reset=false) {
  const meta=await read(db,'meta');
  if(!reset && meta.some(m=>m.id==='demoSeedVersion'&&m.value===SEED_VERSION)) return false;
  const pack=seedPack(),operations=[];
  for(const [store,rows] of Object.entries(pack)) {
    const existing=await read(db,store);
    if(reset) for(const row of existing.filter(r=>r.origin==='demo-seed')) operations.push({store,remove:true,id:row.id});
    for(const value of rows) {
      const prior=existing.find(r=>r.id===value.id);
      // A user check-in can share a deterministic day key with the demo.
      if(prior?.origin==='user') continue;
      if(reset || !prior) operations.push({store,value});
    }
  }
  operations.push({store:'meta',value:{id:'demoSeedVersion',value:SEED_VERSION}},{store:'meta',value:{id:'demoSeededAt',value:new Date().toISOString()}});
  await write(db,operations);return true;
}
