export type UpcomingBatch={name:string;startDate:string;startAt:number};
const istOffset=330*60*1000;
export function upcomingBatch(now=Date.now()):UpcomingBatch{
 if(!Number.isFinite(now))throw Error('A valid time is required.');
 const make=(name:string,startDate:string)=>({name,startDate,startAt:Date.parse(startDate+'T00:00:00+05:30')});
 if(now<Date.parse('2026-11-17T00:00:00+05:30'))return make('A1/2026','2026-11-17');
 if(now<Date.parse('2026-12-15T00:00:00+05:30'))return make('A2/2026','2026-12-15');
 const local=new Date(now+istOffset);let year=local.getUTCFullYear(),month=local.getUTCMonth();
 if(local.getUTCDate()>=15){month++;if(month===12){month=0;year++;}}
 const mm=String(month+1).padStart(2,'0');return make(mm+'/'+year,`${year}-${mm}-15`);
}
