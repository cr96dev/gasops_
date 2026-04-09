import { useRouter } from 'next/router'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

const navItems = [
  { href: '/dashboard',   label: 'Inicio',      icon: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 3h2v-2h-2v-2h-2v2h-2v2h2v2h2v-2z' },
  { href: '/ventas',      label: 'Ventas',       icon: 'M3 17l4-8 4 4 4-7 4 6' },
  { href: '/tanques',     label: 'Tanques',      icon: 'M12 2C8 2 4 5 4 9c0 5 8 13 8 13s8-8 8-13c0-4-4-7-8-7zm0 9a2 2 0 110-4 2 2 0 010 4z' },
  { href: '/inventario',  label: 'Inventario',   icon: 'M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM4 5h16v2H4V5z' },
  { href: '/entregas',    label: 'Entregas',     icon: 'M1 3h15v13H1V3zm15 5h4l3 3v5h-7V8z' },
  { href: '/facturacion', label: 'Facturas',     icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z' },
]

export default function Layout({ children, perfil, estacion }) {
  const router = useRouter()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const esAdmin = perfil?.rol === 'admin'

  async function logout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const todosLosItems = [
    ...navItems,
    ...(esAdmin ? [{ href: '/admin', label: 'Panel', icon: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z' }] : [])
  ]

  return (
    <div className="flex min-h-screen bg-gray-50">

      {/* Sidebar — solo desktop */}
      <aside className="hidden md:flex w-52 bg-white border-r border-gray-100 flex-col flex-shrink-0">
        <div className="px-4 py-4 border-b border-gray-100 flex flex-col items-center">
          <img src="https://i.ibb.co/LdRMd3JL/Whats-App-Image-2026-04-09-at-15-02-41.jpg"
            alt="Hidrocom" className="h-24 w-full object-contain mb-1" />
          <div className="text-xs text-gray-400 text-center truncate w-full">
            {esAdmin ? 'Administrador' : (estacion?.nombre || '...')}
          </div>
        </div>
        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {navItems.map(item => {
            const active = router.pathname === item.href
            return (
              <button key={item.href} onClick={() => router.push(item.href)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {item.label}
              </button>
            )
          })}
          {esAdmin && (
            <>
              <div className="px-3 pt-3 pb-1 text-xs text-gray-400 uppercase tracking-wider">Admin</div>
              <button onClick={() => router.push('/admin')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  router.pathname === '/admin' ? 'bg-purple-50 text-purple-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                }`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
                </svg>
                Panel general
              </button>
            </>
          )}
        </nav>
        <div className="px-4 py-3 border-t border-gray-100">
          <div className="text-xs text-gray-500 truncate mb-2">{perfil?.nombre_completo}</div>
          <button onClick={logout} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Topbar móvil */}
        <div className="md:hidden bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <img src="https://i.ibb.co/LdRMd3JL/Whats-App-Image-2026-04-09-at-15-02-41.jpg"
            alt="Hidrocom" className="h-8 object-contain" />
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 truncate max-w-24">
              {esAdmin ? 'Admin' : (estacion?.nombre || '')}
            </span>
            <button onClick={() => setMenuAbierto(!menuAbierto)}
              className="p-2 rounded-lg hover:bg-gray-50">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                {menuAbierto
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                }
              </svg>
            </button>
          </div>
        </div>

        {/* Menú desplegable móvil */}
        {menuAbierto && (
          <div className="md:hidden bg-white border-b border-gray-100 px-2 py-2 z-10">
            {todosLosItems.map(item => {
              const active = router.pathname === item.href
              return (
                <button key={item.href}
                  onClick={() => { router.push(item.href); setMenuAbierto(false) }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${
                    active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                  }`}>
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  {item.label}
                </button>
              )
            })}
            <div className="border-t border-gray-100 mt-2 pt-2 px-4">
              <div className="text-xs text-gray-400 mb-1">{perfil?.nombre_completo}</div>
              <button onClick={logout} className="text-xs text-red-400 hover:text-red-600">
                Cerrar sesión
              </button>
            </div>
          </div>
        )}

        {/* Contenido */}
        <main className="flex-1 min-w-0 pb-6">
          {children}
        </main>

        {/* Barra de navegación inferior móvil */}
        <nav className="md:hidden bg-white border-t border-gray-100 fixed bottom-0 left-0 right-0 z-10">
          <div className="grid grid-cols-5 px-1">
            {todosLosItems.slice(0, 5).map(item => {
              const active = router.pathname === item.href
              return (
                <button key={item.href}
                  onClick={() => { router.push(item.href); setMenuAbierto(false) }}
                  className={`flex flex-col items-center py-2 px-1 transition-colors ${
                    active ? 'text-blue-600' : 'text-gray-400'
                  }`}>
                  <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  <span className="text-xs">{item.label}</span>
                </button>
              )
            })}
          </div>
        </nav>

      </div>
    </div>
  )
}
