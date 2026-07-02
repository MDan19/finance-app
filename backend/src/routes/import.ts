import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../db/client';
import { authenticate } from '../middleware/auth';
import { getExchangeRate } from '../utils/exchange';
import { updateAccountBalance } from './transactions';

const router = Router();
router.use(authenticate);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ── Parse European number format ──────────────────────────────────────────────
function parseAmount(raw: string): number {
  if (!raw || raw.trim() === '') return NaN;
  let s = raw.replace(/[€$£\s]/g, '');
  if (s.includes('.') && s.includes(',')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      s = s.replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  }
  return parseFloat(s);
}

// ── Parse date ────────────────────────────────────────────────────────────────
function parseDate(raw: string): Date | null {
  if (!raw) return null;
  raw = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return new Date(raw);
  const dmy = raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
  if (dmy) return new Date(`${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`);
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

// ── Split CSV line handling quotes ────────────────────────────────────────────
function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQuotes = !inQuotes; continue; }
    if (line[i] === delimiter && !inQuotes) { result.push(current.trim()); current = ''; continue; }
    current += line[i];
  }
  result.push(current.trim());
  return result;
}

// ── Import profiles ───────────────────────────────────────────────────────────
router.get('/profiles', async (_req, res) => {
  res.json(await prisma.importProfile.findMany({ orderBy: { name: 'asc' } }));
});
router.post('/profiles', async (req, res) => {
  const d = req.body;
  res.status(201).json(await prisma.importProfile.create({
    data: { name: d.name, bankName: d.bankName, delimiter: d.delimiter || ',', encoding: d.encoding || 'UTF-8', columnMap: d.columnMap, dateFormat: d.dateFormat || 'auto' },
  }));
});
router.delete('/profiles/:id', async (req, res) => {
  await prisma.importProfile.delete({ where: { id: +req.params.id } });
  res.json({ success: true });
});

// ── Preview ───────────────────────────────────────────────────────────────────
router.post('/preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const content = req.file.buffer.toString('utf-8');
    const delimiter = (req.body.delimiter as string) || ',';
    const lines = content.split('\n').filter(l => l.trim());
    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1, 21).map(line => {
      const values = splitCsvLine(line, delimiter);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = values[i] || ''; });
      return row;
    });
    res.json({ headers, rows, totalRows: lines.length - 1 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to parse file' });
  }
});

// ── Execute import (batch) ────────────────────────────────────────────────────
router.post('/execute', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { accountId, columnMap: columnMapStr, delimiter: delimiterStr } = req.body;
    const columnMap = JSON.parse(columnMapStr);
    const delimiter = delimiterStr || ',';
    const amountMode = columnMap.amountMode || 'single';
    const baseCurrency = process.env.BASE_CURRENCY || 'EUR';

    const content = req.file.buffer.toString('utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));

    const [keywordRules, account, allAccounts] = await Promise.all([
      prisma.keywordRule.findMany({ where: { isActive: true }, orderBy: { priority: 'desc' } }),
      prisma.account.findUnique({ where: { id: +accountId } }),
      prisma.account.findMany({ where: { isActive: true } }),
    ]);

    if (!account) return res.status(404).json({ error: 'Account not found' });

    // Cache exchange rates to avoid repeated API calls
    const rateCache: Record<string, number> = {};
    const getRate = async (from: string, to: string): Promise<number> => {
      if (from === to) return 1;
      const key = `${from}_${to}`;
      if (!rateCache[key]) rateCache[key] = await getExchangeRate(from, to);
      return rateCache[key];
    };

    const batch = await prisma.importBatch.create({
      data: { filename: req.file.originalname, accountId: +accountId, totalRows: lines.length - 1, status: 'pending' },
    });

    // Parse ALL rows first
    const toInsert: any[] = [];
    let skipped = 0;
    let transfers = 0;
    const log: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) { skipped++; continue; }

      const values = splitCsvLine(line, delimiter);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

      const dateRaw = columnMap.date ? row[columnMap.date] : '';
      const description = columnMap.description ? row[columnMap.description] : '';
      const currencyRaw = columnMap.currency ? row[columnMap.currency] : '';
      const opposingRaw = columnMap.opposingAccount ? row[columnMap.opposingAccount] : '';
      const categoryRaw = columnMap.category ? row[columnMap.category] : '';
      const tagsRaw = columnMap.tags ? row[columnMap.tags] : '';
      const currency = currencyRaw || account.currency;

      if (!dateRaw) { skipped++; log.push(`Row ${i}: skipped — no date`); continue; }

      const date = parseDate(dateRaw);
      if (!date || isNaN(date.getTime())) {
        skipped++; log.push(`Row ${i}: skipped — invalid date: ${dateRaw}`); continue;
      }

      // Parse amount
      let amount: number;
      let isExpense = true;

      if (amountMode === 'two') {
        const debitRaw = columnMap.amountDebit ? row[columnMap.amountDebit] : '';
        const creditRaw = columnMap.amountCredit ? row[columnMap.amountCredit] : '';
        const debit = parseAmount(debitRaw);
        const credit = parseAmount(creditRaw);
        if (!isNaN(debit) && debit > 0) { amount = debit; isExpense = true; }
        else if (!isNaN(credit) && credit > 0) { amount = credit; isExpense = false; }
        else { skipped++; log.push(`Row ${i}: skipped — no valid amount`); continue; }
      } else {
        const amountRaw = columnMap.amount ? row[columnMap.amount] : '';
        amount = parseAmount(amountRaw);
        if (isNaN(amount)) { skipped++; log.push(`Row ${i}: skipped — invalid amount: ${amountRaw}`); continue; }
        isExpense = amount < 0;
        amount = Math.abs(amount);
      }

      // Parse tags
      const tags = tagsRaw ? tagsRaw.split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean) : [];

      // Find opposing account for Transfer detection
      let toAccountId: number | undefined;
      if (opposingRaw && opposingRaw.trim()) {
        const matchedAccount = allAccounts.find(a =>
          a.name.toLowerCase().trim() === opposingRaw.toLowerCase().trim() ||
          (a.institution?.toLowerCase().trim() === opposingRaw.toLowerCase().trim())
        );
        if (matchedAccount && matchedAccount.id !== +accountId) {
          toAccountId = matchedAccount.id;
        }
      }

      // Auto-categorize by CSV category column first, then keywords
      let categoryId: number | null = null;
      if (!toAccountId) {
        if (categoryRaw) {
          const cats = await prisma.category.findFirst({
            where: { name: { equals: categoryRaw.trim(), mode: 'insensitive' }, isActive: true },
          });
          if (cats) categoryId = cats.id;
        }
        if (!categoryId) {
          for (const rule of keywordRules) {
            if (description.toLowerCase().includes(rule.keyword.toLowerCase())) {
              categoryId = rule.categoryId; break;
            }
          }
        }
      }

      const type = toAccountId ? 'TRANSFER' : isExpense ? 'EXPENSE' : 'INCOME';

      toInsert.push({
        date, amount, currency, description, categoryId, toAccountId,
        tags, type, isExpense,
      });
    }

    // Fetch exchange rates for unique currencies (batch)
    const uniqueCurrencies = [...new Set(toInsert.map(r => r.currency).filter(c => c !== baseCurrency))];
    for (const cur of uniqueCurrencies) {
      await getRate(cur, baseCurrency);
    }

    // Duplicate check: get existing transactions for this account
    const existing = await prisma.transaction.findMany({
      where: { accountId: +accountId },
      select: { amount: true, counterparty: true, date: true },
    });
    const existingSet = new Set(existing.map(e =>
      `${new Date(e.date).toDateString()}_${Number(e.amount).toFixed(2)}_${e.counterparty || ''}`
    ));

    // Build insert data
    const insertData: any[] = [];
    let needsCategory = 0;

for (const row of toInsert) {
      const dupKey = `${row.date.toDateString()}_${row.amount.toFixed(2)}_${row.description}`;
      if (existingSet.has(dupKey)) {
        skipped++;
        log.push(`Skipped duplicate: ${row.date.toDateString()} ${row.amount} ${row.description}`);
        continue;
      }

      if (row.toAccountId) {
        const dayStart = new Date(row.date.getFullYear(), row.date.getMonth(), row.date.getDate());
        const dayEnd = new Date(row.date.getFullYear(), row.date.getMonth(), row.date.getDate(), 23, 59, 59);
        const reverseExists = await prisma.transaction.findFirst({
          where: {
            accountId: row.toAccountId,
            toAccountId: +accountId,
            type: 'TRANSFER',
            date: { gte: dayStart, lte: dayEnd },
            amount: row.amount,
          },
        });
        if (reverseExists) {
          skipped++;
          log.push(`Skipped — matched existing transfer from opposite side: ${row.date.toDateString()} ${row.amount}`);
          continue;
        }
      }

      existingSet.add(dupKey); // prevent duplicates within import itself

      const rate = row.currency !== baseCurrency ? (rateCache[`${row.currency}_${baseCurrency}`] || 1) : 1;
      const amountEur = row.amount * rate;

      if (row.type !== 'TRANSFER' && !row.categoryId) needsCategory++;

      insertData.push({
        type: row.type,
        date: row.date,
        accountId: +accountId,
        amount: row.amount,
        currency: row.currency,
        amountEur,
        exchangeRate: rate,
        categoryId: row.categoryId || null,
        counterparty: row.description || null,
        source: 'csv_import',
        importBatchId: batch.id,
        toAccountId: row.toAccountId || null,
        toAmount: row.toAccountId ? row.amount : null,
        toCurrency: row.toAccountId ? row.currency : null,
        tags: row.tags,
      });

      if (row.toAccountId) transfers++;
    }

    // Batch insert in chunks of 100
    const CHUNK = 100;
    let imported = 0;
    for (let i = 0; i < insertData.length; i += CHUNK) {
      const chunk = insertData.slice(i, i + CHUNK);
      await prisma.transaction.createMany({ data: chunk, skipDuplicates: false });
      imported += chunk.length;
    }

    const touchedAccountIds = new Set<number>();
        insertData.forEach(r => {
          touchedAccountIds.add(r.accountId);
          if (r.toAccountId) touchedAccountIds.add(r.toAccountId);
        });
        for (const id of touchedAccountIds) {
          await updateAccountBalance(id);
        }
    
        await prisma.importBatch.update({
          where: { id: batch.id },
          data: { importedRows: imported, skippedRows: skipped, status: 'done' },
        });

    res.json({
      batchId: batch.id,
      imported,
      skipped,
      transfers,
      needsCategory,
      log: log.slice(0, 50), // return first 50 log entries
    });
  } catch (err: any) {
    console.error('Import error:', err);
    res.status(500).json({ error: err.message || 'Import failed' });
  }
});

// ── Keyword rules ─────────────────────────────────────────────────────────────
router.get('/keyword-rules', async (_req, res) => {
  res.json(await prisma.keywordRule.findMany({ orderBy: [{ priority: 'desc' }, { keyword: 'asc' }] }));
});
router.post('/keyword-rules', async (req, res) => {
  const { keyword, categoryId, priority } = req.body;
  res.status(201).json(await prisma.keywordRule.create({
    data: { keyword, categoryId: +categoryId, priority: priority || 0 },
  }));
});
router.put('/keyword-rules/:id', async (req, res) => {
  const { keyword, categoryId, priority, isActive } = req.body;
  res.json(await prisma.keywordRule.update({
    where: { id: +req.params.id },
    data: { keyword, categoryId: +categoryId, priority, isActive },
  }));
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
