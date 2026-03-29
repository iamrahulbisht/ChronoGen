import { useState } from 'react'
import { useInstitutionStore } from '../store/institutionStore'
import { importJson, validateInstitution } from '../api/institutions'
import { useQueryClient } from '@tanstack/react-query'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import { Upload, CheckCircle, AlertTriangle, FileJson } from 'lucide-react'
import toast from 'react-hot-toast'
import { useDropzone } from 'react-dropzone'

export default function ImportPage() {
  const { institutionId } = useInstitutionStore()
  const id = institutionId!
  const qc = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [importResult, setImportResult] = useState<Record<string, unknown> | null>(null)
  const [validating, setValidating] = useState(false)
  const [valResult, setValResult] = useState<Record<string, unknown> | null>(null)

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/json': ['.json'] }, maxFiles: 1,
    onDrop: (f) => { if (f[0]) setFile(f[0]) },
  })

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    try {
      const res = await importJson(id, file)
      setImportResult(res); toast.success('Import successful')
      qc.invalidateQueries()
    } catch (e) { toast.error((e as Error).message) }
    finally { setUploading(false) }
  }

  const handleValidate = async () => {
    setValidating(true)
    try { setValResult(await validateInstitution(id)) }
    catch (e) { setValResult({ valid: false, errors: [(e as Error).message] }) }
    finally { setValidating(false) }
  }

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-bold tracking-tight">Import & Validate</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface border border-border rounded-lg p-6 space-y-4">
          <h3 className="font-display text-sm font-bold">Upload JSON</h3>
          <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-accent bg-accent-dim' : 'border-border hover:border-accent/40'}`}>
            <input {...getInputProps()} />
            <FileJson size={32} className="mx-auto mb-3 text-text-muted" />
            <p className="text-sm text-text-secondary">{isDragActive ? 'Drop it here' : 'Drop your JSON file or click to browse'}</p>
          </div>
          {file && (
            <div className="flex items-center justify-between bg-elevated rounded px-3 py-2">
              <span className="text-sm truncate">{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
              <Button size="sm" onClick={handleUpload} disabled={uploading}>
                {uploading ? <Spinner size={14} /> : <><Upload size={14} className="mr-1" />Import</>}
              </Button>
            </div>
          )}
          {importResult && (
            <div className="bg-green-500/5 border border-green-500/20 rounded p-4 space-y-1">
              <p className="text-sm text-success flex items-center gap-1.5"><CheckCircle size={14} />Imported successfully</p>
              {Object.entries((importResult as Record<string, unknown>).inserted as Record<string, number>).map(([k, v]) => (
                <p key={k} className="text-xs text-text-secondary ml-5">{k}: <span className="text-text-primary font-medium">{v}</span></p>
              ))}
            </div>
          )}
        </div>

        <div className="bg-surface border border-border rounded-lg p-6 space-y-4">
          <h3 className="font-display text-sm font-bold">Validation</h3>
          <Button onClick={handleValidate} disabled={validating} variant="secondary" className="w-full">
            {validating ? <Spinner size={14} /> : <><CheckCircle size={14} className="mr-1.5" />Run Validation</>}
          </Button>
          {valResult && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {(valResult as Record<string, unknown>).valid
                  ? <><CheckCircle size={18} className="text-success" /><span className="text-success text-sm font-medium">Valid</span></>
                  : <><AlertTriangle size={18} className="text-danger" /><span className="text-danger text-sm font-medium">Invalid</span></>}
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                {['total_slots', 'sections', 'teachers', 'rooms'].map(k => (
                  <div key={k} className="bg-elevated rounded p-2 text-center">
                    <p className="text-text-secondary capitalize">{k.replace('_', ' ')}</p>
                    <p className="font-display font-bold">{(valResult as Record<string, number>)[k] ?? 0}</p>
                  </div>
                ))}
              </div>
              {((valResult as Record<string, unknown>).errors as string[] || []).length > 0 && (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {((valResult as Record<string, unknown>).errors as string[]).map((e, i) => (
                    <div key={i} className="text-xs text-danger bg-red-500/5 border border-red-500/20 rounded px-3 py-2">{e}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
