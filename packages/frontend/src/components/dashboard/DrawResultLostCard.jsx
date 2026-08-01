const WINNING_BALL_COLORS = [
  'bg-[#e040a0]',
  'bg-[#7c3aed]',
  'bg-[#26a69a]',
  'bg-[#22c55e]',
  'bg-[#1565c0]',
  'bg-[#3a3a3a]',
  'bg-[#3a3a3a]',
]

export default function DrawResultLostCard({ roundNumber, yourTicket = [], winningNumbers = [], onContinue }) {
  return (
    <div className="bg-[#1a1a1a] rounded-2xl p-8 flex flex-col gap-5">
      <div className="text-center">
        <p className="text-white font-bold text-2xl">No win this round</p>
        <p className="text-gray-400 text-sm mt-1">Round #{roundNumber} draw is in.</p>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-gray-500 text-xs font-semibold tracking-widest uppercase text-center">Your Ticket</p>
        <div className="flex justify-center gap-2">
          {yourTicket.map((n, i) => (
            <div key={i} className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm bg-[#3a3a3a]">
              {n}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-gray-500 text-xs font-semibold tracking-widest uppercase text-center">Winning Numbers</p>
        <div className="flex justify-center gap-2">
          {winningNumbers.map((n, i) => (
            <div key={i} className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm ${WINNING_BALL_COLORS[i] ?? 'bg-[#3a3a3a]'}`}>
              {n}
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onContinue}
        className="border border-gray-600 text-white text-sm px-6 py-2.5 rounded-xl hover:bg-white/10 transition self-center"
      >
        Continue to next round
      </button>
    </div>
  )
}
