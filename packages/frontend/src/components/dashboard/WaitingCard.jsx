export default function WaitingCard() {
  return (
    <div className="bg-[#1a1a1a] rounded-2xl flex flex-col items-center justify-center h-full min-h-[340px] gap-3 p-10">
      <p className="text-white font-bold text-lg">Next round hasn&apos;t started</p>
      <p className="text-gray-400 text-sm text-center">Ticket sales open shortly. Hang tight.</p>
    </div>
  )
}
