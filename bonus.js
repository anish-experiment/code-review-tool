function padDecimal(number) {
  if (parseInt(+number) === +number) return `${number}.0`;

  return number;
}

export function renderBonusAmount(amount, unit) {
  const formatter = {
    DOLLAR: (amount) => `${'$' || ''}${amount || ''}`,
    HOURS: (amount) => `${amount || ''} ${'hr' || ''}`,
    DOLLARS_PER_HOUR: (amount) => `${'$' || ''}${amount || ''}${'/hr' || ''}`,
    X_RATE: (amount) => `${padDecimal(amount) || ''}${'x Rate' || ''}`,
  };

  if (unit && formatter[unit]) {
    return formatter[unit](amount);
  }

  return amount || '-';
}