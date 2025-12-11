const createError = require('http-errors')
const { validateFields } = require('../utils/validationFields')
const Deployment = require('../models/deploymentModel')
const Truck = require('../models/truckModel')
const Driver = require('../models/driverModel')

// create deployment
const createDeployment = async (req, res, next) => {
  try {
    const {
      truckId,
      driverId,
      truckType,
      helperCount,
      pickupSite,
      destination,
      sacksCount,
      loadWeightKg,
      departed,
      pickupIn,
      pickupOut,
      destArrival,
      destDeparture
    } = req.body

    console.log(req.body)

    // validate fields
    validateFields({
      truckId,
      driverId,
      truckType,
      helperCount,
      pickupSite,
      destination
    })

    // check if truck exists
    const truck = await Truck.findById(truckId)
    if (!truck) {
      return next(createError(404, 'Truck not found'))
    }

    // check if truck is already deployed
    if (truck.status === 'deployed') {
      return next(createError(400, 'Truck is already deployed'))
    }

    // create deployment
    const newDeployment = await Deployment.create({
      truckId,
      driverId,
      truckType,
      helperCount,
      pickupSite,
      destination,
      sacksCount: sacksCount || 0,
      loadWeightKg: loadWeightKg || 0,
      departed: departed || '',
      pickupIn: pickupIn || '',
      pickupOut: pickupOut || '',
      destArrival: destArrival || '',
      destDeparture: destDeparture || ''
    })

    // update truck status to deployed
    await Truck.findByIdAndUpdate(truckId, { status: 'deployed' })

    // populate the newly created deployment
    const populatedDeployment = await Deployment.findById(newDeployment._id)
      .populate('truckId')
      .populate('driverId')

    res.status(201).json({
      message: 'Deployment created successfully',
      deployment: populatedDeployment
    })
  } catch (error) {
    next(error)
  }
}

// get deployments
const getAllDeployments = async (req, res, next) => {
  try {
    const {
      status,
      search,
      sort = 'latest',
      perPage = 50,
      page = 1
    } = req.query

    console.log('DEPLOYMENT FILTERS RECEIVED:', req.query)

    // Build the base query
    let baseQuery = Deployment.find()

    // Status filter
    if (status && status !== '') {
      baseQuery = baseQuery.where('status').equals(status)
    }

    // Search filter - We'll handle this after population
    let searchTerm = search && search !== '' ? search : null

    // Sorting
    const sortOptions = {
      oldest: { createdAt: 1 },
      latest: { createdAt: -1 }
    }
    const sortQuery = sortOptions[sort] || sortOptions.latest
    baseQuery = baseQuery.sort(sortQuery)

    // Apply pagination FIRST - at database level
    const limit = parseInt(perPage)
    const skip = (parseInt(page) - 1) * limit
    baseQuery = baseQuery.skip(skip).limit(limit)

    // Populate options
    const populateOptions = [
      {
        path: 'truckId',
        select: 'plateNo truckType condition status imageUrl'
      },
      { path: 'driverId', select: 'firstname lastname licenseNo contact' },
      {
        path: 'replacement.replacementTruckId',
        select: 'plateNo truckType condition status imageUrl'
      },
      {
        path: 'replacement.replacementDriverId',
        select: 'firstname lastname licenseNo contact'
      }
    ]

    baseQuery = baseQuery.populate(populateOptions)

    // Get deployments with pagination applied
    let deployments = await baseQuery

    // Apply search filter after population (client-side)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      deployments = deployments.filter(deployment => {
        // Determine active truck and driver (replacement if exists, otherwise original)
        const activeTruckPlate = deployment.replacement?.replacementTruckId
          ?.plateNo
          ? deployment.replacement.replacementTruckId.plateNo.toLowerCase()
          : deployment.truckId?.plateNo?.toLowerCase() || ''

        const activeDriverFirstname = deployment.replacement
          ?.replacementDriverId?.firstname
          ? deployment.replacement.replacementDriverId.firstname.toLowerCase()
          : deployment.driverId?.firstname?.toLowerCase() || ''

        const activeDriverLastname = deployment.replacement?.replacementDriverId
          ?.lastname
          ? deployment.replacement.replacementDriverId.lastname.toLowerCase()
          : deployment.driverId?.lastname?.toLowerCase() || ''

        // Check deployment fields
        const destination = deployment.destination?.toLowerCase() || ''
        const pickupSite = deployment.pickupSite?.toLowerCase() || ''
        const truckType = deployment.truckType?.toLowerCase() || ''

        return (
          activeTruckPlate.includes(searchLower) ||
          activeDriverFirstname.includes(searchLower) ||
          activeDriverLastname.includes(searchLower) ||
          destination.includes(searchLower) ||
          pickupSite.includes(searchLower) ||
          truckType.includes(searchLower)
        )
      })
    }

    // Get total count for pagination (without search filter for accurate total)
    let totalQuery = Deployment.find()

    // Apply status filter to total count
    if (status && status !== '') {
      totalQuery = totalQuery.where('status').equals(status)
    }

    const total = await totalQuery.countDocuments()

    return res.status(200).json({
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      deployments
    })
  } catch (error) {
    next(error)
  }
}

// update deployment
const updateDeployment = async (req, res, next) => {
  try {
    const { id } = req.params
    const {
      truckId,
      driverId,
      truckType,
      helperCount,
      pickupSite,
      destination,
      sacksCount,
      loadWeightKg,
      status,
      departed,
      pickupIn,
      pickupOut,
      destArrival,
      destDeparture,
      replacement
    } = req.body

    console.log('UPDATE DEPLOYMENT BODY', req.body)

    // find the deployment
    const existingDeployment = await Deployment.findById(id)
    if (!existingDeployment) {
      return next(createError(404, 'Deployment not found'))
    }

    // Store original values for comparison
    const originalTruckId = existingDeployment.truckId.toString()
    const originalStatus = existingDeployment.status
    const hasExistingReplacement =
      existingDeployment.replacement?.replacementTruckId

    // replacement truck logic
    if (replacement && replacement.replacementTruckId) {
      const isNewReplacement =
        !hasExistingReplacement ||
        hasExistingReplacement.toString() !== replacement.replacementTruckId

      if (isNewReplacement) {
        // Update replacement truck status to deployed
        await Truck.findByIdAndUpdate(replacement.replacementTruckId, {
          status: 'deployed'
        })

        // Update original truck status back to available
        await Truck.findByIdAndUpdate(existingDeployment.truckId, {
          status: 'available'
        })
      }

      existingDeployment.replacement = {
        replacementTruckId: replacement.replacementTruckId,
        replacementDriverId: replacement.replacementDriverId,
        replacementTruckType: replacement.replacementTruckType,
        replacementHelperCount: replacement.replacementHelperCount,
        replacedAt: replacement.replacedAt,
        reason: replacement.reason,
        remarks: replacement.remarks
      }
    }

    // check if departed is being set and has a value
    const isDepartedSet =
      departed !== undefined && departed !== '' && departed !== null

    // check if destDeparture is being set and has a value
    const isDestDepartureSet =
      destDeparture !== undefined &&
      destDeparture !== '' &&
      destDeparture !== null

    let finalStatus = status

    if (isDepartedSet && !isDestDepartureSet && status !== 'canceled')
      finalStatus = 'ongoing'
    else if (isDestDepartureSet && status !== 'canceled')
      finalStatus = 'completed'

    // Determine which truck is currently active (replacement or original)
    const activeTruckId = existingDeployment.replacement?.replacementTruckId
      ? existingDeployment.replacement.replacementTruckId
      : existingDeployment.truckId

    // Determine which driver is currently active (replacement or original)
    const activeDriverId = existingDeployment.replacement?.replacementDriverId
      ? existingDeployment.replacement.replacementDriverId
      : existingDeployment.driverId

    // Handle truck status changes based on deployment status - ONLY for active truck
    if (finalStatus === 'canceled') {
      // If deployment is canceled, make the ACTIVE truck available
      await Truck.findByIdAndUpdate(activeTruckId, { status: 'available' })
    } else if (isDestDepartureSet && finalStatus === 'completed') {
      // If destDeparture is set and status is completed, make the ACTIVE truck available
      await Truck.findByIdAndUpdate(activeTruckId, { status: 'available' })
    } else if (finalStatus === 'ongoing' || finalStatus === 'preparing') {
      // If deployment is ongoing or preparing, make sure ACTIVE truck status is deployed
      // BUT only update if it's not the original truck that was replaced
      if (
        !hasExistingReplacement ||
        activeTruckId.toString() !== originalTruckId
      ) {
        await Truck.findByIdAndUpdate(activeTruckId, { status: 'deployed' })
      }
    }

    // Handle truck change - if truckId is being updated (only relevant if no replacement exists)
    if (truckId && truckId !== originalTruckId && !hasExistingReplacement) {
      // Update old truck status back to available
      await Truck.findByIdAndUpdate(originalTruckId, { status: 'available' })

      // Update new truck status to deployed (unless deployment is canceled/completed)
      if (finalStatus !== 'canceled' && finalStatus !== 'completed') {
        await Truck.findByIdAndUpdate(truckId, { status: 'deployed' })
      }
    }

    // ⭐⭐ IMPORTANT: INCREMENT DRIVER'S tripCount WHEN DEPLOYMENT IS COMPLETED ⭐⭐
    if (finalStatus === 'completed' && originalStatus !== 'completed') {
      // Only increment if the deployment is transitioning TO completed status
      // and the driver exists (check for both original and replacement driver)

      if (activeDriverId) {
        try {
          // Increment the driver's tripCount by 1
          await Driver.findByIdAndUpdate(activeDriverId, {
            $inc: { tripCount: 1 }
          })
          console.log(`Incremented tripCount for driver: ${activeDriverId}`)
        } catch (driverError) {
          console.error('Error incrementing driver tripCount:', driverError)
        }
      }
    }

    // only update provided fields, keep existing values for others
    const updatedFields = {
      truckId: truckId || existingDeployment.truckId,
      driverId: driverId || existingDeployment.driverId,
      truckType: truckType || existingDeployment.truckType,
      helperCount: helperCount || existingDeployment.helperCount,
      pickupSite: pickupSite || existingDeployment.pickupSite,
      destination: destination || existingDeployment.destination,
      sacksCount:
        sacksCount !== undefined ? sacksCount : existingDeployment.sacksCount,
      loadWeightKg:
        loadWeightKg !== undefined
          ? loadWeightKg
          : existingDeployment.loadWeightKg,
      status:
        finalStatus !== undefined ? finalStatus : existingDeployment.status,
      departed: departed !== undefined ? departed : existingDeployment.departed,
      pickupIn: pickupIn !== undefined ? pickupIn : existingDeployment.pickupIn,
      pickupOut:
        pickupOut !== undefined ? pickupOut : existingDeployment.pickupOut,
      destArrival:
        destArrival !== undefined
          ? destArrival
          : existingDeployment.destArrival,
      destDeparture:
        destDeparture !== undefined
          ? destDeparture
          : existingDeployment.destDeparture
    }

    Object.assign(existingDeployment, updatedFields)
    await existingDeployment.save()

    // populate the references to get complete data
    const populatedDeployment = await Deployment.findById(id)
      .populate('truckId')
      .populate('driverId')
      .populate('replacement.replacementTruckId')
      .populate('replacement.replacementDriverId')

    res.status(200).json({
      message: 'Deployment updated successfully',
      deployment: populatedDeployment
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  createDeployment,
  getAllDeployments,
  updateDeployment
}
