export function redirectToPayfixy(
  paymentUrl: string,
  ctx: Record<string, unknown>,
) {
  sessionStorage.setItem('pending_payment', JSON.stringify(ctx))
  window.location.href = paymentUrl
}