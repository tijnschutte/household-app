import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/app/ui/dashboard/app-sidebar"
 
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    // <SidebarProvider>
        <div className="">
          {/* <AppSidebar /> */}
          {/* <main className="flex-1 p-4"> */}
              {/* <SidebarTrigger /> */}
              {children}
          {/* </main> */}
        </div>
    // </SidebarProvider>
  );
}