export async function readAllRows<T>(request:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:{message:string}|null}>) {
 const result:T[]=[];
 const size=500;
 for(let from=0;;from+=size){
  const response=await request(from,from+size-1);
  if(response.error)throw new Error(response.error.message);
  const rows=response.data||[];
  result.push(...rows);
  if(rows.length<size)return result;
 }
}
