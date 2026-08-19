const $=id=>document.getElementById(id);
const lookupForm=$("lookupForm"),nameInput=$("patientName"),phoneInput=$("phoneLast4"),lookupButton=$("lookupButton"),lookupError=$("lookupError");
const reservationCard=$("reservationCard"),reservationList=$("reservationList"),changeCard=$("changeCard"),cancelCard=$("cancelCard"),successCard=$("successCard");
const changeCloseButton=$("changeCloseButton"),cancelCloseButton=$("cancelCloseButton"),changeSubmitButton=$("changeSubmitButton"),cancelSubmitButton=$("cancelSubmitButton"),changeError=$("changeError"),cancelError=$("cancelError");
const dateInput=$("appointmentDate"),dateGuide=$("dateGuide"),timeArea=$("timeArea"),calendarTitle=$("calendarTitle"),calendarDays=$("calendarDays"),previousMonthButton=$("previousMonth"),nextMonthButton=$("nextMonth");
const changeCurrentSummary=$("changeCurrentSummary"),cancelSummary=$("cancelSummary"),successTitle=$("successTitle"),successSummary=$("successSummary"),restartButton=$("restartButton");

const morning=["08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30"];
const afternoon=["14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30"];
const weekdays=["일","월","화","수","목","금","토"];
const availabilityCache=new Map();
const availabilityRequests=new Map();
const CACHE_MS=60000;
const STORAGE_PREFIX="sokansim_availability_";
let reservations=[],currentReservation=null,selectedTime="",calendarMonth=new Date();
calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),1);

const pad=n=>String(n).padStart(2,"0");
const toKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const parse=k=>{const [y,m,d]=k.split("-").map(Number);return new Date(y,m-1,d)};
const format=k=>{const d=parse(k);return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${weekdays[d.getDay()]})`};
const monthKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}`;
function range(){const t=new Date(),min=addDays(t,1),max=addDays(t,180);return{min,max}}
function monthRange(d){const y=d.getFullYear(),m=d.getMonth();return{start:toKey(new Date(y,m,1)),end:toKey(new Date(y,m+1,0))}}
function showError(el,msg){el.textContent=msg;el.classList.add("show")}
function clearError(el){el.textContent="";el.classList.remove("show")}
function baseDisabled(d){const r=range(),x=new Date(d.getFullYear(),d.getMonth(),d.getDate()),min=new Date(r.min.getFullYear(),r.min.getMonth(),r.min.getDate()),max=new Date(r.max.getFullYear(),r.max.getMonth(),r.max.getDate());return x<min||x>max||d.getDay()===0||d.getDay()===6}
function restoreMonthCache(key){
  if(availabilityCache.has(key))return availabilityCache.get(key);
  try{
    const raw=localStorage.getItem(STORAGE_PREFIX+key);if(!raw)return null;
    const saved=JSON.parse(raw);if(!saved||!saved.loadedAt||Date.now()-saved.loadedAt>CACHE_MS)return null;
    const data={closedDates:new Set(saved.closedDates||[]),bookedSlots:new Set(saved.bookedSlots||[]),loadedAt:saved.loadedAt};
    availabilityCache.set(key,data);return data;
  }catch{return null}
}
function saveMonthCache(key,data){try{localStorage.setItem(STORAGE_PREFIX+key,JSON.stringify({closedDates:[...data.closedDates],bookedSlots:[...data.bookedSlots],loadedAt:data.loadedAt}))}catch{}}
function monthData(d){const key=monthKey(d);return availabilityCache.get(key)||restoreMonthCache(key)||null}
function isClosed(d){const data=monthData(d);return !!(data&&data.closedDates.has(toKey(d)))}

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
    // 예약 확인 화면을 보는 동안 변경에 필요한 달을 미리 불러옵니다.
    const prefetchMonths=new Map();
    prefetchMonths.set(monthKey(new Date()),new Date());
    reservations.slice(0,3).forEach(r=>{const d=parse(r.appointmentDate);prefetchMonths.set(monthKey(d),d)});
    prefetchMonths.forEach(d=>loadMonthAvailability(d,false).catch(()=>{}));
  }catch(err){reservationCard.classList.add("hidden");showError(lookupError,err.message||"예약을 확인하지 못했습니다.")}
  finally{lookupButton.disabled=false;lookupButton.innerHTML='예약 확인하기 <span>→</span>'}
};

function renderReservations(){
  reservationList.innerHTML="";
  reservations.forEach((reservation,index)=>{
    const item=document.createElement("article");item.className="reservation-item";
    const box=document.createElement("div");box.className="reservation-box";
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
    dateBlock.append(dateLabel,dateValue);box.append(nameBlock,doctorBlock,dateBlock);
    const actions=document.createElement("div");actions.className="action-row";
    const changeButton=document.createElement("button");changeButton.type="button";changeButton.className="secondary";changeButton.textContent="예약 변경";changeButton.onclick=()=>openChange(index);
    const cancelButton=document.createElement("button");cancelButton.type="button";cancelButton.className="danger-ghost";cancelButton.textContent="예약 취소";cancelButton.onclick=()=>openCancel(index);
    actions.append(changeButton,cancelButton);item.append(box,actions);reservationList.appendChild(item);
  });
  reservationCard.classList.remove("hidden");changeCard.classList.add("hidden");cancelCard.classList.add("hidden");successCard.classList.add("hidden");
  reservationCard.scrollIntoView({behavior:"smooth",block:"start"});
}

function openChange(index){
  currentReservation=reservations[index];
  clearError(changeError);changeCard.classList.remove("hidden");cancelCard.classList.add("hidden");
  changeCurrentSummary.textContent=`현재 예약: ${format(currentReservation.appointmentDate)} ${currentReservation.appointmentTime}`;
  dateInput.value="";selectedTime="";timeArea.className="empty";timeArea.textContent="먼저 날짜를 선택해 주세요.";
  calendarMonth=parse(currentReservation.appointmentDate);calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),1);
  // 현재 예약이 있는 달을 즉시 보여주고, 휴진/마감 정보는 뒤에서 갱신합니다.
  renderCalendar();
  changeCard.scrollIntoView({behavior:"smooth",block:"start"});
  loadMonthAvailability(calendarMonth,false).catch(()=>{});
}

function openCancel(index){
  currentReservation=reservations[index];clearError(cancelError);cancelCard.classList.remove("hidden");changeCard.classList.add("hidden");
  cancelSummary.textContent=`${format(currentReservation.appointmentDate)} ${currentReservation.appointmentTime} · 오지혜 원장님`;
  cancelCard.scrollIntoView({behavior:"smooth",block:"start"});
}

changeCloseButton.onclick=()=>changeCard.classList.add("hidden");
cancelCloseButton.onclick=()=>cancelCard.classList.add("hidden");

function chooseDate(key){
  dateInput.value=key;selectedTime="";
  document.querySelectorAll(".day").forEach(x=>x.classList.remove("selected"));
  const selected=[...document.querySelectorAll(".day")].find(x=>x.dataset.date===key);if(selected)selected.classList.add("selected");
  dateGuide.textContent=`${format(key)} 변경 시간을 확인하고 있습니다.`;
  const data=monthData(parse(key));
  if(data){
    if(data.closedDates.has(key)){dateInput.value="";if(selected)selected.classList.remove("selected");timeArea.className="empty";timeArea.textContent="먼저 날짜를 선택해 주세요.";return showError(changeError,"선택한 날짜는 휴진일입니다. 다른 날짜를 선택해 주세요.")}
    renderTimes(key);return;
  }
  timeArea.className="empty";timeArea.textContent="예약 가능시간을 확인 중입니다…";
  loadMonthAvailability(parse(key),false).then(fresh=>{
    if(dateInput.value!==key)return;
    if(fresh.closedDates.has(key)){dateInput.value="";if(selected)selected.classList.remove("selected");timeArea.className="empty";timeArea.textContent="먼저 날짜를 선택해 주세요.";showError(changeError,"선택한 날짜는 휴진일입니다. 다른 날짜를 선택해 주세요.");renderCalendar();return}
    clearError(changeError);dateGuide.textContent=`${format(key)} 변경 시간을 선택해 주세요.`;renderTimes(key);
  }).catch(()=>{});
}

function renderCalendar(){
  calendarDays.innerHTML="";
  const y=calendarMonth.getFullYear(),m=calendarMonth.getMonth(),first=new Date(y,m,1),last=new Date(y,m+1,0).getDate(),data=monthData(calendarMonth);
  calendarTitle.textContent=`${y}년 ${m+1}월`;
  dateGuide.textContent=data?"회색 날짜는 휴진일 또는 예약 불가일입니다.":"달력은 바로 선택할 수 있습니다. 휴진일·마감시간을 확인 중입니다…";
  for(let i=0;i<first.getDay();i++){const e=document.createElement("span");e.className="day empty";calendarDays.appendChild(e)}
  for(let n=1;n<=last;n++){
    const d=new Date(y,m,n),key=toKey(d),b=document.createElement("button");b.type="button";b.textContent=n;b.className="day";b.dataset.date=key;
    if(key===dateInput.value)b.classList.add("selected");
    if(baseDisabled(d)||(data&&data.closedDates.has(key))){b.disabled=true;b.classList.add("disabled")}
    else{if(!data)b.classList.add("pending-day");b.onclick=()=>{clearError(changeError);chooseDate(key)}}
    calendarDays.appendChild(b);
  }
  const r=range();previousMonthButton.disabled=new Date(y,m,0)<r.min;nextMonthButton.disabled=new Date(y,m+1,1)>r.max;
}

previousMonthButton.onclick=()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1);dateInput.value="";selectedTime="";timeArea.className="empty";timeArea.textContent="먼저 날짜를 선택해 주세요.";renderCalendar();loadMonthAvailability(calendarMonth,false).catch(()=>{})};
nextMonthButton.onclick=()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1);dateInput.value="";selectedTime="";timeArea.className="empty";timeArea.textContent="먼저 날짜를 선택해 주세요.";renderCalendar();loadMonthAvailability(calendarMonth,false).catch(()=>{})};

function renderTimes(key){
  selectedTime="";timeArea.innerHTML="";timeArea.className="time-grid";
  const data=monthData(parse(key));
  if(!data){timeArea.className="empty";timeArea.textContent="예약 가능시간을 확인 중입니다…";return}
  const times=parse(key).getDay()===4?[...morning,...afternoon]:morning;
  times.forEach(time=>{
    const b=document.createElement("button"),slot=`${key} ${time}`;
    const ownSlot=currentReservation&&currentReservation.appointmentDate===key&&currentReservation.appointmentTime===time;
    const taken=data.bookedSlots.has(slot)&&!ownSlot;
    b.type="button";b.className="time-button";b.disabled=taken;b.textContent=taken?`${time} 마감`:time;
    b.onclick=()=>{document.querySelectorAll(".time-button").forEach(x=>x.classList.remove("selected"));selectedTime=time;b.classList.add("selected");clearError(changeError)};
    timeArea.appendChild(b);
  });
}

async function loadMonthAvailability(monthDate,force=false){
  const key=monthKey(monthDate),cached=availabilityCache.get(key)||restoreMonthCache(key);
  if(!force&&cached&&Date.now()-cached.loadedAt<CACHE_MS){if(monthKey(calendarMonth)===key)renderCalendar();return cached}
  if(availabilityRequests.has(key))return availabilityRequests.get(key);
  const {start,end}=monthRange(monthDate);
  const request=(async()=>{
    try{
      const response=await fetch(`/api/availability?start=${start}&end=${end}`);
      const result=await response.json();if(!response.ok)throw new Error(result.error);
      const data={closedDates:new Set(result.closedDates||[]),bookedSlots:new Set(result.bookedSlots||[]),loadedAt:Date.now()};
      availabilityCache.set(key,data);saveMonthCache(key,data);
      if(monthKey(calendarMonth)===key){clearError(changeError);renderCalendar();if(dateInput.value&&monthKey(parse(dateInput.value))===key&&!data.closedDates.has(dateInput.value))renderTimes(dateInput.value)}
      return data;
    }catch(e){if(monthKey(calendarMonth)===key){showError(changeError,e.message||"예약 일정을 불러오지 못했습니다.");dateGuide.textContent="예약 일정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."}throw e}
    finally{availabilityRequests.delete(key)}
  })();
  availabilityRequests.set(key,request);return request;
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
    [monthKey(parse(originalDate)),monthKey(parse(appointmentDate))].forEach(k=>{availabilityCache.delete(k);try{localStorage.removeItem(STORAGE_PREFIX+k)}catch{}});
    currentReservation.appointmentDate=appointmentDate;currentReservation.appointmentTime=selectedTime;
    successTitle.textContent="예약이 변경되었습니다.";successSummary.innerHTML=`<strong>${format(appointmentDate)}</strong><br>${selectedTime}<br>오지혜 원장님`;
    changeCard.classList.add("hidden");reservationCard.classList.add("hidden");successCard.classList.remove("hidden");successCard.scrollIntoView({behavior:"smooth",block:"start"});
  }catch(err){showError(changeError,err.message||"예약을 변경하지 못했습니다.")}
  finally{changeSubmitButton.disabled=false;changeSubmitButton.textContent="변경 확정"}
};

cancelSubmitButton.onclick=async()=>{
  clearError(cancelError);if(!currentReservation)return showError(cancelError,"취소할 예약을 다시 선택해 주세요.");
  cancelSubmitButton.disabled=true;cancelSubmitButton.textContent="취소 중입니다…";
  try{
    const response=await fetch("/api/cancel",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({patientName:nameInput.value.trim(),phoneLast4:phoneInput.value,originalDate:currentReservation.appointmentDate,originalTime:currentReservation.appointmentTime})});
    const result=await response.json();if(!response.ok)throw new Error(result.error||"예약을 취소하지 못했습니다.");
    {const k=monthKey(parse(currentReservation.appointmentDate));availabilityCache.delete(k);try{localStorage.removeItem(STORAGE_PREFIX+k)}catch{}}
    successTitle.textContent="예약이 취소되었습니다.";successSummary.innerHTML=`<strong>${format(currentReservation.appointmentDate)}</strong><br>${currentReservation.appointmentTime}<br>예약 취소`;
    cancelCard.classList.add("hidden");reservationCard.classList.add("hidden");successCard.classList.remove("hidden");successCard.scrollIntoView({behavior:"smooth",block:"start"});
  }catch(err){showError(cancelError,err.message||"예약을 취소하지 못했습니다.")}
  finally{cancelSubmitButton.disabled=false;cancelSubmitButton.textContent="예약 취소하기"}
};

restartButton.onclick=()=>{location.reload()};
