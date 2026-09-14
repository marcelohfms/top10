import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Raiz } from './ui/Raiz'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Raiz />
  </StrictMode>,
)
