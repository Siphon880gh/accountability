// Keep original labels for display; compare only letters and numbers.
export function normalizeGoalName(name) {
  return String(name).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
}

export function summarizeGoals(goals,partners,accountId) {
  const visiblePartners=new Set(partners.filter(p=>p.accountId===accountId&&!p.archived).map(p=>p.id));
  const groups=new Map();
  for(const goal of goals) {
    if(goal.archived||!visiblePartners.has(goal.partnerId)) continue;
    const key=normalizeGoalName(goal.name);
    if(!key) continue;
    if(!groups.has(key)) groups.set(key,{key,label:goal.name.trim(),partners:new Set()});
    groups.get(key).partners.add(goal.partnerId);
  }
  return [...groups.values()].map(g=>({key:g.key,label:g.label,count:g.partners.size}))
    .sort((a,b)=>a.label.localeCompare(b.label));
}
