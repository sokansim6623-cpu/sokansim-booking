import {getWebhook} from "./_common.js";
export default async function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({error:"허용되지 않은 요청입니다."});
  try{
    const webhook=getWebhook(),{start,end,excludeDate,excludeTime}=req.query;
    const url=new URL(webhook);
    url.searchParams.set("action","availability");
    url.searchParams.set("start",String(start||""));
    url.searchParams.set("end",String(end||""));
    if(excludeDate)url.searchParams.set("excludeDate",String(excludeDate));
    if(excludeTime)url.searchParams.set("excludeTime",String(excludeTime));
    const r=await fetch(url),data=await r.json();
    if(!r.ok||data.ok===false)throw new Error(data.error||"예약 일정을 불러오지 못했습니다.");
    res.setHeader("Cache-Control","public, max-age=5, s-maxage=10, stale-while-revalidate=20");
    return res.status(200).json({closedDates:data.closedDates||[],bookedSlots:data.bookedSlots||[]});
  }catch(e){return res.status(500).json({error:e.message||"예약 일정을 불러오지 못했습니다."})}
}
