'use client';
/**
 * components/layout/PageTransition.js
 *
 * Wraps page children with an AnimatePresence fade transition keyed
 * to the current pathname. This is the components/ alias for the
 * canonical src/components/layout/page-transition.tsx which is already
 * wired into app/layout.tsx — this file is the JS-friendly re-export
 * that non-TS pages can import via @/components/layout/PageTransition.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

export function PageTransition({ children }) {
  const pathname = usePathname();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
