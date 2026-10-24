import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGoalName,summarizeGoals} from '../js/goalSummary.js';

test('matching ignores case, whitespace and special characters',()=>{
 for(const name of ['Strength training','STRENGTH-TRAINING!',' strength_training ','Strength\tTraining 💪']) assert.equal(normalizeGoalName(name),'strengthtraining');
 assert.equal(normalizeGoalName('讀書 30 分鐘！'),'讀書30分鐘');
 assert.equal(normalizeGoalName(' !!! '),'');
});

test('counts distinct partners and scopes to active goals in this account',()=>{
 const partners=[{id:'a',accountId:'mine'},{id:'b',accountId:'mine'},{id:'c',accountId:'other'},{id:'d',accountId:'mine',archived:true}];
 const goals=[{partnerId:'a',name:'Read books'},{partnerId:'a',name:'READ-BOOKS'},{partnerId:'b',name:'read_books!'},{partnerId:'c',name:'Read books'},{partnerId:'d',name:'Read books'},{partnerId:'b',name:'Read books',archived:true},{partnerId:'missing',name:'Read books'},{partnerId:'a',name:'Run'},{partnerId:'a',name:'Old goal',archived:true},{partnerId:'a',name:'!!!'}];
 assert.deepEqual(summarizeGoals(goals,partners,'mine'),[{key:'readbooks',label:'Read books',count:2},{key:'run',label:'Run',count:1}]);
 assert.equal(goals[1].name,'READ-BOOKS');
 assert.deepEqual(summarizeGoals([],partners,'mine'),[]);
 goals[2].archived=true;
 assert.equal(summarizeGoals(goals,partners,'mine')[0].count,1);
});
