export default function MatchTile({ count, percentage }) {
  return (
    <div className="bg-[#1e1e1e] rounded-xl px-6 py-5 flex flex-col items-center gap-1 min-w-[80px]">
      <span className="text-3xl font-bold text-white">{count}</span>
      <span className="text-xs text-gray-500">matches</span>
      <span className="text-base font-bold text-[#c8f53a]">{percentage}</span>
    </div>
  )
}
