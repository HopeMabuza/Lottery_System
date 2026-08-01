export default function Badge({ children, className = '' }) {
  return (
    <span className={className}>
      {/* Badge */}
      {children}
    </span>
  );
}
