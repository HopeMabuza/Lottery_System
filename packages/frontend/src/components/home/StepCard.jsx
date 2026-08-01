export default function StepCard({ number, title, description }) {
  return (
    <div className="bg-[#1c1c1c] rounded-2xl p-6 flex flex-col gap-4">
      <span className="inline-flex items-center justify-center w-8 h-8 bg-[#c8f53a] rounded-lg font-bold text-black text-sm">
        {number}
      </span>
      <h3 className="font-bold text-white text-lg">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
    </div>
  )
}
