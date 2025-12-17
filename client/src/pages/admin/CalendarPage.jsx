import React, { useState, useEffect } from 'react'
import { MdKeyboardArrowLeft, MdKeyboardArrowRight } from 'react-icons/md'
import {
  FaBoxOpen,
  FaCheckCircle,
  FaFlagCheckered,
  FaTruck,
  FaWarehouse,
  FaClock,
  FaTimesCircle
} from 'react-icons/fa'
import DeploymentDetailsModal from '../../components/modals/DeploymentDetailsModal'
import useGetAllTruck from '../../hooks/useGetAllTruck'
import useGetAllDriver from '../../hooks/useGetAllDriver'
import ReplacementHistoryModal from '../../components/modals/ReplacementHistoryModal'
import useGetAllDeployment from '../../hooks/useGetAllDeployment'
import { error_illustration } from '../../consts/images'

function CalendarPage () {
  const { getAllDeploymentFunction, isLoading: isDeploymentsLoading } =
    useGetAllDeployment()
  const { getAllTruckFunction, isLoading: isTruckLoading } = useGetAllTruck()
  const { getAllDriverFunction, isLoading: isDriverLoading } = useGetAllDriver()

  const [allDeployments, setAllDeployments] = useState([])
  const [allTrucks, setAllTrucks] = useState([])
  const [allDrivers, setAllDrivers] = useState([])
  const [deploymentsError, setDeploymentsError] = useState(null)
  const [truckError, setTruckError] = useState(null)
  const [driverError, setDriverError] = useState(null)

  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDeployment, setSelectedDeployment] = useState({})
  const [view, setView] = useState('month')
  const [isDeploymentDetailsModalOpen, setIsDeploymentDetailsModalOpen] =
    useState(false)
  const [isReplacementModalOpen, setIsReplacementModalOpen] = useState(false)
  const [showReplacementHistory, setShowReplacementHistory] = useState(false)

  useEffect(() => {
    const handleGetAllDeployments = async () => {
      // Fetch all deployments without filters to get everything for the calendar
      const { deployments, total, page, totalPages, error } =
        await getAllDeploymentFunction({})

      if (error) {
        setDeploymentsError(error)
      }
      setAllDeployments(deployments || [])
    }

    const handleGetAllTrucks = async () => {
      const { trucks, error } = await getAllTruckFunction({})

      if (error) {
        setTruckError(error)
      }
      setAllTrucks(trucks || [])
    }

    const handleGetAllDrivers = async () => {
      const { drivers, error } = await getAllDriverFunction({})

      if (error) {
        setDriverError(error)
      }
      setAllDrivers(drivers || [])
    }

    handleGetAllDeployments()
    handleGetAllTrucks()
    handleGetAllDrivers()
  }, [])

  // Handle deployment selection
  const handleDeploymentSelect = deployment => {
    setSelectedDeployment(deployment)
    setIsDeploymentDetailsModalOpen(true)
  }

  // Create events from deployments based on their timeline fields
  const getCalendarEvents = () => {
    return allDeployments
      .map(deployment => {
        const events = []

        // Helper function to create event
        const createEvent = (timestamp, eventType, title, icon) => {
          if (!timestamp) return null

          const eventDate = new Date(timestamp)
          if (isNaN(eventDate.getTime())) return null

          return {
            id: `${deployment._id}-${eventType}`,
            deploymentId: deployment._id,
            title: title,
            shortTitle: title,
            deploymentCode: deployment.deploymentCode || '',
            truckPlate: getTruckPlate(deployment),
            formattedTime: formatTime(eventDate),
            start: eventDate,
            end: eventDate,
            type: eventType,
            deployment: deployment,
            color: getStatusColor(deployment.status),
            icon: icon,
            rawTimestamp: timestamp
          }
        }

        // Create events for each timeline milestone if they exist
        const timelineEvents = [
          {
            field: 'departed',
            type: 'departed',
            title: 'Departure',
            icon: FaTruck
          },
          {
            field: 'pickupIn',
            type: 'pickupIn',
            title: 'Pickup Arrival',
            icon: FaWarehouse
          },
          {
            field: 'pickupOut',
            type: 'pickupOut',
            title: 'Pickup Departure',
            icon: FaBoxOpen
          },
          {
            field: 'destArrival',
            type: 'destArrival',
            title: 'Destination Arrival',
            icon: FaFlagCheckered
          },
          {
            field: 'destDeparture',
            type: 'destDeparture',
            title: 'Delivery Completed',
            icon: FaCheckCircle
          }
        ]

        timelineEvents.forEach(({ field, type, title, icon }) => {
          if (deployment[field]) {
            const event = createEvent(deployment[field], type, title, icon)
            if (event) events.push(event)
          }
        })

        // Also create an event for deployment creation/status
        const createdEvent = createEvent(
          deployment.createdAt,
          'created',
          `Deployment ${
            deployment.status === 'canceled' ? 'Canceled' : 'Created'
          }`,
          deployment.status === 'canceled' ? FaTimesCircle : FaClock
        )
        if (createdEvent) events.push(createdEvent)

        return events
      })
      .flat()
      .filter(event => event !== null)
      .sort((a, b) => a.start - b.start)
  }

  // Helper function to format time
  const formatTime = date => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  // Status-based color mapping
  const getStatusColor = status => {
    const statusColors = {
      preparing: 'bg-orange-500',
      ongoing: 'bg-emerald-500',
      completed: 'bg-blue-500',
      canceled: 'bg-red-500'
    }
    return statusColors[status] || statusColors.ongoing
  }

  // Helper function to get truck plate number (converted to uppercase)
  const getTruckPlate = deployment => {
    if (!deployment) return 'UNKNOWN TRUCK'

    if (deployment.replacement?.replacementTruckId?.plateNo) {
      return deployment.replacement.replacementTruckId.plateNo.toUpperCase()
    }
    return deployment.truckId?.plateNo?.toUpperCase() || 'UNKNOWN TRUCK'
  }

  // Helper function to get driver name
  const getDriverName = deployment => {
    if (!deployment) return 'Unknown Driver'

    if (deployment.replacement?.replacementDriverId) {
      const driver = deployment.replacement.replacementDriverId
      return `${driver.firstname} ${driver.lastname}`
    }
    return (
      `${deployment.driverId?.firstname} ${deployment.driverId?.lastname}` ||
      'Unknown Driver'
    )
  }

  // Navigation functions
  const nextPeriod = () => {
    const newDate = new Date(currentDate)
    if (view === 'month') {
      newDate.setMonth(newDate.getMonth() + 1)
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + 7)
    } else {
      newDate.setDate(newDate.getDate() + 1)
    }
    setCurrentDate(newDate)
  }

  const prevPeriod = () => {
    const newDate = new Date(currentDate)
    if (view === 'month') {
      newDate.setMonth(newDate.getMonth() - 1)
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() - 7)
    } else {
      newDate.setDate(newDate.getDate() - 1)
    }
    setCurrentDate(newDate)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  // Handle date cell click in month view
  const handleDateCellClick = date => {
    setCurrentDate(date)
    setView('day')
  }

  // Get days in month
  const getDaysInMonth = date => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  // Get first day of month
  const getFirstDayOfMonth = date => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  // Format month and year for display
  const getMonthYearString = () => {
    return currentDate.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    })
  }

  const getWeekRangeString = () => {
    const startOfWeek = new Date(currentDate)
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)

    const formatOptions = { month: 'short', day: 'numeric' }
    return `${startOfWeek.toLocaleDateString(
      'en-US',
      formatOptions
    )} - ${endOfWeek.toLocaleDateString('en-US', formatOptions)}`
  }

  // Updated renderMonthView with time, deployment code, and truck/event
  const renderMonthView = () => {
    const daysInMonth = getDaysInMonth(currentDate)
    const firstDayOfMonth = getFirstDayOfMonth(currentDate)
    const events = getCalendarEvents()

    const days = []

    // Add empty cells for days before the first day of month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(
        <div
          key={`empty-${i}`}
          className='min-h-32 p-2 bg-gray-50 border border-gray-200'
        />
      )
    }

    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        day
      )
      const dayEvents = events.filter(
        event => event.start.toDateString() === date.toDateString()
      )

      const isToday = date.toDateString() === new Date().toDateString()

      days.push(
        <div
          key={day}
          className={`min-h-32 border border-gray-200 transition-colors cursor-pointer ${
            isToday
              ? 'bg-blue-50 ring-1 ring-blue-200'
              : 'bg-white hover:bg-gray-50'
          }`}
          onClick={() => handleDateCellClick(date)}
        >
          <div
            className={`font-semibold mb-2 ${
              isToday ? 'text-blue-600' : 'text-gray-700'
            }`}
          >
            {day}
          </div>
          <div
            className='space-y-1 max-h-48 overflow-y-auto px-1'
            onClick={e => e.stopPropagation()}
          >
            {dayEvents.map(event => (
              <div
                key={event.id}
                className={`${event.color} text-white text-xs p-2 rounded cursor-pointer hover:brightness-95 transition-opacity space-y-1`}
                onClick={() => handleDeploymentSelect(event.deployment)}
                title={`${event.deploymentCode} - ${event.truckPlate} - ${
                  event.shortTitle
                } at ${event.start.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}`}
              >
                {/* Time and Deployment Code in one line */}
                <div className='flex items-center justify-between gap-1'>
                  <div className='text-xs font-medium bg-black/20 px-2 py-0.5 rounded-full'>
                    {event.deploymentCode}
                  </div>
                  <div className='text-xs font-medium opacity-90'>
                    {event.formattedTime}
                  </div>
                </div>

                {/* Truck plate and event type on new line */}
                <div className='text-xs truncate'>
                  {event.truckPlate} - {event.shortTitle}
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    }

    return days
  }

  // Updated renderWeekView with time, deployment code, and truck/event
  const renderWeekView = () => {
    const startOfWeek = new Date(currentDate)
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())
    const events = getCalendarEvents()

    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + index)
      const dayEvents = events.filter(
        event => event.start.toDateString() === date.toDateString()
      )
      const isToday = date.toDateString() === new Date().toDateString()

      return (
        <div
          key={index}
          className={`border-x flex flex-col border-gray-200 transition-color cursor-pointer ${
            isToday
              ? 'bg-blue-50 ring-1 ring-blue-200'
              : 'bg-white hover:bg-gray-50'
          }`}
          onClick={() => handleDateCellClick(date)}
        >
          {/* date header */}
          <div
            className='border-b border-gray-200 p-3 sticky z-10 top-0 bg-white'
            onClick={e => e.stopPropagation()}
          >
            <div className='font-semibold text-gray-600 uppercase text-sm'>
              {date.toLocaleDateString('en-US', { weekday: 'short' })}
            </div>
            <div
              className={`text-lg font-bold ${
                isToday ? 'text-blue-600' : 'text-gray-800'
              }`}
            >
              {date.getDate()}
            </div>
          </div>

          {/* items */}
          <div
            className='space-y-2 relative overflow-y-auto flex-1'
            onClick={e => e.stopPropagation()}
          >
            <div className='absolute inset-0 p-2 flex flex-col gap-2'>
              {dayEvents.map(event => (
                <div
                  key={event.id}
                  className={`${event.color} text-white p-2 rounded cursor-pointer hover:brightness-95 transition-opacity space-y-1`}
                  onClick={() => handleDeploymentSelect(event.deployment)}
                  title={`${event.deploymentCode} - ${event.truckPlate} - ${
                    event.shortTitle
                  } at ${event.start.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}`}
                >
                  {/* Time and Deployment Code in one line */}
                  <div className='flex items-center justify-between gap-1'>
                    <div className='text-xs font-medium bg-black/20 px-2 py-0.5 rounded-full'>
                      {event.deploymentCode}
                    </div>
                    <div className='text-xs font-medium opacity-90'>
                      {event.formattedTime}
                    </div>
                  </div>

                  {/* Truck plate and event type on new line */}
                  <div className='text-xs truncate'>
                    {event.truckPlate} - {event.shortTitle}
                  </div>
                </div>
              ))}
            </div>

            {dayEvents.length === 0 && (
              <div className='text-sm italic text-gray-400 text-center py-4'>
                No events
              </div>
            )}
          </div>
        </div>
      )
    })
  }

  // Render day view with time, deployment code, and truck/event
  const renderDayView = () => {
    const events = getCalendarEvents().filter(
      event => event.start.toDateString() === currentDate.toDateString()
    )

    return (
      <div className='flex-1 overflow-y-scroll relative'>
        {events.length === 0 ? (
          <div className='text-center text-gray-500 py-8 italic'>
            No deployment events for this day
          </div>
        ) : (
          <div className='space-y-3 absolute top-0 left-0 right-0'>
            {events.map(event => (
              <div
                key={event.id}
                className={`border-l-4 ${
                  event.color === 'bg-orange-500'
                    ? 'border-orange-500'
                    : event.color === 'bg-emerald-500'
                    ? 'border-emerald-500'
                    : event.color === 'bg-blue-500'
                    ? 'border-blue-500'
                    : event.color === 'bg-red-500'
                    ? 'border-red-500'
                    : 'border-gray-400'
                } p-4 bg-white outline outline-gray-100 rounded overflow-hidden cursor-pointer hover:bg-gray-100 transition-colors`}
                onClick={() => handleDeploymentSelect(event.deployment)}
              >
                <div className='flex items-start space-x-4'>
                  <div className='text-sm min-w-20 font-medium'>
                    {event.formattedTime}
                  </div>
                  <div className='flex-1'>
                    {/* Deployment Code and details */}
                    <div className='flex items-center gap-2 mb-1'>
                      <div className='text-xs font-medium bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full'>
                        {event.deploymentCode}
                      </div>
                      <div className='font-semibold text-gray-800'>
                        {event.truckPlate} - {event.shortTitle}
                      </div>
                    </div>

                    <div className='text-sm text-gray-600 capitalize'>
                      {event.deployment?.pickupSite} →{' '}
                      {event.deployment?.destination}
                    </div>
                    <div className='text-sm text-gray-500 mt-1 capitalize'>
                      Driver: {getDriverName(event.deployment)}
                    </div>
                    <div className='text-sm text-gray-500 capitalize'>
                      Status: {event.deployment?.status}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Loading state
  if (isDeploymentsLoading || isDriverLoading || isTruckLoading) {
    return (
      <div className='flex-1 flex items-center justify-center'>
        <div className='flex flex-col items-center justify-center gap-4 text-center'>
          <div className='relative'>
            <span className='loading loading-spinner loading-lg text-emerald-500'></span>
          </div>
          <p className='text-gray-600 font-medium'>Loading deployments...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (deploymentsError || truckError || driverError) {
    return (
      <div className='flex-1 flex justify-center items-center'>
        <div className='flex flex-col justify-center items-center gap-4 px-4 text-center'>
          <img src={error_illustration} alt='empty list' className='w-56' />
          <div className='space-y-2'>
            <h1 className='text-xl font-semibold text-gray-700'>
              Something went wrong
            </h1>
            <p className='text-gray-500 max-w-md leading-relaxed'>
              We encountered an unexpected error. Please try again later.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className='flex-1 flex flex-col gap-6'>
        <div className='bg-white shadow-card3 outline outline-gray-200 rounded flex items-center justify-between gap-4'>
          {/* Current Period Display */}
          <div className='text-2xl font-semibold p-6'>
            {view === 'month' && getMonthYearString()}
            {view === 'week' && getWeekRangeString()}
            {view === 'day' &&
              currentDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
          </div>

          <div className='flex gap-6 px-6'>
            {/* Navigation Controls */}
            <div className='flex items-center'>
              <button
                onClick={prevPeriod}
                className='py-4 px-6 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-800 text-xl cursor-pointer'
                aria-label='Previous period'
              >
                <MdKeyboardArrowLeft />
              </button>
              <button
                onClick={goToToday}
                className='px-3 py-4 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer'
              >
                Today
              </button>
              <button
                onClick={nextPeriod}
                className='py-4 px-6 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-800  text-xl cursor-pointer'
                aria-label='Next period'
              >
                <MdKeyboardArrowRight />
              </button>
            </div>

            {/* View Controls */}
            <div className='flex space-x-1 bg-gray-100 p-1 rounded-lg'>
              {['month', 'week', 'day'].map(viewType => (
                <button
                  key={viewType}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                    view === viewType
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                  onClick={() => setView(viewType)}
                >
                  {viewType.charAt(0).toUpperCase() + viewType.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Calendar Container - Made Scrollable */}
        <div className='flex-1 flex flex-col relative shadow-card3 outline outline-gray-200 rounded overflow-hidden'>
          {view === 'month' && (
            <div className='absolute inset-0'>
              <div className='h-full flex flex-col'>
                {/* Weekdays Header - Also Sticky */}
                <div className='sticky top-0 z-30 grid grid-cols-7 bg-white border-b border-gray-200'>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                    day => (
                      <div
                        key={day}
                        className='p-4 text-center font-semibold text-gray-600 uppercase text-sm'
                      >
                        {day}
                      </div>
                    )
                  )}
                </div>

                {/* Month Grid - Scrollable */}
                <div className='flex-1 overflow-auto'>
                  <div className='grid grid-cols-7 min-h-full'>
                    {renderMonthView()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === 'week' && (
            <div className=' flex-1 grid grid-cols-1 md:grid-cols-7 '>
              {renderWeekView()}
            </div>
          )}

          {view === 'day' && (
            <div className='flex-1 flex flex-col overflow-hidden bg-white p-4'>
              {renderDayView()}
            </div>
          )}
        </div>
      </div>

      <DeploymentDetailsModal
        isOpen={isDeploymentDetailsModalOpen}
        onClose={() => setIsDeploymentDetailsModalOpen(false)}
        deployment={selectedDeployment}
        drivers={allDrivers}
        trucks={allTrucks}
        openReplacementModal={() => setIsReplacementModalOpen(true)}
        openReplacementHistory={() => setShowReplacementHistory(true)}
        updatable={false}
      />

      <ReplacementHistoryModal
        isOpen={showReplacementHistory}
        onClose={() => setShowReplacementHistory(false)}
        deployment={selectedDeployment}
      />
    </>
  )
}

export default CalendarPage
