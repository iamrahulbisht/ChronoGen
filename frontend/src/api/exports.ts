import { BASE_URL } from './client'

export const downloadUrl = (path: string) => `${BASE_URL}/${path}`

export const downloadExport = (jobId: string, type: string, name?: string) => {
  let url = `${BASE_URL}/api/v1/jobs/${jobId}/exports/${type}`
  if (name) url += `/${name}`
  window.open(url, '_blank')
}

export const downloadAllZip = (jobId: string) =>
  downloadExport(jobId, 'all')
