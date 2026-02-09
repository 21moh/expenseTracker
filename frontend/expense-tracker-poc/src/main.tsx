import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AllCommunityModule, ModuleRegistry } from 'ag-charts-community'
import { AuthProvider } from './context/AuthContext'
import './index.css'
import App from './App.tsx'

ModuleRegistry.registerModules([AllCommunityModule])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
