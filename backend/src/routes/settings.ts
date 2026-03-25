import { Router } from 'express';
import { prisma } from '../db/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Get settings (user preferences)
router.get('/', async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({
    baseCurrency: user.baseCurrency,
    username: user.username,
  });
});

router.put('/', async (req: AuthRequest, res) => {
  const { baseCurrency } = req.body;
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { baseCurrency },
  });
  res.json({ baseCurrency: user.baseCurrency });
});

// Export all data as JSON
router.get('/export', async (_req, res) => {
  const [accounts, transactions, categories, budgetPlans, budgetBuckets] = await Promise.all([
    prisma.account.findMany(),
    prisma.transaction.findMany({ orderBy: { date: 'desc' } }),
    prisma.category.findMany(),
    prisma.budgetPlan.findMany(),
    prisma.budgetBucket.findMany(),
  ]);

  res.setHeader('Content-Disposition', `attachment; filename="finance-export-${new Date().toISOString().split('T')[0]}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.json({ accounts, transactions, categories, budgetPlans, budgetBuckets, exportedAt: new Date() });
});

export default router;
