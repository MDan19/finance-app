import { Router } from 'express';
import { prisma } from '../db/client';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res) => {
  try {
    const payments = await prisma.scheduledPayment.findMany({
      where: { isActive: true },
      orderBy: { dueDay: 'asc' },
    });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch scheduled payments' });
  }
});

router.get('/upcoming', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 14;
    const today = new Date();
    const payments = await prisma.scheduledPayment.findMany({
      where: { isActive: true },
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
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch upcoming payments' });
  }
});

router.post('/', async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ error: 'Failed to create scheduled payment' });
  }
});

router.put('/:id', async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ error: 'Failed to update scheduled payment' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.scheduledPayment.update({
      where: { id: +req.params.id },
      data: { isActive: false },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete scheduled payment' });
  }
});

export default router;
