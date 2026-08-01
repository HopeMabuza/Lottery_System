import Navbar from './Navbar';
import Footer from './Footer';

export default function Layout({ children }) {
  return (
    <div>
      {/* Layout */}
      <Navbar />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
