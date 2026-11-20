import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { scenarios } from '../../data/scenarios'
import { CitationPane } from './CitationPane'

function visibleText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

describe('CitationPane honest excerpt copy (N9)', () => {
  it('labels citation snippets as excerpts on file without claiming direct EHR record proof', () => {
    const html = renderToStaticMarkup(
      <CitationPane
        scenario={scenarios['novo-ozempic-docgap']}
        highlightedIndex={null}
        onSelectIndex={() => {}}
      />,
    )
    const text = visibleText(html)
    expect(text).toContain('Excerpts on file')
    expect(text).not.toContain('Quoted evidence directly from the EHR record')
  })

  it('states when no excerpt is on file instead of claiming evidence is verified in clinical record', () => {
    const noCites = { ...scenarios['novo-ozempic-docgap'], citations: {} }
    const html = renderToStaticMarkup(
      <CitationPane
        scenario={noCites}
        highlightedIndex={null}
        onSelectIndex={() => {}}
      />,
    )
    const text = visibleText(html)
    expect(text).toContain('No excerpt on file for this criterion')
    expect(text).not.toContain('verified in clinical record')
  })
})
