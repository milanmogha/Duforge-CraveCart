import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import { Category, Product } from '../models/Catalog.js';
import { Cart, Order, PromoCode } from '../models/Order.js';
import { Transaction, WithdrawalRequest } from '../models/Finance.js';
import { Review, Ticket, Notification, Slider, Offer, Setting, Page, Faq, AuditLog, City, FeaturedSection } from '../models/Misc.js';
import { slugify } from '../utils/helpers.js';

const img = (seed, w = 600, h = 400) => `https://picsum.photos/seed/${seed}/${w}/${h}`;
// Real food photography (every ID verified live at seed-authoring time)
const u = (id, w = 600) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=60`;
const IMG = {
  biryani: u('1563379091339-03b21ab4a4f8'),
  currychicken: u('1565557623262-b51c2513a641'),
  butterchicken: u('1585937421612-70a008356fbe'),
  chickendish: u('1546833999-b9f581a1996d'),
  indianthali: u('1601050690597-df0568f70950'),
  paneer: u('1631452180519-c014fe946bc7'),
  burger: u('1568901346375-23c9450c58cd'),
  burger2: u('1571091718767-18b5b1457add'),
  pizza: u('1513104890138-7c749659a591'),
  pizza2: u('1574071318508-1cdbab80d002'),
  pasta: u('1621996346565-e3dbc646d9a9'),
  noodles: u('1585032226651-759b368d7246'),
  asianrice: u('1512058564366-18510be2db19'),
  springroll: u('1496116218417-1a781b1c416c'),
  momos: u('1626074353765-517a681e40be'),
  fries: u('1573080496219-bb080dd4f877'),
  milk: u('1550583724-b2692b85b150'),
  eggs: u('1506976785307-8732e854ad03'),
  tomatoes: u('1592924357228-91a4daadcfea'),
  spinach: u('1576045057995-568f588f82fb'),
  potato: u('1518977676601-b53f82aba655'),
  veggies: u('1540420773420-3366772f4999'),
  banana: u('1571771894821-ce9b6c11b08e'),
  mango: u('1553279768-865429fa0078'),
  apple: u('1560806887-1e4cd0b6cbd6'),
  croissant: u('1555507036-ab1f4038808a'),
  bread: u('1509440159596-0249088772ff'),
  cake: u('1578985545062-69928b1d9587'),
  cookies: u('1499636136210-6f4ee915583e'),
  donut: u('1551024601-bec78aea704b'),
  chai: u('1544145945-f90425340c7e'),
  coffee: u('1541167760496-1628856ab772'),
  dessert: u('1599487488170-d11ec9c172f0'),
  icecream: u('1501443762994-82bd5dace89a'),
  lassi: u('1553787499-6f9133860278'),
  cashews: u('1601493700631-2b16ec4b4716'),
  chips: u('1566478989037-eec170784d0b'),
  cleaning: u('1583947215259-38e31be8751f'),
  grocery: u('1542838132-92c53300491e'),
  restaurant: u('1517248135467-4c7edcad34c4'),
  wok: u('1512003867696-6d5ce6835040'),
};

async function run() {
  await connectDB();
  console.log('Clearing existing data...');
  await Promise.all(
    [User, Category, Product, Cart, Order, PromoCode, Transaction, WithdrawalRequest,
      Review, Ticket, Notification, Slider, Offer, Setting, Page, Faq, AuditLog, City, FeaturedSection,
    ].map((M) => M.deleteMany({}))
  );

  console.log('Creating users...');
  const admin = await User.create({
    name: 'Admin', email: 'admin@dapigo.com', phone: '9000000001',
    password: 'admin123', role: 'admin', referralCode: 'ADMIN1',
  });

  const partner1 = await User.create({
    name: 'Ravi Kumar', email: 'partner@dapigo.com', phone: '9000000002',
    password: 'partner123', role: 'partner', referralCode: 'RAVI1234',
    partnerProfile: {
      storeName: 'Spice Garden', slug: 'spice-garden',
      description: 'Authentic Indian cuisine — biryanis, curries and tandoor specials.',
      logo: IMG.indianthali, banner: IMG.currychicken.replace('w=600', 'w=1200'),
      address: '12 MG Road', city: 'Bengaluru', lat: 12.9716, lng: 77.5946,
      cuisineTags: ['Indian', 'Biryani', 'Curry'],
      openTime: '08:00', closeTime: '23:00', isOpen: true,
      deliveryCharge: 30, freeDeliveryAbove: 500, minOrder: 100,
      commissionPercent: 10, kycStatus: 'approved',
    },
  });

  const partner2 = await User.create({
    name: 'Meera Shah', email: 'partner2@dapigo.com', phone: '9000000003',
    password: 'partner123', role: 'partner', referralCode: 'MEER5678',
    partnerProfile: {
      storeName: 'Fresh Basket', slug: 'fresh-basket',
      description: 'Farm-fresh groceries, fruits and daily essentials delivered fast.',
      logo: IMG.grocery, banner: IMG.veggies.replace('w=600', 'w=1200'),
      address: '45 Brigade Road', city: 'Bengaluru', lat: 12.9698, lng: 77.6205,
      cuisineTags: ['Grocery', 'Fruits', 'Essentials'],
      openTime: '07:00', closeTime: '22:00', isOpen: true,
      deliveryCharge: 20, freeDeliveryAbove: 300, minOrder: 50,
      commissionPercent: 8, kycStatus: 'approved',
    },
  });

  const partner3 = await User.create({
    name: 'Chen Li', email: 'partner3@dapigo.com', phone: '9000000006',
    password: 'partner123', role: 'partner', referralCode: 'CHEN4321',
    partnerProfile: {
      storeName: 'Dragon Wok', slug: 'dragon-wok',
      description: 'Indo-Chinese street favourites — noodles, momos and sizzling wok dishes.',
      logo: IMG.wok, banner: IMG.noodles.replace('w=600', 'w=1200'),
      address: '8 Church Street', city: 'Bengaluru', lat: 12.9752, lng: 77.6068,
      cuisineTags: ['Chinese', 'Momos', 'Noodles'],
      openTime: '11:00', closeTime: '23:30', isOpen: true,
      deliveryCharge: 25, freeDeliveryAbove: 400, minOrder: 99,
      commissionPercent: 10, kycStatus: 'approved',
    },
  });

  const partner4 = await User.create({
    name: 'Sarah Dsouza', email: 'partner4@dapigo.com', phone: '9000000007',
    password: 'partner123', role: 'partner', referralCode: 'SARA8765',
    partnerProfile: {
      storeName: 'Bake House & Co', slug: 'bake-house-co',
      description: 'Artisan breads, cakes, coffee and all-day breakfast bakes.',
      logo: IMG.croissant, banner: IMG.bread.replace('w=600', 'w=1200'),
      address: '3 Lavelle Road', city: 'Bengaluru', lat: 12.9667, lng: 77.5952,
      cuisineTags: ['Bakery', 'Desserts', 'Coffee'],
      openTime: '07:30', closeTime: '21:30', isOpen: true,
      deliveryCharge: 25, freeDeliveryAbove: 350, minOrder: 0,
      commissionPercent: 12, kycStatus: 'approved',
    },
  });

  const rider = await User.create({
    name: 'Suresh Rider', email: 'rider@dapigo.com', phone: '9000000004',
    password: 'rider123', role: 'rider', referralCode: 'SURE9012',
    riderProfile: {
      vehicleType: 'bike', vehicleNumber: 'KA01AB1234', licenseNumber: 'DL123456',
      city: 'Bengaluru', kycStatus: 'approved', isOnline: true,
      currentLat: 12.97, currentLng: 77.6,
    },
  });

  const customer = await User.create({
    name: 'Aakash Customer', email: 'customer@dapigo.com', phone: '9000000005',
    password: 'customer123', role: 'customer', referralCode: 'AAKA3456',
    walletBalance: 1000,
    addresses: [
      { label: 'Home', line1: '221B Residency Road', city: 'Bengaluru', area: 'Ashok Nagar', pincode: '560025', lat: 12.9698, lng: 77.6, isDefault: true },
      { label: 'Work', line1: 'Tech Park, Whitefield', city: 'Bengaluru', area: 'Whitefield', pincode: '560066', lat: 12.9698, lng: 77.75 },
    ],
  });
  await Transaction.create({
    user: customer._id, type: 'credit', amount: 1000, balanceAfter: 1000,
    source: 'wallet_topup', note: 'Welcome bonus (seed)',
  });

  // extra customers so seeded reviews come from more than one name
  const customer2 = await User.create({
    name: 'Priya Nair', email: 'priya@dapigo.com', phone: '9000000008',
    password: 'customer123', role: 'customer', referralCode: 'PRIY6543',
    addresses: [{ label: 'Home', line1: '7 Indiranagar 100ft Road', city: 'Bengaluru', area: 'Indiranagar', pincode: '560038', lat: 12.9784, lng: 77.6408, isDefault: true }],
  });
  const customer3 = await User.create({
    name: 'Rahul Verma', email: 'rahul@dapigo.com', phone: '9000000009',
    password: 'customer123', role: 'customer', referralCode: 'RAHU2109',
    addresses: [{ label: 'Home', line1: '19 Koramangala 5th Block', city: 'Bengaluru', area: 'Koramangala', pincode: '560095', lat: 12.9352, lng: 77.6245, isDefault: true }],
  });

  console.log('Creating categories...');
  const catDefs = [
    ['Biryani', IMG.biryani],
    ['Curries', IMG.butterchicken],
    ['Tandoor', IMG.chickendish],
    ['Chinese', IMG.noodles],
    ['Pizza & Burgers', IMG.pizza],
    ['Bakery', IMG.bread],
    ['Desserts', IMG.dessert],
    ['Ice Cream', IMG.icecream],
    ['Beverages', IMG.chai],
    ['Fruits', IMG.mango],
    ['Vegetables', IMG.veggies],
    ['Dairy & Eggs', IMG.milk],
    ['Snacks', IMG.chips],
    ['Household', IMG.cleaning],
  ];
  const cats = {};
  for (const [i, [name, image]] of catDefs.entries()) {
    cats[name] = await Category.create({
      name, slug: slugify(name), image: image || img('cat-' + slugify(name), 300, 300), sortOrder: i,
    });
  }

  console.log('Creating products...');
  const P = (partner, category, title, price, extra = {}) => ({
    title, slug: slugify(title) + '-' + Math.random().toString(36).slice(2, 7),
    description: extra.description || `Delicious ${title} prepared with the finest ingredients.`,
    images: [extra.image || img('p-' + slugify(title))],
    category: cats[category]._id, partner: partner._id,
    price, taxPercent: extra.taxPercent ?? 5, stock: 100,
    isVeg: extra.isVeg ?? false, featured: extra.featured ?? false,
    variants: extra.variants || [], addons: extra.addons || [],
    tags: extra.tags || [], salePrice: extra.salePrice,
    ratingAvg: extra.rating ?? 0, ratingCount: extra.rating ? 12 : 0,
    soldCount: extra.sold ?? Math.floor(Math.random() * 200),
  });

  const products = await Product.insertMany([
    // ── Spice Garden (Indian)
    P(partner1, 'Biryani', 'Chicken Dum Biryani', 249, {
      image: IMG.biryani, featured: true, rating: 4.5, sold: 540, tags: ['bestseller', 'spicy'],
      description: 'Slow-cooked Hyderabadi dum biryani with succulent chicken, saffron and fried onions. Served with raita and salan.',
      variants: [{ name: 'Half', price: 159 }, { name: 'Full', price: 249 }, { name: 'Family Pack', price: 449 }],
      addons: [{ name: 'Extra Raita', price: 25 }, { name: 'Boiled Egg', price: 15 }, { name: 'Gulab Jamun (2pc)', price: 49 }],
    }),
    P(partner1, 'Biryani', 'Veg Hyderabadi Biryani', 189, {
      image: IMG.asianrice, isVeg: true, rating: 4.2, featured: true,
      variants: [{ name: 'Half', price: 119 }, { name: 'Full', price: 189 }],
      addons: [{ name: 'Extra Raita', price: 25 }],
    }),
    P(partner1, 'Biryani', 'Mutton Biryani', 329, { image: IMG.indianthali, rating: 4.6, tags: ['premium'] }),
    P(partner1, 'Biryani', 'Egg Biryani', 169, { image: IMG.asianrice, rating: 4.0 }),
    P(partner1, 'Curries', 'Butter Chicken', 279, {
      image: IMG.butterchicken, featured: true, rating: 4.7, sold: 480,
      description: 'Creamy tomato-butter gravy with charcoal-grilled chicken tikka. Best with naan.',
      addons: [{ name: 'Butter Naan', price: 45 }, { name: 'Garlic Naan', price: 55 }, { name: 'Jeera Rice', price: 99 }],
    }),
    P(partner1, 'Curries', 'Paneer Butter Masala', 229, { image: IMG.paneer, isVeg: true, rating: 4.4, addons: [{ name: 'Butter Naan', price: 45 }] }),
    P(partner1, 'Curries', 'Dal Makhani', 179, { image: IMG.currychicken, isVeg: true, rating: 4.3 }),
    P(partner1, 'Curries', 'Chicken Chettinad', 289, { image: IMG.currychicken, rating: 4.4, tags: ['spicy'] }),
    P(partner1, 'Tandoor', 'Tandoori Chicken (Full)', 349, { image: IMG.chickendish, rating: 4.5, variants: [{ name: 'Half', price: 199 }, { name: 'Full', price: 349 }] }),
    P(partner1, 'Tandoor', 'Paneer Tikka', 219, { image: IMG.paneer, isVeg: true, rating: 4.1 }),
    P(partner1, 'Desserts', 'Gulab Jamun (4pc)', 99, { image: IMG.dessert, isVeg: true, rating: 4.6, salePrice: 79 }),
    P(partner1, 'Desserts', 'Rasmalai (2pc)', 119, { image: IMG.dessert, isVeg: true }),
    P(partner1, 'Beverages', 'Masala Chaas', 49, { image: IMG.lassi, isVeg: true }),
    P(partner1, 'Beverages', 'Sweet Lassi', 69, { image: IMG.lassi, isVeg: true, rating: 4.0 }),

    // ── Fresh Basket (grocery)
    P(partner2, 'Fruits', 'Bananas (1 dozen)', 60, { image: IMG.banana, isVeg: true, rating: 4.3, sold: 320, featured: true }),
    P(partner2, 'Fruits', 'Alphonso Mangoes (1kg)', 350, { image: IMG.mango, isVeg: true, salePrice: 299, featured: true, tags: ['seasonal'] }),
    P(partner2, 'Fruits', 'Apples Shimla (1kg)', 180, { image: IMG.apple, isVeg: true }),
    P(partner2, 'Vegetables', 'Tomatoes (1kg)', 40, { image: IMG.tomatoes, isVeg: true, taxPercent: 0 }),
    P(partner2, 'Vegetables', 'Onions (1kg)', 35, { image: IMG.veggies, isVeg: true, taxPercent: 0 }),
    P(partner2, 'Vegetables', 'Palak Spinach (250g)', 25, { image: IMG.spinach, isVeg: true, taxPercent: 0 }),
    P(partner2, 'Vegetables', 'Potatoes (2kg)', 70, { image: IMG.potato, isVeg: true, taxPercent: 0, rating: 4.1 }),
    P(partner2, 'Dairy & Eggs', 'Farm Eggs (12pc)', 90, { image: IMG.eggs, rating: 4.5 }),
    P(partner2, 'Dairy & Eggs', 'Fresh Paneer (200g)', 95, { image: IMG.paneer, isVeg: true }),
    P(partner2, 'Dairy & Eggs', 'Toned Milk (1L)', 56, { image: IMG.milk, isVeg: true, taxPercent: 0 }),
    P(partner2, 'Snacks', 'Salted Cashews (250g)', 260, { image: IMG.cashews, isVeg: true }),
    P(partner2, 'Snacks', 'Banana Chips (200g)', 80, { image: IMG.chips, isVeg: true, rating: 4.2 }),
    P(partner2, 'Household', 'Dishwash Liquid (750ml)', 135, { image: IMG.cleaning, isVeg: true, taxPercent: 18, salePrice: 119 }),
    P(partner2, 'Household', 'Floor Cleaner Citrus (1L)', 165, { image: IMG.cleaning, isVeg: true, taxPercent: 18 }),

    // ── Dragon Wok (Indo-Chinese)
    P(partner3, 'Chinese', 'Veg Hakka Noodles', 149, {
      image: IMG.noodles, isVeg: true, featured: true, rating: 4.3, sold: 410,
      variants: [{ name: 'Regular', price: 149 }, { name: 'Large', price: 209 }],
      addons: [{ name: 'Extra Schezwan Sauce', price: 20 }, { name: 'Fried Egg Topping', price: 25 }],
    }),
    P(partner3, 'Chinese', 'Chicken Schezwan Noodles', 189, { image: IMG.noodles, rating: 4.4, tags: ['spicy'], variants: [{ name: 'Regular', price: 189 }, { name: 'Large', price: 249 }] }),
    P(partner3, 'Chinese', 'Chicken Fried Rice', 179, { image: IMG.asianrice, rating: 4.2, sold: 350 }),
    P(partner3, 'Chinese', 'Steamed Chicken Momos (8pc)', 129, {
      image: IMG.momos, featured: true, rating: 4.6, sold: 520, tags: ['bestseller'],
      variants: [{ name: 'Steamed', price: 129 }, { name: 'Fried', price: 149 }],
      addons: [{ name: 'Extra Momo Chutney', price: 15 }],
    }),
    P(partner3, 'Chinese', 'Veg Momos (8pc)', 99, { image: IMG.momos, isVeg: true, rating: 4.3, variants: [{ name: 'Steamed', price: 99 }, { name: 'Fried', price: 119 }] }),
    P(partner3, 'Chinese', 'Veg Spring Rolls (6pc)', 119, { image: IMG.springroll, isVeg: true, rating: 4.1 }),
    P(partner3, 'Chinese', 'Gobi Manchurian', 159, { image: IMG.springroll, isVeg: true, rating: 4.2, tags: ['street-style'] }),
    P(partner3, 'Beverages', 'Iced Lemon Tea', 79, { image: IMG.chai, isVeg: true }),

    // ── Bake House & Co (bakery + fast food)
    P(partner4, 'Pizza & Burgers', 'Margherita Pizza (10")', 249, {
      image: IMG.pizza, isVeg: true, featured: true, rating: 4.5, sold: 380,
      variants: [{ name: '8" Regular', price: 199 }, { name: '10" Medium', price: 249 }, { name: '12" Large', price: 349 }],
      addons: [{ name: 'Extra Cheese', price: 49 }, { name: 'Stuffed Crust', price: 69 }],
    }),
    P(partner4, 'Pizza & Burgers', 'Peri Peri Chicken Pizza (10")', 329, { image: IMG.pizza2, rating: 4.6, tags: ['spicy'], variants: [{ name: '10" Medium', price: 329 }, { name: '12" Large', price: 429 }] }),
    P(partner4, 'Pizza & Burgers', 'Classic Chicken Burger', 179, {
      image: IMG.burger, rating: 4.4, sold: 300,
      addons: [{ name: 'Extra Patty', price: 60 }, { name: 'Cheese Slice', price: 25 }, { name: 'French Fries', price: 89 }],
    }),
    P(partner4, 'Pizza & Burgers', 'Crispy Veg Burger', 129, { image: IMG.burger2, isVeg: true, rating: 4.1, addons: [{ name: 'Cheese Slice', price: 25 }] }),
    P(partner4, 'Pizza & Burgers', 'Peri Peri Fries', 109, { image: IMG.fries, isVeg: true, rating: 4.2 }),
    P(partner4, 'Pizza & Burgers', 'Creamy Alfredo Pasta', 239, { image: IMG.pasta, isVeg: true, rating: 4.3 }),
    P(partner4, 'Bakery', 'Butter Croissant', 89, { image: IMG.croissant, isVeg: true, rating: 4.5, featured: true }),
    P(partner4, 'Bakery', 'Sourdough Loaf', 149, { image: IMG.bread, isVeg: true, rating: 4.4 }),
    P(partner4, 'Bakery', 'Choco Chip Cookies (6pc)', 129, { image: IMG.cookies, isVeg: true, salePrice: 99 }),
    P(partner4, 'Bakery', 'Glazed Donut (2pc)', 119, { image: IMG.donut, isVeg: true, rating: 4.0 }),
    P(partner4, 'Desserts', 'Chocolate Truffle Cake (500g)', 449, {
      image: IMG.cake, isVeg: true, featured: true, rating: 4.7, sold: 260,
      variants: [{ name: '500g', price: 449 }, { name: '1kg', price: 849 }],
      addons: [{ name: 'Birthday Candles + Knife', price: 29 }, { name: 'Personalised Message', price: 0 }],
    }),
    P(partner4, 'Ice Cream', 'Belgian Chocolate Tub (500ml)', 299, { image: IMG.icecream, isVeg: true, rating: 4.6, salePrice: 249 }),
    P(partner4, 'Ice Cream', 'Vanilla Bean Tub (500ml)', 249, { image: IMG.icecream, isVeg: true, rating: 4.2 }),
    P(partner4, 'Beverages', 'Cold Brew Coffee (300ml)', 159, { image: IMG.coffee, isVeg: true, rating: 4.4 }),
    P(partner4, 'Beverages', 'Masala Chai (Kulhad)', 49, { image: IMG.chai, isVeg: true, rating: 4.3 }),
  ]);

  console.log('Creating reviews...');
  const byTitle = (t) => products.find((p) => p.title === t);
  const R = (cust, title, rating, comment) => ({
    user: cust._id, product: byTitle(title)._id, partner: byTitle(title).partner,
    target: 'product', rating, comment, verifiedPurchase: true,
  });
  await Review.insertMany([
    R(customer2, 'Chicken Dum Biryani', 5, 'Best biryani I have had in Bengaluru — the dum flavour is unreal and portions are generous.'),
    R(customer3, 'Chicken Dum Biryani', 4, 'Really good, slightly spicy for me but the raita balances it out.'),
    R(customer2, 'Butter Chicken', 5, 'Creamy, smoky, perfect with garlic naan. Ordering again this weekend.'),
    R(customer3, 'Steamed Chicken Momos (8pc)', 5, 'Juicy momos and that chutney is dangerously good.'),
    R(customer2, 'Margherita Pizza (10")', 4, 'Fresh basil and proper thin crust. Arrived hot.'),
    R(customer3, 'Chocolate Truffle Cake (500g)', 5, 'Ordered for a birthday — rich, moist and beautifully packed.'),
    R(customer2, 'Alphonso Mangoes (1kg)', 4, 'Sweet and ripe, a couple of small ones in the box though.'),
    R(customer3, 'Veg Hakka Noodles', 4, 'Good wok flavour, generous veggies.'),
    // store-level reviews (shown on store pages)
    { user: customer2._id, partner: partner1._id, target: 'partner', rating: 5, comment: 'Consistently great food and quick acceptance.', verifiedPurchase: true },
    { user: customer3._id, partner: partner3._id, target: 'partner', rating: 4, comment: 'Tasty Indo-Chinese, packaging could be better.', verifiedPurchase: true },
    { user: customer2._id, partner: partner4._id, target: 'partner', rating: 5, comment: 'The croissants are to die for. Lovely bakery.', verifiedPurchase: true },
  ]);
  // roll the seeded review counts into the partner aggregates
  for (const [p, avg, count] of [[partner1, 4.5, 2], [partner3, 4.3, 2], [partner4, 4.6, 2]]) {
    await User.updateOne({ _id: p._id }, { $set: { 'partnerProfile.ratingAvg': avg, 'partnerProfile.ratingCount': count } });
  }

  console.log('Creating cities and featured sections...');
  await City.insertMany([
    { name: 'Bengaluru', state: 'Karnataka', sortOrder: 0 },
    { name: 'Mumbai', state: 'Maharashtra', sortOrder: 1 },
    { name: 'Delhi', state: 'Delhi', sortOrder: 2 },
    { name: 'Bhuj', state: 'Gujarat', sortOrder: 3 },
  ]);

  const bestSellers = await Product.find({ soldCount: { $gt: 300 } }).select('_id');
  const vegPicks = await Product.find({ isVeg: true, ratingAvg: { $gte: 4.2 } }).limit(8).select('_id');
  const dessertCats = [cats['Desserts']._id, cats['Ice Cream']._id, cats['Bakery']._id];
  const sweetTreats = await Product.find({ category: { $in: dessertCats } }).limit(8).select('_id');
  await FeaturedSection.insertMany([
    { title: 'Best sellers', subtitle: 'Most loved by DapiGO customers', products: bestSellers.map((p) => p._id), sortOrder: 0 },
    { title: 'Fresh veg picks', subtitle: 'Green and wholesome', products: vegPicks.map((p) => p._id), sortOrder: 1 },
    { title: 'Sweet treats', subtitle: 'Bakes, cakes and scoops', products: sweetTreats.map((p) => p._id), sortOrder: 2 },
  ]);

  console.log('Creating promos, sliders, offers, settings, pages, faqs...');
  await PromoCode.insertMany([
    { code: 'WELCOME50', description: '50 off on your first order above 299', type: 'flat', value: 50, minOrder: 299, perUserLimit: 1 },
    { code: 'DAPIGO10', description: '10% off up to 100 on orders above 199', type: 'percent', value: 10, minOrder: 199, maxDiscount: 100, perUserLimit: 5 },
    { code: 'SPICE20', description: '20% off at Spice Garden (min 399)', type: 'percent', value: 20, minOrder: 399, maxDiscount: 150, partner: partner1._id, perUserLimit: 3 },
    { code: 'WOKDEAL', description: '15% off at Dragon Wok (min 249)', type: 'percent', value: 15, minOrder: 249, maxDiscount: 120, partner: partner3._id, perUserLimit: 3 },
  ]);

  await Slider.insertMany([
    { title: 'Craving Biryani?', image: IMG.biryani.replace('w=600', 'w=1200'), sortOrder: 0 },
    { title: 'Momos, noodles & more at Dragon Wok', image: IMG.momos.replace('w=600', 'w=1200'), sortOrder: 1 },
    { title: 'Fresh Groceries Daily', image: IMG.veggies.replace('w=600', 'w=1200'), sortOrder: 2 },
    { title: 'Flat 10% off with DAPIGO10', image: IMG.pizza.replace('w=600', 'w=1200'), sortOrder: 3 },
  ]);

  await Offer.insertMany([
    { title: 'Mango Season Sale', description: 'Alphonso mangoes at 299/kg', image: IMG.mango, active: true },
    { title: 'Free delivery above 500', description: 'On all Spice Garden orders', image: IMG.indianthali, active: true },
    { title: 'Fresh-baked mornings', description: 'Croissants + cold brew combos at Bake House & Co', image: IMG.croissant, active: true },
  ]);

  await Setting.insertMany([
    { key: 'appName', value: 'DAPIGO' },
    { key: 'currency', value: '₹' },
    { key: 'supportEmail', value: 'support@dapigo.com' },
    { key: 'supportPhone', value: '+91 90000 00000' },
    { key: 'defaultCommission', value: 10 },
  ]);

  await Page.insertMany([
    { slug: 'about', title: 'About Us', content: 'DAPIGO is a multi-vendor delivery platform connecting customers with local stores and restaurants, delivered by a trusted rider network.' },
    { slug: 'privacy', title: 'Privacy Policy', content: 'We respect your privacy. Your data is used only to operate the DAPIGO service and is never sold to third parties.' },
    { slug: 'terms', title: 'Terms & Conditions', content: 'By using DAPIGO you agree to our fair-use terms. Orders are subject to store acceptance and rider availability.' },
    // v1 parity: Contact_us.php + per-role privacy pages (Partner_/Rider_privacy_policy.php)
    { slug: 'contact', title: 'Contact Us', content: 'Reach the DAPIGO team at support@dapigo.com or +91 90000 00000. We usually reply within one business day.' },
    { slug: 'partner-privacy', title: 'Partner Privacy Policy', content: 'Store and KYC details submitted by partners are used only for order fulfilment, payouts and compliance, and are never sold to third parties.' },
    { slug: 'rider-privacy', title: 'Rider Privacy Policy', content: 'Rider location is shared with customers only while a delivery is active. Vehicle and KYC details are used for verification and payouts only.' },
  ]);

  await Faq.insertMany([
    { question: 'How do I track my order?', answer: 'Open Orders → select your order to see live status updates from the store and rider.', sortOrder: 0 },
    { question: 'What payment methods are supported?', answer: 'Cash on Delivery and DAPIGO Wallet. You can top up the wallet from your profile.', sortOrder: 1 },
    { question: 'How do refunds work?', answer: 'Cancelled prepaid orders are refunded instantly to your DAPIGO wallet.', sortOrder: 2 },
    { question: 'How do I become a partner?', answer: 'Register from the Partner Console. After KYC approval by our team you can start selling.', sortOrder: 3 },
  ]);

  console.log('\nSeed complete! Demo accounts (password after the dash):');
  console.log('  admin@dapigo.com     - admin123    (admin console)');
  console.log('  partner@dapigo.com   - partner123  (Spice Garden)');
  console.log('  partner2@dapigo.com  - partner123  (Fresh Basket)');
  console.log('  partner3@dapigo.com  - partner123  (Dragon Wok)');
  console.log('  partner4@dapigo.com  - partner123  (Bake House & Co)');
  console.log('  rider@dapigo.com     - rider123    (rider app)');
  console.log('  customer@dapigo.com  - customer123 (storefront, ₹1000 wallet)');
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
