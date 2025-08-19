import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, User, Plus, ExternalLink, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CreateTaskDialog } from './CreateTaskDialog';
import { useNavigate } from 'react-router-dom';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'assigned' | 'in_progress' | 'done';
  priority: 'regular' | 'urgent';
  deadline: string | null;
  created_at: string;
  created_by: string;
  assigned_to: string | null;
  parent_task_id: string | null;
  modified_by?: string | null;
  modified_at?: string | null;
  creator_profile?: {
    name: string;
    email: string;
  };
  assigned_profile?: {
    name: string;
    email: string;
  };
  modifier_profile?: {
    name: string;
    email: string;
  };
}

interface FilterConfig {
  type: 'priority' | 'status';
  value: string;
}

type PriorityValue = 'regular' | 'urgent';
type StatusValue = 'assigned' | 'in_progress' | 'done';

interface TaskListProps {
isAdmin: boolean;
onTaskUpdate?: () => void;
filter?: FilterConfig | null;
}

export const TaskList = ({ isAdmin, onTaskUpdate, filter }: TaskListProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSubtaskDialog, setShowSubtaskDialog] = useState(false);
  const [parentTaskId, setParentTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [profiles, setProfiles] = useState<Array<{user_id: string, name: string, email: string}>>([]);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    priority: '',
    deadline: '',
    assigned_to: ''
  });
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
      fetchTasks();
    fetchProfiles();
  }, [user, isAdmin, filter]);

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, name, email');

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  };

  const fetchTasks = async () => {
    if (!user) return;

    try {
      let allTasks = [];
      
      if (isAdmin) {
        // Admin sees all tasks
        let query = supabase
          .from('tasks')
          .select('*');

        // Apply filters if provided
        if (filter) {
          if (filter.type === 'priority') {
            query = query.eq('priority', filter.value as PriorityValue);
          } else if (filter.type === 'status') {
            query = query.eq('status', filter.value as StatusValue);
          }
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;
        allTasks = data || [];
      } else {
        // Employee: show all threads for any task they're assigned to (parent or subtask)
        const { data: assignedTasks, error: assignedError } = await supabase
          .from('tasks')
          .select('*')
          .eq('assigned_to', user.id);

        if (assignedError) throw assignedError;
        const assigned = assignedTasks || [];
        //console.log('Directly assigned tasks:', assigned);

        // Collect all relevant parent IDs
        const parentIds = new Set<string>();
        assigned.forEach(task => {
          if (task.parent_task_id) {
            parentIds.add(task.parent_task_id); // subtask: add parent
          } else {
            parentIds.add(task.id); // parent: add self
          }
        });
        //console.log('Parent task IDs to fetch:', Array.from(parentIds));

        // Fetch all parent tasks (these are main tasks)
        const { data: parentTasks, error: parentError } = await supabase
          .from('tasks')
          .select('*')
          .in('id', Array.from(parentIds));

        if (parentError) throw parentError;
        //console.log('Fetched parent tasks:', parentTasks);

        // Fetch all subtasks for these parents
        const { data: allSubtasks, error: subtaskError } = await supabase
          .from('tasks')
          .select('*')
          .in('parent_task_id', Array.from(parentIds));

        if (subtaskError) throw subtaskError;
        //console.log('Fetched all subtasks for parents:', allSubtasks);

        // Combine all tasks (parents + subtasks)
        const allTasksMap = new Map<string, Task>();
        (parentTasks || []).forEach(task => allTasksMap.set(task.id, task));
        (allSubtasks || []).forEach(task => allTasksMap.set(task.id, task));

        // Also include directly assigned tasks (in case they're not covered above)
        assigned.forEach(task => allTasksMap.set(task.id, task));

        allTasks = Array.from(allTasksMap.values());
        //console.log('Final tasks for employee:', allTasks);

        // Sort by creation date
        allTasks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
      
      // Fetch profile data separately
      const userIds = [...new Set([
        ...allTasks.map(t => t.created_by),
        ...allTasks.map(t => t.assigned_to).filter(Boolean),
        ...allTasks.map(t => t.modified_by).filter(Boolean)
      ])];
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', userIds);
      
      // Apply client-side filtering for employees (since their query is complex)
      if (!isAdmin && filter) {
        if (filter.type === 'priority') {
          allTasks = allTasks.filter(task => task.priority === filter.value);
        } else if (filter.type === 'status') {
          allTasks = allTasks.filter(task => task.status === filter.value);
        }
      }

      // Combine tasks with profile data
      const tasksWithProfiles = allTasks.map(task => ({
        ...task,
        creator_profile: profiles?.find(p => p.user_id === task.created_by),
        assigned_profile: profiles?.find(p => p.user_id === task.assigned_to),
        modifier_profile: profiles?.find(p => p.user_id === task.modified_by)
      }));
      
      setTasks(tasksWithProfiles as any);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: 'assigned' | 'in_progress' | 'done') => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) throw error;
      
      fetchTasks();
      onTaskUpdate?.();
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-50 text-red-700 border-red-200';
      //case 'regular': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'regular': return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'bg-green-50 text-green-700 border-green-200';
      case 'in_progress': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'assigned': return 'bg-gray-50 text-gray-700 border-gray-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const createSubtask = (parentId: string) => {
    setParentTaskId(parentId);
    setShowSubtaskDialog(true);
  };

  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      
      toast.success('Task deleted successfully');
      fetchTasks();
      onTaskUpdate?.();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
    }
  };

  const editTask = (task: Task) => {
    setEditingTask(task);
    setEditForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      deadline: task.deadline ? format(new Date(task.deadline), 'yyyy-MM-dd') : '',
      assigned_to: task.assigned_to || 'unassigned'
    });
    setShowEditDialog(true);
  };

  const updateTask = async () => {
    if (!editingTask) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: editForm.title,
          description: editForm.description || null,
          priority: editForm.priority as 'regular' | 'urgent',
          deadline: editForm.deadline ? new Date(editForm.deadline).toISOString() : null,
          assigned_to: editForm.assigned_to === 'unassigned' ? null : editForm.assigned_to
        })
        .eq('id', editingTask.id);

      if (error) throw error;
      
      toast.success('Task updated successfully');
      setShowEditDialog(false);
      setEditingTask(null);
      fetchTasks();
      onTaskUpdate?.();
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading tasks...</div>;
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No tasks found
      </div>
    );
  }

  const mainTasks = tasks.filter(task => !task.parent_task_id);
  const subtasks = tasks.filter(task => task.parent_task_id);

  //console.log('Main tasks:', mainTasks);
  //console.log('Subtasks:', subtasks);

  return (
    <div className="space-y-6">
      {mainTasks.map((task) => {
        const taskSubtasks = subtasks.filter(subtask => subtask.parent_task_id === task.id);
        
        return (
          <Card key={task.id} className="border-l-4 border-l-primary/50 shadow-sm hover:shadow-md transition-all duration-200">
            <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-transparent">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold">{task.title}</CardTitle>
                    {/* <span className="font-mono text-xs bg-muted px-2 py-1 rounded-md">
                      #{task.id.slice(0, 8)}
                    </span> */}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`border-2 ${getPriorityColor(task.priority)}`}>
                      {task.priority.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className={`border-2 ${getStatusColor(task.status)}`}>
                      {task.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                    {task.deadline && (
                      <div className="flex items-center text-sm text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
                        <Calendar className="w-4 h-4 mr-1" />
                        {format(new Date(task.deadline), 'MMM dd, yyyy')}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => createSubtask(task.id)}
                      className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Subtask
                    </Button>
                  )}
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => editTask(task)}
                      className="text-green-600 border-green-200 hover:bg-green-50"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                  )}
                  {isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete this task and all its subtasks.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteTask(task.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/task/${task.id}`)}
                    className="text-purple-600 border-purple-200 hover:bg-purple-50"
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    View Details
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <User className="w-4 h-4 mr-1" />
                    <span>
                      Created by <span className="font-medium">{task.creator_profile?.name || 'Unknown'}</span> • 
                      Assigned to <span className="font-medium">{task.assigned_profile?.name || 'Unassigned'}</span>
                    </span>
                  </div>
                  {task.modified_at && task.modifier_profile && (
                    <div className="text-xs text-muted-foreground">
                      Modified on {format(new Date(task.modified_at), 'MMM dd, yyyy')} by <span className="font-medium">{task.modifier_profile.name}</span>
                    </div>
                  )}
                </div>
                
                {(isAdmin || task.assigned_to === user?.id) && (
                  <Select
                    value={task.status}
                    onValueChange={(value) => updateTaskStatus(task.id, value as 'assigned' | 'in_progress' | 'done')}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Subtasks */}
              {taskSubtasks.length > 0 && (
                <div className="mt-4 p-4 bg-gradient-to-r from-slate-50 to-gray-50 rounded-lg border-l-4 border-l-slate-300">
                  <h4 className="font-semibold text-sm mb-3 text-slate-700">Subtasks ({taskSubtasks.length}):</h4>
                  <div className="space-y-3">
                    {taskSubtasks.map((subtask) => (
                       <div key={subtask.id} className="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm">
                         <div className="space-y-2 flex-1">
                           <div className="flex items-center justify-between">
                             <p className="font-medium text-sm">{subtask.title}</p>
                             {/* <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                               #{subtask.id.slice(0, 8)}
                             </span> */}
                           </div>
                           <div className="flex items-center gap-2">
                             <Badge variant="outline" className={`text-xs border-2 ${getPriorityColor(subtask.priority)}`}>
                               {subtask.priority.toUpperCase()}
                             </Badge>
                             <Badge variant="outline" className={`text-xs border-2 ${getStatusColor(subtask.status)}`}>
                               {subtask.status.replace('_', ' ').toUpperCase()}
                             </Badge>
                           </div>
                           <p className="text-xs text-muted-foreground">
                             Assigned to: <span className="font-medium">{subtask.assigned_profile?.name || 'Unassigned'}</span>
                           </p>
                           <div className="flex items-center gap-2">
                             {isAdmin && (
                               <>
                                 <Button
                                   variant="outline"
                                   size="sm"
                                   onClick={() => editTask(subtask)}
                                   className="text-xs h-7 text-green-600 border-green-200 hover:bg-green-50"
                                 >
                                   <Edit className="w-3 h-3 mr-1" />
                                   Edit
                                 </Button>
                                 <AlertDialog>
                                   <AlertDialogTrigger asChild>
                                     <Button variant="outline" size="sm" className="text-xs h-7 text-red-600 border-red-200 hover:bg-red-50">
                                       <Trash2 className="w-3 h-3 mr-1" />
                                       Delete
                                     </Button>
                                   </AlertDialogTrigger>
                                   <AlertDialogContent>
                                     <AlertDialogHeader>
                                       <AlertDialogTitle>Delete Subtask?</AlertDialogTitle>
                                       <AlertDialogDescription>
                                         This action cannot be undone. This will permanently delete this subtask.
                                       </AlertDialogDescription>
                                     </AlertDialogHeader>
                                     <AlertDialogFooter>
                                       <AlertDialogCancel>Cancel</AlertDialogCancel>
                                       <AlertDialogAction onClick={() => deleteTask(subtask.id)}>
                                         Delete
                                       </AlertDialogAction>
                                     </AlertDialogFooter>
                                   </AlertDialogContent>
                                 </AlertDialog>
                               </>
                             )}
                           </div>
                         </div>
                        {(isAdmin || subtask.assigned_to === user?.id) && (
                          <Select
                            value={subtask.status}
                            onValueChange={(value) => updateTaskStatus(subtask.id, value as 'assigned' | 'in_progress' | 'done')}
                          >
                            <SelectTrigger className="w-[120px] ml-3">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="assigned">Assigned</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="done">Done</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </CardContent>
          </Card>
        );
      })}

      {/* Create Subtask Dialog */}
      <CreateTaskDialog
        open={showSubtaskDialog}
        onOpenChange={setShowSubtaskDialog}
        onTaskCreated={() => {
          fetchTasks();
          onTaskUpdate?.();
        }}
        parentTaskId={parentTaskId}
        isSubtask={true}
      />

      {/* Edit Task Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>
              Make changes to the task here.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium">
                Title
              </label>
              <Input
                id="title"
                value={editForm.title}
                onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Task title"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description
              </label>
              <Textarea
                id="description"
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Task description"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="priority" className="text-sm font-medium">
                Priority
              </label>
              <Select
                value={editForm.priority}
                onValueChange={(value) => setEditForm(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label htmlFor="assigned_to" className="text-sm font-medium">
                Assign To
              </label>
              <Select
                value={editForm.assigned_to}
                onValueChange={(value) => setEditForm(prev => ({ ...prev, assigned_to: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.name} ({p.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label htmlFor="deadline" className="text-sm font-medium">
                Deadline
              </label>
              <Input
                id="deadline"
                type="date"
                value={editForm.deadline}
                onChange={(e) => setEditForm(prev => ({ ...prev, deadline: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={updateTask}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};