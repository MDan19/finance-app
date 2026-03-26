import { Router } from 'express';
import { prisma } from '../db/client';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/plans', async (req, res) => {
  const { year, month } = req.query;
  const where: any = {};
  if (year) where.year = parseInt(year as string);
  if (month) where.month = parseInt(month as string);
  const plans = await prisma.budgetPlan.findMany({ where, include: { category: true } });
  res.json(plans);
});

router.put('/plans/:categoryId/:year/:month', async (req, res) => {
  const { categoryId, year, month } = req.params;
  const { amount } = req.body;
  const plan = await prisma.budgetPlan.upsert({
    where: { categoryId_year_month: { categoryId: +categoryId, year: +year, month: +month } },
    update: { amount },
    create: { categoryId: +categoryId, year: +year, month: +month, amount },
  });
  res.json(plan);
});

router.get('/plan-items', async (_req, res) => {
  try {
    const items = await prisma.planItem.findMany({
      orderBy: [{ groupName: 'asc' }, { sortOrder: 'asc' }],
    });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch plan items' });
  }
});

router.post('/plan-items', async (req, res) => {
  try {
    const data = req.body;
    const item = await prisma.planItem.create({
      data: {
        name: data.name,
        groupName: data.groupName || 'Other',
        paymentType: data.paymentType || 'Monthly',
        categoryId: data.categoryId ? +data.categoryId : null,
        keywordMatch: data.keywordMatch || null,
        sortOrder: data.sortOrder || 0,
        isActive: true,
      },
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create plan item' });
  }
});

router.put('/plan-items/:id', async (req, res) => {
  try {
    const data = req.body;
    const item = await prisma.planItem.update({
      where: { id: +req.params.id },
      data: {
        name: data.name,
        groupName: data.groupName,
        paymentType: data.paymentType,
        categoryId: data.categoryId ? +data.categoryId : null,
        keywordMatch: data.keywordMatch || null,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
      },
    });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update plan item' });
  }
});

router.delete('/plan-items/:id', async (req, res) => {
  try {
    await prisma.planItem.delete({ where: { id: +req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete plan item' });
  }
});

router.get('/plan-amounts/:year', async (req, res) => {
  try {
    const amounts = await prisma.planAmount.findMany({ where: { year: +req.params.year } });
    res.json(amounts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch plan amounts' });
  }
});

router.put('/plan-amounts/:itemId/:year/:month', async (req, res) => {
  try {
    const { itemId, year, month } = req.params;
    const { amount } = req.body;
    const record = await prisma.planAmount.upsert({
      where: { planItemId_year_month: { planItemId: +itemId, year: +year, month: +month } },
      update: { amount: parseFloat(amount) },
      create: { planItemId: +itemId, year: +year, month: +month, amount: parseFloat(amount) },
    });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save plan amount' });
  }
});

router.get('/plan-facts/:year', async (req, res) => {
  try {
    const year = +req.params.year;
    const items = await prisma.planItem.findMany({ where: { isActive: true } });
    const transactions = await prisma.transaction.findMany({
      where: {
        date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31T23:59:59`) },
        type: { in: ['EXPENSE', 'TRANSFER'] },
      },
      select: { categoryId: true, amountEur: true, amount: true, date: true, counterparty: true, note: true },
    });
    const facts: Record<number, Record<number, number>> = {};
    for (const item of items) {
      facts[item.id] = {};
      for (const tx of transactions) {
        const month = new Date(tx.date).getMonth() + 1;
        let matches = false;
        if (item.categoryId && tx.categoryId === item.categoryId) {
          matches = true;
        }
        if (!matches && item.keywordMatch) {
          const keywords = item.keywordMatch.split(',').map((k: string) => k.trim().toLowerCase());
          const searchStr = `${tx.counterparty || ''} ${tx.note || ''}`.toLowerCase();
          if (keywords.some((kw: string) => kw && searchStr.includes(kw))) {
            matches = true;
          }
        }
        if (matches) {
          facts[item.id][month] = (facts[item.id][month] || 0) + Number(tx.amountEur ?? tx.amount ?? 0);
        }
      }
    }
    res.json(facts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch facts' });
  }
});

router.get('/income-facts/:year', async (req, res) => {
  try {
    const year = +req.params.year;
    const transactions = await prisma.transaction.findMany({
      where: {
        date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31T23:59:59`) },
        type: { in: ['INCOME', 'COMPENSATION'] },
      },
      select: { incomeSource: true, compensationSource: true, amountEur: true, amount: true, date: true, type: true },
    });
    const facts: Record<string, Record<number, number>> = {};
    for (const tx of transactions) {
      const source = tx.type === 'COMPENSATION'
        ? `Compensation (${tx.compensationSource || 'Other'})`
        : (tx.incomeSource || 'Other income');
      const month = new Date(tx.date).getMonth() + 1;
      if (!facts[source]) facts[source] = {};
      facts[source][month] = (facts[source][month] || 0) + Number(tx.amountEur ?? tx.amount ?? 0);
    }
    res.json(facts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch income facts' });
  }
});

router.get('/annual', async (req, res) => {
  const y = parseInt(req.query.year as string) || new Date().getFullYear();
  const [plans, categories] = await Promise.all([
    prisma.budgetPlan.findMany({ where: { year: y }, include: { category: true } }),
    prisma.category.findMany({ where: { isActive: true } }),
  ]);
  const transactions = await prisma.transaction.findMany({
    where: {
      date: { gte: new Date(`${y}-01-01`), lte: new Date(`${y}-12-31T23:59:59`) },
      type: 'EXPENSE',
      categoryId: { not: null },
    },
    select: { categoryId: true, amountEur: true, date: true },
  });
  const facts: Record<string, Record<number, number>> = {};
  for (const tx of transactions) {
    if (!tx.categoryId) continue;
    const month = new Date(tx.date).getMonth() + 1;
    if (!facts[tx.categoryId]) facts[tx.categoryId] = {};
    facts[tx.categoryId][month] = (facts[tx.categoryId][month] || 0) + Number(tx.amountEur ?? 0);
  }
  res.json({ plans, categories, facts, year: y });
});

router.get('/buckets', async (_req, res) => {
  res.json(await prisma.budgetBucket.findMany({ orderBy: { sortOrder: 'asc' } }));
});

router.post('/buckets', async (req, res) => {
  const d = req.body;
  res.status(201).json(await prisma.budgetBucket.create({
    data: { name: d.name, targetPercent: d.targetPercent, categories: d.categories || [], color: d.color || '#6366f1', sortOrder: d.sortOrder || 0 },
  }));
});

router.put('/buckets/:id', async (req, res) => {
  const d = req.body;
  res.json(await prisma.budgetBucket.update({
    where: { id: +req.params.id },
    data: { name: d.name, targetPercent: d.targetPercent, categories: d.categories, color: d.color, sortOrder: d.sortOrder },
  }));
});

router.delete('/buckets/:id', async (req, res) => {
  await prisma.budgetBucket.delete({ where: { id: +req.params.id } });
  res.json({ success: true });
});

router.get('/monthly-income', async (req, res) => {
  const where: any = {};
  if (req.query.year) where.year = parseInt(req.query.year as string);
  res.json(await prisma.monthlyIncome.findMany({ where }));
});

router.put('/monthly-income/:year/:month', async (req, res) => {
  const { year, month } = req.params;
  const { amount, currency } = req.body;
  res.json(await prisma.monthlyIncome.upsert({
    where: { year_month: { year: +year, month: +month } },
    update: { amount, currency: currency || 'EUR' },
    create: { year: +year, month: +month, amount, currency: currency || 'EUR' },
  }));
});

export default router;
