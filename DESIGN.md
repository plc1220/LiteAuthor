---

name: LiteAuthor Aesthetic
colors:
  surface: '#fff8ef'
  surface-dim: '#e3d9c1'
  surface-bright: '#fff8ef'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fdf3da'
  surface-container: '#f7edd4'
  surface-container-high: '#f1e8cf'
  surface-container-highest: '#ece2c9'
  on-surface: '#201b0c'
  on-surface-variant: '#4e4540'
  inverse-surface: '#35301f'
  inverse-on-surface: '#faf0d7'
  outline: '#80756f'
  outline-variant: '#d2c4bd'
  surface-tint: '#6d5b50'
  primary: '#271a12'
  on-primary: '#ffffff'
  primary-container: '#3e2f26'
  on-primary-container: '#ac968a'
  inverse-primary: '#dac2b5'
  secondary: '#825506'
  on-secondary: '#ffffff'
  secondary-container: '#ffc16d'
  on-secondary-container: '#784d00'
  tertiary: '#321500'
  on-tertiary: '#ffffff'
  tertiary-container: '#4c290b'
  on-tertiary-container: '#c38f69'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#f7ded0'
  primary-fixed-dim: '#dac2b5'
  on-primary-fixed: '#261911'
  on-primary-fixed-variant: '#54433a'
  secondary-fixed: '#ffddb5'
  secondary-fixed-dim: '#f9bb68'
  on-secondary-fixed: '#2a1800'
  on-secondary-fixed-variant: '#643f00'
  tertiary-fixed: '#ffdcc5'
  tertiary-fixed-dim: '#f4bb92'
  on-tertiary-fixed: '#301400'
  on-tertiary-fixed-variant: '#653d1e'
  background: '#fff8ef'
  on-background: '#201b0c'
  surface-variant: '#ece2c9'
typography:
  h1:
    fontFamily: newsreader
    fontSize: 40px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  h2:
    fontFamily: newsreader
    fontSize: 32px
    fontWeight: '500'
    lineHeight: '1.3'
  prose-body:
    fontFamily: newsreader
    fontSize: 20px
    fontWeight: '400'
    lineHeight: '1.7'
  ui-label:
    fontFamily: publicSans
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  ui-button:
    fontFamily: publicSans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
  caption:
    fontFamily: newsreader
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.4'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  page-margin: 80px
  prose-width: 720px
  gutter: 24px

##   section-gap: 48px

## Brand & Style

The design system is rooted in the "Tactile Minimalist" movement, specifically designed to evoke the focused, sensory experience of writing on physical parchment. The brand personality is scholarly, quiet, and timeless—removing the clinical coldness of modern digital tools in favor of a warm, analog atmosphere. 

The UI should feel like a well-appointed writing desk. It prioritizes the "Zen" state of the author by reducing visual noise and utilizing organic, weathered textures. Every interaction should feel intentional and soft, mimicking the friction of ink on paper rather than pixels on a screen.

## Colors

The palette is strictly monochromatic-adjacent, relying on sepia tones and "ink" values. 

- **Primary (Ink):** A deep, dark brown-black used for primary prose to ensure maximum legibility without the harshness of pure #000000.
- **Background (Parchment):** A warm, cream-based off-white that reduces eye strain during long writing sessions.
- **Accents (Amber/Wax):** Used sparingly for active states or notifications, reminiscent of a wax seal or aged tape.
- **Tertiary (Weathered Oak):** Used for borders and subtle UI elements to provide structure without breaking the organic feel.

Backgrounds should incorporate a subtle, non-tiling paper grain texture (opacity 3-5%) to prevent the screen from looking "flat."

## Typography

This design system employs a strict typographic hierarchy to separate "The Work" from "The Tool."

- **The Prose (Newsreader):** Used for all creative writing content. It features a high x-height and classic serifs that mimic 20th-century typesetting. Line heights are generous (1.7) to allow the text to breathe, simulating a printed page.
- **The Interface (Public Sans):** Used for buttons, menus, and metadata. This clean, neutral sans-serif provides a functional contrast to the literary serif, ensuring that UI controls are easily distinguishable from the author's prose.

Avoid all-caps for prose; use them only for UI labels to maintain a "classic editorial" look.

## Layout & Spacing

The layout is centered around a **Fixed Grid** model for the writing canvas, mimicking the dimensions of a physical manuscript.

1. **The Canvas:** A centered column with a maximum width of 720px to ensure an optimal character-per-line count (60-75 characters).
2. **Safe Margins:** Aggressive whitespace (80px minimum) on the left and right to maintain a focused, "Zen" environment.
3. **Rhythm:** Vertical rhythm follows a 4px baseline, but prose blocks should use larger gaps (48px) between chapters or sections to signify a "fresh page."

The UI should use "float" logic, where panels appear to rest on top of the parchment background rather than being locked into rigid sidebars.

## Elevation & Depth

Depth in this design system is achieved through **Tonal Layers** and texture rather than drop shadows.

- **Surface Levels:** The primary background is the "Desk." The writing area is the "Paper," which sits one level above. 
- **The Deckle-Edge:** Dividers should not be solid lines. Use a subtle, irregular "deckle-edge" SVG mask to create the appearance of torn or hand-cut paper.
- **Subtle Insets:** Search bars and input fields should use a "pressed" effect—achieved with a slightly darker sepia inner stroke—simulating an embossment in the paper.
- **Zero Shadows:** Avoid standard CSS box-shadows. If depth is required, use a 1px solid stroke in a color 10% darker than the surface it sits upon.

## Shapes

The shape language is "Organic Geometric." 

UI elements like buttons and chips use a **Soft (0.25rem)** roundedness to mimic the naturally slightly rounded corners of weathered paper. Sharp 90-degree angles are avoided to keep the aesthetic gentle. Large containers (like the main writing sheet) should have a slight, irregular warp or "rounded-lg" corner to feel less like a digital div and more like a stack of loose-leaf pages.

## Components

### Buttons

Primary buttons are styled as "Wax Seals" or "Ink Stamps." They feature a solid fill of the Amber color with Public Sans typography in white or deep ink. Secondary buttons are "Ghost" style with a 1px weathered-oak border.

### The Deckle Divider

Used to separate sections of text. This is a horizontal rule with a custom "torn paper" texture. It should be low-contrast and feel like a physical break in the page.

### Input Fields

Inputs should not look like boxes. They are represented by a single "Inkline" (bottom border only) or a subtle indented parchment texture. The cursor should be a thin charcoal line.

### Chips & Tags

Metadata tags (e.g., "Draft," "Chapter 1") should look like small scraps of paper taped or pinned to the margin, using a slightly different sepia hue than the main page.

### Cards

Cards (for story bibles or character notes) should use a "Stacked Paper" effect, where 2-3 offset borders of varying sepia tones create the illusion of a physical stack of index cards.