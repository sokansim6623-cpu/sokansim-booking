import {checkAdmin,postToSheet,validName,validLast4,validDate,validTime} from "./_common.js";
export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"허용되지 않은 요청입니다."});
  if(!checkAdmin(req))return res.status(401).json({error:"직원용 비밀번호를 확인해 주세요."});
  const p=req.body||{},chartNo=String(p.chartNo||"").trim(),patientName=String(p.patientName||"").trim(),phoneLast4=String(p.phoneLast4||""),memo=String(p.memo||"").trim();
  if(!chartNo)return res.status(400).json({error:"차트번호를 입력해 주세요."});
  if(!validName(patientName))return res.status(400).json({error:"환자명을 정확히 입력해 주세요."});
  if(!validLast4(phoneLast4))return res.status(400).json({error:"휴대폰번호 뒷자리 4자리를 확인해 주세요."});
  if(!validDate(p.appointmentDate)||!validTime(p.appointmentTime))return res.status(400).json({error:"예약 날짜와 시간을 확인해 주세요."});
  try{
    const {data}=await postToSheet({action:"admin_create",chartNo,patientName,phoneLast4,appointmentDate:String(p.appointmentDate),appointmentTime:String(p.appointmentTime),memo:memo.slice(0,300)});
    if(data.error==="slot_taken")return res.status(409).json({error:"해당 시간은 이미 예약되어 있습니다. 다른 시간을 선택해 주세요."});
    if(data.ok!==true)throw new Error(data.error||"예약을 저장하지 못했습니다.");
    return res.status(201).json({ok:true,reservationId:data.reservationId});
  }catch(e){return res.status(500).json({error:e.message||"예약을 저장하지 못했습니다."})}
}
