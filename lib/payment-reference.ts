export const PAYMENT_REFERENCE_ERROR = 'Enter your UTR / Payment ID.';
export function validPaymentReference(value:string){
 return value.trim().length>0 && value.trim().length<=100;
}
