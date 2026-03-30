const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const { generateUniqueOrderCode } = require('../utils/orderCode');

const WORKING_HOURS = {
    startMinutes: 8 * 60, // 8:00 AM
    endMinutes: 20 * 60 // 8:00 PM
};

const WORKING_HOURS_LABEL = '8:00 AM - 8:00 PM';
const MAX_ORDER_TOTAL_QUANTITY = 8;
const DEMO_PAYMENT_TTL_MS = 15 * 60 * 1000;
const demoPaymentSessions = new Map();

const isWithinWorkingHours = () => {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    return minutes >= WORKING_HOURS.startMinutes && minutes < WORKING_HOURS.endMinutes;
};

const parsePrepMinutes = (value) => {
    if (typeof value === 'number' && !Number.isNaN(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const match = value.match(/(\d+)/);
        if (match) {
            return parseInt(match[1], 10);
        }
    }
    return 15;
};

const computePickupIso = (minutes = 15) => {
    const eta = new Date(Date.now() + minutes * 60000);
    return eta.toISOString();
};

const sanitizeItems = (items = []) => {
    let longestPrep = 0;
    const normalizedItems = Array.isArray(items) ? items.map(item => {
        const prepMinutes = parsePrepMinutes(item && item.preparationTime);
        longestPrep = Math.max(longestPrep, prepMinutes);
        const rawQuantity = Number(item && item.quantity);
        const quantity = rawQuantity > 0 ? Math.floor(rawQuantity) : 1;
        return {
            name: item && item.name,
            price: Number(item && item.price) || 0,
            quantity,
            preparationTime: item && item.preparationTime,
            status: 'Pending'
        };
    }) : [];

    const totalAmount = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalQuantity = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);

    return { normalizedItems, totalAmount, totalQuantity, longestPrep };
};

const cleanupExpiredPaymentSessions = () => {
    const now = Date.now();
    for (const [sessionId, session] of demoPaymentSessions.entries()) {
        if (session.expiresAt <= now && session.status !== 'ordered') {
            demoPaymentSessions.delete(sessionId);
        }
    }
};

const placeOrderFromPayload = async ({ userId, items, pickupTime, status, paymentMode = 'Cash' }) => {
    const { normalizedItems, totalAmount, totalQuantity, longestPrep } = sanitizeItems(items);

    if (totalQuantity > MAX_ORDER_TOTAL_QUANTITY) {
        const err = new Error(`Order limit is ${MAX_ORDER_TOTAL_QUANTITY} total items.`);
        err.statusCode = 400;
        throw err;
    }

    const orderData = {
        orderCode: await generateUniqueOrderCode(Order),
        userId,
        items: normalizedItems,
        totalAmount,
        paymentMode,
        pickupTime: pickupTime || computePickupIso(longestPrep || 15)
    };

    if (status) {
        orderData.status = status;
    }

    const order = new Order(orderData);
    await order.save();
    return order;
};

// Place order (requires logged in user)
router.post('/place', async (req, res) => {
    const { userId, items = [], pickupTime, status } = req.body;
    const paymentMode = 'Cash';

    if (!userId) {
        return res.status(401).json({ msg: 'Login required to place orders.' });
    }

    if (!isWithinWorkingHours()) {
        return res.status(403).json({ msg: `Orders can only be placed between ${WORKING_HOURS_LABEL} (college hours).` });
    }

    try {
        const order = await placeOrderFromPayload({ userId, items, pickupTime, status, paymentMode });
        res.json({ msg: 'Order placed', orderCode: order.orderCode, orderId: order._id });
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ msg: err.message });
        }
        console.error(err);
        res.status(500).json({ msg: 'Unable to place order right now.' });
    }
});

router.post('/payment-session/create', async (req, res) => {
    cleanupExpiredPaymentSessions();

    const { userId, items = [], pickupTime, status } = req.body || {};

    if (!userId) {
        return res.status(401).json({ msg: 'Login required to start payment.' });
    }

    if (!isWithinWorkingHours()) {
        return res.status(403).json({ msg: `Orders can only be placed between ${WORKING_HOURS_LABEL} (college hours).` });
    }

    try {
        const { normalizedItems, totalAmount, totalQuantity } = sanitizeItems(items);
        if (!normalizedItems.length) {
            return res.status(400).json({ msg: 'Add at least one item to place an order.' });
        }
        if (totalQuantity > MAX_ORDER_TOTAL_QUANTITY) {
            return res.status(400).json({ msg: `Order limit is ${MAX_ORDER_TOTAL_QUANTITY} total items.` });
        }

        const sessionId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        demoPaymentSessions.set(sessionId, {
            sessionId,
            userId,
            items: normalizedItems,
            pickupTime,
            status,
            totalAmount,
            state: 'pending',
            createdAt: Date.now(),
            expiresAt: Date.now() + DEMO_PAYMENT_TTL_MS,
            orderId: null,
            orderCode: null
        });

        return res.json({
            sessionId,
            state: 'pending',
            totalAmount,
            expiresInMs: DEMO_PAYMENT_TTL_MS
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ msg: 'Unable to start demo payment.' });
    }
});

router.get('/payment-session/:sessionId', (req, res) => {
    cleanupExpiredPaymentSessions();
    const { sessionId } = req.params;
    const session = demoPaymentSessions.get(sessionId);

    if (!session) {
        return res.status(404).json({ msg: 'Payment session not found or expired.' });
    }

    return res.json({
        sessionId,
        state: session.state,
        totalAmount: session.totalAmount,
        orderId: session.orderId,
        orderCode: session.orderCode,
        expiresAt: session.expiresAt
    });
});

router.post('/payment-session/:sessionId/pay', async (req, res) => {
    cleanupExpiredPaymentSessions();
    const { sessionId } = req.params;
    const session = demoPaymentSessions.get(sessionId);

    if (!session) {
        return res.status(404).json({ msg: 'Payment session not found or expired.' });
    }

    if (session.state === 'ordered') {
        return res.json({
            msg: 'Payment already completed.',
            sessionId,
            state: 'ordered',
            orderId: session.orderId,
            orderCode: session.orderCode
        });
    }

    if (!isWithinWorkingHours()) {
        return res.status(403).json({ msg: `Orders can only be placed between ${WORKING_HOURS_LABEL} (college hours).` });
    }

    try {
        session.state = 'processing';
        const order = await placeOrderFromPayload({
            userId: session.userId,
            items: session.items,
            pickupTime: session.pickupTime,
            status: session.status,
            paymentMode: 'Demo Online'
        });

        session.state = 'ordered';
        session.orderId = order._id;
        session.orderCode = order.orderCode;

        return res.json({
            msg: 'Demo payment successful and order placed.',
            sessionId,
            state: session.state,
            orderId: session.orderId,
            orderCode: session.orderCode
        });
    } catch (err) {
        session.state = 'pending';
        if (err.statusCode) {
            return res.status(err.statusCode).json({ msg: err.message });
        }
        console.error(err);
        return res.status(500).json({ msg: 'Unable to complete demo payment.' });
    }
});

// Get orders by user
router.get('/:userId', async (req, res) => {
    const { userId } = req.params;

    if (!userId) {
        return res.status(400).json({ msg: 'User ID is required.' });
    }

    try {
        const orders = await Order.find({ userId });

        await Promise.all(orders.map(async (order) => {
            let shouldSave = false;

            if (!order.orderCode) {
                order.orderCode = await generateUniqueOrderCode(Order);
                shouldSave = true;
            }

            if (!order.pickupTime) {
                if (shouldSave) {
                    await order.save();
                }
                return;
            }
            const pickupDate = new Date(order.pickupTime);
            if (Number.isNaN(pickupDate.getTime())) {
                if (shouldSave) {
                    await order.save();
                }
                return;
            }

            const statusKey = (order.status || '').toLowerCase();
            if (statusKey.includes('picked') || statusKey.includes('cancel')) {
                if (shouldSave) {
                    await order.save();
                }
                return;
            }

            const readyByTime = pickupDate <= new Date();
            const hasPendingItems = (order.items || []).some(item => (item.status || 'Pending') !== 'Done');
            if (readyByTime && (order.status !== 'Ready for Pickup' || hasPendingItems)) {
                order.status = 'Ready for Pickup';
                order.items = (order.items || []).map(item => {
                    const base = typeof item.toObject === 'function' ? item.toObject() : item;
                    return { ...base, status: 'Done' };
                });
                shouldSave = true;
            }

            if (shouldSave) {
                await order.save();
            }
        }));

        res.json(orders);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Unable to fetch orders.' });
    }
});

// Add review for picked order
router.post('/:orderId/review', async (req, res) => {
    const { orderId } = req.params;
    const rawUserId = String(req.body?.userId || '').trim();
    const ratingValue = Number(req.body?.rating);

    if (!rawUserId) {
        return res.status(401).json({ msg: 'Login required to review orders.' });
    }

    if (!Number.isFinite(ratingValue) || ratingValue < 1 || ratingValue > 5) {
        return res.status(400).json({ msg: 'Rating must be between 1 and 5.' });
    }

    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ msg: 'Order not found.' });
        }

        if (String(order.userId) !== rawUserId) {
            return res.status(403).json({ msg: 'You can only review your own orders.' });
        }

        const statusKey = String(order.status || '').toLowerCase();
        if (!statusKey.includes('picked') && !order.pickedAt) {
            return res.status(400).json({ msg: 'Reviews are available after pickup.' });
        }

        if (order.review && order.review.rating) {
            return res.status(400).json({ msg: 'Review already submitted for this order.' });
        }

        order.review = {
            rating: ratingValue,
            createdAt: new Date()
        };

        await order.save();
        return res.json({ msg: 'Review saved.', review: order.review });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ msg: 'Unable to save review.' });
    }
});

module.exports = router;