'use client'

import { useRouter } from 'next/navigation'
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow'

export default function OnboardingPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full">
        <OnboardingFlow onComplete={() => router.push('/dashboard')} />
      </div>
    </div>
  )
}
