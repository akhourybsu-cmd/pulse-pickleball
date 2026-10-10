import { useLocation, useNavigate } from 'react-router-dom';
import { browserHistoryIndex, readReturnContext, returnHistoryDelta } from '@/lib/navigation/returnContext';

export function useReturnNavigation(fallback = '/player/community', fallbackLabel = 'Communities', fallbackToHistory = false) {
  const location = useLocation();
  const navigate = useNavigate();
  const context = readReturnContext(location.state);
  return {
    label: context?.label ?? fallbackLabel,
    goBack: () => {
      if (!context && fallbackToHistory && (browserHistoryIndex() ?? 0) > 0) {
        navigate(-1);
        return;
      }
      const delta = context && returnHistoryDelta(context, browserHistoryIndex());
      if (delta != null) navigate(delta);
      else navigate(context?.to ?? fallback, {
        replace: true,
        state: context ? { restoreScrollY: context.scrollY, restoreScrollFor: context.to } : undefined,
      });
    },
  };
}
