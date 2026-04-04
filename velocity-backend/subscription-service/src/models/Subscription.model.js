'use strict';

const mongoose = require('mongoose');

const PLANS = [
  {
    id:       'basic',
    name:     'Normal',
    price:    9.99,
    period:   'month',
    benefits: ['10% member discount on car & bike rides, parcels & carpools', 'Priority customer support', 'Free cancellation', 'Basic trip analytics'],
  },
  {
    id:       'standard',
    name:     'Standard',
    price:    19.99,
    period:   'month',
    popular:  true,
    benefits: ['20% member discount on car & bike rides, parcels & carpools', '24/7 premium support', 'Free cancellation', 'Advanced analytics', 'Free parcel delivery (up to 5kg)', 'Carpool priority matching'],
  },
  {
    id:       'premium',
    name:     'Premium',
    price:    34.99,
    period:   'month',
    benefits: ['30% member discount on car & bike rides, parcels & carpools', 'Dedicated account manager', 'Free cancellation anytime', 'Full analytics', 'Unlimited parcel delivery', 'Premium carpool matching', 'Airport pickup priority', 'Exclusive luxury vehicle access'],
  },
];

const subscriptionSchema = new mongoose.Schema(
  {
    userId:    { type: String, required: true, unique: true },
    planId:    { type: String, required: true },
    planName:  { type: String, required: true },
    price:     { type: Number, required: true },
    status:    { type: String, enum: ['active', 'cancelled', 'expired'], default: 'active' },
    startDate: { type: Date, default: Date.now },
    endDate:   { type: Date },
  },
  { timestamps: true },
);

const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = { Subscription, PLANS };
