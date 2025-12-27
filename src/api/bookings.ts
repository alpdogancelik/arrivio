import { request } from './client';
import { Booking, BookingSchema, BookingStatus } from '@/types/api';
import { USE_MOCK_DATA } from '@/config/mock';
import {
  cancelMockBooking,
  completeMockBooking,
  createMockBooking,
  getMockBooking,
  listMockBookings,
  updateMockBooking,
} from '@/mock/data';
import { z } from 'zod';

const BookingListSchema = z.array(BookingSchema);

export type ListBookingsParams = { status?: BookingStatus | 'all' };
export type CreateBookingPayload = {
  facilityId: string;
  stationId?: string;
  arrivalTime: string; // ISO string
  notes?: string;
};

export type UpdateBookingPayload = Partial<Pick<CreateBookingPayload, 'arrivalTime' | 'stationId' | 'notes'>>;

export const fetchBookings = (params?: ListBookingsParams) =>
  USE_MOCK_DATA
    ? Promise.resolve(listMockBookings(params))
    : request<Booking[]>({
        path: '/bookings',
        method: 'GET',
        query: params,
        schema: BookingListSchema,
      });

export const fetchBooking = (id: string) =>
  USE_MOCK_DATA
    ? Promise.resolve(getMockBooking(id))
    : request<Booking>({
        path: `/bookings/${id}`,
        method: 'GET',
        schema: BookingSchema,
      });

export const createBooking = (payload: CreateBookingPayload) =>
  USE_MOCK_DATA
    ? Promise.resolve(createMockBooking(payload))
    : request<Booking>({
        path: '/bookings',
        method: 'POST',
        body: payload,
        schema: BookingSchema,
      });

export const updateBooking = (id: string, payload: UpdateBookingPayload) =>
  USE_MOCK_DATA
    ? Promise.resolve(updateMockBooking(id, payload))
    : request<Booking>({
        path: `/bookings/${id}`,
        method: 'PATCH',
        body: payload,
        schema: BookingSchema,
      });

export const cancelBooking = (id: string, reason?: string) =>
  USE_MOCK_DATA
    ? Promise.resolve(cancelMockBooking(id))
    : request<Booking>({
        path: `/bookings/${id}/cancel`,
        method: 'POST',
        body: reason ? { reason } : undefined,
        schema: BookingSchema,
      });

export const completeBooking = (id: string) =>
  USE_MOCK_DATA
    ? Promise.resolve(completeMockBooking(id))
    : request<Booking>({
        path: `/bookings/${id}/complete`,
        method: 'POST',
        schema: BookingSchema,
      });
