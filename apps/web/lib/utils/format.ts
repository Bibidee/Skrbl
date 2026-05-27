/** Truncate a wallet address to 0xABCD...1234 style. */
export function shortenAddress(address: string | undefined | null, chars = 4): string {
  if (!address) return '';
  if (address.length <= 2 + chars * 2) return address;
  return `${address.slice(0, 2 + chars)}...${address.slice(-chars)}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}
