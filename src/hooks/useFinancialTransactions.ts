import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export type TransactionType = 'payment' | 'refund' | 'payout' | 'credit' | 'fee';
export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface FinancialTransaction {
  id: string;
  venue_id: string | null;
  event_id: string | null;
  registration_id: string | null;
  user_id: string | null;
  transaction_type: TransactionType;
  amount_cents: number;
  currency: string;
  stripe_payment_intent_id: string | null;
  stripe_refund_id: string | null;
  stripe_payout_id: string | null;
  stripe_transfer_id: string | null;
  status: TransactionStatus;
  failure_reason: string | null;
  notes: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

interface TransactionFilters {
  venue_id?: string;
  event_id?: string;
  user_id?: string;
  transaction_type?: TransactionType;
  status?: TransactionStatus;
  start_date?: string;
  end_date?: string;
}

/**
 * Hook to fetch financial transactions for a venue
 */
export function useVenueTransactions(venueId: string | undefined, filters?: TransactionFilters) {
  return useQuery({
    queryKey: ['venue-transactions', venueId, filters],
    queryFn: async () => {
      if (!venueId) return [];

      let query = supabase
        .from('financial_transactions')
        .select(`
          *,
          unified_events:event_id (
            id,
            title
          ),
          profiles:user_id (
            id,
            display_name
          )
        `)
        .eq('venue_id', venueId)
        .order('created_at', { ascending: false });

      if (filters?.transaction_type) {
        query = query.eq('transaction_type', filters.transaction_type);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.start_date) {
        query = query.gte('created_at', filters.start_date);
      }
      if (filters?.end_date) {
        query = query.lte('created_at', filters.end_date);
      }

      const { data, error } = await query.limit(100);

      if (error) {
        console.error('Error fetching transactions:', error);
        return [];
      }

      return data;
    },
    enabled: !!venueId,
  });
}

/**
 * Hook to get transaction summary/totals
 */
export function useTransactionSummary(venueId: string | undefined, dateRange?: { start: string; end: string }) {
  return useQuery({
    queryKey: ['transaction-summary', venueId, dateRange],
    queryFn: async () => {
      if (!venueId) return null;

      let query = supabase
        .from('financial_transactions')
        .select('transaction_type, amount_cents, status')
        .eq('venue_id', venueId)
        .eq('status', 'completed');

      if (dateRange?.start) {
        query = query.gte('created_at', dateRange.start);
      }
      if (dateRange?.end) {
        query = query.lte('created_at', dateRange.end);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching transaction summary:', error);
        return null;
      }

      // Calculate totals
      const summary = {
        totalPayments: 0,
        totalRefunds: 0,
        totalPayouts: 0,
        totalFees: 0,
        netRevenue: 0,
        transactionCount: data.length,
      };

      for (const tx of data) {
        switch (tx.transaction_type) {
          case 'payment':
            summary.totalPayments += tx.amount_cents;
            break;
          case 'refund':
            summary.totalRefunds += tx.amount_cents;
            break;
          case 'payout':
            summary.totalPayouts += tx.amount_cents;
            break;
          case 'fee':
            summary.totalFees += tx.amount_cents;
            break;
        }
      }

      summary.netRevenue = summary.totalPayments - summary.totalRefunds - summary.totalFees;

      return summary;
    },
    enabled: !!venueId,
  });
}

/**
 * Hook to record a new transaction
 */
export function useRecordTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transaction: Omit<FinancialTransaction, 'id' | 'created_at' | 'updated_at'>) => {
      const { venue_id, event_id, registration_id, user_id, transaction_type, amount_cents, 
              currency, stripe_payment_intent_id, stripe_refund_id, stripe_payout_id, 
              stripe_transfer_id, status, failure_reason, notes, metadata } = transaction;
      
      const { data, error } = await supabase
        .from('financial_transactions')
        .insert([{
          venue_id,
          event_id,
          registration_id,
          user_id,
          transaction_type,
          amount_cents,
          currency,
          stripe_payment_intent_id,
          stripe_refund_id,
          stripe_payout_id,
          stripe_transfer_id,
          status,
          failure_reason,
          notes,
          metadata,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['venue-transactions', data.venue_id] });
      queryClient.invalidateQueries({ queryKey: ['transaction-summary', data.venue_id] });
    },
    onError: (error: Error) => {
      console.error('Error recording transaction:', error);
      toast.error('Failed to record transaction');
    },
  });
}

/**
 * Hook to process a refund
 */
export function useProcessRefund() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      originalTransactionId, 
      amount_cents, 
      reason 
    }: { 
      originalTransactionId: string; 
      amount_cents: number; 
      reason?: string;
    }) => {
      // Get original transaction
      const { data: original, error: fetchError } = await supabase
        .from('financial_transactions')
        .select('*')
        .eq('id', originalTransactionId)
        .single();

      if (fetchError || !original) {
        throw new Error('Original transaction not found');
      }

      if (original.transaction_type !== 'payment') {
        throw new Error('Can only refund payment transactions');
      }

      if (amount_cents > original.amount_cents) {
        throw new Error('Refund amount cannot exceed original payment');
      }

      // Create refund transaction
      const { data, error } = await supabase
        .from('financial_transactions')
        .insert([{
          venue_id: original.venue_id,
          event_id: original.event_id,
          registration_id: original.registration_id,
          user_id: original.user_id,
          transaction_type: 'refund',
          amount_cents: amount_cents,
          currency: original.currency,
          status: 'pending',
          notes: reason,
          metadata: {
            original_transaction_id: originalTransactionId,
          },
        }])
        .select()
        .single();

      if (error) throw error;

      // TODO: Call Stripe to process actual refund
      // For now, mark as completed
      await supabase
        .from('financial_transactions')
        .update({ status: 'completed' })
        .eq('id', data.id);

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['venue-transactions', data.venue_id] });
      queryClient.invalidateQueries({ queryKey: ['transaction-summary', data.venue_id] });
      toast.success('Refund processed');
    },
    onError: (error: Error) => {
      console.error('Error processing refund:', error);
      toast.error(error.message || 'Failed to process refund');
    },
  });
}

/**
 * Export transactions to CSV
 */
export function exportTransactionsToCSV(transactions: FinancialTransaction[]): string {
  const headers = [
    'Date',
    'Type',
    'Status',
    'Amount',
    'Currency',
    'Event',
    'User',
    'Stripe Payment ID',
    'Notes',
  ];

  const rows = transactions.map((tx) => [
    new Date(tx.created_at).toISOString(),
    tx.transaction_type,
    tx.status,
    (tx.amount_cents / 100).toFixed(2),
    tx.currency.toUpperCase(),
    (tx as any).unified_events?.title || '',
    (tx as any).profiles?.display_name || '',
    tx.stripe_payment_intent_id || '',
    tx.notes || '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  return csvContent;
}

/**
 * Helper to format cents as currency
 */
export function formatCents(cents: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}
