const PREORDER_DRAFT_KEY = 'preorderDraft';
export const MAX_PREORDER_TOTAL_QUANTITY = 8;

const clampQuantity = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(Math.floor(parsed), MAX_PREORDER_TOTAL_QUANTITY);
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
    if (!Array.isArray(parsed)) return [];

    // Keep legacy drafts valid by capping item and total quantities to current limit.
    let runningTotal = 0;
    return parsed.reduce((acc, item) => {
      if (!item || !item._id) return acc;
      const remaining = MAX_PREORDER_TOTAL_QUANTITY - runningTotal;
      if (remaining <= 0) return acc;

      const nextQuantity = Math.min(clampQuantity(item.quantity), remaining);
      if (nextQuantity <= 0) return acc;

      runningTotal += nextQuantity;
      acc.push({
        ...item,
        quantity: nextQuantity,
        price: normalizePrice(item.price)
      });
      return acc;
    }, []);
  } catch (err) {
    return [];
  }
};

const writePreorderDraftItems = (items) => {
  localStorage.setItem(PREORDER_DRAFT_KEY, JSON.stringify(items));
  emitDraftChanged();
};

export const getPreorderDraftCount = () => getPreorderDraftItems().length;

export const getPreorderDraftTotalQuantity = (items = getPreorderDraftItems()) => (
  (items || []).reduce((sum, item) => sum + clampQuantity(item.quantity), 0)
);

export const calculatePreorderTotal = (items) => (
  (items || []).reduce((sum, item) => sum + (normalizePrice(item.price) * clampQuantity(item.quantity)), 0)
);

export const upsertPreorderDraftItem = (item, quantity = 1) => {
  if (!item || !item._id) return { addedQuantity: 0, reachedLimit: false };

  const nextQuantity = clampQuantity(quantity);
  const draftItems = getPreorderDraftItems();
  const existingIndex = draftItems.findIndex((entry) => entry._id === item._id);
  const currentTotal = getPreorderDraftTotalQuantity(draftItems);
  const maxAddable = Math.max(0, MAX_PREORDER_TOTAL_QUANTITY - currentTotal);
  const quantityToAdd = Math.min(nextQuantity, maxAddable);

  if (quantityToAdd <= 0) {
    return { addedQuantity: 0, reachedLimit: true };
  }

  if (existingIndex >= 0) {
    const existing = draftItems[existingIndex];
    draftItems[existingIndex] = {
      ...existing,
      quantity: clampQuantity(existing.quantity + quantityToAdd),
      price: normalizePrice(item.price),
      name: item.name || existing.name,
      preparationTime: item.preparationTime || existing.preparationTime
    };
  } else {
    draftItems.push({
      _id: item._id,
      name: item.name || 'Item',
      price: normalizePrice(item.price),
      quantity: quantityToAdd,
      preparationTime: item.preparationTime
    });
  }

  writePreorderDraftItems(draftItems);
  const updatedTotal = getPreorderDraftTotalQuantity(draftItems);
  return {
    addedQuantity: quantityToAdd,
    reachedLimit: updatedTotal >= MAX_PREORDER_TOTAL_QUANTITY
  };
};

export const updatePreorderDraftQuantity = (itemId, quantity) => {
  if (!itemId) return { quantity: 1, capped: false };

  const draftItems = getPreorderDraftItems();
  const target = draftItems.find((item) => item._id === itemId);
  if (!target) return { quantity: 1, capped: false };

  const requestedQuantity = clampQuantity(quantity);
  const totalWithoutTarget = draftItems
    .filter((item) => item._id !== itemId)
    .reduce((sum, item) => sum + clampQuantity(item.quantity), 0);
  const maxForTarget = Math.max(1, MAX_PREORDER_TOTAL_QUANTITY - totalWithoutTarget);
  const appliedQuantity = Math.min(requestedQuantity, maxForTarget);

  const nextItems = draftItems.map((item) => (
    item._id === itemId ? { ...item, quantity: appliedQuantity } : item
  ));

  const capped = appliedQuantity < requestedQuantity;
  writePreorderDraftItems(nextItems);
  return { quantity: appliedQuantity, capped };
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
