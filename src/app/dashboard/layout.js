import Sidebar from '@/components/sidebar/Sidebar';
import TopNavbar from '@/components/navigation/TopNavbar';

export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen">
      <TopNavbar />
      <div className="flex">
        <Sidebar />
        <main className="glass-panel min-h-[calc(100vh-7.5rem)] flex-1 p-5 md:p-7">{children}</main>
      </div>
    </div>
  );
}

