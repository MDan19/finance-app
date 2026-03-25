import bcrypt from 'bcryptjs';
import { prisma } from './client';

export async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  const existing = await prisma.user.findUnique({ where: { username } });
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: { username, passwordHash, baseCurrency: process.env.BASE_CURRENCY || 'EUR' },
    });
    console.log(`✓ Admin user '${username}' created`);

    // Seed default categories
    await seedDefaultCategories();
    await seedDefaultBuckets();
  }
}

async function seedDefaultCategories() {
  const cats = [
    { name: 'Groceries', icon: '🛒', color: '#22c55e', budgetGroup: 'needs' },
    { name: 'Transport', icon: '🚌', color: '#3b82f6', budgetGroup: 'needs' },
    { name: 'Utilities', icon: '💡', color: '#f59e0b', budgetGroup: 'needs' },
    { name: 'Housing', icon: '🏠', color: '#8b5cf6', budgetGroup: 'needs' },
    { name: 'Health', icon: '⚕️', color: '#ef4444', budgetGroup: 'needs' },
    { name: 'Dining Out', icon: '🍽️', color: '#f97316', budgetGroup: 'wants' },
    { name: 'Entertainment', icon: '🎬', color: '#ec4899', budgetGroup: 'wants' },
    { name: 'Shopping', icon: '🛍️', color: '#06b6d4', budgetGroup: 'wants' },
    { name: 'Travel', icon: '✈️', color: '#14b8a6', budgetGroup: 'wants' },
    { name: 'Subscriptions', icon: '📱', color: '#a855f7', budgetGroup: 'wants' },
    { name: 'Savings', icon: '💰', color: '#10b981', budgetGroup: 'savings' },
    { name: 'Investments', icon: '📈', color: '#6366f1', budgetGroup: 'savings' },
    { name: 'Education', icon: '📚', color: '#84cc16', budgetGroup: 'savings' },
    { name: 'Car', icon: '🚗', color: '#64748b', budgetGroup: 'needs' },
    { name: 'Insurance', icon: '🛡️', color: '#0ea5e9', budgetGroup: 'needs' },
  ];

  for (let i = 0; i < cats.length; i++) {
    await prisma.category.create({ data: { ...cats[i], sortOrder: i } });
  }
}

async function seedDefaultBuckets() {
  const buckets = [
    { name: 'Needs', targetPercent: 50, categories: [], color: '#3b82f6', sortOrder: 0 },
    { name: 'Wants', targetPercent: 30, categories: [], color: '#f97316', sortOrder: 1 },
    { name: 'Savings & Investments', targetPercent: 20, categories: [], color: '#22c55e', sortOrder: 2 },
  ];
  for (const bucket of buckets) {
    await prisma.budgetBucket.create({ data: bucket });
  }
}
