import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Users, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { CreateTaskDialog } from '@/components/Tasks/CreateTaskDialog';
import { TaskList } from '@/components/Tasks/TaskList';

interface DashboardStats {
  totalTasks: number;
  pendingTasks: number;
  completedTasks: number;
  urgentTasks: number;
  totalEmployees: number;
}

interface FilterConfig {
  type: 'priority' | 'status';
  value: string;
}

interface AdminDashboardProps {
  filter?: FilterConfig | null;
}

export const AdminDashboard = ({ filter }: AdminDashboardProps) => {
  const [stats, setStats] = useState<DashboardStats>({
    totalTasks: 0,
    pendingTasks: 0,
    completedTasks: 0,
    urgentTasks: 0,
    totalEmployees: 0
  });
  const [loading, setLoading] = useState(true);
  const [showCreateTask, setShowCreateTask] = useState(false);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      // Fetch task statistics
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('status, priority');

      if (tasksError) throw tasksError;

      // Fetch employee count
      const { data: employees, error: employeesError } = await supabase
        .from('user_roles')
        .select('id')
        .eq('role', 'employee');

      if (employeesError) throw employeesError;

      const totalTasks = tasks?.length || 0;
      const pendingTasks = tasks?.filter(t => t.status !== 'done').length || 0;
      const completedTasks = tasks?.filter(t => t.status === 'done').length || 0;
      const urgentTasks = tasks?.filter(t => t.priority === 'urgent').length || 0;
      const totalEmployees = employees?.length || 0;

      setStats({
        totalTasks,
        pendingTasks,
        completedTasks,
        urgentTasks,
        totalEmployees
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Tasks',
      value: stats.totalTasks,
      icon: CheckCircle,
      color: 'text-blue-600'
    },
    {
      title: 'Pending Tasks',
      value: stats.pendingTasks,
      icon: Clock,
      color: 'text-yellow-600'
    },
    {
      title: 'Completed Tasks',
      value: stats.completedTasks,
      icon: CheckCircle,
      color: 'text-green-600'
    },
    {
      title: 'Urgent Tasks',
      value: stats.urgentTasks,
      icon: AlertTriangle,
      color: 'text-red-600'
    },
    {
      title: 'Total Employees',
      value: stats.totalEmployees,
      icon: Users,
      color: 'text-purple-600'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Admin Dashboard</h2>
          <p className="text-muted-foreground">
            Manage tasks, assign work, and track progress
          </p>
        </div>
        <Button onClick={() => setShowCreateTask(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Task
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {statCards.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? '--' : stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Tasks */}
      <Card>
        <CardHeader>
          <CardTitle>All Tasks</CardTitle>
          <CardDescription>
            Manage and monitor all tasks in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TaskList isAdmin={true} onTaskUpdate={fetchDashboardStats} filter={filter} />
        </CardContent>
      </Card>

      {/* Create Task Dialog */}
      <CreateTaskDialog 
        open={showCreateTask} 
        onOpenChange={setShowCreateTask}
        onTaskCreated={fetchDashboardStats}
      />
    </div>
  );
};