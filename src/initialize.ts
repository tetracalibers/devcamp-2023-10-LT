import 'reveal.js/dist/reveal.css'
import 'reveal.js/dist/theme/white_contrast_compact_verbatim_headers.css'
import './style/my-reveal.css'
import 'reveal.js/plugin/highlight/zenburn.css'
import Reveal from 'reveal.js'
import RevealMarkdown from 'reveal.js/plugin/markdown/markdown'
import RevealHighlight from 'reveal.js/plugin/highlight/highlight'
import RevalNotes from 'reveal.js/plugin/notes/notes'

export const initialize = ({ showNotes }: { showNotes: boolean }) => {
  Reveal.initialize({
    history: true,
    showNotes,
    plugins: [RevealMarkdown, RevalNotes, RevealHighlight],
  })
}
