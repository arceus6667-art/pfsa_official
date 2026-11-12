export const PAYMENT_REFERENCE_ERROR = 'Enter the valid UTR of 12 digits.';
export function validPaymentReference(value:string){
 return /^\S{12,100}$/u.test(value.trim());
}
