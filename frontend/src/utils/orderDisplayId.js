const DIGIT_COUNT = 3;
const PREFIX = 'O';

const normalizeHexId = (value) => String(value || '').trim().toLowerCase();

const normalizeDisplayCode = (value) => String(value || '').trim().toUpperCase();

export const formatOrderDisplayId = (orderCodeOrId) => {
  const readable = normalizeDisplayCode(orderCodeOrId);
  if (/^[A-Z]\d+$/.test(readable)) {
    return readable;
  }

  const raw = normalizeHexId(orderCodeOrId);
  if (!raw) return `${PREFIX}${'0'.repeat(DIGIT_COUNT)}`;

  const safeHex = raw.replace(/[^0-9a-f]/g, '').slice(-8);
  if (!safeHex) return `${PREFIX}${'0'.repeat(DIGIT_COUNT)}`;

  const numeric = Number.parseInt(safeHex, 16);
  if (Number.isNaN(numeric)) return `${PREFIX}${'0'.repeat(DIGIT_COUNT)}`;

  const digits = String(numeric).slice(-DIGIT_COUNT).padStart(DIGIT_COUNT, '0');
  return `${PREFIX}${digits}`;
};
