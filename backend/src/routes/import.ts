import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../db/client';
import { authenticate } from '../middleware/auth';
import { getExchangeRate } from '../utils/exchange';

const router = Router();
router.use(authenticate);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── Parse European number format ──────────────────────────────────────────────
function parseAmount(raw: string): number {
  if (!raw || raw.trim() === '') return NaN;
  // Remove currency symbols and whitespace
  let s = raw.replace(/[€$£\s]/g, '');
  // Detect format: if has both . and , → determine which is decimal
  if (s.includes('.') && s.includes(',')) {
    // e.g. "1.052,55" → European (dot=thousands, comma=decimal)
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // e.g. "1,052.55" → US (comma=thousands, dot=decimal)
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    // Could be "1 052,55" or "148,29"
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      // Decimal comma: "148,29" → "148.29"
      s = s.replace(',', '.');
    } else {
      // Thousands comma: "1,052" → "1052"
      s = s.replace(/,/g, '');
    }
  }
  // Remove remaining thousand separators (spaces already removed)
  s = s.replace(/\s/g, '');
  return parseFloat(s);
}

// ── Parse date in multiple formats ───────────────────────────────────────────
function parseDate(raw: string): Date | null {
  if (!raw) return null;
  raw = raw.trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return new Date(raw);
  // DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
  const dmy = raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
  if (dmy) return new Date(`${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`);
  // MM/DD/YYYY (US)
  const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) {
    const d = new Date(`${mdy[3]}-${mdy[1].padStart(2,'0')}-${mdy[2].padStart(2,'0')}`);
    if (!isNaN(d.getTime())) return d;
  }
  // Fallback
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
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

// ── Execute import ────────────────────────────────────────────────────────────
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

    const keywordRules = await prisma.keywordRule.findMany({ where: { isActive: true }, orderBy: { priority: 'desc' } });
    const account = await prisma.account.findUnique({ where: { id: +accountId } });
    if (!account) return res.status(404).json({ error: 'Account not found' });

    // Get all accounts for opposing_account matching
    const allAccounts = await prisma.account.findMany({ where: { isActive: true } });

    const batch = await prisma.importBatch.create({
      data: { filename: req.file.originalname, accountId: +accountId, totalRows: lines.length - 1, status: 'pending' },
    });

    let imported = 0, skipped = 0, transfers = 0;
    const needsCategory: number[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = splitCsvLine(lines[i], delimiter);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

      const dateRaw = columnMap.date ? row[columnMap.date] : '';
      const description = columnMap.description ? row[columnMap.description] : '';
      const currencyRaw = columnMap.currency ? row[columnMap.currency] : '';
      const opposingRaw = columnMap.opposingAccount ? row[columnMap.opposingAccount] : '';
      const currency = currencyRaw || account.currency;

      if (!dateRaw) { skipped++; continue; }

      const date = parseDate(dateRaw);
      if (!date || isNaN(date.getTime())) { skipped++; continue; }

      // Parse amount
      let amount: number;
      let isExpense = true;

      if (amountMode === 'two') {
        const debitRaw = columnMap.amountDebit ? row[columnMap.amountDebit] : '';
        const creditRaw = columnMap.amountCredit ? row[columnMap.amountCredit] : '';
        const debit = parseAmount(debitRaw);
        const credit = parseAmount(creditRaw);
        if (!isNaN(debit) && debit > 0) {
          amount = debit; isExpense = true;
        } else if (!isNaN(credit) && credit > 0) {
          amount = credit; isExpense = false;
        } else { skipped++; continue; }
      } else {
        const amountRaw = columnMap.amount ? row[columnMap.amount] : '';
        amount = parseAmount(amountRaw);
        if (isNaN(amount)) { skipped++; continue; }
        isExpense = amount < 0;
        amount = Math.abs(amount);
      }

      // Duplicate check
      const existing = await prisma.transaction.findFirst({
        where: { accountId: +accountId, amount, counterparty: description || null,
          date: { gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
                  lte: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59) } },
      });
      if (existing) { skipped++; continue; }

      // Check for Transfer via opposing_account
      let toAccountId: number | undefined;
      if (opposingRaw) {
        const matchedAccount = allAccounts.find(a =>
          a.name.toLowerCase().trim() === opposingRaw.toLowerCase().trim() ||
          a.institution?.toLowerCase().trim() === opposingRaw.toLowerCase().trim()
        );
        if (matchedAccount && matchedAccount.id !== +accountId) {
          toAccountId = matchedAccount.id;
        }
      }

      // Auto-categorize by keyword
      let categoryId: number | null = null;
      if (!toAccountId) {
        for (const rule of keywordRules) {
          if (description.toLowerCase().includes(rule.keyword.toLowerCase())) {
            categoryId = rule.categoryId; break;
          }
        }
      }

      // Exchange rate
      let amountEur = amount;
      let exchangeRate = 1;
      if (currency !== baseCurrency) {
        exchangeRate = await getExchangeRate(currency, baseCurrency);
        amountEur = amount * exchangeRate;
      }

      const type = toAccountId ? 'TRANSFER' : isExpense ? 'EXPENSE' : 'INCOME';

      const tx = await prisma.transaction.create({
        data: {
          type: type as any,
          date,
          accountId: +accountId,
          amount,
          currency,
          amountEur,
          exchangeRate,
          categoryId: toAccountId ? null : categoryId,
          counterparty: description || null,
          source: 'csv_import',
          importBatchId: batch.id,
          toAccountId: toAccountId || null,
          toAmount: toAccountId ? amount : null,
          toCurrency: toAccountId ? currency : null,
        },
      });

      if (toAccountId) { transfers++; }
      else if (!categoryId) { needsCategory.push(tx.id); }
      imported++;
    }

    await prisma.importBatch.update({
      where: { id: batch.id },
      data: { importedRows: imported, skippedRows: skipped, status: 'done' },
    });

    res.json({ batchId: batch.id, imported, skipped, transfers, needsCategory: needsCategory.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Import failed' });
  }
});

// ── Keyword rules ─────────────────────────────────────────────────────────────
router.get('/keyword-rules', async (_req, res) => {
  res.json(await prisma.keywordRule.findMany({ orderBy: [{ priority: 'desc' }, { keyword: 'asc' }] }));
});
router.post('/keyword-rules', async (req, res) => {
  const { keyword, categoryId, priority } = req.body;
  res.status(201).json(await prisma.keywordRule.create({ data: { keyword, categoryId: +categoryId, priority: priority || 0 } }));
});
router.put('/keyword-rules/:id', async (req, res) => {
  const { keyword, categoryId, priority, isActive } = req.body;
  res.json(await prisma.keywordRule.update({ where: { id: +req.params.id }, data: { keyword, categoryId: +categoryId, priority, isActive } }));
});
router.delete('/keyword-rules/:id', async (req, res) => {
  await prisma.keywordRule.delete({ where: { id: +req.params.id } });
  res.json({ success: true });
});

router.get('/batches', async (_req, res) => {
  res.json(await prisma.importBatch.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }));
});

export default router;
