const createError = require('http-errors')
const sharp = require('sharp')
const Truck = require('../models/truckModel')
const { validateFields } = require('../utils/validationFields')
const { isValidFileType } = require('../utils/validationFile')
const {
  validateCondition,
  validateStatus,
  validateType
} = require('../utils/validationTruckFields')
const { uploadImageToCloudinary } = require('../utils/cloudinaryUtils')
const { cloudinary } = require('../middlewares/multerCloudinary')

// create truck
const createTruck = async (req, res, next) => {
  try {
    const { plateNo, truckType, condition, status, tools } = req.body

    console.log('CREATE TRUCK BODY', req.body)

    // validate fields
    validateFields(plateNo)

    // validate other fields
    validateType(truckType)
    validateCondition(condition)
    validateStatus(status)

    // check if truck with same plate number already exists
    const isTruckAlreadyExist = await Truck.findOne({
      plateNo: { $regex: new RegExp(`^${plateNo}$`, 'i') }
    })

    if (isTruckAlreadyExist) {
      return next(
        createError(409, 'Truck with this plate number already exists')
      )
    }

    // parse tools if it's a string (from FormData)
    let toolsArray = []
    if (tools) {
      try {
        toolsArray = typeof tools === 'string' ? JSON.parse(tools) : tools
      } catch (error) {
        console.log('Error parsing tools:', error)
        toolsArray = []
      }
    }

    // upload profile picture to cloudinary (if provided)
    let imageData = {
      url: '',
      publicId: ''
    }

    if (req.file) {
      console.log(req.file)

      try {
        // validate file type
        if (!isValidFileType(req.file.mimetype)) {
          return next(
            createError(400, 'Invalid file type. Only images are allowed')
          )
        }

        // compress the image with sharp
        const compressedImage = await sharp(req.file.buffer)
          .rotate()
          .resize({
            width: 1200,
            withoutEnlargement: true
          })
          .jpeg({
            quality: 80,
            mozjpeg: true
          })
          .toBuffer()

        // upload the image to cloudinary
        const uploadResult = await uploadImageToCloudinary(
          compressedImage,
          'Yza/truck'
        )

        imageData = {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id
        }
      } catch (error) {
        return next(error)
      }
    }

    // create new truck
    const newTruck = await Truck.create({
      plateNo,
      truckType,
      condition,
      status,
      tools: toolsArray,
      imageUrl: imageData.url,
      imagePublicId: imageData.publicId
    })

    return res.status(201).json({
      message: 'Truck created successfully',
      truck: newTruck
    })
  } catch (error) {
    next(error)
  }
}

// get trucks
const getAllTrucks = async (req, res, next) => {
  try {
    const {
      truckType,
      condition,
      status,
      search,
      sort,
      perPage,
      page = 1,
      showDeleted
    } = req.query

    console.log(req.query)

    const query = {}

    if (showDeleted !== 'true') {
      query.$or = [
        { isSoftDeleted: false },
        { isSoftDeleted: { $exists: false } }
      ]
    }

    //  filters
    if (truckType) query.truckType = truckType
    if (condition) query.condition = condition
    if (status) query.status = status

    // search
    if (search) {
      const regex = { $regex: search, $options: 'i' }
      query.$or = [{ plateNo: regex }]
    }

    // sorting
    const sortOptions = {
      oldest: { createdAt: 1 },
      latest: { createdAt: -1 },
      'a-z': { plateNo: 1 },
      'z-a': { plateNo: -1 }
    }

    const sortQuery = sortOptions[sort] || sortOptions.latest

    // check if pagination parameters are provided
    const hasPagination =
      perPage !== undefined &&
      perPage !== '' &&
      !isNaN(parseInt(perPage)) &&
      page !== undefined &&
      page !== '' &&
      !isNaN(parseInt(page))

    if (hasPagination) {
      console.log('WITH PAGINATION')
      // With pagination
      const limit = parseInt(perPage)
      const skip = (parseInt(page) - 1) * limit

      const [total, trucks] = await Promise.all([
        Truck.countDocuments(query),
        Truck.find(query).skip(skip).limit(limit).sort(sortQuery)
      ])

      return res.status(200).json({
        total,
        page: Number(page),
        totalPages: Math.ceil(total / limit),
        trucks
      })
    } else {
      console.log('NO PAGINATION')

      // Without pagination - get all trucks
      const trucks = await Truck.find(query).sort(sortQuery)

      return res.status(200).json({
        trucks
      })
    }
  } catch (error) {
    next(error)
  }
}

// update truck
const updateTruck = async (req, res, next) => {
  try {
    const { id } = req.params
    const { plateNo, truckType, condition, status, tools } = req.body

    console.log('UPDATE TRUCK BODY', req.body)

    // find the truck
    const existingTruck = await Truck.findById(id)
    if (!existingTruck) {
      return next(createError(404, 'Truck not found'))
    }

    // parse tools if it's a string (from FormData)
    let toolsArray = []
    if (tools) {
      try {
        toolsArray = typeof tools === 'string' ? JSON.parse(tools) : tools

        // validate tools structure
        if (Array.isArray(toolsArray)) {
          toolsArray = toolsArray.filter(
            tool =>
              tool &&
              tool.tool &&
              typeof tool.tool === 'string' &&
              typeof tool.quantity === 'number' &&
              tool.quantity >= 1
          )
        } else {
          toolsArray = []
        }
      } catch (error) {
        console.log('Error parsing tools:', error)
        toolsArray = []
      }
    }

    // handle file upload if provided
    let imageUrl = existingTruck.imageUrl
    let imagePublicId = existingTruck.imagePublicId

    // if images are provided
    if (req.file) {
      console.log('IMAGE FOR UPDATE', req.file)

      try {
        // validate file type
        if (!isValidFileType(req.file.mimetype)) {
          return next(
            createError(400, 'Invalid file type. Only images are allowed')
          )
        }

        // Validate file size (16MB max)
        const MAX_FILE_SIZE = 16 * 1024 * 1024
        if (req.file.size > MAX_FILE_SIZE) {
          return next(createError(400, 'Image size must be less than 16MB'))
        }

        // delete old picture if exist
        if (imagePublicId) {
          await cloudinary.uploader.destroy(imagePublicId)
        }

        // upload new image
        const uploadResult = await uploadImageToCloudinary(
          req.file.buffer,
          'Yza/truck'
        )

        imageUrl = uploadResult.secure_url
        imagePublicId = uploadResult.public_id
      } catch (error) {
        console.error('Cloudinary error:', error)
        return next(createError(500, 'Failed to upload image'))
      }
    }

    // update fields
    const updatedFields = {
      plateNo: plateNo || existingTruck.plateNo,
      truckType: truckType ?? existingTruck.truckType,
      condition: condition || existingTruck.condition,
      status: status || existingTruck.status,
      imageUrl,
      imagePublicId,
      tools: toolsArray
    }

    Object.assign(existingTruck, updatedFields)
    await existingTruck.save()

    res.status(200).json({
      message: 'Truck updated successfully',
      truck: existingTruck
    })
  } catch (error) {
    next(error)
  }
}

// delete truck
const hardDeleteTruck = async (req, res, next) => {
  try {
    const { id } = req.params

    console.log('DELETE TRUCK ID', id)

    // Find the truck to delete
    const truckToDelete = await Truck.findByIdAndDelete(id)
    if (!truckToDelete) {
      return next(createError(404, 'Truck not found'))
    }

    // Delete profile picture from Cloudinary if it exists
    if (truckToDelete.imagePublicId) {
      await cloudinary.uploader.destroy(truckToDelete.imagePublicId)
    }

    return res.status(200).json({
      message: 'Truck deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting truck:', error)
    next(createError(500, 'Failed to delete truck'))
  }
}

const softDeleteTruck = async (req, res, next) => {
  try {
    const { id } = req.params

    // Find the truck
    const truck = await Truck.findById(id)
    if (!truck) {
      return next(createError(404, 'Truck not found'))
    }

    // Check if already deleted
    if (truck.isSoftDeleted) {
      return next(createError(400, 'Truck is already deleted'))
    }

    // Soft delete the truck
    truck.isSoftDeleted = true

    await truck.save()

    res.status(200).json({
      success: true,
      message: 'Truck deleted successfully'
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  createTruck,
  getAllTrucks,
  updateTruck,
  hardDeleteTruck,
  softDeleteTruck
}
