import StepCard from './StepCard'

const steps = [
  {
    number: 1,
    title: 'Pick your numbers',
    description: 'Choose 7 numbers from 1–49 in the order you want them.',
  },
  {
    number: 2,
    title: 'Buy a ticket',
    description: 'A ticket costs a few dollars in USDC and goes straight into the pot.',
  },
  {
    number: 3,
    title: 'Match the draw',
    description: 'Match numbers in order to win a share of the pot — paid out instantly.',
  },
]

export default function HowToPlaySection() {
  return (
    <section className="px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {steps.map((step) => (
          <StepCard key={step.number} {...step} />
        ))}
      </div>
    </section>
  )
}
