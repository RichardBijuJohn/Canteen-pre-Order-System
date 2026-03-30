const ORDER_CODE_PREFIX = 'O';
const ORDER_CODE_DIGITS = 4;
const MAX_GENERATION_ATTEMPTS = 40;

const buildCandidateCode = () => {
  const max = 10 ** ORDER_CODE_DIGITS;
  const value = Math.floor(Math.random() * max);
  const digits = String(value).padStart(ORDER_CODE_DIGITS, '0');
  return `${ORDER_CODE_PREFIX}${digits}`;
};

const isCodeTaken = async (OrderModel, orderCode) => {
  const existing = await OrderModel.exists({ orderCode });
  return Boolean(existing);
};

const generateUniqueOrderCode = async (OrderModel) => {
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = buildCandidateCode();
    // eslint-disable-next-line no-await-in-loop
    const taken = await isCodeTaken(OrderModel, candidate);
    if (!taken) {
      return candidate;
    }
  }

  const fallback = Date.now().toString().slice(-ORDER_CODE_DIGITS);
  return `${ORDER_CODE_PREFIX}${fallback.padStart(ORDER_CODE_DIGITS, '0')}`;
};

module.exports = {
  generateUniqueOrderCode,
  ORDER_CODE_PREFIX,
  ORDER_CODE_DIGITS
};
