import { Router } from 'express';
import { Order } from '../models/Order.js';
import { Transaction } from '../models/Finance.js';
import { protect, authorize } from '../middleware/auth.js';
import { asyncH } from '../middleware/error.js';
import { emit } from '../socket.js';

const router = Router();
router.use(protect, authorize('rider'));

// GET /api/rider/dashboard
router.get(
  '/dashboard',
  asyncH(async (req, res) => {
    const rid = req.user._id;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(Date.now() - 6 * 86400000);
    weekStart.setHours(0, 0, 0, 0);
    const [totalDeliveries, activeCount, todayAgg, weekAgg] = await Promise.all([
      Order.countDocuments({ rider: rid, status: { $in: ['delivered', 'completed'] } }),
      Order.countDocuments({ rider: rid, status: { $in: ['assigned', 'picked_up', 'out_for_delivery'] } }),
      Order.aggregate([
        { $match: { rider: rid, settled: true, deliveredAt: { $gte: todayStart } } },
        { $group: { _id: null, earning: { $sum: '$riderEarning' }, count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { rider: rid, settled: true, deliveredAt: { $gte: weekStart } } },
        { $group: { _id: null, earning: { $sum: '$riderEarning' }, count: { $sum: 1 } } },
      ]),
    ]);
    res.json({
      totalDeliveries,
      activeCount,
      today: { earning: todayAgg[0]?.earning || 0, deliveries: todayAgg[0]?.count || 0 },
      week: { earning: weekAgg[0]?.earning || 0, deliveries: weekAgg[0]?.count || 0 },
      walletBalance: req.user.walletBalance,
      codHeld: req.user.riderProfile?.codHeld || 0,
      isOnline: req.user.riderProfile?.isOnline || false,
      kycStatus: req.user.riderProfile?.kycStatus,
      rating: {
        avg: req.user.riderProfile?.ratingAvg || 0,
        count: req.user.riderProfile?.ratingCount || 0,
      },
    });
  })
);

// PUT /api/rider/status { isOnline }
router.put(
  '/status',
  asyncH(async (req, res) => {
    if (!req.user.riderProfile) return res.status(400).json({ message: 'No rider profile' });
    req.user.riderProfile.isOnline = !!req.body.isOnline;
    await req.user.save();
    res.json({ isOnline: req.user.riderProfile.isOnline });
  })
);

// PUT /api/rider/location { lat, lng }
router.put(
  '/location',
  asyncH(async (req, res) => {
    const { lat, lng } = req.body;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ message: 'lat and lng required' });
    }
    req.user.riderProfile.currentLat = lat;
    req.user.riderProfile.currentLng = lng;
    req.user.riderProfile.locationUpdatedAt = new Date();
    await req.user.save();
    try {
      emit(`rider_location_${req.user._id}`, { lat, lng, updatedAt: req.user.riderProfile.locationUpdatedAt });
    } catch (err) {
      console.error('Socket emit failed:', err.message);
    }
    res.json({ message: 'Location updated' });
  })
);

// PUT /api/rider/profile — vehicle & bank details
router.put(
  '/profile',
  asyncH(async (req, res) => {
    const allowed = ['vehicleType', 'vehicleNumber', 'licenseNumber', 'city', 'bankName', 'bankAccount', 'bankIfsc'];
    if (!req.user.riderProfile) req.user.riderProfile = {};
    for (const k of allowed) if (req.body[k] !== undefined) req.user.riderProfile[k] = req.body[k];
    await req.user.save();
    res.json({ user: req.user.toSafe() });
  })
);

// GET /api/rider/cash-collection (v1: get_rider_cash_collection)
// COD cash currently held + history of admin collections.
router.get(
  '/cash-collection',
  asyncH(async (req, res) => {
    const collections = await Transaction.find({ user: req.user._id, source: 'cod_collection' })
      .sort('-createdAt').limit(50);
    const codOrders = await Order.find({
      rider: req.user._id, paymentMethod: 'cod', settled: true,
    }).sort('-deliveredAt').limit(50).select('orderNumber grandTotal deliveredAt');
    res.json({ codHeld: req.user.riderProfile?.codHeld || 0, collections, codOrders });
  })
);

export default router;
