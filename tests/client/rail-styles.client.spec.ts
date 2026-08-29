/** CSS contracts for the full and compact Workspace App rail variants. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../src/client/PageAppRail.module.css', import.meta.url)), 'utf8')

/** Read the normalized declarations of one exact CSS selector. */
function declarations(selector: string): Map<string, string> | undefined {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, ' ')
  for (const [, selectorList = '', body = ''] of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectorList.split(',').map(value => value.trim()).includes(selector)) continue
    const found = new Map<string, string>()
    for (const part of body.split(';')) {
      const colon = part.indexOf(':')
      if (colon === -1) continue
      found.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim().replace(/\s+/g, ' '))
    }
    return found
  }
  return undefined
}

describe('PageAppRail.module.css', () => {
  it('fills the navigation column reserved by the shell', () => {
    expect(declarations('.rail')?.get('width')).toBe('100%')
  })

  it('uses the specified compact rail and item geometry', () => {
    expect(declarations(".rail[data-variant='compact']")?.get('width')).toBe('56px')
    expect(declarations(".rail[data-variant='compact']")?.get('padding')).toBe('6px')
    expect(declarations(".rail[data-variant='compact']")?.get('box-sizing')).toBe('border-box')
    expect(declarations(".rail[data-variant='compact'] .item")?.get('justify-content')).toBe('center')
    expect(declarations(".rail[data-variant='compact'] .item")?.get('padding')).toBe('8px')
    expect(declarations(".rail[data-variant='compact'] .item")?.get('box-sizing')).toBe('border-box')
    expect(declarations(".rail[data-variant='compact'] .itemLabel")?.get('max-width')).toBe('100%')
  })
})
