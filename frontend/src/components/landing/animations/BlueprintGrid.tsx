import { motion } from 'framer-motion'

export function BlueprintGrid() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Horizontal Lines */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ duration: 1.5 }}
        className="absolute inset-0"
        style={{
            backgroundImage: 'linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)',
            backgroundSize: '100% 40px'
        }}
      />
      {/* Vertical Lines */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ duration: 1.5, delay: 0.5 }}
        className="absolute inset-0"
        style={{
            backgroundImage: 'linear-gradient(to right, #cbd5e1 1px, transparent 1px)',
            backgroundSize: '40px 100%'
        }}
      />
      
      {/* Animated Path "Drawing" Effect */}
      <svg className="absolute top-0 right-0 w-[800px] h-[800px] opacity-20" viewBox="0 0 100 100">
         <motion.path
           d="M0 0 L100 0 L100 100"
           fill="none"
           stroke="#1e3a5f"
           strokeWidth="0.5"
           initial={{ pathLength: 0 }}
           animate={{ pathLength: 1 }}
           transition={{ duration: 3, ease: "easeInOut" }}
         />
         <motion.path
           d="M0 20 L80 20 L80 100"
           fill="none"
           stroke="#f97316"
           strokeWidth="0.5"
           initial={{ pathLength: 0 }}
           animate={{ pathLength: 1 }}
           transition={{ duration: 3, delay: 0.5, ease: "easeInOut" }}
         />
          <motion.path
           d="M0 40 L60 40 L60 100"
           fill="none"
           stroke="#1e3a5f"
           strokeWidth="0.5"
           initial={{ pathLength: 0 }}
           animate={{ pathLength: 1 }}
           transition={{ duration: 3, delay: 1, ease: "easeInOut" }}
         />
      </svg>
      
      {/* Gradient fade to white at bottom */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/50 to-white" />
    </div>
  )
}
