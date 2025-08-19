import { useState } from 'react';
import { SidebarProvider} from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { CreateTaskDialog } from '@/components/Tasks/CreateTaskDialog';
import { Scale } from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {

  const [createOpen, setCreateOpen] = useState(false);
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        {/* Sidebar - shown for all roles, content adapts */}
        <AppSidebar onCreateTask={() => setCreateOpen(true)} />

        <div className="flex-1">
          {/* Header */}
          <header className="border-b bg-card px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Global sidebar trigger */}
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Scale className="w-4 h-4 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="font-semibold text-lg">PCATask</h1>

                </div>
              </div>
              
            
            </div>
          </header>

          {/* Main Content */}
          <main className="p-6">
            {children}
          </main>
        </div>
      </div>

      {/* Global Create Task dialog (admins only will have entry point) */}
      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onTaskCreated={() => {}}
      />
    </SidebarProvider>
  );
};

export default DashboardLayout;