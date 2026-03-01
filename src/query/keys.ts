import { ListBookingsParams } from '@/api/bookings';
import { ListIssuesParams } from '@/api/issues';
import { ListQueueEntryParams } from '@/api/queue-entries';

export const queryKeys = {
  me: ['me'] as const,
  bookings: (params?: ListBookingsParams) => ['bookings', params?.status ?? 'all'] as const,
  booking: (id: string) => ['booking', id] as const,
  issue: (id: string) => ['issue', id] as const,
  issues: (params?: ListIssuesParams) =>
    ['issues', params?.status ?? 'all', params?.bookingId ?? 'all'] as const,
  facilities: () => ['facilities'] as const,
  stations: (facilityId?: string) => ['stations', facilityId ?? 'all'] as const,
  stationRecommendation: (facilityId: string | undefined, arrivalTime: string) =>
    ['stationRecommendation', facilityId ?? 'all', arrivalTime] as const,
  bookingPredictedStatus: (id: string) => ['bookingPredictedStatus', id] as const,
  queueEntries: (params?: ListQueueEntryParams) =>
    ['queueEntries', params?.stationId ?? 'all', params?.carrierId ?? 'all', params?.bookingId ?? 'all'] as const,
  reports: () => ['reports'] as const,
};
