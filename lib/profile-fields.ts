export function profileChanges(read:(key:string)=>string,isStaff:boolean){
 const keys=isStaff?['name','phone','city','linkedin','github','cohort','start_date']:['phone','city','linkedin','github'];
 return Object.fromEntries(keys.map(key=>[key,read(key)||null])) as Record<string,string|null>;
}
