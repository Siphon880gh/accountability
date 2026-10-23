import test from 'node:test';
import assert from 'node:assert/strict';
import {today,shift,streaks,heatmapDates,validDate} from '../js/dates.js';
import {seedPack} from '../js/seed.js';
test('current streak, grace, gaps, dedup and future dates',()=>{
 assert.equal(streaks(['2026-11-04','2026-11-05','2026-11-06','2026-11-06','2026-11-07'],'2026-11-06').current,3);
 assert.equal(streaks(['2026-11-05'],'2026-11-06').current,1);
 assert.deepEqual(streaks(['2026-11-01','2026-11-02','2026-11-04'],'2026-11-06'),{current:0,history:[{start:'2026-11-04',end:'2026-11-04',length:1},{start:'2026-11-01',end:'2026-11-02',length:2}]});
});
test('local day arithmetic crosses DST, leap days and year boundaries',()=>{
 assert.equal(shift('2026-03-08',1),'2026-03-09');assert.equal(shift('2026-11-01',-1),'2026-10-31');assert.equal(shift('2024-02-28',1),'2024-02-29');assert.equal(shift('2026-01-01',-1),'2025-12-31');assert.equal(validDate('2026-02-30'),false);assert.equal(today(new Date(2026,10,6,23,59)),'2026-11-06');
});
test('heatmap caps at 365 days and honors goal start',()=>{
 assert.equal(heatmapDates('2020-01-01','2026-11-06').length,365);assert.equal(heatmapDates('2026-11-05','2026-11-06').length,2);
});
test('seed shows all required streak states and stable unique IDs',()=>{
 const pack=seedPack('2026-11-06');const dates=id=>pack.activityDays.filter(d=>d.goalId===id).map(d=>d.date);
 assert.equal(streaks(dates('goal-lift'),'2026-11-06').current,5);
 assert.deepEqual(streaks(dates('goal-read'),'2026-11-06').history.map(r=>r.length),[4,7,2]);
 assert.equal(streaks(dates('goal-jobs'),'2026-11-06').current,2);assert.equal(dates('goal-language').length,0);
 for(const rows of Object.values(pack)){assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);assert.ok(rows.every(r=>r.origin==='demo-seed'));}
 assert.equal(pack.goals.filter(g=>g.partnerId==='partner-alex').length,3);assert.equal(pack.goals.filter(g=>g.partnerId==='partner-blair').length,1);
});
