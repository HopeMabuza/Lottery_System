const BALL_COLORS = [
  'bg-[#e040a0]',
  'bg-[#7c3aed]',
  'bg-[#26a69a]',
  'bg-[#22c55e]',
  'bg-[#1565c0]',
  'bg-[#d97706]',
  'bg-[#e53935]',
]

export default function TicketSubmittedCard({ numbers = [] }) {
  return (
    <div className="bg-[#1a1a1a] rounded-2xl flex flex-col items-center justify-center h-full min-h-[340px] gap-5 p-10">
      <p className="text-[#c8f53a] font-bold text-xl">Ticket Submitted ✓</p>

      <div className="flex gap-3">
        {numbers.map((n, i) => (
          <div
            key={i}
            className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm ${BALL_COLORS[i % BALL_COLORS.length]}`}
          >
            {n}
          </div>
        ))}
      </div>

      <p className="text-gray-400 text-sm text-center">
        You&apos;re in this round. Check back after the draw.
      </p>
    </div>
  )
}
