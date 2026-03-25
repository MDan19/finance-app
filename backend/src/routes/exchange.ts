import { Router } from 'express';
import { prisma } from '../db/client';
import { authenticate } from '../middleware/auth';
import { getExchangeRate } from '../utils/exchange';

const router = Router();
router.use(authenticate);

router.get('/rate', async (req, res) => {
  const { from, to } = req.query as { from: string; to: string };
  try {
    const rate = await getExchangeRate(from, to);
    res.json({ from, to, rate });
  } catch {
    res.status(500).json({ error: 'Failed to get rate' });
  }
});

router.post('/rate/manual', async (req, res) => {
  const { from, to, rate } = req.body;
  await prisma.exchangeRate.create({
    data: {
      fromCurrency: from,
      toCurrency: to,
      rate,
      source: 'manual',
    },
  });
  res.json({ success: true });
});

router.get('/rates', async (_req, res) => {
  const rates = await prisma.exchangeRate.findMany({
    orderBy: { date: 'desc' },
    take: 100,
  });
  res.json(rates);
});

export default router;
