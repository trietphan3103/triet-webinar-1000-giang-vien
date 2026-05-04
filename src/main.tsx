import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import Admin from './Admin'
import Vip from './Vip'

const path = window.location.pathname
const isAdmin = path.startsWith('/admin')
const isVip = path.startsWith('/vip')

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isAdmin ? <Admin /> : isVip ? <Vip /> : <App />}</StrictMode>
)
