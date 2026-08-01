import RoundHeader from '../components/dashboard/RoundHeader'
import NumberPicker from '../components/dashboard/NumberPicker'
import DrawInProgressCard from '../components/dashboard/DrawInProgressCard'
import WaitingCard from '../components/dashboard/WaitingCard'
import TicketSubmittedCard from '../components/dashboard/TicketSubmittedCard'
import PausedCard from '../components/dashboard/PausedCard'
import DrawResultWonCard from '../components/dashboard/DrawResultWonCard'
import DrawResultLostCard from '../components/dashboard/DrawResultLostCard'
import RewardBanner from '../components/dashboard/RewardBanner'
import LastDrawCard from '../components/dashboard/LastDrawCard'
import RoundStatsCard from '../components/dashboard/RoundStatsCard'
import PrizeTiersSidebar from '../components/dashboard/PrizeTiersSidebar'

// TODO: replace with real contract data
const MOCK = {
  status: 'OPEN', // 'OPEN' | 'DRAW_IN_PROGRESS' | 'WAITING' | 'TICKET_SUBMITTED'
  roundNumber: 42,
  prizePool: '$1284',
  timeLeft: '05:18',
  reward: '$68.4',
  ticketsSold: 128,
  entryFee: '$5',
  rollover: '$320',
  submittedTicket: [3, 12, 19, 24, 31, 38, 44], // TODO: from contract
  yourTicket: [7, 14, 22, 29, 33, 9, 12],       // TODO: from contract
  winningNumbers: [7, 14, 22, 29, 33, 41, 47],  // TODO: from contract
  wonAmount: '$68.4',                            // TODO: from contract
}

export default function DashboardPage() {
  const { status, roundNumber, prizePool, timeLeft, reward } = MOCK
  const isDrawing = status === 'DRAW_IN_PROGRESS'
  const isWaiting = status === 'WAITING'
  const isSubmitted = status === 'TICKET_SUBMITTED'
  const isPaused = status === 'PAUSED'
  const isWon = status === 'DRAW_COMPLETE_WON'
  const isLost = status === 'DRAW_COMPLETE_LOST'
  const hasReward = isDrawing || isWaiting || isSubmitted || isPaused // TODO: derive from contract

  return (
    <div className="text-white">
      <div className="max-w-[1200px] mx-auto px-8 py-10">
        <RoundHeader
          roundNumber={roundNumber}
          prizePool={prizePool}
          timeLeft={timeLeft}
          status={status}
        />

        <div className="mt-6">
          {hasReward && (
            <RewardBanner amount={reward} onWithdraw={() => {}} />
          )}

          <div className="flex gap-6 items-stretch">
            <div className="flex-1 min-w-0">
              {isDrawing ? <DrawInProgressCard />
                : isWaiting ? <WaitingCard />
                : isSubmitted ? <TicketSubmittedCard numbers={MOCK.submittedTicket} />
                : isPaused ? <PausedCard />
                : isWon ? <DrawResultWonCard
                    roundNumber={MOCK.roundNumber - 1}
                    yourTicket={MOCK.yourTicket}
                    winningNumbers={MOCK.winningNumbers}
                    wonAmount={MOCK.wonAmount}
                    onWithdraw={() => {}}
                    onContinue={() => {}}
                  />
                : isLost ? <DrawResultLostCard
                    roundNumber={MOCK.roundNumber - 1}
                    yourTicket={[2, 5, 19, 21, 40, 44, 46]}
                    winningNumbers={MOCK.winningNumbers}
                    onContinue={() => {}}
                  />
                : <NumberPicker />}
            </div>
            <div className="w-[360px] shrink-0 flex flex-col gap-4">
              <LastDrawCard />
              <RoundStatsCard
                ticketsSold={MOCK.ticketsSold}
                entryFee={MOCK.entryFee}
                rollover={MOCK.rollover}
              />
              <PrizeTiersSidebar />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
