import api from './client'
import type { SubjectResponse } from '../types/subject'

export const listSubjects = (instId: string): Promise<SubjectResponse[]> =>
  api.get(`/api/v1/institutions/${instId}/subjects`).then(r => r.data)

export const createSubject = (instId: string, data: Record<string, unknown>): Promise<SubjectResponse> =>
  api.post(`/api/v1/institutions/${instId}/subjects`, data).then(r => r.data)

export const updateSubject = (instId: string, sid: string, data: Record<string, unknown>): Promise<SubjectResponse> =>
  api.put(`/api/v1/institutions/${instId}/subjects/${sid}`, data).then(r => r.data)

export const deleteSubject = (instId: string, sid: string): Promise<void> =>
  api.delete(`/api/v1/institutions/${instId}/subjects/${sid}`)
