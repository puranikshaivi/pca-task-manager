import { useUserRole } from '@/hooks/useUserRole';
import { AdminDashboard } from '@/components/Dashboard/AdminDashboard';
import { EmployeeDashboard } from '@/components/Dashboard/EmployeeDashboard';
import { Loader2 } from 'lucide-react';
import DashboardLayout from '@/components/Layout/DashboardLayout';

const Dashboard = () => {
  const { role, loading } = useUserRole();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {role === 'admin' ? <AdminDashboard /> : <EmployeeDashboard />}
    </DashboardLayout>
  );
};

export default Dashboard;