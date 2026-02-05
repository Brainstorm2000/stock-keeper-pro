 // Currency formatting utility for Nigerian Naira
 export const formatCurrency = (amount: number): string => {
   return `₦${amount.toLocaleString('en-NG')}`;
 };