"use client";
import {useId} from 'react';
import {PAYMENT_REFERENCE_ERROR,validPaymentReference} from '@/lib/payment-reference';
export function PaymentReferenceInput({disabled=false}:{disabled?:boolean}){
 const hint=useId();
 return <label>UTR / Payment ID<input name="utr" required minLength={12} maxLength={100} autoComplete="off" disabled={disabled} aria-describedby={hint}
  onInput={e=>e.currentTarget.setCustomValidity(validPaymentReference(e.currentTarget.value)?'':PAYMENT_REFERENCE_ERROR)}
  onInvalid={e=>e.currentTarget.setCustomValidity(PAYMENT_REFERENCE_ERROR)}
  onBlur={e=>{e.currentTarget.value=e.currentTarget.value.trim();e.currentTarget.setCustomValidity(validPaymentReference(e.currentTarget.value)?'':PAYMENT_REFERENCE_ERROR);if(e.currentTarget.value&&!validPaymentReference(e.currentTarget.value))e.currentTarget.reportValidity();}}
 /><small id={hint}>At least 12 characters. Payment IDs may include letters. Do not include spaces.</small></label>;
}
