/** CSS contracts for the shared RC2 full-window shell. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../src/client/PageAppShell.module.css', import.meta.url)), 'utf8')

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

describe('RC2 shared PageAppShell.module.css', () => {
  it('reserves a navigation column instead of overlaying Native DSH', () => {
    expect(declarations('.shell')?.get('--page-app-rail-width')).toBe('166px')
    expect(declarations('.shell')?.get('display')).toBe('grid')
    expect(declarations('.shell')?.get('grid-template-columns')).toBe('var(--page-app-rail-width) minmax(0, 1fr)')
    expect(declarations('.host')?.get('position')).toBe('relative')
  })

  it('hides complete surfaces without removing their DOM', () => {
    expect(declarations('.surface[hidden]')?.get('display')).toBe('none')
    expect(declarations('.surface')?.get('contain')).toBe('layout paint')
  })
})
