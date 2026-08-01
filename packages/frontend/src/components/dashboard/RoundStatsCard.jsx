export default function RoundStatsCard({ ticketsSold, entryFee, rollover }) {
  const rows = [
    { label: 'Tickets Sold', value: ticketsSold },
    { label: 'Entry Fee', value: entryFee },
    { label: 'Rollover', value: rollover },
  ]

  return (
    <div className="bg-[#1a1a1a] rounded-2xl p-4">
      <span className="text-white font-bold block mb-3">This round</span>
      <div className="flex flex-col gap-2">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex justify-between">
            <span className="text-gray-400 text-sm">{label}</span>
            <span className="text-white text-sm font-medium">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
