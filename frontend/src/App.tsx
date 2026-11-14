import { lazy, Suspense } from 'react'
import { BrowserRouter, NavLink, Route, Routes } from 'react-router'
import Compare from './pages/Compare'
import Navigator from './pages/Navigator'
import SlipNavigator from './pages/SlipNavigator'
import Validation from './pages/Validation'

const Globe = lazy(() => import('./pages/Globe'))

const links = [
  ['/', 'Navigator'],
  ['/slip', 'Slip Navigator'],
  ['/compare', 'Compare'],
  ['/validation', 'Validation'],
  ['/globe', 'Globe'],
] as const

export default function App() {
  return (
    <BrowserRouter>
      <nav className="flex gap-4 border-b border-white/10 bg-space-900 px-4 py-3">
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'font-semibold' : 'opacity-70')}>
            {label}
          </NavLink>
        ))}
      </nav>
      <main className="p-4">
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Navigator />} />
            <Route path="/slip" element={<SlipNavigator />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/validation" element={<Validation />} />
            <Route path="/globe" element={<Globe />} />
          </Routes>
        </Suspense>
      </main>
    </BrowserRouter>
  )
}
