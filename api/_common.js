export function getWebhook(){
  const webhook=process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if(!webhook)throw new Error("구글시트 연결 정보가 없습니다.");
  return webhook;
}
export async function postToSheet(payload){
  const webhook=getWebhook();
  const r=await fetch(webhook,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  const text=await r.text();
  let data={};try{data=JSON.parse(text)}catch{throw new Error("구글시트 응답을 확인하지 못했습니다.")}
  return {r,data};
}
export function validName(v){return /^[가-힣a-zA-Z\s]{2,20}$/.test(String(v||"").trim())}
export function validLast4(v){return /^\d{4}$/.test(String(v||""))}
export function validDate(v){return /^\d{4}-\d{2}-\d{2}$/.test(String(v||""))}
export function validTime(v){return /^\d{2}:\d{2}$/.test(String(v||""))}
export function checkAdmin(req){
  const expected=process.env.ADMIN_PASSWORD;
  const received=req.headers["x-admin-password"];
  return Boolean(expected&&received&&received===expected);
}
