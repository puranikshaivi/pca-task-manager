import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Plus, LayoutList, User, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";

interface AppSidebarProps {
  onCreateTask?: () => void;
}

export function AppSidebar({ onCreateTask }: AppSidebarProps) {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const { user, signOut } = useAuth();
  const { role } = useUserRole();
  const { toast } = useToast();

  const items = [
    { title: "My Tasks", url: "/dashboard", icon: LayoutList },
  ];

  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-muted text-primary font-medium" : "hover:bg-muted/50";

  const userInitials =
    user?.user_metadata?.name?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase() || user?.email?.substring(0, 2).toUpperCase() || "U";

  const isCollapsed = state === "collapsed";

    const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive"
      });
    }
  };

  return (
    <Sidebar
      collapsible="icon"
    >
      <div className="flex items-center gap-2 p-3 border-b">
        <Avatar className="h-8 w-8">
          <AvatarFallback>
            {userInitials}
          </AvatarFallback>
        </Avatar>
        {!isCollapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-medium line-clamp-1">
              {user?.user_metadata?.name || "User"}
            </span>
            <span className="text-xs text-muted-foreground capitalize">
              {role || "member"}
            </span>
          </div>
        )}
      </div>

      <SidebarContent>
        {/* Navigation Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                    <SidebarGroupContent>
              <SidebarMenuButton asChild>
                <NavLink to="/dashboard" className={getNavCls}>
                  <span>All Tasks</span>
                </NavLink>
              </SidebarMenuButton>
          </SidebarGroupContent>
           <SidebarGroupContent>
              <SidebarMenuButton asChild>
                <NavLink to="/dashboard/regularPriority" className={getNavCls}>
                  <span>Regular Priority</span>
                </NavLink>
              </SidebarMenuButton>
          </SidebarGroupContent>
                    <SidebarGroupContent>
              <SidebarMenuButton asChild>
                <NavLink to="/dashboard/urgentPriority" className={getNavCls}>
                  <span>Urgent Priority</span>
                </NavLink>
              </SidebarMenuButton>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Task Status</SidebarGroupLabel>
          <SidebarGroupContent>
              <SidebarMenuButton asChild>
                <NavLink to="/dashboard/assigned" className={getNavCls}>
                  <span>Assigned</span>
                </NavLink>
              </SidebarMenuButton>
          </SidebarGroupContent>
                    <SidebarGroupContent>
              <SidebarMenuButton asChild>
                <NavLink to="/dashboard/in-progress" className={getNavCls}>
                  <span>In Progress</span>
                </NavLink>
              </SidebarMenuButton>
          </SidebarGroupContent>
                    <SidebarGroupContent>
              <SidebarMenuButton asChild>
                <NavLink to="/dashboard/completed" className={getNavCls}>
                  <span>Completed</span>
                </NavLink>
              </SidebarMenuButton>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Actions */}
        {role === "admin" && (
          <SidebarGroup>
            <SidebarGroupLabel>Actions</SidebarGroupLabel>
            <SidebarGroupContent>
              <Button className="w-full justify-start" onClick={onCreateTask}>
                <Plus className="mr-2 h-4 w-4" />
                {!isCollapsed && <span>Create Task</span>}
              </Button>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <Button onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
            </Button>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}