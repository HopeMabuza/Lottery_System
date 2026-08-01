export default function RewardBanner({ amount, onWithdraw }) {
  return (
    <div className="flex items-center justify-between bg-[#1a2e08] border border-[#3a5a10] rounded-2xl px-6 py-4 mb-4">
      <div>
        <p className="text-[#c8f53a] text-xs font-semibold tracking-widest uppercase mb-1">
          You have a reward waiting
        </p>
        <p className="text-[#c8f53a] text-3xl font-bold">{amount}</p>
      </div>
      <button
        onClick={onWithdraw}
        className="bg-[#c8f53a] text-black font-bold px-6 py-3 rounded-xl hover:brightness-110 transition"
      >
        Withdraw
      </button>
    </div>
  )
}
