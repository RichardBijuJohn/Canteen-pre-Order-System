const PREORDER_DRAFT_KEY = 'preorderDraft';

const clampQuantity = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
};

const normalizePrice = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const emitDraftChanged = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('preorder-draft-changed'));
  }
};

export const getPreorderDraftItems = () => {
  try {
    const raw = localStorage.getItem(PREORDER_DRAFT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
};

const writePreorderDraftItems = (items) => {
  localStorage.setItem(PREORDER_DRAFT_KEY, JSON.stringify(items));
  emitDraftChanged();
};

export const getPreorderDraftCount = () => getPreorderDraftItems().length;

export const calculatePreorderTotal = (items) => (
  (items || []).reduce((sum, item) => sum + (normalizePrice(item.price) * clampQuantity(item.quantity)), 0)
);

export const upsertPreorderDraftItem = (item, quantity = 1) => {
  if (!item || !item._id) return;

  const nextQuantity = clampQuantity(quantity);
  const draftItems = getPreorderDraftItems();
  const existingIndex = draftItems.findIndex((entry) => entry._id === item._id);

  if (existingIndex >= 0) {
    const existing = draftItems[existingIndex];
    draftItems[existingIndex] = {
      ...existing,
      quantity: clampQuantity(existing.quantity + nextQuantity),
      price: normalizePrice(item.price),
      name: item.name || existing.name,
      preparationTime: item.preparationTime || existing.preparationTime
    };
  } else {
    draftItems.push({
      _id: item._id,
      name: item.name || 'Item',
      price: normalizePrice(item.price),
      quantity: nextQuantity,
      preparationTime: item.preparationTime
    });
  }

  writePreorderDraftItems(draftItems);
};

export const updatePreorderDraftQuantity = (itemId, quantity) => {
  if (!itemId) return;
  const draftItems = getPreorderDraftItems().map((item) => (
    item._id === itemId ? { ...item, quantity: clampQuantity(quantity) } : item
  ));
  writePreorderDraftItems(draftItems);
};

export const removePreorderDraftItem = (itemId) => {
  if (!itemId) return;
  const nextItems = getPreorderDraftItems().filter((item) => item._id !== itemId);
  writePreorderDraftItems(nextItems);
};

export const clearPreorderDraft = () => {
  localStorage.removeItem(PREORDER_DRAFT_KEY);
  emitDraftChanged();
};
