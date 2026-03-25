import { Router } from 'express';
import { prisma } from '../db/client';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res) => {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    include: { children: { where: { isActive: true } } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  // Return only top-level
  res.json(categories.filter(c => !c.parentId));
});

router.get('/all', async (_req, res) => {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  res.json(categories);
});

router.post('/', async (req, res) => {
  const data = req.body;
  const cat = await prisma.category.create({
    data: {
      name: data.name,
      color: data.color || '#6366f1',
      icon: data.icon || '📦',
      parentId: data.parentId || null,
      budgetGroup: data.budgetGroup || null,
      sortOrder: data.sortOrder || 0,
    },
  });
  res.status(201).json(cat);
});

router.put('/:id', async (req, res) => {
  const data = req.body;
  const cat = await prisma.category.update({
    where: { id: +req.params.id },
    data: {
      name: data.name,
      color: data.color,
      icon: data.icon,
      parentId: data.parentId || null,
      budgetGroup: data.budgetGroup || null,
      sortOrder: data.sortOrder,
    },
  });
  res.json(cat);
});

router.delete('/:id', async (req, res) => {
  await prisma.category.update({
    where: { id: +req.params.id },
    data: { isActive: false },
  });
  res.json({ success: true });
});

router.put('/reorder', async (req, res) => {
  const { order } = req.body; // [{ id, sortOrder }]
  await Promise.all(
    order.map((item: { id: number; sortOrder: number }) =>
      prisma.category.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } })
    )
  );
  res.json({ success: true });
});

export default router;
