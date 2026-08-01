export default function LotteryBall({ number, color, className = '' }) {
  return (
    <div
      className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl ${color} ${className}`}
    >
      {number}
    </div>
  )
}
