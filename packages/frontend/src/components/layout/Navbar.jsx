import { useNavigate, useLocation } from 'react-router-dom'
import { useAccount, useDisconnect } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'

export default function Navbar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { open } = useAppKit()

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : ''

  const navBtn = (label, path) => {
    const active = pathname === path
    return (
      <button
        onClick={() => navigate(path)}
        className={active
          ? 'bg-[#c8f53a] text-black font-medium px-4 py-1.5 rounded-full text-sm'
          : 'text-white text-sm hover:text-gray-300 transition'
        }
      >
        {label}
      </button>
    )
  }

  return (
    <nav className="flex items-center justify-between px-6 py-4 bg-[#0a0a0a]">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
        <div className="w-9 h-9 bg-[#c8f53a] rounded-lg flex items-center justify-center">
          <span className="text-black font-bold text-lg">7</span>
        </div>
        <span className="text-white font-bold text-lg">Lucky Seven</span>
      </div>

      <div className="flex items-center gap-6">
        {navBtn('Live Round', '/dashboard')}
        {navBtn('History', '/results')}
        {navBtn('My Tickets', '/my-tickets')}
      </div>

      <div className="flex items-center gap-3">
        {isConnected ? (
          <>
            <span className="bg-[#1c1c1c] text-white rounded-lg px-3 py-1.5 text-sm">{shortAddress}</span>
            <button
              onClick={() => disconnect()}
              className="border border-white text-white rounded-lg px-3 py-1.5 text-sm hover:bg-white/10 transition"
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            onClick={() => open()}
            className="bg-[#c8f53a] text-black font-bold px-5 py-2 rounded-lg hover:brightness-110 transition"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </nav>
  )
}
