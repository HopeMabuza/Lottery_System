export default function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null;

  return (
    <div>
      {/* Modal */}
      {children}
    </div>
  );
}
