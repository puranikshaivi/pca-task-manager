-- Fix the function search path warning
CREATE OR REPLACE FUNCTION update_task_modification()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only update if this is an actual update (not insert)
  IF TG_OP = 'UPDATE' THEN
    NEW.modified_by = auth.uid();
    NEW.modified_at = now();
  END IF;
  RETURN NEW;
END;
$$;