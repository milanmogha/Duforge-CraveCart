import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email format'),
    phone: z.string().min(10, 'Phone number must be at least 10 digits'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    role: z.enum(['customer', 'partner', 'rider']).optional().default('customer'),
    referralCode: z.string().optional(),
    storeName: z.string().optional(),
    city: z.string().optional(),
    address: z.string().optional(),
    vehicleType: z.enum(['bike', 'scooter', 'car']).optional(),
    vehicleNumber: z.string().optional(),
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format').optional(),
    password: z.string().min(1, 'Password is required').optional(),
    panel: z.enum(['admin', 'partner', 'rider', 'customer']).optional(),
  })
});

export const changePasswordSchema = z.object({
  body: z.object({
    oldPassword: z.string().min(1, 'Old password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  })
});
