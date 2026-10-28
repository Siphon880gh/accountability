import test from 'node:test';
import assert from 'node:assert/strict';
import {noteTagIds,tagColor,tagsForDate,TAG_COLORS} from '../js/tags.js';
test('multiple tags preserve legacy notes and deduplicate IDs',()=>{
 assert.deepEqual(noteTagIds({tagId:'win'}),['win']);
 assert.deepEqual(noteTagIds({tagId:'old',tagIds:['win','focus','win']}),['win','focus']);
 assert.deepEqual(noteTagIds({tagId:'old',tagIds:[]}),[]);
 assert.deepEqual(noteTagIds({}),[]);
});
test('tag colors are deterministic and accept only hex colors',()=>{
 assert.equal(tagColor({label:'Win'}),tagColor({label:'Win'}));
 assert.equal(tagColor({label:'Win',color:'#123abc'}),'#123abc');
 assert.ok(TAG_COLORS.includes(tagColor({label:'Win',color:'red;display:none'})));
});
test('date dots deduplicate tags and stay scoped to their goal and date',()=>{
 const tags=[{id:'a',goalId:'g',label:'Win'},{id:'b',goalId:'g',label:'Focus'},{id:'c',goalId:'other',label:'Elsewhere'}];
 const notes=[{goalId:'g',date:'2026-11-06',tagIds:['a','b']},{goalId:'g',date:'2026-11-06',tagId:'a'},{goalId:'other',date:'2026-11-06',tagIds:['c']},{goalId:'g',date:'2026-11-05',tagIds:['b']}];
 assert.deepEqual(tagsForDate(notes,tags,'g','2026-11-06').map(t=>t.id),['a','b']);
 assert.deepEqual(tagsForDate(notes,tags,'g','2026-11-04'),[]);
});
