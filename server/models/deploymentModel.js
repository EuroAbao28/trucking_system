const mongoose = require('mongoose')

const deploymentSchema = new mongoose.Schema(
  {
    truckId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Truck',
      required: [true, 'Truck is required']
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      required: [true, 'Driver is required']
    },
    truckType: {
      type: String,
      required: [true, 'Truck type is required']
    },
    helperCount: {
      type: String,
      required: [true, 'Helper count is required']
    },
    pickupSite: {
      type: String,
      required: [true, 'Pick-up site is required']
    },
    destination: {
      type: String,
      required: [true, 'Destination is required']
    },
    sacksCount: {
      type: Number,
      default: 0
    },
    loadWeightKg: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      default: 'preparing'
    },

    // Replacement fields
    replacement: {
      replacementTruckId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Truck'
      },
      replacementDriverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Driver'
      },
      replacementTruckType: String,
      replacementHelperCount: Number,
      replacedAt: String,
      reason: String,
      remarks: String
    },

    // timeline
    departed: {
      type: String,
      default: ''
    },
    pickupIn: {
      type: String,
      default: ''
    },
    pickupOut: {
      type: String,
      default: ''
    },
    destArrival: {
      type: String,
      default: ''
    },
    destDeparture: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
)

const Deployment = mongoose.model('Deployment', deploymentSchema)
module.exports = Deployment
