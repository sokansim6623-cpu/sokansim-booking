import {postToSheet,validName,validLast4} from "./_common.js";
export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"허용되지 않은 요청입니다."});
  const p=req.body||{},reservationId=String(p.reservationId||""),patientName=String(p.patientName||"").trim(),phoneLast4=String(p.phoneLast4||"");
  if(!reservationId||!validName(patientName)||!validLast4(phoneLast4))return res.status(400).json({error:"예약 정보를 다시 확인해 주세요."});
  try{
    const {data}=await postToSheet({action:"cancel",reservationId,patientName,phoneLast4});
    if(data.error==="not_found")return res.status(404).json({error:"취소할 예약을 확인하지 못했습니다."});
    if(data.ok!==true)throw new Error(data.error||"예약을 취소하지 못했습니다.");
    return res.status(200).json({ok:true});
  }catch(e){return res.status(500).json({error:e.message||"예약을 취소하지 못했습니다."})}
}
