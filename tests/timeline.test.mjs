import test from 'node:test';
import assert from 'node:assert/strict';
import {monthDays,yearMonths} from '../js/timeline.js';
test('months include empty periods and honor start and today',()=>{
 assert.deepEqual(yearMonths(2026,'2026-08-15','2026-11-06'),['2026-08','2026-09','2026-10','2026-11']);
 assert.equal(monthDays('2026-08','2026-08-15','2026-11-06').length,17);
 assert.equal(monthDays('2026-11','2026-08-15','2026-11-06').length,6);
 assert.equal(monthDays('2024-02','2024-01-01','2026-11-06').length,29);
 assert.deepEqual(monthDays('2026-13','2026-01-01'),[]);
});
