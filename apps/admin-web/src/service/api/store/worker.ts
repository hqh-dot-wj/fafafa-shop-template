import { request } from '@/service/request';

const BASE = '/admin/worker';

export function fetchGetWorkerProfileList(params: Api.Store.WorkerProfileSearchParams) {
  return request<Api.Common.PaginatingQueryRecord<Api.Store.WorkerProfile>>({
    url: `${BASE}/profiles`,
    method: 'get',
    params,
  });
}

export function fetchCreateWorkerProfile(data: Api.Store.CreateWorkerProfileDto) {
  return request<{ workerId: number }>({
    url: `${BASE}/profiles`,
    method: 'post',
    data,
  });
}

export function fetchGetWorkerProfile(id: number) {
  return request<Api.Store.WorkerProfile>({
    url: `${BASE}/profiles/${id}`,
    method: 'get',
  });
}

export function fetchUpdateWorkerProfile(id: number, data: Api.Store.UpdateWorkerProfileDto) {
  return request<null>({
    url: `${BASE}/profiles/${id}`,
    method: 'patch',
    data,
  });
}

export function fetchUpdateWorkerProfileStatus(id: number, data: Api.Store.UpdateWorkerStatusDto) {
  return request<null>({
    url: `${BASE}/profiles/${id}/status`,
    method: 'post',
    data,
  });
}

export function fetchGetWorkerApplicationList(params: Api.Store.WorkerApplicationSearchParams) {
  return request<Api.Common.PaginatingQueryRecord<Api.Store.WorkerApplication>>({
    url: `${BASE}/applications`,
    method: 'get',
    params,
  });
}

export function fetchGetWorkerApplication(id: number) {
  return request<Api.Store.WorkerApplication>({
    url: `${BASE}/applications/${id}`,
    method: 'get',
  });
}

export function fetchApproveWorkerApplication(id: number, data: Api.Store.ApproveWorkerApplicationDto) {
  return request<{ workerId: number }>({
    url: `${BASE}/applications/${id}/approve`,
    method: 'post',
    data,
  });
}

export function fetchRejectWorkerApplication(id: number, data: Api.Store.RejectWorkerApplicationDto) {
  return request<null>({
    url: `${BASE}/applications/${id}/reject`,
    method: 'post',
    data,
  });
}
