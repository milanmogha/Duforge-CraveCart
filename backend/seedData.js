import mongoose from 'mongoose';
import { Category, Product } from './src/models/Catalog.js';
import User from './src/models/User.js';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1/dapigo_v2';

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB.');

    // 1. Remove old data
    console.log('Clearing old categories and products...');
    await Category.deleteMany({});
    await Product.deleteMany({});

    // 2. Ensure a partner exists
    let partner = await User.findOne({ role: 'partner' });
    if (!partner) {
      partner = await User.create({
        name: 'Dapigo Premium Store',
        email: 'store@dapigo.com',
        phone: '9876543210',
        password: 'dummy',
        role: 'partner',
        partnerProfile: {
          storeName: 'Dapigo Premium Store',
          description: 'Best items in town.',
          city: 'Mumbai',
          isOpen: true
        }
      });
      console.log('Created dummy partner.');
    } else {
      console.log(`Using existing partner: ${partner.name}`);
    }

    // 3. Create Categories (8 Categories with images)
    console.log('Creating categories...');
    const categoriesData = [
      { name: 'Fresh Fruits', slug: 'fresh-fruits', image: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&q=80' },
      { name: 'Vegetables', slug: 'vegetables', image: 'https://images.unsplash.com/photo-1566385101042-1a0aa0c1268c?w=400&q=80' },
      { name: 'Dairy & Eggs', slug: 'dairy-eggs', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&q=80' },
      { name: 'Bakery', slug: 'bakery', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80' },
      { name: 'Beverages', slug: 'beverages', image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&q=80' },
      { name: 'Snacks', slug: 'snacks', image: 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=400&q=80' },
      { name: 'Meat & Seafood', slug: 'meat-seafood', image: 'https://images.unsplash.com/photo-1603048297172-c92544798d5e?w=400&q=80' },
      { name: 'Personal Care', slug: 'personal-care', image: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&q=80' },
    ];

    const insertedCategories = await Category.insertMany(categoriesData);

    const getCatId = (slug) => insertedCategories.find(c => c.slug === slug)._id;

    // 4. Create Products (at least 5 with images)
    console.log('Creating products...');
    const productsData = [
      {
        title: 'Farm Fresh Apples (1kg)',
        slug: 'farm-fresh-apples-1kg',
        description: 'Crisp and sweet apples, handpicked from the finest orchards.',
        images: ['https://images.unsplash.com/photo-1560806887-1e4cd0b6faa6?w=600&q=80'],
        category: getCatId('fresh-fruits'),
        partner: partner._id,
        price: 250,
        salePrice: 199,
        isVeg: true,
        featured: true,
        ratingAvg: 4.8,
        ratingCount: 124
      },
      {
        title: 'Organic Tomatoes (500g)',
        slug: 'organic-tomatoes-500g',
        description: 'Juicy, ripe organic tomatoes perfect for salads and cooking.',
        images: ['https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&q=80'],
        category: getCatId('vegetables'),
        partner: partner._id,
        price: 60,
        salePrice: 45,
        isVeg: true,
        ratingAvg: 4.5,
        ratingCount: 89
      },
      {
        title: 'Farm Fresh Milk (1L)',
        slug: 'farm-fresh-milk-1l',
        description: 'Pure, unadulterated cow milk delivered fresh.',
        images: ['https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600&q=80'],
        category: getCatId('dairy-eggs'),
        partner: partner._id,
        price: 75,
        isVeg: true,
        featured: true,
        ratingAvg: 4.9,
        ratingCount: 302
      },
      {
        title: 'Artisan Sourdough Bread',
        slug: 'artisan-sourdough-bread',
        description: 'Freshly baked sourdough with a crisp crust and soft center.',
        images: ['https://images.unsplash.com/photo-1589367920969-ab8e050eb0e9?w=600&q=80'],
        category: getCatId('bakery'),
        partner: partner._id,
        price: 150,
        isVeg: true,
        ratingAvg: 4.7,
        ratingCount: 56
      },
      {
        title: 'Premium Roasted Coffee Beans (250g)',
        slug: 'premium-roasted-coffee-beans',
        description: 'Rich and aromatic Arabica coffee beans, perfectly roasted.',
        images: ['https://images.unsplash.com/photo-1559525839-b184a4d698c7?w=600&q=80'],
        category: getCatId('beverages'),
        partner: partner._id,
        price: 450,
        salePrice: 399,
        isVeg: true,
        featured: true,
        ratingAvg: 4.9,
        ratingCount: 412
      },
      {
        title: 'Spicy Potato Chips (Family Pack)',
        slug: 'spicy-potato-chips',
        description: 'Crunchy potato chips with a fiery blend of spices.',
        images: ['https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=600&q=80'],
        category: getCatId('snacks'),
        partner: partner._id,
        price: 80,
        isVeg: true,
        ratingAvg: 4.2,
        ratingCount: 15
      }
    ];

    await Product.insertMany(productsData);

    console.log('Seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

seed();
