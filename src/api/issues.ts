import { request } from './client';
import { Issue, IssueSchema, IssueStatus } from '@/types/api';
import { USE_MOCK_DATA } from '@/config/mock';
import { createMockIssue, listMockIssues } from '@/mock/data';
import { z } from 'zod';

const IssueListSchema = z.array(IssueSchema);

export type CreateIssuePayload = {
  category: string;
  description: string;
  photoUrl?: string;
  bookingId?: string;
};

export type ListIssuesParams = {
  status?: IssueStatus;
  bookingId?: string;
};

export const createIssue = (payload: CreateIssuePayload) =>
  USE_MOCK_DATA
    ? Promise.resolve(createMockIssue(payload))
    : request<Issue>({
        path: '/issues',
        method: 'POST',
        body: payload,
        schema: IssueSchema,
      });

export const fetchIssues = (params?: ListIssuesParams) =>
  USE_MOCK_DATA
    ? Promise.resolve(listMockIssues(params))
    : request<Issue[]>({
        path: '/issues',
        method: 'GET',
        query: params,
        schema: IssueListSchema,
      });
