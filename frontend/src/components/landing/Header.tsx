import { Link } from 'react-router-dom'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const navItems = [
    { name: 'Features', href: '#features' },
    { name: 'Pricing', href: '#pricing' },
    { name: 'Resources', href: '#faq' },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex h-16 items-center justify-between">
          <Link to="/landing" className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-[#1e3a5f]">SiteProof</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <a 
                key={item.name} 
                href={item.href}
                className="text-sm font-medium text-gray-700 hover:text-[#1e3a5f] transition-colors"
              >
                {item.name}
              </a>
            ))}
            <Link 
              to="/login"
              className="text-sm font-medium text-gray-700 hover:text-[#1e3a5f] transition-colors"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center justify-center rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1e3a5f]/90"
            >
              Get a Demo
            </Link>
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6 text-gray-700" />
            ) : (
              <Menu className="h-6 w-6 text-gray-700" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      <div
        className={cn(
          "md:hidden border-t bg-white overflow-hidden transition-all duration-300 ease-in-out",
          isMobileMenuOpen ? "max-h-64 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="container mx-auto px-4 py-4 space-y-4">
          {navItems.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className="block text-sm font-medium text-gray-700 hover:text-[#1e3a5f]"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {item.name}
            </a>
          ))}
          <Link
            to="/login"
            className="block text-sm font-medium text-gray-700 hover:text-[#1e3a5f]"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Login
          </Link>
          <Link
            to="/register"
            className="block w-full rounded-lg bg-[#1e3a5f] px-4 py-2 text-center text-sm font-medium text-white hover:bg-[#1e3a5f]/90"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Get a Demo
          </Link>
        </div>
      </div>
    </header>
  )
}
