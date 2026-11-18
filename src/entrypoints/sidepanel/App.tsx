import { QueryClientProvider } from '@tanstack/react-query';
import { usePendingSelectionRedirect } from '@/features/page/usePendingSelectionRedirect';
import { AppShell } from '@/components/AppShell';
import { queryClient } from '@/lib/queryClient';

function PendingSelectionRedirect() {
  usePendingSelectionRedirect();
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PendingSelectionRedirect />
      <AppShell />
    </QueryClientProvider>
  );
}
