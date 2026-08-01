import { useState } from 'react'

export default function NumberPicker() {
  const [selected, setSelected] = useState([])

  function toggle(n) {
    setSelected(prev =>
      prev.includes(n)
        ? prev.filter(x => x !== n)
        : prev.length < 7 ? [...prev, n] : prev
    )
  }

  const allNumbers = Array.from({ length: 49 }, (_, i) => i + 1)
  const slots = Array.from({ length: 7 }, (_, i) => selected[i] ?? null)
  const ready = selected.length === 7

  return (
    <div className="bg-[#1a1a1a] rounded-2xl p-6 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <span className="text-white font-bold">Pick your 7 numbers</span>
        <span className="text-gray-400">({selected.length}/7)</span>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-4">
        {slots.map((val, i) => (
          <div key={i} className="flex justify-center">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border border-dashed border-gray-600 ${val !== null ? 'bg-[#2a2a2a]' : 'bg-[#1c1c1c]'}`}>
              {val !== null && <span className="text-white font-bold text-sm">{val}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5 flex-1 [grid-auto-rows:1fr]">
        {allNumbers.map(n => (
          <button
            key={n}
            onClick={() => toggle(n)}
            className={`w-full py-2 rounded-xl flex items-center justify-center text-sm font-medium cursor-pointer transition
              ${selected.includes(n)
                ? 'bg-[#c8f53a] text-black font-bold'
                : 'bg-[#1c1c1c] text-white hover:bg-[#2a2a2a]'
              }`}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="flex gap-3 mt-auto pt-4">
        <button
          onClick={() => setSelected([])}
          className="bg-[#1c1c1c] text-white px-6 py-3 rounded-xl hover:bg-[#2a2a2a] transition"
        >
          Clear
        </button>
        <button
          disabled={!ready}
          className={`flex-1 py-3 rounded-xl font-bold transition ${ready
            ? 'bg-[#c8f53a] text-black'
            : 'bg-[#2a2a2a] text-gray-500 cursor-not-allowed'
          }`}
        >
          Buy Ticket — $5
        </button>
      </div>
    </div>
  )
}
