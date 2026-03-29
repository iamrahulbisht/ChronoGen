import api from './client'
import type { InstitutionResponse, RoomResponse } from '../types/institution'

export const listInstitutions = (): Promise<InstitutionResponse[]> =>
  api.get('/api/v1/institutions/').then(r => r.data)

export const createInstitution = (data: Record<string, unknown>): Promise<InstitutionResponse> =>
  api.post('/api/v1/institutions/', data).then(r => r.data)

export const getInstitution = (id: string): Promise<InstitutionResponse> =>
  api.get(`/api/v1/institutions/${id}`).then(r => r.data)

export const updateInstitution = (id: string, data: Record<string, unknown>): Promise<InstitutionResponse> =>
  api.put(`/api/v1/institutions/${id}`, data).then(r => r.data)

export const deleteInstitution = (id: string): Promise<void> =>
  api.delete(`/api/v1/institutions/${id}`)

// Rooms
export const listRooms = (instId: string): Promise<RoomResponse[]> =>
  api.get(`/api/v1/institutions/${instId}/rooms`).then(r => r.data)

export const createRoom = (instId: string, data: Record<string, unknown>): Promise<RoomResponse> =>
  api.post(`/api/v1/institutions/${instId}/rooms`, data).then(r => r.data)

export const updateRoom = (instId: string, roomId: string, data: Record<string, unknown>): Promise<RoomResponse> =>
  api.put(`/api/v1/institutions/${instId}/rooms/${roomId}`, data).then(r => r.data)

export const deleteRoom = (instId: string, roomId: string): Promise<void> =>
  api.delete(`/api/v1/institutions/${instId}/rooms/${roomId}`)

// Import & Validate
export const importJson = (instId: string, file: File) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post(`/api/v1/institutions/${instId}/import/json`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export const validateInstitution = (instId: string) =>
  api.get(`/api/v1/institutions/${instId}/validate`).then(r => r.data)
