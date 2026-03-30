const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const { generateUniqueOrderCode } = require('../utils/orderCode');

const WORKING_HOURS = {
    startMinutes: 8 * 60, // 8:00 AM
    endMinutes: 17 * 60 // 5:00 PM
};

const WORKING_HOURS_LABEL = '8:00 AM - 5:00 PM';

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
        let longestPrep = 0;
        const normalizedItems = Array.isArray(items) ? items.map(item => {
            const prepMinutes = parsePrepMinutes(item && item.preparationTime);
            longestPrep = Math.max(longestPrep, prepMinutes);
            const rawQuantity = Number(item && item.quantity);
            const quantity = rawQuantity > 0 ? rawQuantity : 1;
            return {
                name: item && item.name,
                price: Number(item && item.price) || 0,
                quantity,
                preparationTime: item && item.preparationTime,
                status: 'Pending'
            };
        }) : [];

        const totalAmount = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

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
        res.json({ msg: 'Order placed', orderCode: order.orderCode, orderId: order._id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Unable to place order right now.' });
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