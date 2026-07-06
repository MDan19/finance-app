import express from 'express';
import cors from 'cors';
import { prisma } from './db/client';
import { seedAdmin } from './db/seed';
import authRoutes from './routes/auth';
import accountRoutes from './routes/accounts';
import transactionRoutes from './routes/transactions';
import categoryRoutes from './routes/categories';
import budgetRoutes from './routes/budget';
import analyticsRoutes from './routes/analytics';
import importRoutes from './routes/import';
import settingsRoutes from './routes/settings';
import exchangeRoutes from './routes/exchange';
import scheduledRoutes from './routes/scheduled';
import currencyRoutes from './routes/currencies';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/api/currencies', currencyRoutes);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/import', importRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/exchange', exchangeRoutes);
app.use('/api/scheduled', scheduledRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

async function main() {
  try {
    await prisma.$connect();
    console.log('✓ Database connected');
    await seedAdmin();
    console.log('✓ Admin user ready');

    app.listen(PORT, () => {
      console.log(`✓ Backend running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
