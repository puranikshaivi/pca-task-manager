import { useState, useEffect } from 'react';
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle, Clock, AlertTriangle, ListTodo } from 'lucide-react';
import { TaskList } from '@/components/Tasks/TaskList';

interface EmployeeStats {
  totalTasks: number;
  pendingTasks: number;
  completedTasks: number;
  urgentTasks: number;
}

interface FilterConfig {
  type: 'priority' | 'status';
  value: string;
}

interface EmployeeDashboardProps {
  filter?: FilterConfig | null;
}

export const EmployeeDashboard = ({ filter }: EmployeeDashboardProps) => {
  const [stats, setStats] = useState<EmployeeStats>({
    totalTasks: 0,
    pendingTasks: 0,
    completedTasks: 0,
    urgentTasks: 0
  });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchEmployeeStats();
    }
  }, [user]);

  const fetchEmployeeStats = async () => {
    if (!user) return;

    try {
      // Get tasks assigned to user + parent tasks if assigned to subtasks
      const { data: assignedTasks, error: assignedError } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', user.id);

      if (assignedError) throw assignedError;

      const assigned = assignedTasks || [];
      const parentTaskIds = assigned
        .filter(task => task.parent_task_id)
        .map(task => task.parent_task_id);

      // Get all subtasks for tasks where user is assigned to parent
      const { data: userParentTasks, error: userParentError } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', user.id)
        .is('parent_task_id', null);

      if (userParentError) throw userParentError;

      const userParentTaskIds = (userParentTasks || []).map(task => task.id);
      
      let allSubtasks = [];
      if (userParentTaskIds.length > 0) {
        const { data: subtasks, error: subtaskError } = await supabase
          .from('tasks')
          .select('*')
          .in('parent_task_id', userParentTaskIds);

        if (subtaskError) throw subtaskError;
        allSubtasks = subtasks || [];
      }

      let parentTasks = [];
      if (parentTaskIds.length > 0) {
        const { data: parents, error: parentError } = await supabase
          .from('tasks')
          .select('*')
          .in('id', parentTaskIds);

        if (parentError) throw parentError;
        parentTasks = parents || [];
      }

      // Combine all tasks, remove duplicates
      const taskIds = new Set();
      const allTasks = [...assigned, ...parentTasks, ...allSubtasks].filter(task => {
        if (taskIds.has(task.id)) return false;
        taskIds.add(task.id);
        return true;
      });

      const totalTasks = allTasks.length;
      const pendingTasks = allTasks.filter(t => t.status !== 'done').length;
      const completedTasks = allTasks.filter(t => t.status === 'done').length;
      const urgentTasks = allTasks.filter(t => t.priority === 'urgent').length;

      setStats({
        totalTasks,
        pendingTasks,
        completedTasks,
        urgentTasks
      });
    } catch (error) {
      console.error('Error fetching employee stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'My Tasks',
      value: stats.totalTasks,
      icon: ListTodo,
      color: 'text-blue-600'
    },
    {
      title: 'Pending',
      value: stats.pendingTasks,
      icon: Clock,
      color: 'text-yellow-600'
    },
    {
      title: 'Completed',
      value: stats.completedTasks,
      icon: CheckCircle,
      color: 'text-green-600'
    },
    {
      title: 'Urgent',
      value: stats.urgentTasks,
      icon: AlertTriangle,
      color: 'text-red-600'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">My Dashboard</h2>
        <p className="text-muted-foreground">
          View and manage your assigned tasks
        </p>
      </div>


      {/* My Tasks */}
      <Card>
        <CardHeader>
          <CardTitle>My Tasks</CardTitle>
          <CardDescription>
            Tasks assigned to you
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TaskList isAdmin={false} onTaskUpdate={fetchEmployeeStats} filter={filter} />
        </CardContent>
      </Card>
    </div>
  );
};