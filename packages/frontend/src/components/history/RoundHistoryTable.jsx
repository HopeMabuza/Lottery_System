import HistoryRow from './HistoryRow'

// TODO: replace with contract/API data
const MOCK_HISTORY = [
  { round: 41, date: 'Jul 30, 2026 18:00', numbers: [7,14,22,29,33,41,47],  pot: '$1,190.00', winners: 3, rollover: '$0.00'   },
  { round: 40, date: 'Jul 29, 2026 18:00', numbers: [2,9,18,27,31,39,45],   pot: '$980.00',   winners: 0, rollover: '$320.00' },
  { round: 39, date: 'Jul 28, 2026 18:00', numbers: [4,11,19,24,30,38,49],  pot: '$1,420.00', winners: 5, rollover: '$0.00'   },
  { round: 38, date: 'Jul 27, 2026 18:00', numbers: [6,13,21,28,35,42,48],  pot: '$760.00',   winners: 1, rollover: '$0.00'   },
  { round: 37, date: 'Jul 26, 2026 18:00', numbers: [1,8,17,25,32,40,46],   pot: '$1,050.00', winners: 2, rollover: '$0.00'   },
]

export default function RoundHistoryTable() {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <th className="text-left text-gray-500 font-medium pb-3">Round</th>
          <th className="text-left text-gray-500 font-medium pb-3">Date</th>
          <th className="text-left text-gray-500 font-medium pb-3">Winning numbers</th>
          <th className="text-left text-gray-500 font-medium pb-3">Pot</th>
          <th className="text-left text-gray-500 font-medium pb-3">Winners</th>
          <th className="text-left text-gray-500 font-medium pb-3">Rollover</th>
        </tr>
      </thead>
      <tbody>
        {MOCK_HISTORY.map(row => (
          <HistoryRow key={row.round} {...row} />
        ))}
      </tbody>
    </table>
  )
}
