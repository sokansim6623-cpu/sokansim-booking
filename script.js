const $=id=>document.getElementById(id);
const form=$("reservationForm"),nameInput=$("patientName"),birthInput=$("birthDate"),phoneInput=$("phoneLast4"),dateInput=$("appointmentDate"),dateGuide=$("dateGuide"),timeArea=$("timeArea"),privacyInput=$("privacyConsent"),submitButton=$("submitButton"),errorMessage=$("errorMessage"),successScreen=$("successScreen"),reservationSummary=$("reservationSummary"),calendarTitle=$("calendarTitle"),calendarDays=$("calendarDays"),previousMonthButton=$("previousMonth"),nextMonthButton=$("nextMonth");
const morning=["08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30"];
const afternoon=["14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30"];
const weekdays=["일","월","화","수","목","금","토"];
let selectedTime="",closedDates=new Set(),bookedSlots=new Set(),calendarMonth=new Date();
calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),1);
const pad=n=>String(n).padStart(2,"0");
const toKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const parse=k=>{const [y,m,d]=k.split("-").map(Number);return new Date(y,m-1,d)};
const format=k=>{const d=parse(k);return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${weekdays[d.getDay()]})`};
function range(){const t=new Date(),min=addDays(t,1),max=addDays(t,90);return{min,max,start:toKey(min),end:toKey(max)}}
function showError(m){errorMessage.textContent=m;errorMessage.classList.add("show")}
function clearError(){errorMessage.textContent="";errorMessage.classList.remove("show")}
function disabled(d){const r=range(),x=new Date(d.getFullYear(),d.getMonth(),d.getDate()),min=new Date(r.min.getFullYear(),r.min.getMonth(),r.min.getDate()),max=new Date(r.max.getFullYear(),r.max.getMonth(),r.max.getDate());return x<min||x>max||d.getDay()===0||d.getDay()===6||closedDates.has(toKey(d))}
function renderCalendar(){
  calendarDays.innerHTML="";const y=calendarMonth.getFullYear(),m=calendarMonth.getMonth(),first=new Date(y,m,1),last=new Date(y,m+1,0).getDate();
  calendarTitle.textContent=`${y}년 ${m+1}월`;
  for(let i=0;i<first.getDay();i++){const e=document.createElement("span");e.className="day empty";calendarDays.appendChild(e)}
  for(let n=1;n<=last;n++){const d=new Date(y,m,n),key=toKey(d),b=document.createElement("button");b.type="button";b.textContent=n;b.className="day";if(key===dateInput.value)b.classList.add("selected");if(disabled(d)){b.disabled=true;b.classList.add("disabled")}else b.onclick=()=>{dateInput.value=key;selectedTime="";document.querySelectorAll(".day").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");dateGuide.textContent=`${format(key)} 진료시간을 선택해 주세요.`;renderTimes(key);clearError()};calendarDays.appendChild(b)}
  const r=range();previousMonthButton.disabled=new Date(y,m,0)<r.min;nextMonthButton.disabled=new Date(y,m+1,1)>r.max;
}
previousMonthButton.onclick=()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1);renderCalendar()};
nextMonthButton.onclick=()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1);renderCalendar()};
function renderTimes(key){selectedTime="";timeArea.innerHTML="";timeArea.className="time-grid";const times=parse(key).getDay()===4?[...morning,...afternoon]:morning;times.forEach(time=>{const b=document.createElement("button"),taken=bookedSlots.has(`${key} ${time}`);b.type="button";b.className="time-button";b.disabled=taken;b.textContent=taken?`${time} 마감`:time;b.onclick=()=>{document.querySelectorAll(".time-button").forEach(x=>x.classList.remove("selected"));selectedTime=time;b.classList.add("selected");clearError()};timeArea.appendChild(b)})}
async function loadAvailability(){const r=range();try{const response=await fetch(`/api/availability?start=${r.start}&end=${r.end}`),result=await response.json();if(!response.ok)throw new Error(result.error);closedDates=new Set(result.closedDates||[]);bookedSlots=new Set(result.bookedSlots||[])}catch(e){showError(e.message||"예약 일정을 불러오지 못했습니다.")}renderCalendar()}
birthInput.oninput=()=>birthInput.value=birthInput.value.replace(/\D/g,"").slice(0,8);
phoneInput.oninput=()=>phoneInput.value=phoneInput.value.replace(/\D/g,"").slice(0,4);
form.onsubmit=async e=>{e.preventDefault();clearError();const patientName=nameInput.value.trim(),birthDate=birthInput.value,phoneLast4=phoneInput.value,appointmentDate=dateInput.value;if(!/^[가-힣a-zA-Z\s]{2,20}$/.test(patientName))return showError("성함을 정확히 입력해 주세요.");if(!/^\d{8}$/.test(birthDate))return showError("생년월일 8자리를 확인해 주세요.");if(!/^\d{4}$/.test(phoneLast4))return showError("휴대전화번호 뒤 4자리를 확인해 주세요.");if(!appointmentDate||!selectedTime)return showError("예약 희망 날짜와 시간대를 선택해 주세요.");if(!privacyInput.checked)return showError("개인정보 수집·이용에 동의해 주세요.");submitButton.disabled=true;submitButton.textContent="신청 중입니다…";try{const response=await fetch("/api/reservation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({patientName,birthDate,phoneLast4,appointmentDate,appointmentTime:selectedTime,privacyConsent:true})}),result=await response.json();if(!response.ok)throw new Error(result.error);reservationSummary.innerHTML=`<strong>${format(appointmentDate)}</strong><br>${selectedTime<"13:00"?"오전":"오후"} ${selectedTime}`;form.classList.add("hidden");successScreen.classList.remove("hidden");successScreen.scrollIntoView({behavior:"smooth"})}catch(err){showError(err.message||"예약 신청 중 오류가 발생했습니다.");submitButton.disabled=false;submitButton.innerHTML='예약 신청하기 <span>→</span>'}};
loadAvailability();
