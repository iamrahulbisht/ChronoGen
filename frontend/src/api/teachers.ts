import api from './client'
import type { TeacherResponse } from '../types/teacher'

export const listTeachers = (instId: string): Promise<TeacherResponse[]> =>
  api.get(`/api/v1/institutions/${instId}/teachers`).then(r => r.data)

export const createTeacher = (instId: string, data: Record<string, unknown>): Promise<TeacherResponse> =>
  api.post(`/api/v1/institutions/${instId}/teachers`, data).then(r => r.data)

export const updateTeacher = (instId: string, tid: string, data: Record<string, unknown>): Promise<TeacherResponse> =>
  api.put(`/api/v1/institutions/${instId}/teachers/${tid}`, data).then(r => r.data)

export const deleteTeacher = (instId: string, tid: string): Promise<void> =>
  api.delete(`/api/v1/institutions/${instId}/teachers/${tid}`)
