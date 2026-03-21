const express = require('express');
const router = express.Router();
const Order = require('../models/Order');

const WORKING_HOURS = {
    startMinutes: 8 * 60, // 8:00 AM
    endMinutes: 22 * 60 // 10:00 PM
};

const WORKING_HOURS_LABEL = '8:00 AM - 10:00 PM';

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
            userId,
            items: normalizedItems,
            totalAmount,
            pickupTime: pickupTime || computePickupIso(longestPrep || 15)
        };

        if (status) {
            orderData.status = status;
        }

        const order = new Order(orderData);
        await order.save();
        res.json({ msg: 'Order placed' });
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
            if (!order.pickupTime) return;
            const pickupDate = new Date(order.pickupTime);
            if (Number.isNaN(pickupDate.getTime())) return;

            const readyByTime = pickupDate <= new Date();
            const hasPendingItems = (order.items || []).some(item => (item.status || 'Pending') !== 'Done');
            if (readyByTime && (order.status !== 'Ready for Pickup' || hasPendingItems)) {
                order.status = 'Ready for Pickup';
                order.items = (order.items || []).map(item => {
                    const base = typeof item.toObject === 'function' ? item.toObject() : item;
                    return { ...base, status: 'Done' };
                });
                await order.save();
            }
        }));

        res.json(orders);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Unable to fetch orders.' });
    }
});

module.exports = router;