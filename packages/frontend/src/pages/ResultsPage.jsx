import RoundHistoryTable from '../components/history/RoundHistoryTable'

export default function ResultsPage() {
  return (
    <div className="text-white">
      <div className="max-w-[1200px] mx-auto px-8 py-10">
        <h1 className="text-3xl font-bold mb-8">Round History</h1>
        <RoundHistoryTable />
      </div>
    </div>
  )
}
