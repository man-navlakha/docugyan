import TopNavbar from '@/components/navigation/TopNavbar';

export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0c]">
      <TopNavbar />
      <main className="flex-1 w-full relative">
        {children}
      </main>
    </div>
  );
}