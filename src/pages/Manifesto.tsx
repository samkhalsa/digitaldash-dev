import { motion, useReducedMotion } from "framer-motion";
import story from "../content/story.md?raw";
import { Markdown } from "../components/Markdown";
import { Reveal } from "../components/Reveal";

/**
 * splits the story into sections on each "## " heading so every section can
 * reveal on its own. html comments in the markdown are stripped first.
 */
function splitSections(source: string): string[] {
  const clean = source.replace(/<!--[\s\S]*?-->/g, "").trim();
  return clean
    .split(/\n(?=## )/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const sections = splitSections(story);

export function Manifesto() {
  const reduce = useReducedMotion();

  return (
    <motion.main
      className="story"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <article>
        {sections.map((section, i) => (
          <Reveal key={i} className="section" delay={i === 0 ? 0.1 : 0}>
            <Markdown>{section}</Markdown>
          </Reveal>
        ))}
      </article>
    </motion.main>
  );
}
