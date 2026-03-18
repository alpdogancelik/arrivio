import { db } from '@/services/firebase';
import { USE_MOCK_DATA } from '@/config/mock';
import { listMockFacilities } from '@/mock/data';
import type { Facility } from '@/types/api';
import { collection, getDocs } from 'firebase/firestore';

const ensureDb = () => {
  if (!db) {
    throw new Error('Firestore is disabled');
  }
  return db;
};

const toStringValue = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

const toNumberValue = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

const mapFacility = (id: string, data: Record<string, any>): Facility => ({
  id: toStringValue(data.Facility_ID ?? data.facilityId) ?? id,
  name: toStringValue(data.Name ?? data.Facility_Name ?? data.name ?? data.facilityName) ?? id,
  address: toStringValue(data.Address ?? data.Adress ?? data.address),
  city: toStringValue(data.City ?? data.city),
  country: toStringValue(data.Country ?? data.country),
  latitude: toNumberValue(data.Latitude ?? data.latitude ?? data.lat),
  longitude: toNumberValue(data.Longitude ?? data.longitude ?? data.lng),
  capacity: toNumberValue(data.Capacity ?? data.capacity),
  status: toStringValue(data.Status ?? data.status),
  phone: toStringValue(data.Phone ?? data.phone ?? data.Contact_Number),
});

const mapMockFacility = (item: any): Facility => ({
  id: String(item.id ?? ''),
  name: String(item.name ?? ''),
  address: item.address,
  city: item.city,
  country: item.country,
  latitude: item.geo?.lat,
  longitude: item.geo?.lng,
  capacity: item.gates ?? item.docks,
  status: item.policy,
  phone: item.phone,
});

export const fetchFacilities = async () => {
  if (USE_MOCK_DATA) {
    return listMockFacilities().map(mapMockFacility);
  }

  const database = ensureDb();
  const snapshot = await getDocs(collection(database, 'Facility'));
  return snapshot.docs.map((docSnap) => mapFacility(docSnap.id, docSnap.data() as Record<string, any>));
};
