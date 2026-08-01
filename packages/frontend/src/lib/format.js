// TODO: Add formatting helpers for currency, dates, and blockchain values

export function formatEther(value) {
  // Placeholder: format wei to ether string
  return value ? value.toString() : '0';
}

export function formatDate(timestamp) {
  // Placeholder: format a unix timestamp to a readable date string
  return timestamp ? new Date(timestamp * 1000).toLocaleDateString() : '';
}

export function formatCurrency(value, symbol = 'ETH') {
  // Placeholder: format a value with a currency symbol
  return `${value} ${symbol}`;
}
