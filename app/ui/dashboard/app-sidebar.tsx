import { signOut } from "@/auth";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
  } from "@/components/ui/sidebar"
   
import { Home, PowerIcon, ShoppingBag } from "lucide-react"
    

const items = [
    {
        title: 'Dashboard',
        url: '/dashboard',
        icon: Home,
    },
    {
        title: 'Household',
        url: '/dashboard/household',
        icon: ShoppingBag,
    }

]

export function AppSidebar() {
  return (
    <Sidebar>
        <SidebarContent>
            <SidebarGroup>
            <SidebarGroupLabel>Links</SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>
                {items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                        <a href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                        </a>
                    </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
                </SidebarMenu>
            </SidebarGroupContent>
            </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
        <form
            action={async () => {
                'use server';
            await signOut({ redirectTo: '/' });
            }}
            >
            <button className="flex h-[48px] w-full items-center justify-center gap-2 rounded-md bg-gray-50 p-3 text-sm font-medium hover:bg-sky-100 hover:text-blue-600 md:flex-none md:justify-start md:p-2 md:px-3">
            <PowerIcon className="w-6" />
            <div className="hidden md:block">Sign Out</div>
            </button>
        </form>
        </SidebarFooter>
    </Sidebar>
  )
}