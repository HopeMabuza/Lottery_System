import MatchTile from '../home/MatchTile'

const tiers = [
  { count: 2, percentage: '5%' },
  { count: 3, percentage: '10%' },
  { count: 4, percentage: '15%' },
  { count: 5, percentage: '20%' },
  { count: 6, percentage: '20%' },
  { count: 7, percentage: '30%' },
]

export default function PrizeTiersSidebar() {
  return (
    <div className="bg-[#1a1a1a] rounded-2xl p-4">
      <span className="text-white font-bold block mb-3">How much you can win</span>
      <div className="grid grid-cols-3 gap-2">
        {tiers.map(({ count, percentage }) => (
          <MatchTile key={count} count={count} percentage={percentage} />
        ))}
      </div>
      <p className="text-gray-500 text-xs mt-3">
        A small platform fee is taken first. Unclaimed prizes roll into the next round.
      </p>
    </div>
  )
}
