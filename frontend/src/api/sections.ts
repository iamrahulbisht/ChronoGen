import api from './client'
import type { SectionResponse } from '../types/section'

export const listSections = (instId: string): Promise<SectionResponse[]> =>
  api.get(`/api/v1/institutions/${instId}/sections`).then(r => r.data)

export const createSection = (instId: string, data: Record<string, unknown>): Promise<SectionResponse> =>
  api.post(`/api/v1/institutions/${instId}/sections`, data).then(r => r.data)

export const updateSection = (instId: string, sid: string, data: Record<string, unknown>): Promise<SectionResponse> =>
  api.put(`/api/v1/institutions/${instId}/sections/${sid}`, data).then(r => r.data)

export const deleteSection = (instId: string, sid: string): Promise<void> =>
  api.delete(`/api/v1/institutions/${instId}/sections/${sid}`)
