import { prisma } from '../db/client';

export async function getExchangeRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;

  // Check cache (last 24 hours)
  const cached = await prisma.exchangeRate.findFirst({
    where: {
      fromCurrency: from,
      toCurrency: to,
      date: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    orderBy: { date: 'desc' },
  });

  if (cached) return Number(cached.rate);

  // Fetch from API
  try {
    const apiKey = process.env.EXCHANGE_API_KEY;
    if (!apiKey) {
      console.warn('No EXCHANGE_API_KEY set, using rate 1');
      return 1;
    }

    const url = `${process.env.EXCHANGE_API_URL || 'https://v6.exchangerate-api.com/v6'}/${apiKey}/pair/${from}/${to}`;
    const resp = await fetch(url);
    const data = await resp.json() as { result: string; conversion_rate: number };

    if (data.result !== 'success') {
      console.error('Exchange API error:', data);
      return 1;
    }

    const rate = data.conversion_rate;

    await prisma.exchangeRate.upsert({
      where: {
        fromCurrency_toCurrency_date: {
          fromCurrency: from,
          toCurrency: to,
          date: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
      update: { rate, source: 'api' },
      create: {
        fromCurrency: from,
        toCurrency: to,
        rate,
        source: 'api',
        date: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    });

    return rate;
  } catch (err) {
    console.error('Failed to fetch exchange rate:', err);
    return 1;
  }
}
