import AppLayout from './components/layout/AppLayout'
import { Toaster } from 'sonner'

function App() {
  return (
    <>
      <Toaster position="top-right" richColors />
      <AppLayout />
    </>
  )
}

export default App
