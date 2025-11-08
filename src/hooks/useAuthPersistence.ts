import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to manage authentication persistence based on user preference
 * This ensures users stay signed in when they want to, and are logged out
 * when they close their browser if they prefer not to stay signed in
 */
export const useAuthPersistence = () => {
  useEffect(() => {
    const checkPersistence = async () => {
      const shouldPersist = localStorage.getItem('pulse_persist_session');
      
      // If user doesn't want to persist session (stay signed in = false)
      if (shouldPersist === 'false') {
        // Set up listener to sign out when browser/tab closes
        const handleBeforeUnload = async () => {
          await supabase.auth.signOut();
        };
        
        window.addEventListener('beforeunload', handleBeforeUnload);
        
        return () => {
          window.removeEventListener('beforeunload', handleBeforeUnload);
        };
      }
    };
    
    checkPersistence();
  }, []);
};
