// import SideNav from '@/app/ui/dashboard/sidenav';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/app/ui/dashboard/app-sidebar"
 
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full p-4">
        <AppSidebar />
        {/* <main className="flex-1 border border-red-500 p-4"> */}
          <SidebarTrigger />
          {children}
        {/* </main> */}
      </div>
    </SidebarProvider>
  );
}