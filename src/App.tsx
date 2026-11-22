import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { CityProvider } from './context/CityProvider'
import { LocaleProvider } from './context/LocaleProvider'
import { HomePage } from './pages/HomePage'
import { TreeProfilePage } from './pages/TreeProfilePage'

export function App() {
  return (
    <LocaleProvider>
      <CityProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/tree/:username" element={<TreeProfilePage />} />
            <Route path="/rankings" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </CityProvider>
    </LocaleProvider>
  )
}

export default App
