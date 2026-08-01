export default function DrawInProgressCard() {
  return (
    <div className="bg-[#1a1a1a] rounded-2xl flex flex-col items-center justify-center h-full min-h-[340px] gap-5 p-10">
      <div className="w-12 h-12 rounded-full border-4 border-[#2a2a2a] border-t-[#c8f53a] animate-spin" />
      <p className="text-white font-bold text-lg animate-pulse">
        Picking the winning numbers…
      </p>
      <p className="text-gray-400 text-sm text-center max-w-xs">
        The draw is running now. This usually takes a minute — hang tight.
      </p>
    </div>
  )
}
