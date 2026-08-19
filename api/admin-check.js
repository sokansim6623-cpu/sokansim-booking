import {checkAdmin} from "./_common.js";
export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"허용되지 않은 요청입니다."});
  if(!process.env.ADMIN_PASSWORD)return res.status(500).json({error:"직원용 비밀번호가 설정되지 않았습니다."});
  if(!checkAdmin(req))return res.status(401).json({error:"직원용 비밀번호를 확인해 주세요."});
  return res.status(200).json({ok:true});
}
