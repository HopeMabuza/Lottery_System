const balls = [
  { number: 7,  bg: 'bg-[#e040a0]' },
  { number: 14, bg: 'bg-[#3a3a3a]' },
  { number: 22, bg: 'bg-[#26a69a]' },
  { number: 29, bg: 'bg-[#3a3a3a]' },
  { number: 33, bg: 'bg-[#1565c0]' },
  { number: 41, bg: 'bg-[#3a3a3a]' },
  { number: 47, bg: 'bg-[#3a3a3a]' },
]

export default function LastDrawCard() {
  return (
    <div className="bg-[#1a1a1a] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-white font-bold">Last Draw • #41</span>
        <span className="text-[#c8f53a] text-sm">3 matched — you won!</span>
      </div>
      <div className="flex gap-2">
        {balls.map(({ number, bg }) => (
          <div
            key={number}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${bg}`}
          >
            {number}
          </div>
        ))}
      </div>
    </div>
  )
}
