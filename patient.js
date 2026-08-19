const $=id=>document.getElementById(id);
const lookupForm=$("lookupForm"),nameInput=$("patientName"),phoneInput=$("phoneLast4"),lookupButton=$("lookupButton"),lookupError=$("lookupError");
const reservationCard=$("reservationCard"),reservationList=$("reservationList"),changeCard=$("changeCard"),cancelCard=$("cancelCard"),successCard=$("successCard");
const changeCloseButton=$("changeCloseButton"),cancelCloseButton=$("cancelCloseButton"),changeSubmitButton=$("changeSubmitButton"),cancelSubmitButton=$("cancelSubmitButton"),changeError=$("changeError"),cancelError=$("cancelError");
const dateInput=$("appointmentDate"),dateGuide=$("dateGuide"),timeArea=$("timeArea"),calendarTitle=$("calendarTitle"),calendarDays=$("calendarDays"),previousMonthButton=$("previousMonth"),nextMonthButton=$("nextMonth");
const changeCurrentSummary=$("changeCurrentSummary"),cancelSummary=$("cancelSummary"),successTitle=$("successTitle"),successSummary=$("successSummary"),restartButton=$("restartButton");

const morning=["08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30"];
const afternoon=["14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30"];
const weekdays=["일","월","화","수","목","금","토"];
let reservations=[],currentReservation=null,selectedTime="",closedDates=new Set(),bookedSlots=new Set(),calendarMonth=new Date();
calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),1);

const pad=n=>String(n).padStart(2,"0");
const toKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const parse=k=>{const [y,m,d]=k.split("-").map(Number);return new Date(y,m-1,d)};
const format=k=>{const d=parse(k);return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${weekdays[d.getDay()]})`};
function range(){const t=new Date(),min=addDays(t,1),max=addDays(t,180);return{min,max,start:toKey(min),end:toKey(max)}}
function showError(el,msg){el.textContent=msg;el.classList.add("show")}
function clearError(el){el.textContent="";el.classList.remove("show")}
function isDisabled(d){const r=range(),x=new Date(d.getFullYear(),d.getMonth(),d.getDate()),min=new Date(r.min.getFullYear(),r.min.getMonth(),r.min.getDate()),max=new Date(r.max.getFullYear(),r.max.getMonth(),r.max.getDate());return x<min||x>max||d.getDay()===0||d.getDay()===6||closedDates.has(toKey(d))}

phoneInput.oninput=()=>phoneInput.value=phoneInput.value.replace(/\D/g,"").slice(0,4);

lookupForm.onsubmit=async e=>{
  e.preventDefault();clearError(lookupError);
  const patientName=nameInput.value.trim(),phoneLast4=phoneInput.value;
  if(!/^[가-힣a-zA-Z\s]{2,20}$/.test(patientName))return showError(lookupError,"성함을 정확히 입력해 주세요.");
  if(!/^\d{4}$/.test(phoneLast4))return showError(lookupError,"휴대전화번호 뒤 4자리를 확인해 주세요.");
  lookupButton.disabled=true;lookupButton.textContent="확인 중입니다…";
  try{
    const response=await fetch("/api/lookup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({patientName,phoneLast4})});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||"예약을 확인하지 못했습니다.");
    reservations=Array.isArray(result.reservations)?result.reservations:[];
    if(!reservations.length)throw new Error("확인되는 예약이 없습니다.");
    renderReservations();
  }catch(err){reservationCard.classList.add("hidden");showError(lookupError,err.message||"예약을 확인하지 못했습니다.")}
  finally{lookupButton.disabled=false;lookupButton.innerHTML='예약 확인하기 <span>→</span>'}
};

function renderReservations(){
  reservationList.innerHTML="";
  reservations.forEach((reservation,index)=>{
    const item=document.createElement("article");
    item.className="reservation-item";

    const box=document.createElement("div");
    box.className="reservation-box";
    const nameBlock=document.createElement("div");
    const nameLabel=document.createElement("span");nameLabel.textContent="환자명";
    const nameValue=document.createElement("strong");nameValue.textContent=reservation.patientName;
    nameBlock.append(nameLabel,nameValue);
    const doctorBlock=document.createElement("div");
    const doctorLabel=document.createElement("span");doctorLabel.textContent="담당 의료진";
    const doctorValue=document.createElement("strong");doctorValue.textContent="오지혜 원장님";
    doctorBlock.append(doctorLabel,doctorValue);
    const dateBlock=document.createElement("div");dateBlock.className="wide";
    const dateLabel=document.createElement("span");dateLabel.textContent="예약 일시";
    const dateValue=document.createElement("strong");dateValue.textContent=`${format(reservation.appointmentDate)} ${reservation.appointmentTime}`;
    dateBlock.append(dateLabel,dateValue);
    box.append(nameBlock,doctorBlock,dateBlock);

    const actions=document.createElement("div");actions.className="action-row";
    const changeButton=document.createElement("button");changeButton.type="button";changeButton.className="secondary";changeButton.textContent="예약 변경";changeButton.onclick=()=>openChange(index);
    const cancelButton=document.createElement("button");cancelButton.type="button";cancelButton.className="danger-ghost";cancelButton.textContent="예약 취소";cancelButton.onclick=()=>openCancel(index);
    actions.append(changeButton,cancelButton);
    item.append(box,actions);
    reservationList.appendChild(item);
  });
  reservationCard.classList.remove("hidden");changeCard.classList.add("hidden");cancelCard.classList.add("hidden");successCard.classList.add("hidden");
  reservationCard.scrollIntoView({behavior:"smooth",block:"start"});
}

async function openChange(index){
  currentReservation=reservations[index];
  clearError(changeError);changeCard.classList.remove("hidden");cancelCard.classList.add("hidden");
  changeCurrentSummary.textContent=`현재 예약: ${format(currentReservation.appointmentDate)} ${currentReservation.appointmentTime}`;
  dateInput.value="";selectedTime="";timeArea.className="empty";timeArea.textContent="먼저 날짜를 선택해 주세요.";
  dateGuide.textContent="회색 날짜는 휴진일 또는 예약 불가일입니다.";
  calendarMonth=new Date();calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),1);
  await loadAvailability();changeCard.scrollIntoView({behavior:"smooth",block:"start"});
}

function openCancel(index){
  currentReservation=reservations[index];
  clearError(cancelError);cancelCard.classList.remove("hidden");changeCard.classList.add("hidden");
  cancelSummary.textContent=`${format(currentReservation.appointmentDate)} ${currentReservation.appointmentTime} · 오지혜 원장님`;
  cancelCard.scrollIntoView({behavior:"smooth",block:"start"});
}

changeCloseButton.onclick=()=>changeCard.classList.add("hidden");
cancelCloseButton.onclick=()=>cancelCard.classList.add("hidden");

function renderCalendar(){
  calendarDays.innerHTML="";const y=calendarMonth.getFullYear(),m=calendarMonth.getMonth(),first=new Date(y,m,1),last=new Date(y,m+1,0).getDate();
  calendarTitle.textContent=`${y}년 ${m+1}월`;
  for(let i=0;i<first.getDay();i++){const e=document.createElement("span");e.className="day empty";calendarDays.appendChild(e)}
  for(let n=1;n<=last;n++){
    const d=new Date(y,m,n),key=toKey(d),b=document.createElement("button");b.type="button";b.textContent=n;b.className="day";
    if(key===dateInput.value)b.classList.add("selected");
    if(isDisabled(d)){b.disabled=true;b.classList.add("disabled")}
    else b.onclick=()=>{dateInput.value=key;selectedTime="";document.querySelectorAll(".day").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");dateGuide.textContent=`${format(key)} 변경 시간을 선택해 주세요.`;renderTimes(key);clearError(changeError)};
    calendarDays.appendChild(b)
  }
  const r=range();previousMonthButton.disabled=new Date(y,m,0)<r.min;nextMonthButton.disabled=new Date(y,m+1,1)>r.max;
}
previousMonthButton.onclick=()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1);renderCalendar()};
nextMonthButton.onclick=()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1);renderCalendar()};
function renderTimes(key){selectedTime="";timeArea.innerHTML="";timeArea.className="time-grid";const times=parse(key).getDay()===4?[...morning,...afternoon]:morning;times.forEach(time=>{const b=document.createElement("button"),taken=bookedSlots.has(`${key} ${time}`);b.type="button";b.className="time-button";b.disabled=taken;b.textContent=taken?`${time} 마감`:time;b.onclick=()=>{document.querySelectorAll(".time-button").forEach(x=>x.classList.remove("selected"));selectedTime=time;b.classList.add("selected");clearError(changeError)};timeArea.appendChild(b)})}
async function loadAvailability(){
  const r=range();closedDates=new Set();bookedSlots=new Set();
  try{
    const response=await fetch(`/api/availability?start=${r.start}&end=${r.end}&excludeDate=${encodeURIComponent(currentReservation.appointmentDate)}&excludeTime=${encodeURIComponent(currentReservation.appointmentTime)}&_ts=${Date.now()}`,{cache:"no-store"}),result=await response.json();
    if(!response.ok)throw new Error(result.error);
    closedDates=new Set(result.closedDates||[]);bookedSlots=new Set(result.bookedSlots||[]);
  }catch(e){showError(changeError,e.message||"예약 일정을 불러오지 못했습니다.")}
  renderCalendar();
}

changeSubmitButton.onclick=async()=>{
  clearError(changeError);const appointmentDate=dateInput.value;
  if(!currentReservation)return showError(changeError,"변경할 예약을 다시 선택해 주세요.");
  if(!appointmentDate||!selectedTime)return showError(changeError,"변경할 날짜와 시간을 선택해 주세요.");
  changeSubmitButton.disabled=true;changeSubmitButton.textContent="변경 중입니다…";
  try{
    const originalDate=currentReservation.appointmentDate,originalTime=currentReservation.appointmentTime;
    const response=await fetch("/api/change",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({patientName:nameInput.value.trim(),phoneLast4:phoneInput.value,originalDate,originalTime,appointmentDate,appointmentTime:selectedTime})});
    const result=await response.json();if(!response.ok)throw new Error(result.error||"예약을 변경하지 못했습니다.");
    successTitle.textContent="예약이 변경되었습니다.";successSummary.innerHTML=`<strong>${format(appointmentDate)}</strong><br>${selectedTime} · 오지혜 원장님`;
    reservationCard.classList.add("hidden");changeCard.classList.add("hidden");cancelCard.classList.add("hidden");successCard.classList.remove("hidden");successCard.scrollIntoView({behavior:"smooth"});
  }catch(err){showError(changeError,err.message||"예약을 변경하지 못했습니다.")}
  finally{changeSubmitButton.disabled=false;changeSubmitButton.textContent="변경 확정"}
};

cancelSubmitButton.onclick=async()=>{
  clearError(cancelError);
  if(!currentReservation)return showError(cancelError,"취소할 예약을 다시 선택해 주세요.");
  cancelSubmitButton.disabled=true;cancelSubmitButton.textContent="취소 중입니다…";
  try{
    const response=await fetch("/api/cancel",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({patientName:nameInput.value.trim(),phoneLast4:phoneInput.value,originalDate:currentReservation.appointmentDate,originalTime:currentReservation.appointmentTime})});
    const result=await response.json();if(!response.ok)throw new Error(result.error||"예약을 취소하지 못했습니다.");
    successTitle.textContent="예약이 취소되었습니다.";successSummary.textContent=`${format(currentReservation.appointmentDate)} ${currentReservation.appointmentTime} 예약이 취소되었습니다.`;
    reservationCard.classList.add("hidden");changeCard.classList.add("hidden");cancelCard.classList.add("hidden");successCard.classList.remove("hidden");successCard.scrollIntoView({behavior:"smooth"});
  }catch(err){showError(cancelError,err.message||"예약을 취소하지 못했습니다.")}
  finally{cancelSubmitButton.disabled=false;cancelSubmitButton.textContent="예약 취소하기"}
};
restartButton.onclick=()=>location.reload();
