import { Router } from 'express';
import { prisma } from '../db/client';
import { authenticate } from '../middleware/auth';
import { getExchangeRate } from '../utils/exchange';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const {
      page = '1', limit = '50',
      startDate, endDate, accountId, categoryId,
      type, search, minAmount, maxAmount,
    } = req.query as Record<string, string>;

    const where: any = {};
    const andConditions: any[] = [];

    if (startDate) where.date = { ...where.date, gte: new Date(startDate) };
    if (endDate) where.date = { ...where.date, lte: new Date(endDate + 'T23:59:59') };
    if (accountId) {
      const ids = accountId.split(',').map(Number);
      andConditions.push({ OR: [{ accountId: { in: ids } }, { toAccountId: { in: ids } }] });
    }
    if (categoryId) {
      const ids = categoryId.split(',').map(Number);
      where.categoryId = { in: ids };
    }
    if (type) {
      const types = type.split(',');
      where.type = { in: types };
    }
    if (search) {
      andConditions.push({
        OR: [
          { note: { contains: search, mode: 'insensitive' } },
          { counterparty: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    if (minAmount) where.amount = { ...where.amount, gte: parseFloat(minAmount) };
    if (maxAmount) where.amount = { ...where.amount, lte: parseFloat(maxAmount) };
    if (andConditions.length) where.AND = andConditions;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          account: { select: { id: true, name: true, currency: true, type: true } },
          toAccount: { select: { id: true, name: true, currency: true } },
          category: { select: { id: true, name: true, color: true, icon: true } },
          linkedTransaction: { select: { id: true, type: true, amount: true, date: true } },
        },
        orderBy: { date: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({ transactions, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

router.get('/:id', async (req, res) => {
  const tx = await prisma.transaction.findUnique({
    where: { id: +req.params.id },
    include: {
      account: true,
      toAccount: true,
      category: true,
      linkedTransaction: true,
      linkedBy: true,
    },
  });
  if (!tx) return res.status(404).json({ error: 'Not found' });
  res.json(tx);
});

router.post('/', async (req, res) => {
  try {
    const data = req.body;
    const baseCurrency = process.env.BASE_CURRENCY || 'EUR';

    // Calculate EUR amount if needed
    let amountEur = data.amountEur;
    let exchangeRate = data.exchangeRate;
    if (!amountEur && data.currency !== baseCurrency) {
      const rate = await getExchangeRate(data.currency, baseCurrency);
      exchangeRate = rate;
      amountEur = parseFloat(data.amount) * rate;
    } else if (!amountEur && data.currency === baseCurrency) {
      amountEur = parseFloat(data.amount);
      exchangeRate = 1;
    }

    const tx = await prisma.transaction.create({
      data: {
        type: data.type,
        date: new Date(data.date),
        accountId: data.accountId,
        amount: data.amount,
        currency: data.currency,
        amountEur,
        exchangeRate,
        categoryId: data.categoryId || null,
        incomeSource: data.incomeSource || null,
        counterparty: data.counterparty || null,
        note: data.note || null,
        source: data.source || 'manual',
        linkedTransactionId: data.linkedTransactionId || null,
        compensationSource: data.compensationSource || null,
        toAccountId: data.toAccountId || null,
        toAmount: data.toAmount || null,
        toCurrency: data.toCurrency || null,
        toExchangeRate: data.toExchangeRate || null,
        tags: data.tags || [],
      },
      include: {
        account: { select: { id: true, name: true, currency: true } },
        category: { select: { id: true, name: true, color: true, icon: true } },
      },
    });

    // Update account balances
    await updateAccountBalance(data.accountId);
    if (data.toAccountId) await updateAccountBalance(data.toAccountId);

    res.status(201).json(tx);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const data = req.body;
    const baseCurrency = process.env.BASE_CURRENCY || 'EUR';

    let amountEur = data.amountEur;
    let exchangeRate = data.exchangeRate;
    if (!amountEur && data.currency !== baseCurrency) {
      const rate = await getExchangeRate(data.currency, baseCurrency);
      exchangeRate = rate;
      amountEur = parseFloat(data.amount) * rate;
    } else if (!amountEur) {
      amountEur = parseFloat(data.amount);
      exchangeRate = 1;
    }

    const tx = await prisma.transaction.update({
      where: { id: +req.params.id },
      data: {
        type: data.type,
        date: new Date(data.date),
        accountId: data.accountId,
        amount: data.amount,
        currency: data.currency,
        amountEur,
        exchangeRate,
        categoryId: data.categoryId || null,
        incomeSource: data.incomeSource || null,
        counterparty: data.counterparty || null,
        note: data.note || null,
        linkedTransactionId: data.linkedTransactionId || null,
        compensationSource: data.compensationSource || null,
        toAccountId: data.toAccountId || null,
        toAmount: data.toAmount || null,
        toCurrency: data.toCurrency || null,
        tags: data.tags || [],
      },
      include: {
        account: { select: { id: true, name: true, currency: true } },
        category: { select: { id: true, name: true, color: true, icon: true } },
      },
    });

    await updateAccountBalance(data.accountId);
    if (data.toAccountId) await updateAccountBalance(data.toAccountId);

    res.json(tx);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const tx = await prisma.transaction.findUnique({ where: { id: +req.params.id } });
    if (!tx) return res.status(404).json({ error: 'Not found' });

    await prisma.transaction.delete({ where: { id: +req.params.id } });
    await updateAccountBalance(tx.accountId);
    if (tx.toAccountId) await updateAccountBalance(tx.toAccountId);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

router.post('/bulk-delete', async (req, res) => {
  const { ids } = req.body;
  await prisma.transaction.deleteMany({ where: { id: { in: ids } } });
  res.json({ success: true });
});

router.post('/bulk-categorize', async (req, res) => {
  const { ids, categoryId } = req.body;
  await prisma.transaction.updateMany({
    where: { id: { in: ids } },
    data: { categoryId },
  });
  res.json({ success: true });
});

export async function updateAccountBalance(accountId: number) {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return;

  // Calculate balance from transactions
  const income = await prisma.transaction.aggregate({
    where: { accountId, type: { in: ['INCOME', 'COMPENSATION'] } },
    _sum: { amount: true },
  });
  const expense = await prisma.transaction.aggregate({
    where: { accountId, type: { in: ['EXPENSE'] } },
    _sum: { amount: true },
  });
  const transferIn = await prisma.transaction.aggregate({
    where: { toAccountId: accountId, type: 'TRANSFER' },
    _sum: { toAmount: true },
  });
  const transferOut = await prisma.transaction.aggregate({
    where: { accountId, type: 'TRANSFER' },
    _sum: { amount: true },
  });
  const refunds = await prisma.transaction.aggregate({
    where: { accountId, type: 'REFUND' },
    _sum: { amount: true },
  });

  const openingBalance = Number(account.currentBalance) || 0;
  const totalIncome = Number(income._sum.amount ?? 0);
  const totalExpense = Number(expense._sum.amount ?? 0);
  const totalTransferIn = Number(transferIn._sum.toAmount ?? 0);
  const totalTransferOut = Number(transferOut._sum.amount ?? 0);
  const totalRefunds = Number(refunds._sum.amount ?? 0);

  // This is a running balance — for simplicity we just recompute from transactions
  const balance = totalIncome + totalTransferIn + totalRefunds - totalExpense - totalTransferOut;

  await prisma.account.update({
    where: { id: accountId },
    data: { currentBalance: balance },
  });
}

// Add these two routes to backend/src/routes/transactions.ts
// Place them BEFORE "export default router"

// Count transactions by filter (for Settings preview)
router.get('/count', async (req, res) => {
  try {
    const { accountId, startDate, endDate, importBatchId } = req.query as Record<string, string>
    const where: any = {}
    if (accountId) where.accountId = +accountId
    if (importBatchId) where.importBatchId = +importBatchId
    if (startDate) where.date = { ...where.date, gte: new Date(startDate) }
    if (endDate) where.date = { ...where.date, lte: new Date(endDate + 'T23:59:59') }
    const count = await prisma.transaction.count({ where })
    res.json({ count })
  } catch (err) {
    res.status(500).json({ error: 'Failed to count' })
  }
})

// Bulk delete by filter (for Settings)
router.delete('/bulk-delete-filtered', async (req, res) => {
  try {
    const { accountId, startDate, endDate, importBatchId } = req.query as Record<string, string>
    const where: any = {}
    if (accountId) where.accountId = +accountId
    if (importBatchId) where.importBatchId = +importBatchId
    if (startDate) where.date = { ...where.date, gte: new Date(startDate) }
    if (endDate) where.date = { ...where.date, lte: new Date(endDate + 'T23:59:59') }

    let total = 0
    while (true) {
      const ids = await prisma.transaction.findMany({
        where, select: { id: true }, take: 500,
      })
      if (ids.length === 0) break
      await prisma.transaction.deleteMany({
        where: { id: { in: ids.map(r => r.id) } }
      })
      total += ids.length
      await new Promise(r => setTimeout(r, 100))
    }

    res.json({ deleted: total })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete' })
  }
})


export default router;
