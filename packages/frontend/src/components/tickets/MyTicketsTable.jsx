import TicketRow from './TicketRow'

// TODO: replace with contract/API data (tickets belonging to connected wallet)
const MOCK_TICKETS = [
  {
    round: 41,
    myNumbers:      [7, 14, 22, 29, 33, 9, 12],
    winningNumbers: [7, 14, 22, 29, 33, 41, 47],
    matches: 5,
    tier:    '5 matches',
    reward:  '$238.00',
    status:  'Pending Withdrawal',
  },
  {
    round: 40,
    myNumbers:      [2, 9, 18, 5, 31, 3, 45],
    winningNumbers: [2, 9, 18, 27, 31, 39, 45],
    matches: 4,
    tier:    '4 matches',
    reward:  '$147.00',
    status:  'Claimed',
  },
  {
    round: 39,
    myNumbers:      [4, 11, 6, 24, 30, 38, 1],
    winningNumbers: [4, 11, 19, 24, 30, 38, 49],
    matches: 1,
    tier:    'No win',
    reward:  null,
    status:  'No Reward',
  },
]

export default function MyTicketsTable() {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <th className="text-left text-gray-500 font-medium pb-3">Round</th>
          <th className="text-left text-gray-500 font-medium pb-3">My numbers</th>
          <th className="text-left text-gray-500 font-medium pb-3">Winning numbers</th>
          <th className="text-left text-gray-500 font-medium pb-3">Matches</th>
          <th className="text-left text-gray-500 font-medium pb-3">Tier</th>
          <th className="text-left text-gray-500 font-medium pb-3">Reward</th>
          <th className="text-left text-gray-500 font-medium pb-3">Status</th>
        </tr>
      </thead>
      <tbody>
        {MOCK_TICKETS.map(ticket => (
          <TicketRow key={ticket.round} {...ticket} />
        ))}
      </tbody>
    </table>
  )
}
