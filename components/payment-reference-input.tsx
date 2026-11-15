"use client";

import {PAYMENT_REFERENCE_ERROR,validPaymentReference} from '@/lib/payment-reference';
export function PaymentReferenceInput({disabled=false}:{disabled?:boolean}){
 return <label>UTR / Payment ID<input name="utr" required maxLength={100} autoComplete="off" disabled={disabled}
  onInput={e=>e.currentTarget.setCustomValidity(validPaymentReference(e.currentTarget.value)?'':PAYMENT_REFERENCE_ERROR)}
  onInvalid={e=>e.currentTarget.setCustomValidity(PAYMENT_REFERENCE_ERROR)}
  onBlur={e=>{e.currentTarget.value=e.currentTarget.value.trim();e.currentTarget.setCustomValidity(validPaymentReference(e.currentTarget.value)?'':PAYMENT_REFERENCE_ERROR);if(e.currentTarget.value&&!validPaymentReference(e.currentTarget.value))e.currentTarget.reportValidity();}}
 /></label>;
}

