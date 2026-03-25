import { Router } from 'express';
import { prisma } from '../db/client';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Budget plans (monthly)
router.get('/plans', async (req, res) => {
  const { year, month } = req.query;
  const where: any = {};
  if (year) where.year = parseInt(year as string);
  if (month) where.month = parseInt(month as string);

  const plans = await prisma.budgetPlan.findMany({
    where,
    include: { category: true },
  });
  res.json(plans);
});

router.put('/plans/:categoryId/:year/:month', async (req, res) => {
  const { categoryId, year, month } = req.params;
  const { amount } = req.body;

  const plan = await prisma.budgetPlan.upsert({
    where: {
      categoryId_year_month: {
        categoryId: +categoryId,
        year: +year,
        month: +month,
      },
    },
    update: { amount },
    create: { categoryId: +categoryId, year: +year, month: +month, amount },
  });
  res.json(plan);
});

// Annual plan/fact table
router.get('/annual', async (req, res) => {
  const { year } = req.query;
  const y = parseInt(year as string) || new Date().getFullYear();

  const [plans, categories] = await Promise.all([
    prisma.budgetPlan.findMany({
      where: { year: y },
      include: { category: true },
    }),
    prisma.category.findMany({ where: { isActive: true } }),
  ]);

  // Get actual spending per category per month
  const startDate = new Date(`${y}-01-01`);
  const endDate = new Date(`${y}-12-31T23:59:59`);

  const transactions = await prisma.transaction.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      type: 'EXPENSE',
      categoryId: { not: null },
    },
    select: { categoryId: true, amountEur: true, date: true },
  });

  // Group by category and month
  const facts: Record<string, Record<number, number>> = {};
  for (const tx of transactions) {
    if (!tx.categoryId) continue;
    const month = new Date(tx.date).getMonth() + 1;
    if (!facts[tx.categoryId]) facts[tx.categoryId] = {};
    facts[tx.categoryId][month] = (facts[tx.categoryId][month] || 0) + Number(tx.amountEur ?? 0);
  }

  res.json({ plans, categories, facts, year: y });
});

// Budget buckets
router.get('/buckets', async (_req, res) => {
  const buckets = await prisma.budgetBucket.findMany({ orderBy: { sortOrder: 'asc' } });
  res.json(buckets);
});

router.post('/buckets', async (req, res) => {
  const data = req.body;
  const bucket = await prisma.budgetBucket.create({
    data: {
      name: data.name,
      targetPercent: data.targetPercent,
      categories: data.categories || [],
      color: data.color || '#6366f1',
      sortOrder: data.sortOrder || 0,
    },
  });
  res.status(201).json(bucket);
});

router.put('/buckets/:id', async (req, res) => {
  const data = req.body;
  const bucket = await prisma.budgetBucket.update({
    where: { id: +req.params.id },
    data: {
      name: data.name,
      targetPercent: data.targetPercent,
      categories: data.categories,
      color: data.color,
      sortOrder: data.sortOrder,
    },
  });
  res.json(bucket);
});

router.delete('/buckets/:id', async (req, res) => {
  await prisma.budgetBucket.delete({ where: { id: +req.params.id } });
  res.json({ success: true });
});

// Monthly income
router.get('/monthly-income', async (req, res) => {
  const { year } = req.query;
  const where: any = {};
  if (year) where.year = parseInt(year as string);
  const incomes = await prisma.monthlyIncome.findMany({ where });
  res.json(incomes);
});

router.put('/monthly-income/:year/:month', async (req, res) => {
  const { year, month } = req.params;
  const { amount, currency } = req.body;
  const income = await prisma.monthlyIncome.upsert({
    where: { year_month: { year: +year, month: +month } },
    update: { amount, currency: currency || 'EUR' },
    create: { year: +year, month: +month, amount, currency: currency || 'EUR' },
  });
  res.json(income);
});

export default router;
