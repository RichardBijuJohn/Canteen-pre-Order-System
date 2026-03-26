const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');

const router = express.Router();

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'canteen-admin-secret';
const FALLBACK_ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@canteen.local';
const FALLBACK_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ALLOWED_STATUS = ['Pending', 'Ready for Pickup', 'Picked', 'Cancelled', 'Complete'];

const signAdminToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: '10h' });

const ensureFallbackAdminUser = async () => {
  const hashed = await bcrypt.hash(FALLBACK_ADMIN_PASSWORD, 10);
  const existing = await User.findOne({ email: FALLBACK_ADMIN_EMAIL });

  if (!existing) {
    const created = new User({
      name: 'Admin',
      email: FALLBACK_ADMIN_EMAIL,
      password: hashed,
      role: 'admin'
    });
    await created.save();
    return created;
  }

  let changed = false;
  if (existing.role !== 'admin') {
    existing.role = 'admin';
    changed = true;
  }

  if (!existing.password || typeof existing.password !== 'string') {
    existing.password = hashed;
    changed = true;
  } else {
    let match = false;
    try {
      match = await bcrypt.compare(FALLBACK_ADMIN_PASSWORD, existing.password);
    } catch (_err) {
      match = false;
    }
    if (!match) {
      existing.password = hashed;
      changed = true;
    }
  }

  if (changed) {
    await existing.save();
  }

  return existing;
};

const requireAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    return res.status(401).json({ msg: 'Admin token is missing.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.sub === 'static-admin' && decoded.role === 'admin') {
      req.admin = { _id: 'static-admin', name: decoded.name || 'Admin', role: 'admin' };
      return next();
    }

    const user = await User.findById(decoded.sub);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ msg: 'Admin access required.' });
    }

    req.admin = user;
    return next();
  } catch (err) {
    return res.status(401).json({ msg: 'Invalid or expired admin session.' });
  }
};

router.post('/login', async (req, res) => {
  const rawEmail = String(req.body?.email || '');
  const rawPassword = String(req.body?.password || '');
  const email = rawEmail.trim().toLowerCase();
  const password = rawPassword.trim();

  if (!email || !password) {
    return res.status(400).json({ msg: 'Email and password are required.' });
  }

  try {
    // Fallback admin credentials for local/demo usage.
    if (email === String(FALLBACK_ADMIN_EMAIL).trim().toLowerCase() && password === FALLBACK_ADMIN_PASSWORD) {
      const adminUser = await ensureFallbackAdminUser();
      const token = signAdminToken({ sub: String(adminUser._id), role: 'admin', name: adminUser.name || 'Admin' });
      return res.json({
        msg: 'Admin login success.',
        token,
        admin: { name: adminUser.name || 'Admin', email: adminUser.email, role: 'admin' }
      });
    }

    const user = await User.findOne({ email });
    if (!user || user.role !== 'admin') {
      return res.status(401).json({ msg: 'Admin account not found.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ msg: 'Invalid password.' });
    }

    const token = signAdminToken({ sub: String(user._id), role: 'admin', name: user.name || 'Admin' });
    return res.json({
      msg: 'Admin login success.',
      token,
      admin: { name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Unable to login as admin.' });
  }
});

router.get('/menu', requireAdmin, async (_req, res) => {
  try {
    const items = await MenuItem.find().sort({ _id: -1 });
    return res.json(items);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Unable to fetch menu items.' });
  }
});

router.post('/menu', requireAdmin, async (req, res) => {
  try {
    const { name, price, category, available = true, rating = 4, preparationTime = '15 min' } = req.body || {};
    if (!name || Number(price) <= 0) {
      return res.status(400).json({ msg: 'Valid name and price are required.' });
    }

    const item = new MenuItem({
      name: String(name).trim(),
      price: Number(price),
      category: category ? String(category).trim() : 'General',
      available: Boolean(available),
      rating: Number(rating) || 4,
      preparationTime: String(preparationTime).trim() || '15 min'
    });

    await item.save();
    return res.json({ msg: 'Menu item added.', item });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Unable to add menu item.' });
  }
});

router.put('/menu/:itemId', requireAdmin, async (req, res) => {
  try {
    const { itemId } = req.params;
    const updates = { ...req.body };

    if (updates.price !== undefined) {
      updates.price = Number(updates.price);
      if (Number.isNaN(updates.price) || updates.price <= 0) {
        return res.status(400).json({ msg: 'Price must be greater than 0.' });
      }
    }

    if (updates.rating !== undefined) {
      updates.rating = Number(updates.rating) || 4;
    }

    const item = await MenuItem.findByIdAndUpdate(itemId, updates, { new: true });
    if (!item) {
      return res.status(404).json({ msg: 'Menu item not found.' });
    }

    return res.json({ msg: 'Menu item updated.', item });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Unable to update menu item.' });
  }
});

router.delete('/menu/:itemId', requireAdmin, async (req, res) => {
  try {
    const { itemId } = req.params;
    const item = await MenuItem.findByIdAndDelete(itemId);
    if (!item) {
      return res.status(404).json({ msg: 'Menu item not found.' });
    }
    return res.json({ msg: 'Menu item removed.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Unable to remove menu item.' });
  }
});

router.get('/orders', requireAdmin, async (_req, res) => {
  try {
    const orders = await Order.find().sort({ _id: -1 });
    return res.json(orders);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Unable to fetch orders.' });
  }
});

router.patch('/orders/:orderId/status', requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const nextStatus = String(req.body?.status || '').trim();

    if (!ALLOWED_STATUS.includes(nextStatus)) {
      return res.status(400).json({ msg: `Status must be one of: ${ALLOWED_STATUS.join(', ')}` });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ msg: 'Order not found.' });
    }

    const currentStatusKey = String(order.status || '').toLowerCase();
    if (currentStatusKey.includes('picked') && nextStatus === 'Ready for Pickup') {
      return res.status(400).json({ msg: 'Picked orders cannot be set back to Ready for Pickup.' });
    }

    order.status = nextStatus;
    if (nextStatus === 'Picked') {
      order.pickedAt = order.pickedAt || new Date();
    }
    if (nextStatus === 'Ready for Pickup' || nextStatus === 'Picked' || nextStatus === 'Complete') {
      order.items = (order.items || []).map((item) => {
        const base = typeof item.toObject === 'function' ? item.toObject() : item;
        return { ...base, status: 'Done' };
      });
    }

    await order.save();
    return res.json({ msg: 'Order status updated.', order });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Unable to update order status.' });
  }
});

module.exports = router;
