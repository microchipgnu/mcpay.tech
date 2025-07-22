"use client"

import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/providers/theme-context"
import { useSession } from "@/lib/client/auth"
import {
  LogIn,
  User
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAccountModal } from "@/components/hooks/use-account-modal"
import { AccountModal } from "@/components/custom-ui/account-modal"
import { Badge } from "@/components/ui/badge"

export default function Navbar() {
  const pathname = usePathname()

  const { isDark } = useTheme()
  const { data: session, isPending: sessionLoading } = useSession()
  const { isOpen, defaultTab, openModal, closeModal } = useAccountModal()

  // Determine logo based on theme
  const logoSrc = isDark ? "/MCPay-logo-dark.svg" : "/MCPay-logo-light.svg"

  return (
    <nav
      className={`sticky top-0 z-40 w-full border-b transition-colors duration-200 ${isDark ? "bg-black/95 backdrop-blur border-gray-800" : "bg-white/95 backdrop-blur border-gray-200"
        }`}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <Link href="/" className="flex-shrink-0 flex items-center gap-3">
              <Image src={logoSrc} alt="MCPay Logo" width={112} height={72} />
              <Badge variant="outline" className="text-xs">Alpha</Badge>
            </Link>
          </div>

          {/* Navigation Items - Always Visible */}
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              asChild
              className={`px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                pathname === "/register"
                  ? isDark
                    ? "bg-gray-800 text-white"
                    : "bg-gray-100 text-gray-900"
                  : isDark
                    ? "text-gray-300 hover:bg-gray-800 hover:text-white"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <Link href="/build">Build Server</Link>
            </Button>

            <Button
              variant="ghost"
              asChild
              className={`px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                pathname === "/register"
                  ? isDark
                    ? "bg-gray-800 text-white"
                    : "bg-gray-100 text-gray-900"
                  : isDark
                    ? "text-gray-300 hover:bg-gray-800 hover:text-white"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <Link href="/register">Register Server</Link>
            </Button>
            
            {/* Account Button */}
            <Button
              variant="ghost"
              onClick={() => openModal('funds')}
              disabled={sessionLoading}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                isDark
                  ? "text-gray-300 hover:bg-gray-800 hover:text-white"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              {session?.user ? (
                <>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    isDark ? "bg-gray-700" : "bg-gray-200"
                  }`}>
                    {session.user.image ? (
                      <Image 
                        src={session.user.image} 
                        alt="Profile" 
                        width={24}
                        height={24}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-3 w-3" />
                    )}
                  </div>
                  <span className="hidden sm:inline">
                    {session.user.name?.split(' ')[0] || 'Account'}
                  </span>
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  <span className="hidden sm:inline">Connect</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Account Modal */}
      <AccountModal 
        isOpen={isOpen} 
        onClose={closeModal}
        defaultTab={defaultTab}
      />
    </nav>
  )
}
