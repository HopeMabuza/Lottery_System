const BALL_COLORS = [
  'bg-[#e040a0]',
  'bg-[#7c3aed]',
  'bg-[#26a69a]',
  'bg-[#22c55e]',
  'bg-[#1565c0]',
  'bg-[#d97706]',
  'bg-[#e53935]',
]

export default function HistoryRow({ round, date, numbers, pot, winners, rollover }) {
  return (
    <tr className="border-t border-gray-800">
      <td className="py-4 text-white font-bold">#{round}</td>
      <td className="py-4 text-gray-400">{date}</td>
      <td className="py-4">
        <div className="flex gap-1.5">
          {numbers.map((n, i) => (
            <div
              key={i}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs ${BALL_COLORS[i]}`}
            >
              {n}
            </div>
          ))}
        </div>
      </td>
      <td className="py-4 text-white">{pot}</td>
      <td className="py-4 text-white">{winners}</td>
      <td className="py-4 text-white">{rollover}</td>
    </tr>
  )
}
