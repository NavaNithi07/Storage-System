import Sidebar from './Sidebar';

export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen w-full bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/30">
      {/* Background ambient effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/10 blur-[120px]" />
      </div>

      <Sidebar />
      
      {/* Main Content Area */}
      <main className="flex-1 w-full overflow-x-hidden overflow-y-auto relative z-10 pb-24 md:pb-8">
        <div className="w-full px-4 sm:px-6 md:px-8 py-6 md:py-8 max-w-7xl mx-auto min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
