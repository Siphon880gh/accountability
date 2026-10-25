import {shift,today} from './dates.js';
export function monthDays(month,start,end=today()) {
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return [];
  const days=[];
  for(let d=`${month}-01`;d.startsWith(month)&&d<=end;d=shift(d,1))if(d>=start)days.push(d);
  return days;
}
export function yearMonths(year,start,end=today()) {
  return Array.from({length:12},(_,i)=>`${year}-${String(i+1).padStart(2,'0')}`).filter(m=>m>=start.slice(0,7)&&m<=end.slice(0,7));
}
