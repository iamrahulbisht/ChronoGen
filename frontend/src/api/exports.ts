import { BASE_URL } from './client'

export const downloadUrl = (path: string) => `${BASE_URL}/${path}`

export const exportUrl = (jobId: string, type: string, name?: string) => {
  let url = `${BASE_URL}/api/v1/jobs/${jobId}/exports/${type}`
  if (name) url += `/${name}`
  return url
}

export const downloadExport = (jobId: string, type: string, name?: string) => {
  window.open(exportUrl(jobId, type, name), '_blank')
}

export const downloadAllZip = (jobId: string) =>
  downloadExport(jobId, 'all')
