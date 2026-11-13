// This is a login alias, not an authorization check. Supabase validates the password and staff role.
export function staffLoginEmail(identifier:string){
 const value=identifier.trim();
 return value.toLowerCase()==='admin123'?'admin@skillsetgoedutech.in':value;
}
