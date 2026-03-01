import { z } from 'zod';

export const RoleSchema = z.enum(['carrier', 'facility', 'admin', 'operator']).default('carrier');
export type Role = z.infer<typeof RoleSchema>;

export const AuthProviderSchema = z.enum(['backend', 'firebase']).default('backend');
export type AuthProvider = z.infer<typeof AuthProviderSchema>;

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number().optional(), // epoch seconds
  issuedAt: z.number().optional(), // epoch seconds
  provider: AuthProviderSchema.optional().default('backend'),
});
export type AuthTokens = z.infer<typeof AuthTokensSchema>;

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional().nullable(),
  surname: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  role: RoleSchema,
  company: z.string().optional().nullable(),
  vehiclePlate: z.string().optional().nullable(),
  capacity: z.number().optional().nullable(),
  available: z.boolean().optional(),
});
export type User = z.infer<typeof UserSchema>;

export const FacilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  capacity: z.number().optional(),
  status: z.string().optional(),
  phone: z.string().optional(),
});
export type Facility = z.infer<typeof FacilitySchema>;

export const StationSchema = z.object({
  id: z.string(),
  facilityId: z.string(),
  name: z.string(),
  gate: z.string().optional(),
  servers: z.number().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  status: z.enum(['open', 'closed', 'limited']).optional(),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  type: z.string().optional(),
  // These fields are "learned" over time from completed services (see Cloud Functions).
  avgServiceTimeMin: z.number().optional(),
  totalServiceTimeMin: z.number().optional(),
  completedJobsCount: z.number().optional(),
});
export type Station = z.infer<typeof StationSchema>;

export const BookingStatusSchema = z.enum(['pending', 'confirmed', 'arrived', 'servicing', 'completed', 'cancelled']);
export type BookingStatus = z.infer<typeof BookingStatusSchema>;

export const BookingSchema = z.object({
  id: z.string(),
  facilityId: z.string(),
  facilityName: z.string().optional(),
  stationId: z.string(),
  stationName: z.string().optional(),
  arrivalTime: z.string(),
  slot: z.string().optional(),
  etaMinutes: z.number().optional(),
  status: BookingStatusSchema.default('pending'),
  recommendedStationId: z.string().optional(),
  recommendedWaitMin: z.number().optional(),
  recommendations: z.array(z.lazy(() => StationRecommendationSchema)).optional(),
  serviceStartTime: z.string().optional(),
  serviceEndTime: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Booking = z.infer<typeof BookingSchema>;

export const QueueStatusSchema = z.object({
  stationId: z.string(),
  etaMinutes: z.number(),
  queueLength: z.number().optional(),
  updatedAt: z.string().optional(),
});
export type QueueStatus = z.infer<typeof QueueStatusSchema>;

export const IssueStatusSchema = z.enum(['open', 'in_progress', 'resolved']);
export type IssueStatus = z.infer<typeof IssueStatusSchema>;

export const IssueSchema = z.object({
  id: z.string(),
  bookingId: z.string().optional(),
  category: z.string(),
  description: z.string(),
  photoUrl: z.string().optional(),
  status: IssueStatusSchema.optional(),
  createdAt: z.string().optional(),
});
export type Issue = z.infer<typeof IssueSchema>;

export const QueueEntrySchema = z.object({
  id: z.string(),
  carrierId: z.string().optional(),
  stationId: z.string().optional(),
  bookingId: z.string().optional().nullable(),
  facilityId: z.string().optional().nullable(),
  status: z.enum(['Waiting', 'Servicing', 'Completed']).optional(),
  entryTime: z.string().optional(),
  exitTime: z.string().optional(),
  waitingMinutes: z.number().optional(),
  serviceMinutes: z.number().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type QueueEntry = z.infer<typeof QueueEntrySchema>;

export const QueueEventTypeSchema = z.enum(['queue_joined', 'service_start', 'service_end']);
export type QueueEventType = z.infer<typeof QueueEventTypeSchema>;

export const QueueEventSchema = z.object({
  id: z.string(),
  facilityId: z.string(),
  stationId: z.string(),
  carrierId: z.string(),
  bookingId: z.string().optional().nullable(),
  type: QueueEventTypeSchema,
  ts: z.string(),
});
export type QueueEvent = z.infer<typeof QueueEventSchema>;

export const StationStatsSchema = z.object({
  stationId: z.string(),
  windowMinutes: z.number(),
  avgServiceSec: z.number(),
  avgWaitSec: z.number(),
  lambdaPerMin: z.number(),
  updatedAt: z.string().optional(),
});
export type StationStats = z.infer<typeof StationStatsSchema>;

export const StationRecommendationSchema = z.object({
  stationId: z.string(),
  stationName: z.string().optional(),
  facilityId: z.string().optional(),
  status: z.enum(['open', 'closed', 'limited']).optional(),
  predictedWaitMin: z.number(),
  predictedPosition: z.number(),
  predictedQueue: z.number(),
  score: z.number(),
});
export type StationRecommendation = z.infer<typeof StationRecommendationSchema>;

export const StationRecommendationResponseSchema = z.object({
  suggestedStationId: z.string().nullable(),
  stations: z.array(StationRecommendationSchema),
  windowMinutes: z.number().optional(),
});
export type StationRecommendationResponse = z.infer<typeof StationRecommendationResponseSchema>;

export const BookingPredictedStatusSchema = z.object({
  bookingId: z.string(),
  stationId: z.string(),
  predictedWaitMin: z.number(),
  predictedPosition: z.number(),
  predictedQueue: z.number(),
  serviceStartEta: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type BookingPredictedStatus = z.infer<typeof BookingPredictedStatusSchema>;

export const ReportSchema = z.object({
  id: z.string(),
  averageWaitingMinutes: z.number().optional(),
  averageServiceMinutes: z.number().optional(),
  dailyTruckCount: z.number().optional(),
  createdAt: z.string().optional(),
});
export type Report = z.infer<typeof ReportSchema>;
