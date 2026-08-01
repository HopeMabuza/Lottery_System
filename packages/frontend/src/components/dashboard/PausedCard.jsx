export default function PausedCard() {
  return (
    <div className="bg-[#2a1f08] border border-[#5a3a08] rounded-2xl flex flex-col items-center justify-center h-full min-h-[340px] gap-3 p-10">
      <p className="text-[#f59e0b] font-bold text-xl">Game Paused</p>
      <p className="text-gray-400 text-sm text-center max-w-sm">
        Ticket sales are temporarily paused. Withdrawals still work as normal.
      </p>
    </div>
  )
}
