import React from 'react'
import { useUserContext } from '../../contexts/UserContext'

function MyProfile () {
  const { userData } = useUserContext()

  console.log(userData.data)

  return (
    <div>
      <h1 className='font-semibold text-2xl mr-auto'>My Profile</h1>

      <div></div>
    </div>
  )
}

export default MyProfile
