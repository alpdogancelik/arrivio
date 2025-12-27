import { ListBookingsParams } from '@/api/bookings';
import { ListIssuesParams } from '@/api/issues';

export const queryKeys = {
  me: ['me'] as const,
  bookings: (params?: ListBookingsParams) => ['bookings', params?.status ?? 'all'] as const,
  booking: (id: string) => ['booking', id] as const,
  issue: (id: string) => ['issue', id] as const,
  issues: (params?: ListIssuesParams) =>
    ['issues', params?.status ?? 'all', params?.bookingId ?? 'all'] as const,
};
