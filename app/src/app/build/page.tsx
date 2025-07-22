"use client"

import React, { Suspense } from "react"
import { Server } from "lucide-react"
import { useTheme } from "@/components/providers/theme-context"
import { useSession } from "@/lib/client/auth"
import { AccountModal } from "@/components/custom-ui/account-modal"
import { useAccountModal } from "@/components/hooks/use-account-modal"
import { Button } from "@/components/ui/button"

function BuildPageContent() {
  const { isDark } = useTheme()
  const { data: session, isPending } = useSession()
  const { isOpen: isAccountModalOpen, openModal, closeModal } = useAccountModal()

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
      {/* Navbar */}
      <div className={`border-b ${isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white/50'} sticky top-0 z-10`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Server className={`h-8 w-8 ${isDark ? 'text-gray-300' : 'text-gray-700'}`} />
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Build MCP Server
            </h1>
          </div>
          {/* Auth Button */}
          {isPending ? null : !session?.user ? (
            <Button onClick={() => openModal('wallets')}>
              Sign In
            </Button>
          ) : (
            <Button variant="outline" onClick={() => openModal('wallets')}>
              Manage Wallets
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center flex-1 py-20">
        <h2 className={`text-4xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Coming Soon
        </h2>
      </div>

      {/* Account Modal */}
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={closeModal}
        defaultTab="wallets"
      />
    </div>
  )
}

export default function BuildPage() {
  return (
    <Suspense fallback={null}>
      <BuildPageContent />
    </Suspense>
  )
}
