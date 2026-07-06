import { Router } from 'express';
import { prisma } from '../db/client';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res) => {
  const currencies = await prisma.currency.findMany({ orderBy: { sortOrder: 'asc' } });
  res.json(currencies);
});

router.post('/', async (req, res) => {
  const { code, name } = req.body;
  const max = await prisma.currency.aggregate({ _max: { sortOrder: true } });
  const currency = await prisma.currency.create({
    data: { code: code.toUpperCase(), name, sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });
  res.status(201).json(currency);
});

router.delete('/:code', async (req, res) => {
  try {
    await prisma.currency.delete({ where: { code: req.params.code.toUpperCase() } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete currency' });
  }
});

export default router;
