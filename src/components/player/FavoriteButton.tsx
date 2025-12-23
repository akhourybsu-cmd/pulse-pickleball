import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface FavoriteButtonProps {
  isFavorite: boolean;
  onToggle: () => Promise<boolean>;
  size?: 'sm' | 'default' | 'lg' | 'icon';
  className?: string;
}

export function FavoriteButton({ isFavorite, onToggle, size = 'icon', className }: FavoriteButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    setLoading(true);
    try {
      const success = await onToggle();
      if (success) {
        toast.success(isFavorite ? 'Removed from favorites' : 'Added to favorites');
      }
    } catch (error) {
      toast.error('Failed to update favorites');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size={size}
      className={cn(
        'hover:bg-transparent',
        isFavorite && 'text-red-500 hover:text-red-600',
        !isFavorite && 'text-muted-foreground hover:text-red-500',
        className
      )}
      onClick={handleClick}
      disabled={loading}
    >
      <Heart 
        className={cn(
          'w-5 h-5 transition-all',
          isFavorite && 'fill-current',
          loading && 'animate-pulse'
        )} 
      />
    </Button>
  );
}
