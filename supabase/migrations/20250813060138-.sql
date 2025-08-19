-- Add modification tracking to tasks table
ALTER TABLE public.tasks 
ADD COLUMN modified_by uuid,
ADD COLUMN modified_at timestamp with time zone;

-- Create function to update modification tracking
CREATE OR REPLACE FUNCTION update_task_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if this is an actual update (not insert)
  IF TG_OP = 'UPDATE' THEN
    NEW.modified_by = auth.uid();
    NEW.modified_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for task modifications
CREATE TRIGGER update_task_modification_trigger
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_task_modification();