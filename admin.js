const $=id=>document.getElementById(id);
const form=$("adminForm");
const chartInput=$("chartNo"),nameInput=$("patientName"),phoneInput=$("phoneLast4"),memoInput=$("memo"),dateInput=$("appointmentDate"),dateGuide=$("dateGuide"),timeArea=$("timeArea"),submitButton=$("submitButton"),adminError=$("adminError");
const calendarTitle=$("calendarTitle"),calendarDays=$("calendarDays"),previousMonthButton=$("previousMonth"),nextMonthButton=$("nextMonth"),successScreen=$("successScreen"),reservationSummary=$("reservationSummary"),newReservationButton=$("newReservationButton");
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
function range(){const t=new Date(),min=t,max=addDays(t,180);return{min,max,start:toKey(min),end:toKey(max)}}
function showError(el,m){el.textContent=m;el.classList.add("show")}
function clearError(el){el.textContent="";el.classList.remove("show")}
function disabled(d){const r=range(),x=new Date(d.getFullYear(),d.getMonth(),d.getDate()),min=new Date(r.min.getFullYear(),r.min.getMonth(),r.min.getDate()),max=new Date(r.max.getFullYear(),r.max.getMonth(),r.max.getDate());return x<min||x>max||d.getDay()===0||d.getDay()===6||closedDates.has(toKey(d))}
phoneInput.oninput=()=>phoneInput.value=phoneInput.value.replace(/\D/g,"").slice(0,4);
chartInput.oninput=()=>chartInput.value=chartInput.value.replace(/\s/g,"").slice(0,20);

function renderCalendar(){
  calendarDays.innerHTML="";const y=calendarMonth.getFullYear(),m=calendarMonth.getMonth(),first=new Date(y,m,1),last=new Date(y,m+1,0).getDate();calendarTitle.textContent=`${y}년 ${m+1}월`;
  for(let i=0;i<first.getDay();i++){const e=document.createElement("span");e.className="day empty";calendarDays.appendChild(e)}
  for(let n=1;n<=last;n++){const d=new Date(y,m,n),key=toKey(d),b=document.createElement("button");b.type="button";b.textContent=n;b.className="day";if(key===dateInput.value)b.classList.add("selected");if(disabled(d)){b.disabled=true;b.classList.add("disabled")}else b.onclick=()=>{dateInput.value=key;selectedTime="";document.querySelectorAll(".day").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");dateGuide.textContent=`${format(key)} 예약 시간을 선택해 주세요.`;renderTimes(key);clearError(adminError)};calendarDays.appendChild(b)}
  const r=range();previousMonthButton.disabled=new Date(y,m,0)<r.min;nextMonthButton.disabled=new Date(y,m+1,1)>r.max;
}
previousMonthButton.onclick=()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1);renderCalendar()};
nextMonthButton.onclick=()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1);renderCalendar()};
function renderTimes(key){selectedTime="";timeArea.innerHTML="";timeArea.className="time-grid";const times=parse(key).getDay()===4?[...morning,...afternoon]:morning;times.forEach(time=>{const b=document.createElement("button"),taken=bookedSlots.has(`${key} ${time}`);b.type="button";b.className="time-button";b.disabled=taken;b.textContent=taken?`${time} 마감`:time;b.onclick=()=>{document.querySelectorAll(".time-button").forEach(x=>x.classList.remove("selected"));selectedTime=time;b.classList.add("selected");clearError(adminError)};timeArea.appendChild(b)})}
async function loadAvailability(){const r=range();closedDates=new Set();bookedSlots=new Set();try{const response=await fetch(`/api/availability?start=${r.start}&end=${r.end}`),result=await response.json();if(!response.ok)throw new Error(result.error);closedDates=new Set(result.closedDates||[]);bookedSlots=new Set(result.bookedSlots||[])}catch(e){showError(adminError,e.message||"예약 일정을 불러오지 못했습니다.")}renderCalendar()}

form.onsubmit=async e=>{
  e.preventDefault();clearError(adminError);
  const chartNo=chartInput.value.trim(),patientName=nameInput.value.trim(),phoneLast4=phoneInput.value,appointmentDate=dateInput.value,memo=memoInput.value.trim();
  if(!chartNo)return showError(adminError,"차트번호를 입력해 주세요.");
  if(!/^[가-힣a-zA-Z\s]{2,20}$/.test(patientName))return showError(adminError,"환자명을 정확히 입력해 주세요.");
  if(!/^\d{4}$/.test(phoneLast4))return showError(adminError,"휴대폰번호 뒷자리 4자리를 확인해 주세요.");
  if(!appointmentDate||!selectedTime)return showError(adminError,"예약 날짜와 시간을 선택해 주세요.");
  submitButton.disabled=true;submitButton.textContent="등록 중입니다…";
  try{
    const response=await fetch("/api/admin-reservation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chartNo,patientName,phoneLast4,appointmentDate,appointmentTime:selectedTime,memo})}),result=await response.json();
    if(!response.ok)throw new Error(result.error||"예약을 등록하지 못했습니다.");
    reservationSummary.innerHTML=`<strong>${patientName}</strong><br>차트번호 ${chartNo}<br>${format(appointmentDate)} ${selectedTime}<br>오지혜 원장님`;
    form.classList.add("hidden");successScreen.classList.remove("hidden");successScreen.scrollIntoView({behavior:"smooth"});
  }catch(err){showError(adminError,err.message||"예약을 등록하지 못했습니다.")}
  finally{submitButton.disabled=false;submitButton.innerHTML='예약 등록하기 <span>→</span>'}
};
newReservationButton.onclick=async()=>{form.reset();dateInput.value="";selectedTime="";timeArea.className="empty";timeArea.textContent="먼저 예약 날짜를 선택해 주세요.";dateGuide.textContent="회색 날짜는 휴진일 또는 예약 불가일입니다.";successScreen.classList.add("hidden");form.classList.remove("hidden");calendarMonth=new Date();calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),1);await loadAvailability();form.scrollIntoView({behavior:"smooth"})};

loadAvailability();
