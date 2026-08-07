import { Router } from 'express';
import { Transaction, WithdrawalRequest } from '../models/Finance.js';
import { protect } from '../middleware/auth.js';
import { asyncH } from '../middleware/error.js';
import { walletAdjust, paginate, notify } from '../utils/helpers.js';

const router = Router();

// GET /api/wallet — balance + recent transactions
router.get(
  '/',
  protect,
  asyncH(async (req, res) => {
    const { page, limit, skip } = paginate(req);
    const [transactions, total] = await Promise.all([
      Transaction.find({ user: req.user._id }).sort('-createdAt').skip(skip).limit(limit),
      Transaction.countDocuments({ user: req.user._id }),
    ]);
    res.json({ balance: req.user.walletBalance, transactions, total, page });
  })
);

// POST /api/wallet/topup { amount } — mock gateway top-up
router.post(
  '/topup',
  protect,
  asyncH(async (req, res) => {
    const amount = Number(req.body.amount);
    if (!amount || amount <= 0 || amount > 100000) {
      return res.status(400).json({ message: 'Invalid amount' });
    }
    const balance = await walletAdjust(req.user._id, amount, 'wallet_topup', {
      note: 'Wallet top-up (demo gateway)',
    });
    res.json({ balance, message: 'Money added to wallet' });
  })
);

// GET /api/wallet/withdrawals
router.get(
  '/withdrawals',
  protect,
  asyncH(async (req, res) => {
    const withdrawals = await WithdrawalRequest.find({ user: req.user._id }).sort('-createdAt');
    res.json({ withdrawals });
  })
);

// POST /api/wallet/withdrawals { amount, note }
router.post(
  '/withdrawals',
  protect,
  asyncH(async (req, res) => {
    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });
    if (amount > req.user.walletBalance) {
      return res.status(400).json({ message: 'Amount exceeds wallet balance' });
    }
    const pending = await WithdrawalRequest.findOne({ user: req.user._id, status: 'pending' });
    if (pending) {
      return res.status(400).json({ message: 'You already have a pending withdrawal request' });
    }
    const wr = await WithdrawalRequest.create({
      user: req.user._id,
      amount,
      note: req.body.note,
    });
    await notify(req.user._id, 'Withdrawal requested', `Your withdrawal request of ${amount} is pending review.`, { type: 'wallet' });
    res.status(201).json({ withdrawal: wr });
  })
);

export default router;
