import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const navItems = [
  { href: '/dashboard',   label: 'Inicio',      icon: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 3h2v-2h-2v-2h-2v2h-2v2h2v2h2v-2z' },
  { href: '/ventas',      label: 'Ventas',       icon: 'M3 17l4-8 4 4 4-7 4 6' },
  { href: '/tanques',     label: 'Tanques',      icon: 'M12 2C8 2 4 5 4 9c0 5 8 13 8 13s8-8 8-13c0-4-4-7-8-7zm0 9a2 2 0 110-4 2 2 0 010 4z' },
  { href: '/inventario',  label: 'Inventario',   icon: 'M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM4 5h16v2H4V5z' },
  { href: '/entregas',    label: 'Entregas',     icon: 'M1 3h15v13H1V3zm15 5h4l3 3v5h-7V8z' },
  { href: '/facturacion', label: 'Facturación',  icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z' },
]

export default function Layout({ children, perfil, estacion }) {
  const router = useRouter()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const esAdmin = perfil?.rol === 'admin'

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-52 bg-white border-r border-gray-100 flex flex-col flex-shrink-0">

        {/* Logo */}
        <div className="px-4 py-4 border-b border-gray-100 flex flex-col items-center">
          <img src="/logo.jpg" alt="Hidrocom" className="h-14 w-auto object-contain mb-2" />
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

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
