"use client"

import { useState, useCallback } from 'react'
import type { AccountModalTab, UseAccountModalReturn } from '@/types'

export function useAccountModal(): UseAccountModalReturn {
  const [isOpen, setIsOpen] = useState(false)
  const [defaultTab, setDefaultTab] = useState<AccountModalTab>('profile')

  const openModal = useCallback((tab: AccountModalTab = 'profile') => {
    setDefaultTab(tab)
    setIsOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setIsOpen(false)
  }, [])

  return {
    isOpen,
    defaultTab,
    openModal,
    closeModal
  }
} 