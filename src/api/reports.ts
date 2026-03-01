import { db } from '@/services/firebase';
import { USE_MOCK_DATA } from '@/config/mock';
import type { Report } from '@/types/api';
import { collection, getDocs } from 'firebase/firestore';

const ensureDb = () => {
  if (!db) {
    throw new Error('Firestore is disabled');
  }
  return db;
};

const toNumberValue = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const toStringValue = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

const toIsoString = (value: any) => {
  if (!value) return undefined;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }
  if (value?.toDate) {
    try {
      return value.toDate().toISOString();
    } catch {
      return undefined;
    }
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return undefined;
};

const mapReport = (id: string, data: Record<string, any>): Report => ({
  id: toStringValue(data.Report_ID ?? data.ReportId) ?? id,
  averageWaitingMinutes: toNumberValue(
    data.AvarageWaitingTime ??
      data.AvargeWaitingTime ??
      data.AverageWaitingTime ??
      data.averageWaitingTime,
  ),
  averageServiceMinutes: toNumberValue(
    data.AvarageServiceTime ??
      data.AvargeServiceTime ??
      data.AverageServiceTime ??
      data.averageServiceTime,
  ),
  dailyTruckCount: toNumberValue(data.DailyTruckCount ?? data.dailyTruckCount),
  createdAt: toIsoString(data.CreationDate ?? data.CreatedAt ?? data.createdAt),
});

export const fetchReports = async () => {
  if (USE_MOCK_DATA) {
    return [] as Report[];
  }

  const database = ensureDb();
  const snapshot = await getDocs(collection(database, 'Report'));
  return snapshot.docs.map((docSnap) => mapReport(docSnap.id, docSnap.data() as Record<string, any>));
};

export const fetchLatestReport = async () => {
  const reports = await fetchReports();
  const sorted = [...reports].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });
  return sorted[0] ?? null;
};
