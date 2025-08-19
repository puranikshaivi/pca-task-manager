import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Employee {
  user_id: string;
  profiles: {
    name: string;
    email: string;
  };
}

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated: () => void;
  parentTaskId?: string | null;
  isSubtask?: boolean;
}

export const CreateTaskDialog = ({ 
  open, 
  onOpenChange, 
  onTaskCreated, 
  parentTaskId = null,
  isSubtask = false 
}: CreateTaskDialogProps) => {
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'regular',
    assigned_to: '',
    deadline: undefined as Date | undefined
  });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingEmployees, setFetchingEmployees] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchEmployees();
    }
  }, [open]);

  const fetchEmployees = async () => {
    setFetchingEmployees(true);
    try {
      // First get employee user IDs
      const { data: employeeRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id');

      if (rolesError) throw rolesError;

      if (employeeRoles && employeeRoles.length > 0) {
        // Then get their profiles
        const { data: employeeProfiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, name, email')
          .in('user_id', employeeRoles.map(emp => emp.user_id));

        if (profilesError) throw profilesError;

        // Transform to match expected interface
        const employeesWithProfiles = employeeProfiles?.map(profile => ({
          user_id: profile.user_id,
          profiles: profile
        })) || [];

        setEmployees(employeesWithProfiles);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast({
        title: "Error",
        description: "Failed to fetch employees",
        variant: "destructive"
      });
    } finally {
      setFetchingEmployees(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const taskData = {
        title: form.title,
        description: form.description || null,
        priority: form.priority as 'regular' | 'urgent',
        assigned_to: form.assigned_to || null,
        deadline: form.deadline ? form.deadline.toISOString() : null,
        created_by: user.id,
        parent_task_id: parentTaskId
      };

      const { error } = await supabase
        .from('tasks')
        .insert(taskData);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${isSubtask ? 'Subtask' : 'Task'} created successfully!`
      });

      // Reset form
      setForm({
        title: '',
        description: '',
        priority: 'regular',
        assigned_to: '',
        deadline: undefined
      });

      // Set up real-time task updates using Supabase channels
      const channel = supabase
        .channel('task-updates')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'tasks'
          },
          () => {
            onTaskCreated();
          }
        )
        .subscribe();

      // Clean up after short delay
      setTimeout(() => {
        supabase.removeChannel(channel);
      }, 1000);

      onTaskCreated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Create New {isSubtask ? 'Subtask' : 'Task'}</DialogTitle>
          <DialogDescription>
            {isSubtask ? 'Add a subtask to break down work into smaller pieces' : 'Create a new task and assign it to an employee'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter task title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter task description (optional)"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select 
                value={form.priority} 
                onValueChange={(value) => setForm(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assigned_to">Assign To</Label>
              <Select 
                value={form.assigned_to} 
                onValueChange={(value) => setForm(prev => ({ ...prev, assigned_to: value }))}
                disabled={fetchingEmployees}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.user_id} value={employee.user_id}>
                      {employee.profiles.name} ({employee.profiles.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Deadline (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !form.deadline && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.deadline ? format(form.deadline, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={form.deadline}
                  onSelect={(date) => setForm(prev => ({ ...prev, deadline: date }))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create {isSubtask ? 'Subtask' : 'Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};