import {postToSheet,validName,validLast4} from "./_common.js";
export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"허용되지 않은 요청입니다."});
  const p=req.body||{},patientName=String(p.patientName||"").trim(),phoneLast4=String(p.phoneLast4||"");
  if(!validName(patientName))return res.status(400).json({error:"성함을 정확히 입력해 주세요."});
  if(!validLast4(phoneLast4))return res.status(400).json({error:"휴대전화번호 뒤 4자리를 확인해 주세요."});
  try{
    const {data}=await postToSheet({action:"lookup",patientName,phoneLast4});
    if(data.error==="not_found")return res.status(404).json({error:"확인되는 예약이 없습니다. 성함과 휴대전화번호 뒤 4자리를 확인해 주세요."});
    if(data.ok!==true||!data.reservation)throw new Error(data.error||"예약을 확인하지 못했습니다.");
    return res.status(200).json({ok:true,reservation:data.reservation});
  }catch(e){return res.status(500).json({error:e.message||"예약을 확인하지 못했습니다."})}
}
