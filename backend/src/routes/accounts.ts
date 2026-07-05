import { Router } from 'express';
import { prisma } from '../db/client';
import { authenticate } from '../middleware/auth';
import { Prisma } from '@prisma/client';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res) => {
  try {
    const accounts = await prisma.account.findMany({
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

router.get('/:id', async (req, res) => {
  const account = await prisma.account.findUnique({ where: { id: +req.params.id } });
  if (!account) return res.status(404).json({ error: 'Not found' });
  res.json(account);
});

router.post('/', async (req, res) => {
  try {
    const data = req.body;
    const account = await prisma.account.create({
      data: {
        name: data.name,
        type: data.type,
        currency: data.currency || 'EUR',
        institution: data.institution,
        openingDate: data.openingDate ? new Date(data.openingDate) : null,
        isActive: data.isActive ?? true,
        notes: data.notes,
        currentBalance: data.currentBalance ?? 0,
        openingBalance: data.openingBalance ?? 0,
        creditLimit: data.creditLimit,
        currentDebt: data.currentDebt ?? 0,
        originalAmount: data.originalAmount,
        remainingAmount: data.remainingAmount,
        monthlyPayment: data.monthlyPayment,
        interestRate: data.interestRate,
        endDate: data.endDate ? new Date(data.endDate) : null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        counterpartyName: data.counterpartyName,
        direction: data.direction,
      },
    });
    res.status(201).json(account);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const data = req.body;
    const account = await prisma.account.update({
      where: { id: +req.params.id },
      data: {
        name: data.name,
        type: data.type,
        currency: data.currency,
        institution: data.institution,
        openingDate: data.openingDate ? new Date(data.openingDate) : null,
        isActive: data.isActive,
        notes: data.notes,
        currentBalance: data.currentBalance,
        openingBalance: data.openingBalance ?? 0,
        creditLimit: data.creditLimit,
        currentDebt: data.currentDebt,
        originalAmount: data.originalAmount,
        remainingAmount: data.remainingAmount,
        monthlyPayment: data.monthlyPayment,
        interestRate: data.interestRate,
        endDate: data.endDate ? new Date(data.endDate) : null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        counterpartyName: data.counterpartyName,
        direction: data.direction,
      },
    });
    res.json(account);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update account' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.account.update({
      where: { id: +req.params.id },
      data: { isActive: false },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

router.get('/:id/balance', async (req, res) => {
  const account = await prisma.account.findUnique({ where: { id: +req.params.id } });
  if (!account) return res.status(404).json({ error: 'Not found' });

  const income = await prisma.transaction.aggregate({
    where: { accountId: +req.params.id, type: 'INCOME' },
    _sum: { amountEur: true },
  });
  const expense = await prisma.transaction.aggregate({
    where: { accountId: +req.params.id, type: 'EXPENSE' },
    _sum: { amountEur: true },
  });

  res.json({
    account,
    totalIncome: income._sum.amountEur ?? 0,
    totalExpense: expense._sum.amountEur ?? 0,
  });
});

router.delete('/:id/permanent', async (req, res) => {
  try {
    await prisma.account.delete({ where: { id: +req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2003') {
      return res.status(400).json({
        error: 'Cannot delete: account has linked transactions. Delete them first via Settings → Transactions.',
      });
    }
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;
