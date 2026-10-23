import {read,write,verifier} from './db.js';

// Public demo credentials, intentionally displayed on the sign-in screen.
export const DEMO_USERNAME='admin';
export const DEMO_PASSWORD='password';

export async function ensureDemoAccount(db) {
  const accounts=await read(db,'accounts');
  if(accounts.some(a=>a.username===DEMO_USERNAME)) return;
  const passwordVerifier=await verifier(DEMO_PASSWORD);
  await write(db,[{store:'accounts',value:{id:'acct-demo-admin',username:DEMO_USERNAME,displayName:'Demo Admin',passwordVerifier,createdAt:new Date().toISOString(),isDemo:true,origin:'demo-seed'}}]);
}
export async function usesDemoCredentials(account) {
  return !!account && (await verifier(DEMO_PASSWORD,account.passwordVerifier.salt)).hash===account.passwordVerifier.hash;
}
export async function enableDemoCredentials(db,account) {
  if(account.id!=='acct-demo-admin'||!account.isDemo) throw Error('Only the local demo account can use demo credentials.');
  await write(db,[{store:'accounts',value:{...account,passwordVerifier:await verifier(DEMO_PASSWORD)}}]);
}
