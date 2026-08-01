import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { networks } from './chains'

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
})

createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks,
  metadata: {
    name: 'Lucky Seven',
    description: 'A simple, transparent on-chain lottery',
    url: window.location.origin,
    icons: [],
  },
  allowUnsupportedChain: true,
  features: {
    analytics: false,
    email: false,
    socials: false,
  },
})

export const wagmiConfig = wagmiAdapter.wagmiConfig
