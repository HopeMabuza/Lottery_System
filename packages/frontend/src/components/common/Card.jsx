export default function Card({ children, className = '' }) {
  return (
    <div className={className}>
      {/* Card */}
      {children}
    </div>
  );
}
