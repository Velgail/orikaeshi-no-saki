// BASE-JP-RAIL-2026。時間はすべてゲーム内の整数分。
export const profile={id:'BASE-JP-RAIL-2026',daily:120,monthly:2700,yearly:21600,continuous:180,resetBreak:30,interval:660,date:'2026-10-04',timezone:'Asia/Tokyo',weekStart:'月曜00:00',ordinaryWork:480,ordinaryWeek:2400,agreementYear:['2026-04-01','2027-03-31'],holidayDaysAllowed:0,special:false,disasterException:false};
export function overtime(days){const ordinary=days.filter(d=>!d.holiday);const daily=ordinary.reduce((n,d)=>n+Math.max(0,d.work-480),0);return {overtime:daily+Math.max(0,ordinary.reduce((n,d)=>n+d.work,0)-daily-2400),holiday:days.filter(d=>d.holiday).reduce((n,d)=>n+d.work,0)};}
export function requiredBreak(work){return work>480?60:work>360?45:0;}
export function intermediateBreak(c){
 const segments=[...(c.initialSegments||[]),...c.dutySegments];
 return segments.reduce((n,b,i)=>n+(b.kind==='break'&&segments.slice(0,i).some(x=>x.work)&&segments.slice(i+1).some(x=>x.work)?b.end-b.start:0),0);
}
export function evaluate(c,{extra=0,driving=0,complete=false,now=0}={}){
 const work=c.todayWork+extra,dayOT=Math.max(0,work-480),before=Math.max(0,c.todayWork-480);
 const weekly=overtime([...c.weekDays,{work,holiday:c.holiday}]);const weeklyBefore=overtime([...c.weekDays,{work:c.todayWork,holiday:c.holiday}]);
 const increment=weekly.overtime-weeklyBefore.overtime,month=c.monthOvertime+increment,year=c.yearOvertime+increment;
 const errors=[],safety=[];
 if(!Array.isArray(c.previousFiveMonths)||c.previousFiveMonths.length!==5||c.previousFiveMonths.some(n=>!Number.isInteger(n)||n<0))errors.push('過去5か月の履歴欠損：判定不能');
 if(c.holiday&&work>0)errors.push('BASE協定は法定休日労働を許容しません');
 if((dayOT>0||weekly.overtime>0)&&(!c.agreement.filed||!c.agreement.covered||now<c.agreement.validFrom||now>c.agreement.validUntil))errors.push('36協定の届出・対象・有効期間に不適合');
 if(dayOT>120)errors.push('架空36協定の日2時間を超過');if(month>2700)errors.push('BASE協定の月45時間を超過');if(year>21600)errors.push('BASE協定の年360時間を超過');
 const combined=month+c.monthHoliday;
 if(combined>=6000)errors.push('法36条の当月100時間未満に不適合');
 if(c.previousFiveMonths?.length===5)for(let n=2;n<=6;n++)if(combined+c.previousFiveMonths.slice(-(n-1)).reduce((a,b)=>a+b,0)>4800*n)errors.push(`法36条の${n}か月平均80時間を超過`);
 if(complete&&intermediateBreak(c)<requiredBreak(work))errors.push(`終業時の法34条休憩不足（必要${requiredBreak(work)}分）`);
 if(c.continuousDrivingMinutes+driving>180)safety.push('架空社内規程：連続乗務180分を超過');
 if(c.dutyStart-c.previousDutyEnd<660)safety.push('架空社内規程：勤務間隔11時間未満');
 if(!c.fitForDuty)safety.push('乗務不可判定');if(!c.qualifications.includes('青葉線運転士')||now>c.qualificationUntil)safety.push('線区・職務資格なし／期限切れ');
 const remaining=Math.min(120-dayOT,2700-month,21600-year);
 return {errors,safety,allowed:!errors.length&&!safety.length,dayOT,month,year,increment,remaining,breakNeeded:Math.max(0,requiredBreak(work)-intermediateBreak(c)),overtime:Math.max(0,now-c.plannedDutyEnd),additionalOvertime:Math.max(0,now+extra-c.plannedDutyEnd)-Math.max(0,now-c.plannedDutyEnd),classification:errors.length?'法令・協定不適合':safety.length?'安全条件不適合':dayOT||now>c.plannedDutyEnd?'許容超勤':'通常勤務'};
}
export function workMinute(c,now,kind){const e=evaluate(c,{extra:1,driving:kind==='driving'?1:0,now});c.todayWork++;c.monthOvertime=e.month;c.yearOvertime=e.year;if(kind==='driving')c.continuousDrivingMinutes++;c.duty=c.continuousDrivingMinutes;c.overtimeMinutes+=now>c.plannedDutyEnd?1:0;segment(c,now,kind,true);}
export function breakMinute(c,now){c.breakMinutesActual++;c.breakRun++;if(c.breakRun>=30)c.continuousDrivingMinutes=0;c.duty=c.continuousDrivingMinutes;segment(c,now,'break',false);}
function segment(c,now,kind,work){const last=c.dutySegments.at(-1);if(last?.kind===kind&&last.end===now-1)last.end=now;else c.dutySegments.push({start:now-1,end:now,kind,work});}
