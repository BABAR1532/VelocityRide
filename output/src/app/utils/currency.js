const INR_PER_USD = 100;

export function usdToInr(amount) {
  const num = Number(amount || 0);
  return num * INR_PER_USD;
}

export function formatInr(amount) {
  const inr = usdToInr(amount);
  return `Rs ${inr.toFixed(2)}`;
}

