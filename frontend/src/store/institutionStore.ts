import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface InstitutionStore {
  institutionId: string | null
  institutionName: string
  setInstitution: (id: string, name: string) => void
  clearInstitution: () => void
}

export const useInstitutionStore = create<InstitutionStore>()(
  persist(
    (set) => ({
      institutionId: null,
      institutionName: '',
      setInstitution: (id, name) => set({ institutionId: id, institutionName: name }),
      clearInstitution: () => set({ institutionId: null, institutionName: '' }),
    }),
    { name: 'chronogen-institution' }
  )
)
