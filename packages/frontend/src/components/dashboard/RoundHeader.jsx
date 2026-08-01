const STATUS_BADGE = {
  OPEN: (
    <span className="bg-[#c8f53a] text-black text-xs font-bold px-3 py-0.5 rounded-full ml-3">
      OPEN
    </span>
  ),
  DRAW_IN_PROGRESS: (
    <span className="border border-[#c8f53a] text-[#c8f53a] text-xs font-bold px-3 py-0.5 rounded-full ml-3">
      DRAW IN_PROGRESS
    </span>
  ),
  PAUSED: (
    <span className="border border-[#f59e0b] text-[#f59e0b] text-xs font-bold px-3 py-0.5 rounded-full ml-3">
      PAUSED
    </span>
  ),
  WAITING: (
    <span className="border border-gray-500 text-gray-400 text-xs font-bold px-3 py-0.5 rounded-full ml-3">
      WAITING
    </span>
  ),
  CLOSED: (
    <span className="border border-gray-500 text-gray-400 text-xs font-bold px-3 py-0.5 rounded-full ml-3">
      CLOSED
    </span>
  ),
}

export default function RoundHeader({ roundNumber, prizePool, timeLeft, status = 'OPEN' }) {
  const isDrawing = status === 'DRAW_IN_PROGRESS'
  const isWaiting = status === 'WAITING'

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <span className="text-white font-bold text-xl">Round #{roundNumber}</span>
        {STATUS_BADGE[status] ?? STATUS_BADGE.OPEN}
      </div>
      <div className="flex items-center gap-8">
        <div className="flex flex-col items-end">
          <span className="text-gray-400 text-xs">Prize pool</span>
          <span className="text-[#c8f53a] text-2xl font-bold">{prizePool}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-gray-400 text-xs">Time left</span>
          {isDrawing
            ? <span className="text-white text-2xl font-bold">Draw Pending</span>
            : isWaiting
            ? <span className="text-white text-2xl font-bold">—</span>
            : <span className="text-white text-2xl font-bold">{timeLeft}</span>
          }
        </div>
      </div>
    </div>
  )
}
