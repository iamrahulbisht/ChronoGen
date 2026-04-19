import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import AppShell from './components/layout/AppShell'
import SelectInstitutionPage from './pages/SelectInstitutionPage'
import DashboardPage from './pages/DashboardPage'
import RoomsPage from './pages/RoomsPage'
import TeachersPage from './pages/TeachersPage'
import SubjectsPage from './pages/SubjectsPage'
import SectionsPage from './pages/SectionsPage'
import ImportPage from './pages/ImportPage'
import JobsPage from './pages/JobsPage'
import JobDetailPage from './pages/JobDetailPage'
import TimetablePage from './pages/TimetablePage'
import AnalyticsPage from './pages/AnalyticsPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SelectInstitutionPage />} />
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/rooms" element={<RoomsPage />} />
            <Route path="/teachers" element={<TeachersPage />} />
            <Route path="/subjects" element={<SubjectsPage />} />
            <Route path="/sections" element={<SectionsPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/jobs/:jobId" element={<JobDetailPage />} />
            <Route path="/jobs/:jobId/timetable" element={<TimetablePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" toastOptions={{ style: { background: '#111118', color: '#e8e8f0', border: '1px solid #242430', fontSize: '13px' } }} />
    </QueryClientProvider>
  )
}
