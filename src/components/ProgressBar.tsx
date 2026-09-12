import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";

/** a thin reading-progress line along the top of the viewport. */
export function ProgressBar() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  });

  if (reduce) return null;

  return <motion.div className="progress" style={{ scaleX }} aria-hidden="true" />;
}
