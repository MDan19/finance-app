import { Router } from 'express';
import { prisma } from '../db/client';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Dashboard: net worth snapshot
router.get('/networth', async (_req, res) => {
  try {
    const accounts = await prisma.account.findMany({ where: { isActive: true } });

    let totalAssets = 0;
    let totalLiabilities = 0;

    for (const acc of accounts) {
      const balance = Number(acc.currentBalance ?? 0);
      const remaining = Number(acc.remainingAmount ?? 0);
      const debt = Number(acc.currentDebt ?? 0);

      switch (acc.type) {
        case 'BANK':
        case 'CASH':
          totalAssets += balance;
          break;
        case 'CREDIT_CARD':
          totalLiabilities += debt;
          break;
        case 'LOAN_CONSUMER':
        case 'LOAN_AUTO':
        case 'MORTGAGE':
          totalLiabilities += remaining;
          break;
        case 'PERSONAL_DEBT':
          totalLiabilities += balance;
          break;
        case 'PERSONAL_CREDIT':
          totalAssets += balance;
          break;
      }
    }

    res.json({
      totalAssets,
      totalLiabilities,
      netWorth: totalAssets - totalLiabilities,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute net worth' });
  }
});

// Dashboard: this month summary
router.get('/this-month', async (_req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [income, expense, topCategories] = await Promise.all([
      prisma.transaction.aggregate({
        where: { type: 'INCOME', date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amountEur: true },
      }),
      prisma.transaction.aggregate({
        where: { type: 'EXPENSE', date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amountEur: true },
      }),
      prisma.transaction.groupBy({
        by: ['categoryId'],
        where: { type: 'EXPENSE', date: { gte: startOfMonth, lte: endOfMonth }, categoryId: { not: null } },
        _sum: { amountEur: true },
        orderBy: { _sum: { amountEur: 'desc' } },
        take: 3,
      }),
    ]);

    const categoryIds = topCategories.map(c => c.categoryId!).filter(Boolean);
    const categories = await prisma.category.findMany({ where: { id: { in: categoryIds } } });
    const catMap = Object.fromEntries(categories.map(c => [c.id, c]));

    const topCategoriesWithInfo = topCategories.map(c => ({
      category: catMap[c.categoryId!],
      amount: Number(c._sum.amountEur ?? 0),
    }));

    res.json({
      income: Number(income._sum.amountEur ?? 0),
      expense: Number(expense._sum.amountEur ?? 0),
      balance: Number(income._sum.amountEur ?? 0) - Number(expense._sum.amountEur ?? 0),
      topCategories: topCategoriesWithInfo,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch monthly summary' });
  }
});

// Categories spending
router.get('/categories-spending', async (req, res) => {
  try {
    const { startDate, endDate, accountId } = req.query as Record<string, string>;

    const where: any = { type: 'EXPENSE' };
    if (startDate) where.date = { ...where.date, gte: new Date(startDate) };
    if (endDate) where.date = { ...where.date, lte: new Date(endDate + 'T23:59:59') };
    if (accountId) where.accountId = { in: accountId.split(',').map(Number) };

    const spending = await prisma.transaction.groupBy({
      by: ['categoryId'],
      where,
      _sum: { amountEur: true },
    });

    const categoryIds = spending.map(s => s.categoryId!).filter(Boolean);
    const categories = await prisma.category.findMany({ where: { id: { in: categoryIds } } });
    const catMap = Object.fromEntries(categories.map(c => [c.id, c]));

    res.json(spending.map(s => ({
      category: catMap[s.categoryId!],
      amount: Number(s._sum.amountEur ?? 0),
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch category spending' });
  }
});

// Monthly trend (last 12 months per category)
router.get('/monthly-trend', async (req, res) => {
  try {
    const { categoryId } = req.query;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 11);
    startDate.setDate(1);

    const where: any = {
      type: 'EXPENSE',
      date: { gte: startDate, lte: endDate },
    };
    if (categoryId) where.categoryId = +categoryId;

    const transactions = await prisma.transaction.findMany({
      where,
      select: { date: true, amountEur: true, categoryId: true },
    });

    // Group by month
    const monthly: Record<string, number> = {};
    for (const tx of transactions) {
      const key = `${new Date(tx.date).getFullYear()}-${String(new Date(tx.date).getMonth() + 1).padStart(2, '0')}`;
      monthly[key] = (monthly[key] || 0) + Number(tx.amountEur ?? 0);
    }

    res.json(monthly);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trend' });
  }
});

// Budget buckets compliance
router.get('/bucket-compliance', async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [buckets, monthlyIncome, spending] = await Promise.all([
      prisma.budgetBucket.findMany({ orderBy: { sortOrder: 'asc' } }),
      prisma.monthlyIncome.findFirst({
        where: { year: now.getFullYear(), month: now.getMonth() + 1 },
      }),
      prisma.transaction.groupBy({
        by: ['categoryId'],
        where: { type: 'EXPENSE', date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amountEur: true },
      }),
    ]);

    const spendMap: Record<number, number> = {};
    for (const s of spending) {
      if (s.categoryId) spendMap[s.categoryId] = Number(s._sum.amountEur ?? 0);
    }

    const income = Number(monthlyIncome?.amount ?? 0);

    const result = buckets.map(bucket => {
      const categoryIds = ((bucket.categories as unknown) as number[]) || [];
      const spent = categoryIds.reduce((sum, id) => sum + (spendMap[id] || 0), 0);
      const budgeted = income * (Number(bucket.targetPercent) / 100);
      return {
        ...bucket,
        budgeted,
        spent,
        left: budgeted - spent,
        percentUsed: budgeted > 0 ? (spent / budgeted) * 100 : 0,
      };
    });

    res.json({ buckets: result, monthlyIncome: income });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch compliance' });
  }
});

router.get('/tag-breakdown', async (req, res) => {
  try {
    const { categoryId, startDate, endDate } = req.query as Record<string, string>
    const where: any = { type: 'EXPENSE' }
    if (categoryId) where.categoryId = +categoryId
    if (startDate) where.date = { ...where.date, gte: new Date(startDate) }
    if (endDate) where.date = { ...where.date, lte: new Date(endDate + 'T23:59:59') }

    const transactions = await prisma.transaction.findMany({
      where, select: { amountEur: true, amount: true, tags: true },
    })

    const tagTotals: Record<string, number> = {}
    for (const tx of transactions) {
      const tags = (tx as any).tags as string[]
      const amt = Number(tx.amountEur ?? tx.amount ?? 0)
      if (!tags || tags.length === 0) {
        tagTotals['general'] = (tagTotals['general'] || 0) + amt
      } else {
        for (const tag of tags) {
          tagTotals[tag] = (tagTotals[tag] || 0) + amt
        }
      }
    }

    const result = Object.entries(tagTotals)
      .map(([tag, amount]) => ({ tag, amount }))
      .sort((a, b) => b.amount - a.amount)

    res.json(result)
  } catch (err) {
    res.status(500).json({ error: 'Failed' })
  }
})

export default router;
