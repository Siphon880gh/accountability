export function today(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
export function shift(date, n) {
  const [y,m,d] = date.split('-').map(Number);
  return today(new Date(y,m-1,d+n,12));
}
export function validDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && shift(date,0) === date;
}
export function streaks(dates, anchor = today()) {
  const sorted = [...new Set(dates)].filter(d=>validDate(d) && d<=anchor).sort();
  const runs=[];
  for (const date of sorted) {
    const last=runs.at(-1);
    if(last && shift(last.end,1)===date){last.end=date;last.length++;}
    else runs.push({start:date,end:date,length:1});
  }
  const last=runs.at(-1);
  const current=last && (last.end===anchor || last.end===shift(anchor,-1)) ? last.length : 0;
  return {current, history:runs.slice(0,current?-1:undefined).reverse().slice(0,3)};
}
export function heatmapDates(start, anchor=today()) {
  const first = start > shift(anchor,-364) ? start : shift(anchor,-364);
  const dates=[];
  for(let d=first;d<=anchor;d=shift(d,1)) dates.push(d);
  return dates;
}
