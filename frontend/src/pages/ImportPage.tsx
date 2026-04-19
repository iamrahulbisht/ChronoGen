import { useState } from 'react'
import { useInstitutionStore } from '../store/institutionStore'
import { importJson, importExcel, downloadExcelTemplate, validateInstitution } from '../api/institutions'
import { useQueryClient } from '@tanstack/react-query'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import { Upload, CheckCircle, AlertTriangle, FileJson, FileSpreadsheet, Download } from 'lucide-react'
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
    accept: { 
        'application/json': ['.json'],
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
        'application/vnd.ms-excel': ['.xls']
    }, 
    maxFiles: 1,
    onDrop: (f) => { if (f[0]) setFile(f[0]) },
  })

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setImportResult(null)
    setValResult(null)
    try {
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
      const res = isExcel ? await importExcel(id, file) : await importJson(id, file)
      
      setImportResult(res); toast.success(`${isExcel ? 'Excel' : 'JSON'} import successful`)
      qc.invalidateQueries()
      
      // Auto-validate after successful import
      await handleValidate()
    } catch (e) { toast.error((e as Error).message) }
    finally { setUploading(false) }
  }

  const handleValidate = async () => {
    setValidating(true)
    try { setValResult(await validateInstitution(id)) }
    catch (e) { setValResult({ valid: false, errors: [(e as Error).message] }) }
    finally { setValidating(false) }
  }

  const handleDownloadTemplate = async () => {
    try {
        await downloadExcelTemplate(id)
        toast.success('Template downloaded')
    } catch (e) {
        toast.error('Failed to download template')
    }
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="font-display text-2xl font-bold tracking-tight">Data Management</h2>
            <p className="text-sm text-text-secondary mt-1">Import your school data via Excel or JSON to get started.</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-2">
            <Download size={16} />
            Download Excel Template
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface border border-border rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold uppercase tracking-widest text-text-secondary">Upload Data Source</h3>
            <div className="flex gap-2">
                <div className="px-2 py-0.5 rounded bg-accent/10 text-accent text-[10px] font-bold">XLSX</div>
                <div className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 text-[10px] font-bold">JSON</div>
            </div>
          </div>

          <div {...getRootProps()} className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 ${isDragActive ? 'border-accent bg-accent/5 scale-[0.99]' : 'border-border hover:border-accent/40 bg-elevated/30'}`}>
            <input {...getInputProps()} />
            <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-accent">
                {file?.name.endsWith('.json') ? <FileJson size={32} /> : <FileSpreadsheet size={32} />}
            </div>
            <p className="text-sm font-bold text-text-primary mb-1">{isDragActive ? 'Release to upload' : 'Drag & drop file here'}</p>
            <p className="text-xs text-text-muted">Supports Excel (.xlsx) and JSON files</p>
          </div>

          {file && (
            <div className="flex items-center justify-between bg-elevated/50 border border-border rounded-xl p-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="p-2 bg-accent/20 rounded-lg text-accent">
                    {file.name.endsWith('.json') ? <FileJson size={20} /> : <FileSpreadsheet size={20} />}
                </div>
                <div className="overflow-hidden">
                    <p className="text-sm font-bold text-text-primary truncate">{file.name}</p>
                    <p className="text-[10px] text-text-secondary uppercase">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <Button size="sm" onClick={handleUpload} disabled={uploading} className="shadow-lg shadow-accent/20">
                {uploading ? <Spinner size={14} /> : <><Upload size={14} className="mr-1.5" />Import Data</>}
              </Button>
            </div>
          )}

          {importResult && (
            <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-5 space-y-3 animate-in zoom-in-95">
              <p className="text-sm font-bold text-success flex items-center gap-2">
                <CheckCircle size={18} />
                Successfully Imported Data
              </p>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries((importResult as any).inserted as Record<string, number>).map(([k, v]) => (
                    <div key={k} className="bg-surface/50 rounded-xl p-3 border border-border/50">
                        <p className="text-[10px] text-text-secondary uppercase font-bold tracking-tight">{k}</p>
                        <p className="text-lg font-black text-text-primary">{v}</p>
                    </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-surface border border-border rounded-2xl p-6 space-y-6">
          <h3 className="font-display text-sm font-bold uppercase tracking-widest text-text-secondary">Data Integrity Check</h3>
          
          <div className="p-6 bg-elevated/30 rounded-2xl border border-border space-y-4">
            <p className="text-xs text-text-muted leading-relaxed">
                Run validation to ensure all teachers are assigned correctly, room capacities match student counts, and workloads are feasible.
            </p>
            <Button onClick={handleValidate} disabled={validating} variant="secondary" className="w-full h-11 shadow-lg">
                {validating ? <Spinner size={14} /> : <><CheckCircle size={16} className="mr-2" />Run Full Validation</>}
            </Button>
          </div>

          {valResult && (
            <div className="space-y-4 animate-in fade-in duration-500">
              <div className={`p-4 rounded-xl flex items-center gap-3 border ${ (valResult as any).valid ? 'bg-success/5 border-success/20 text-success' : 'bg-danger/5 border-danger/20 text-danger' }`}>
                {(valResult as any).valid ? <CheckCircle size={24} /> : <AlertTriangle size={24} />}
                <div>
                    <p className="text-sm font-black uppercase tracking-wider">{(valResult as any).valid ? 'Structure Valid' : 'Structure Invalid'}</p>
                    <p className="text-xs opacity-80">{(valResult as any).valid ? 'All constraints satisfied. Ready for generation.' : 'Found critical issues in data mapping.'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Slots', key: 'total_slots' },
                    { label: 'Classes', key: 'sections' },
                    { label: 'Teachers', key: 'teachers' },
                    { label: 'Rooms', key: 'rooms' }
                ].map(item => (
                  <div key={item.key} className="bg-elevated/50 rounded-xl p-3 border border-border/50 text-center">
                    <p className="text-[9px] text-text-secondary uppercase font-bold">{item.label}</p>
                    <p className="text-base font-black text-text-primary">{(valResult as any)[item.key] ?? 0}</p>
                  </div>
                ))}
              </div>

              {((valResult as any).errors || []).length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  <p className="text-[10px] font-bold text-danger uppercase tracking-widest pl-1">Error Log</p>
                  {(valResult as any).errors.map((e: string, i: number) => (
                    <div key={i} className="text-xs text-danger bg-danger/5 border border-danger/10 rounded-xl px-4 py-3 flex gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-danger mt-1.5 shrink-0" />
                        {e}
                    </div>
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
