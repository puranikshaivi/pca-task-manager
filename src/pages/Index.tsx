import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Scale, LogIn, UserPlus } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !loading) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/20 flex items-center justify-center p-4">
      <div className="text-center space-y-8 max-w-md">
        <div className="space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary rounded-xl flex items-center justify-center">
            <Scale className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">PCATask</h1>
          <p className="text-xl text-muted-foreground">
            Professional task management for law firms
          </p>
        </div>
        
        <div className="space-y-4">
          <Button 
            onClick={() => navigate('/auth')} 
            className="w-full"
            size="lg"
          >
            <LogIn className="mr-2 h-5 w-5" />
            Sign In
          </Button>
          <Button 
            onClick={() => navigate('/auth')} 
            variant="outline"
            className="w-full"
            size="lg"
          >
            <UserPlus className="mr-2 h-5 w-5" />
            Create Account
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
