/* Balance — category/subcategory → Phosphor icon mapping.
   Categories don't carry an icon field; this maps the seeded taxonomy names to
   fitting Phosphor icons. Unknown (user-created) names fall back to a neutral
   tag icon, so every category always renders a proper icon. */
import {
  // income
  Money, Laptop, Storefront, HandCoins, TrendUp, Gift, Receipt,
  // expense top-level
  House, ShoppingBag, ForkKnife, Car, GraduationCap, Monitor, Briefcase,
  GameController, Heartbeat, Bank, HandHeart, DotsThreeOutline,
  // subcategories
  Key, Lightning, Drop, WifiHigh, Wrench, DeviceMobile, Handbag, TShirt, Sparkle,
  ShoppingCart, Coffee, Moped, Bus, Taxi, GasPump, Airplane, Books, Certificate,
  Cloud, Code, Television, Package, Truck, Cube, Camera, FilmSlate, Stethoscope,
  Pill, Barbell, Scissors, CreditCard, Heart, UsersThree, Warning, Question,
  ArrowsClockwise, Tag,
} from '@phosphor-icons/react';

const ICON_BY_NAME = {
  // ── Income ──
  'Salary / Wages': Money,
  'Freelance / Contract Work': Laptop,
  'Business Revenue / Online Sales': Storefront,
  'Allowances / Pocket Money': HandCoins,
  'Investment / Interest Returns': TrendUp,
  'Gifts Received': Gift,
  'Refunds / Reimbursements': Receipt,

  // ── Expense: top-level ──
  'Housing & Utilities': House,
  'Shopping': ShoppingBag,
  'Food & Dining': ForkKnife,
  'Transportation': Car,
  'Education': GraduationCap,
  'Tech & Subscriptions': Monitor,
  'Business Operations': Briefcase,
  'Entertainment & Hobbies': GameController,
  'Health & Personal': Heartbeat,
  'Financial & Fees': Bank,
  'Giving & Social': HandHeart,
  'Others': DotsThreeOutline,

  // ── Housing & Utilities ──
  'Rent': Key,
  'Electricity': Lightning,
  'Water & Gas': Drop,
  'Internet / Broadband': WifiHigh,
  'Home Maintenance': Wrench,

  // ── Shopping ──
  'Gadgets & Electronics': DeviceMobile,
  'Fashion Item': Handbag,
  'Clothing': TShirt,
  'Makeup & Cosmetics': Sparkle,

  // ── Food & Dining ──
  'Groceries': ShoppingCart,
  'Restaurants / Dining Out': ForkKnife,
  'Coffee Shops / Snacks': Coffee,
  'Food Delivery': Moped,

  // ── Transportation ──
  'Public Transit': Bus,
  'Ride-shares': Taxi,
  'Fuel / Gas': GasPump,
  'Vehicle Maintenance': Wrench,
  'Train / Plane': Airplane,

  // ── Education ──
  'University Tuition': GraduationCap,
  'Books & Supplies': Books,
  'Online Courses / Certifications': Certificate,

  // ── Tech & Subscriptions ──
  'Server Hosting': Cloud,
  'Software Licenses': Code,
  'Mobile Recharge / Data Packs': DeviceMobile,
  'Streaming Services': Television,

  // ── Business Operations ──
  'Inventory Purchases': Package,
  'Courier / Shipping': Truck,
  'Packaging Materials': Cube,

  // ── Entertainment & Hobbies ──
  'Gaming': GameController,
  'Photography Gear & Editing Tools': Camera,
  'Movies': FilmSlate,

  // ── Health & Personal ──
  'Doctor Visits': Stethoscope,
  'Medicines': Pill,
  'Gym / Fitness': Barbell,
  'Haircuts / Grooming': Scissors,
  'Lotions': Drop,

  // ── Financial & Fees ──
  'Bank Charges': Bank,
  'Credit Card Payments': CreditCard,
  'Loan Repayments': HandCoins,

  // ── Giving & Social ──
  'Charity': Heart,
  'Gifts Given': Gift,
  'Club Memberships / Dues': UsersThree,

  // ── Others ──
  'Lost': Warning,
  'Unknown': Question,
  'Reconcile': ArrowsClockwise,
};

/** Returns the Phosphor icon component for a category/subcategory name. */
export const catIconFor = (name) => ICON_BY_NAME[name] || Tag;

/** Renders a category's icon. Inherits color via `currentColor`. */
export default function CatIcon({ name, ...props }) {
  const Ic = catIconFor(name);
  return <Ic {...props} />;
}
