import api from './client'
import type { JobResponse, JobListResponse } from '../types/job'
import type { TimetableResponse } from '../types/timetable'

export const createJob = (data: Record<string, unknown>): Promise<Record<string, unknown>> =>
  api.post('/api/v1/jobs/', data).then(r => r.data)

export const listJobs = (instId?: string, status?: string): Promise<JobListResponse[]> => {
  const params: Record<string, string> = {}
  if (instId) params.institution_id = instId
  if (status) params.status = status
  return api.get('/api/v1/jobs/', { params }).then(r => r.data)
}

export const getJob = (jobId: string): Promise<JobResponse> =>
  api.get(`/api/v1/jobs/${jobId}`).then(r => r.data)

export const deleteJob = (jobId: string): Promise<void> =>
  api.delete(`/api/v1/jobs/${jobId}`)

export const getTimetable = (jobId: string, paretoIndex = 0): Promise<TimetableResponse> =>
  api.get(`/api/v1/jobs/${jobId}/timetable`, { params: { pareto_index: paretoIndex } }).then(r => r.data)
