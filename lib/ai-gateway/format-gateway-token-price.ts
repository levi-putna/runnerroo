/**
 * Parses per-token catalogue strings into numeric USD per 1 million tokens (for cost estimates).
 */
export function gatewayTokenUsdToUsdPerMillion(tokenPrice: string | undefined): number | null {
  if (tokenPrice === undefined || tokenPrice === "") {
    return null;
  }
  const n = Number(tokenPrice);
  if (Number.isNaN(n)) {
    return null;
  }
  return n * 1_000_000;
}
