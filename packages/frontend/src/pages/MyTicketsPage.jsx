import MyTicketsTable from '../components/tickets/MyTicketsTable'

export default function MyTicketsPage() {
  return (
    <div className="text-white">
      <div className="max-w-[1200px] mx-auto px-8 py-10">
        <h1 className="text-3xl font-bold mb-8">My Tickets</h1>
        <MyTicketsTable />
      </div>
    </div>
  )
}
