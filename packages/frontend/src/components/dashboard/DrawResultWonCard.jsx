const BALL_COLORS = [
  'bg-[#e040a0]',
  'bg-[#7c3aed]',
  'bg-[#26a69a]',
  'bg-[#22c55e]',
  'bg-[#1565c0]',
]

function Ball({ number, matched }) {
  const colorIndex = matched !== -1 ? matched : null
  const bg = colorIndex !== null ? BALL_COLORS[colorIndex % BALL_COLORS.length] : 'bg-[#3a3a3a]'
  return (
    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm ${bg}`}>
      {number}
    </div>
  )
}

export default function DrawResultWonCard({ roundNumber, yourTicket = [], winningNumbers = [], wonAmount, onWithdraw, onContinue }) {
  const matchedSet = new Set(winningNumbers)
  let matchColorIdx = 0

  const ticketBalls = yourTicket.map(n => {
    const isMatch = matchedSet.has(n)
    return { number: n, matched: isMatch ? matchColorIdx++ : -1 }
  })

  matchColorIdx = 0
  const winningBalls = winningNumbers.map(n => {
    const isMatch = yourTicket.includes(n)
    return { number: n, matched: isMatch ? matchColorIdx++ : -1 }
  })

  return (
    <div className="bg-[#1a1a1a] rounded-2xl p-8 flex flex-col gap-5">
      <div className="text-center">
        <p className="text-[#c8f53a] font-bold text-2xl">You won! 🎉</p>
        <p className="text-gray-400 text-sm mt-1">Round #{roundNumber} draw is in.</p>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-gray-500 text-xs font-semibold tracking-widest uppercase text-center">Your Ticket</p>
        <div className="flex justify-center gap-2">
          {ticketBalls.map((b, i) => <Ball key={i} number={b.number} matched={b.matched} />)}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-gray-500 text-xs font-semibold tracking-widest uppercase text-center">Winning Numbers</p>
        <div className="flex justify-center gap-2">
          {winningBalls.map((b, i) => <Ball key={i} number={b.number} matched={b.matched} />)}
        </div>
      </div>

      <div className="flex items-center justify-between bg-[#1a2e08] border border-[#3a5a10] rounded-xl px-5 py-4">
        <div>
          <p className="text-[#c8f53a] text-xs font-semibold tracking-widest uppercase mb-1">You Won</p>
          <p className="text-[#c8f53a] text-2xl font-bold">{wonAmount}</p>
        </div>
        <button
          onClick={onWithdraw}
          className="bg-[#c8f53a] text-black font-bold px-6 py-2.5 rounded-xl hover:brightness-110 transition"
        >
          Withdraw
        </button>
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
