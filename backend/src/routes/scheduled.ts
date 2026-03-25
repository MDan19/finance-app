import { Router } from 'express';
import { prisma } from '../db/client';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res) => {
  const payments = await prisma.scheduledPayment.findMany({
    where: { isActive: true },
    include: {
      account: { select: { id: true, name: true } },
      category: { select: { id: true, name: true, color: true, icon: true } },
    },
    orderBy: { dueDay: 'asc' },
  });
  res.json(payments);
});

// Get upcoming in next N days
router.get('/upcoming', async (req, res) => {
  const days = parseInt(req.query.days as string) || 14;
  const today = new Date();
  const payments = await prisma.scheduledPayment.findMany({
    where: { isActive: true },
    include: {
      account: { select: { id: true, name: true } },
      category: { select: { id: true, name: true, color: true, icon: true } },
    },
    orderBy: { dueDay: 'asc' },
  });

  const upcoming = payments
    .map(p => {
      const thisMonth = new Date(today.getFullYear(), today.getMonth(), p.dueDay);
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, p.dueDay);
      const dueDate = thisMonth >= today ? thisMonth : nextMonth;
      const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { ...p, dueDate, diffDays };
    })
    .filter(p => p.diffDays <= days)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  res.json(upcoming);
});

router.post('/', async (req, res) => {
  const data = req.body;
  const payment = await prisma.scheduledPayment.create({
    data: {
      name: data.name,
      accountId: +data.accountId,
      categoryId: data.categoryId ? +data.categoryId : null,
      amount: data.amount,
      currency: data.currency || 'EUR',
      dueDay: +data.dueDay,
      notes: data.notes,
    },
  });
  res.status(201).json(payment);
});

router.put('/:id', async (req, res) => {
  const data = req.body;
  const payment = await prisma.scheduledPayment.update({
    where: { id: +req.params.id },
    data: {
      name: data.name,
      accountId: +data.accountId,
      categoryId: data.categoryId ? +data.categoryId : null,
      amount: data.amount,
      currency: data.currency,
      dueDay: +data.dueDay,
      isActive: data.isActive,
      notes: data.notes,
    },
  });
  res.json(payment);
});

router.delete('/:id', async (req, res) => {
  await prisma.scheduledPayment.update({
    where: { id: +req.params.id },
    data: { isActive: false },
  });
  res.json({ success: true });
});

export default router;
