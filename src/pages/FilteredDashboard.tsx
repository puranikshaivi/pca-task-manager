import { useUserRole } from '@/hooks/useUserRole';
import { AdminDashboard } from '@/components/Dashboard/AdminDashboard';
import { EmployeeDashboard } from '@/components/Dashboard/EmployeeDashboard';
import { Loader2 } from 'lucide-react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { useParams } from 'react-router-dom';

type FilterType = 'regularPriority' | 'urgentPriority' | 'assigned' | 'in-progress' | 'completed';

const FilteredDashboard = () => {
  const { role, loading } = useUserRole();
  const { filter } = useParams<{ filter: FilterType }>();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const getFilterConfig = (filter: FilterType) => {
    const priorityMap = {
      'regularPriority': 'regular',
      'urgentPriority': 'urgent'
    };

    const statusMap = {
      'assigned': 'assigned',
      'in-progress': 'in_progress', 
      'completed': 'done'
    };

    if (filter in priorityMap) {
      return { 
        type: 'priority' as const, 
        value: priorityMap[filter as keyof typeof priorityMap] 
      };
    } else if (filter in statusMap) {
      return { 
        type: 'status' as const, 
        value: statusMap[filter as keyof typeof statusMap] 
      };
    }
    return null;
  };

  const filterConfig = filter ? getFilterConfig(filter) : null;

  return (
    <DashboardLayout>
      {role === 'admin' ? (
        <AdminDashboard filter={filterConfig} />
      ) : (
        <EmployeeDashboard filter={filterConfig} />
      )}
    </DashboardLayout>
  );
};

export default FilteredDashboard;