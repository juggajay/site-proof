import { motion, useScroll, useTransform, useSpring } from 'framer-motion'
import { useRef, ReactNode } from 'react'

export function ParallaxFloat({ children }: { children: ReactNode }) {
  const ref = useRef(null)
  
  // Mouse parallax or scroll parallax? Let's go with a gentle float that reacts to scroll
  // for a "heavy object being lifted" feel
  
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  })

  const y = useTransform(scrollYProgress, [0, 1], [50, -50])
  const springY = useSpring(y, { stiffness: 100, damping: 30 })

  return (
    <motion.div ref={ref} style={{ y: springY }}>
      {children}
    </motion.div>
  )
}
