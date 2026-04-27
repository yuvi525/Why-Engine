/**
 * app/template.tsx
 *
 * Next.js Template — runs on every navigation.
 * Previously used motion.div which caused Framer Motion v12 + React 19
 * infinite effect recursion. Replaced with a simple CSS fade-in.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        animation: 'templateFadeIn 0.22s ease-out both',
      }}
    >
      {children}
      <style>{`
        @keyframes templateFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
