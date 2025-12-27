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
});
export type Facility = z.infer<typeof FacilitySchema>;

export const StationSchema = z.object({
  id: z.string(),
  facilityId: z.string(),
  name: z.string(),
  gate: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  status: z.enum(['open', 'closed', 'limited']).optional(),
});
export type Station = z.infer<typeof StationSchema>;

export const BookingStatusSchema = z.enum(['pending', 'confirmed', 'arrived', 'completed', 'cancelled']);
export type BookingStatus = z.infer<typeof BookingStatusSchema>;

export const BookingSchema = z.object({
  id: z.string(),
  facilityId: z.string(),
  facilityName: z.string().optional(),
  stationId: z.string(),
  stationName: z.string().optional(),
  arrivalTime: z.string(),
  etaMinutes: z.number().optional(),
  status: BookingStatusSchema.default('pending'),
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
