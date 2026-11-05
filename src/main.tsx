import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import '@fontsource-variable/archivo'
import '@fontsource-variable/jetbrains-mono'
import './theme.css'
import { DataProvider } from './state'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <DataProvider><App /></DataProvider>
    </BrowserRouter>
  </StrictMode>,
)
