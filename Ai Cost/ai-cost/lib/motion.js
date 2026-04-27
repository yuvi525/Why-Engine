/**
 * lib/motion.js
 *
 * Shared Framer Motion variant presets for the WHY Engine UI.
 * Import named exports wherever you need consistent animation tokens.
 *
 * Usage:
 *   import { fadeUp, stagger, scaleIn } from '@/lib/motion';
 *   <motion.div variants={fadeUp} initial="hidden" animate="show">
 */

export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
  },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.25 } },
};

/** Parent variant — use with staggerChildren on a motion.div wrapping a list */
export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

/** Faster stagger — for denser lists (e.g. key rows, rule rows) */
export const staggerFast = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] },
  },
};

export const slideFromRight = {
  hidden: { opacity: 0, x: 20 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

/** For toast notifications — slide in from right, slide out to right */
export const toastAnim = {
  hidden: { opacity: 0, x: 80 },
  show: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 340, damping: 28 },
  },
  exit: { opacity: 0, x: 80, transition: { duration: 0.2 } },
};
