import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, User, ArrowLeft, Clock, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { TaskComments } from '@/components/Tasks/TaskComments';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'assigned' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  deadline: string | null;
  created_at: string;
  created_by: string;
  assigned_to: string | null;
  parent_task_id: string | null;
  modified_at: string | null;
  modified_by: string | null;
  creator_profile?: { name: string; email: string };
  assigned_profile?: { name: string; email: string };
  modified_profile?: { name: string; email: string };
}

interface Profile { user_id: string; name: string; email: string }

export const TaskDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { isAdmin } = useUserRole();

  const [task, setTask] = useState<Task | null>(null);
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as Task['priority'],
    status: 'assigned' as Task['status'],
    assigned_to: '' as string,
    deadline: '' as string,
  });

  useEffect(() => {
    if (id) {
      fetchTaskDetails();
    }
  }, [id, user?.id, isAdmin]);

  const fetchTaskDetails = async () => {
    if (!user || !id) return;

    try {
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single();
      if (taskError) throw taskError;

      const { data: subtaskData, error: subtaskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('parent_task_id', id)
        .order('created_at', { ascending: false });
      if (subtaskError) throw subtaskError;

      const all = [taskData, ...(subtaskData || [])];
      const userIds = Array.from(
        new Set(
          all.flatMap((t: any) => [t.created_by, t.assigned_to, t.modified_by].filter(Boolean)) as string[]
        )
      );

      const { data: fetchedProfiles } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']);

      const canUserEdit = isAdmin || taskData.assigned_to === user.id;
      setCanEdit(!!canUserEdit);

      const taskWithProfiles: Task = {
        ...taskData,
        creator_profile: fetchedProfiles?.find((p) => p.user_id === taskData.created_by),
        assigned_profile: fetchedProfiles?.find((p) => p.user_id === taskData.assigned_to),
        modified_profile: fetchedProfiles?.find((p) => p.user_id === taskData.modified_by),
      } as Task;

      const subtasksWithProfiles: Task[] = (subtaskData || []).map((st: any) => ({
        ...st,
        creator_profile: fetchedProfiles?.find((p) => p.user_id === st.created_by),
        assigned_profile: fetchedProfiles?.find((p) => p.user_id === st.assigned_to),
        modified_profile: fetchedProfiles?.find((p) => p.user_id === st.modified_by),
      }));

      setTask(taskWithProfiles);
      setSubtasks(subtasksWithProfiles);

      // Also fetch all profiles for assignment dropdown
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('user_id, name, email');
      setProfiles(allProfiles || []);
    } catch (error) {
      console.error('Error fetching task details:', error);
      toast({ title: 'Error', description: 'Failed to load task details', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: Task['status']) => {
    try {
      const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
      if (error) throw error;
      fetchTaskDetails();
      toast({ title: 'Success', description: 'Task status updated successfully' });
    } catch (error) {
      console.error('Error updating task status:', error);
      toast({ title: 'Error', description: 'Failed to update task status', variant: 'destructive' });
    }
  };

  const openEdit = (t: Task) => {
    setEditTargetId(t.id);
    setEditForm({
      title: t.title,
      description: t.description || '',
      priority: t.priority,
      status: t.status,
      assigned_to: t.assigned_to || '',
      deadline: t.deadline ? new Date(t.deadline).toISOString().slice(0, 16) : '', // for datetime-local
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editTargetId) return;
    try {
      const payload: any = {
        title: editForm.title,
        description: editForm.description || null,
        priority: editForm.priority,
        status: editForm.status,
        assigned_to: editForm.assigned_to || null,
      };
      if (editForm.deadline) payload.deadline = new Date(editForm.deadline).toISOString();
      else payload.deadline = null;

      const { error } = await supabase.from('tasks').update(payload).eq('id', editTargetId);
      if (error) throw error;
      toast({ title: 'Saved', description: 'Task updated successfully' });
      setEditOpen(false);
      await fetchTaskDetails();
      // TODO: If assigned_to changed, trigger email notification via edge function
    } catch (error) {
      console.error('Error updating task:', error);
      toast({ title: 'Error', description: 'Failed to update task', variant: 'destructive' });
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
      toast({ title: 'Deleted', description: 'Task deleted successfully' });
      if (taskId === task?.id) navigate('/dashboard');
      else await fetchTaskDetails();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({ title: 'Error', description: 'Failed to delete task', variant: 'destructive' });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'assigned': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading task details...</div>;
  }

  if (!task) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Task not found</p>
        <Button onClick={() => navigate('/dashboard')} className="mt-4">Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <Button variant="outline" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-2xl">{task.title}</CardTitle>
              {/* <CardDescription>
                <span className="font-mono text-xs bg-muted px-2 py-1 rounded">ID: {task.id.slice(0, 8)}</span>
              </CardDescription> */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                <Badge variant="outline" className={getStatusColor(task.status)}>{task.status.replace('_', ' ')}</Badge>
                {task.deadline && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4 mr-1" />
                    {format(new Date(task.deadline), 'MMM dd, yyyy')}
                  </div>
                )}
                <div className="flex items-center text-sm text-muted-foreground">
                  <Clock className="w-4 h-4 mr-1" />
                  Created {format(new Date(task.created_at), 'MMM dd, yyyy')}
                </div>
                {task.modified_at && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="w-4 h-4 mr-1" />
                    Modified {format(new Date(task.modified_at), 'MMM dd, yyyy')} by {task.modified_profile?.name || 'Admin'}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canEdit && (
                <Select value={task.status} onValueChange={(v) => updateTaskStatus(task.id, v as Task['status'])}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {isAdmin && (
                <>
                  <Button variant="outline" onClick={() => openEdit(task)}>
                    <Edit className="w-4 h-4 mr-2" /> Edit
                  </Button>
                  <Button variant="destructive" onClick={() => deleteTask(task.id)}>
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {task.description && (
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-muted-foreground">{task.description}</p>
            </div>
          )}
          <div className="flex items-center text-sm text-muted-foreground">
            <User className="w-4 h-4 mr-1" />
            <span>
              Created by {task.creator_profile?.name || 'Unknown'} • Assigned to {task.assigned_profile?.name || 'Unassigned'}
            </span>
          </div>
        </CardContent>
      </Card>

      {subtasks.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Subtasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {subtasks.map((st) => (
              <div key={st.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="space-y-1">
                  <p className="font-medium">{st.title}</p>
                  {st.description && <p className="text-sm text-muted-foreground">{st.description}</p>}
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={getPriorityColor(st.priority)}>{st.priority}</Badge>
                    <Badge variant="outline" className={getStatusColor(st.status)}>{st.status.replace('_', ' ')}</Badge>
                    <span className="text-xs text-muted-foreground">Assigned to {st.assigned_profile?.name || 'Unassigned'}</span>
                    {st.modified_at && (
                      <span className="text-xs text-muted-foreground"> • Modified {format(new Date(st.modified_at), 'MMM dd, yyyy')} by {st.modified_profile?.name || 'Admin'}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(canEdit || st.assigned_to === user?.id) && (
                    <Select value={st.status} onValueChange={(v) => updateTaskStatus(st.id, v as Task['status'])}>
                      <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="assigned">Assigned</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {isAdmin && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => openEdit(st)}>
                        <Edit className="w-4 h-4 mr-1" /> Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => deleteTask(st.id)}>
                        <Trash2 className="w-4 h-4 mr-1" /> Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={3} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={editForm.priority} onValueChange={(v) => setEditForm({ ...editForm, priority: v as Task['priority'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v as Task['status'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Assign To</Label>
                <Select value={editForm.assigned_to || "unassigned"} onValueChange={(v) => setEditForm({ ...editForm, assigned_to: v === "unassigned" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Select assignee" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.name} ({p.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Deadline</Label>
                <Input type="datetime-local" value={editForm.deadline} onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button onClick={saveEdit}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Comments Section */}
      <Card>
        <CardHeader>
          <CardTitle>Comments</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskComments taskId={task.id} />
        </CardContent>
      </Card>
    </div>
  );
};
