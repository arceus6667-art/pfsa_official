"use client";

export function PaymentReferenceInput({disabled=false}:{disabled?:boolean}){
 return <label>UTR / Payment ID<input name="utr" required maxLength={100} autoComplete="off" disabled={disabled}
  onBlur={e=>{e.currentTarget.value=e.currentTarget.value.trim();}}
 /></label>;
}

