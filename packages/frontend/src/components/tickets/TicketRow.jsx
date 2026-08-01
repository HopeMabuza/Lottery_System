const BALL_COLORS = [
  'bg-[#e040a0]',
  'bg-[#7c3aed]',
  'bg-[#26a69a]',
  'bg-[#22c55e]',
  'bg-[#1565c0]',
  'bg-[#d97706]',
  'bg-[#e53935]',
]

const STATUS_STYLES = {
  'Pending Withdrawal': 'text-[#c8f53a] font-semibold',
  'Claimed':            'text-[#c8f53a] font-semibold',
  'No Reward':          'text-gray-500',
}

function Ball({ number, colorIndex }) {
  const bg = colorIndex !== null ? BALL_COLORS[colorIndex % BALL_COLORS.length] : 'bg-[#2a2a2a]'
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${bg}`}>
      {number}
    </div>
  )
}

export default function TicketRow({ round, myNumbers, winningNumbers, matches, tier, reward, status }) {
  const winSet = new Set(winningNumbers)
  let colorIdx = 0

  const myBalls = myNumbers.map(n => ({
    number: n,
    colorIndex: winSet.has(n) ? colorIdx++ : null,
  }))

  return (
    <tr className="border-t border-gray-800">
      <td className="py-4 text-white font-bold">#{round}</td>

      <td className="py-4">
        <div className="flex gap-1">
          {myBalls.map((b, i) => <Ball key={i} number={b.number} colorIndex={b.colorIndex} />)}
        </div>
      </td>

      <td className="py-4">
        <div className="flex gap-1">
          {winningNumbers.map((n, i) => (
            <div key={i} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 font-bold text-xs bg-[#2a2a2a]">
              {n}
            </div>
          ))}
        </div>
      </td>

      <td className="py-4 text-white">{matches}</td>
      <td className="py-4 text-gray-400">{tier}</td>
      <td className="py-4">
        {reward ? <span className="text-[#c8f53a] font-semibold">{reward}</span> : <span className="text-gray-500">—</span>}
      </td>
      <td className={`py-4 ${STATUS_STYLES[status] ?? 'text-gray-400'}`}>{status}</td>
    </tr>
  )
}
