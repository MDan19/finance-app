import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../db/client';
import { authenticate } from '../middleware/auth';
import { getExchangeRate } from '../utils/exchange';

const router = Router();
router.use(authenticate);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/profiles', async (_req, res) => {
  const profiles = await prisma.importProfile.findMany({ orderBy: { name: 'asc' } });
  res.json(profiles);
});

router.post('/profiles', async (req, res) => {
  const data = req.body;
  const profile = await prisma.importProfile.create({
    data: {
      name: data.name,
      bankName: data.bankName,
      delimiter: data.delimiter || ',',
      encoding: data.encoding || 'UTF-8',
      columnMap: data.columnMap,
      dateFormat: data.dateFormat || 'YYYY-MM-DD',
    },
  });
  res.status(201).json(profile);
});

router.put('/profiles/:id', async (req, res) => {
  const data = req.body;
  const profile = await prisma.importProfile.update({
    where: { id: +req.params.id },
    data: {
      name: data.name,
      bankName: data.bankName,
      delimiter: data.delimiter,
      encoding: data.encoding,
      columnMap: data.columnMap,
      dateFormat: data.dateFormat,
    },
  });
  res.json(profile);
});

router.delete('/profiles/:id', async (req, res) => {
  await prisma.importProfile.delete({ where: { id: +req.params.id } });
  res.json({ success: true });
});

router.post('/preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const content = req.file.buffer.toString('utf-8');
    const delimiter = (req.body.delimiter as string) || ',';
    const lines = content.split('\n').filter(l => l.trim());
    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, ''));
    const rows = lines.slice(1, 21).map(line => {
      const values = line.split(delimiter).map(v => v.trim().replace(/"/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = values[i] || ''; });
      return row;
    });
    res.json({ headers, rows, totalRows: lines.length - 1 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to parse file' });
  }
});

router.post('/execute', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { accountId, columnMap: columnMapStr, delimiter: delimiterStr } = req.body;
    const columnMap = JSON.parse(columnMapStr);
    const delimiter = delimiterStr || ',';
    const baseCurrency = process.env.BASE_CURRENCY || 'EUR';

    const content = req.file.buffer.toString('utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, ''));

    const keywordRules = await prisma.keywordRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });

    const account = await prisma.account.findUnique({ where: { id: +accountId } });
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const batch = await prisma.importBatch.create({
      data: {
        filename: req.file.originalname,
        accountId: +accountId,
        totalRows: lines.length - 1,
        status: 'pending',
      },
    });

    let imported = 0;
    let skipped = 0;
    const needsCategory: number[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter).map(v => v.trim().replace(/"/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

      const dateRaw = row[columnMap.date];
      const amountRaw = row[columnMap.amount];
      const description = row[columnMap.description] || '';
      const currency = row[columnMap.currency] || account.currency;

      if (!dateRaw || !amountRaw) { skipped++; continue; }

      const date = new Date(dateRaw);
      if (isNaN(date.getTime())) { skipped++; continue; }

      const amount = parseFloat(amountRaw.replace(',', '.').replace(/[^0-9.-]/g, ''));
      if (isNaN(amount)) { skipped++; continue; }

      const existing = await prisma.transaction.findFirst({
        where: {
          accountId: +accountId,
          amount: Math.abs(amount),
          counterparty: description || null,
        },
      });
      if (existing) { skipped++; continue; }

      let categoryId: number | null = null;
      for (const rule of keywordRules) {
        if (description.toLowerCase().includes(rule.keyword.toLowerCase())) {
          categoryId = rule.categoryId;
          break;
        }
      }

      let amountEur = Math.abs(amount);
      let exchangeRate = 1;
      if (currency !== baseCurrency) {
        exchangeRate = await getExchangeRate(currency, baseCurrency);
        amountEur = Math.abs(amount) * exchangeRate;
      }

      const type = amount < 0 ? 'EXPENSE' : 'INCOME';

      const tx = await prisma.transaction.create({
        data: {
          type: type as 'EXPENSE' | 'INCOME',
          date: new Date(dateRaw),
          accountId: +accountId,
          amount: Math.abs(amount),
          currency,
          amountEur,
          exchangeRate,
          categoryId,
          counterparty: description,
          source: 'csv_import',
          importBatchId: batch.id,
        },
      });

      if (!categoryId) needsCategory.push(tx.id);
      imported++;
    }

    await prisma.importBatch.update({
      where: { id: batch.id },
      data: { importedRows: imported, skippedRows: skipped, status: 'done' },
    });

    res.json({ batchId: batch.id, imported, skipped, needsCategory: needsCategory.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Import failed' });
  }
});

router.get('/keyword-rules', async (_req, res) => {
  const rules = await prisma.keywordRule.findMany({
    orderBy: [{ priority: 'desc' }, { keyword: 'asc' }],
  });
  res.json(rules);
});

router.post('/keyword-rules', async (req, res) => {
  const { keyword, categoryId, priority } = req.body;
  const rule = await prisma.keywordRule.create({
    data: { keyword, categoryId: +categoryId, priority: priority || 0 },
  });
  res.status(201).json(rule);
});

router.put('/keyword-rules/:id', async (req, res) => {
  const { keyword, categoryId, priority, isActive } = req.body;
  const rule = await prisma.keywordRule.update({
    where: { id: +req.params.id },
    data: { keyword, categoryId: +categoryId, priority, isActive },
  });
  res.json(rule);
});

router.delete('/keyword-rules/:id', async (req, res) => {
  await prisma.keywordRule.delete({ where: { id: +req.params.id } });
  res.json({ success: true });
});

router.get('/batches', async (_req, res) => {
  const batches = await prisma.importBatch.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(batches);
});

export default router;
