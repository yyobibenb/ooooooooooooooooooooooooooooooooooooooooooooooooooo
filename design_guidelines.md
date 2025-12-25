# Premium AI IDE Design Guidelines

## Design Approach
**System:** Apple HIG with glassmorphism treatment
**References:** Replit Agent, VS Code, Linear, Cursor AI
**Core Principle:** Liquid glass surfaces with sophisticated depth layering, minimal but purposeful animations

## Typography System
- **Primary Font:** SF Pro Display (system font fallback)
- **Code Font:** SF Mono / JetBrains Mono
- **Scale:** 
  - Headings: text-2xl to text-3xl (24-30px)
  - Body/UI: text-sm to text-base (14-16px)
  - Code: text-sm (14px, 1.5 line-height)
  - Labels/Meta: text-xs (12px)
- **Weights:** Regular (400), Medium (500), Semibold (600)

## Layout Architecture

### Main Application Structure
Three-panel horizontal split:
1. **Left Sidebar (256px):** File explorer with hierarchical tree
2. **Center Panel (flex-1):** Monaco code editor workspace
3. **Right Panel (380px):** AI chat interface, collapsible

**Spacing System:** Use 1, 2, 3, 4, 6, 8, 12 units consistently (p-4, gap-6, space-y-8)

### Top Navigation Bar
- Height: 48px (h-12)
- Contains: App logo, breadcrumb trail, action buttons (Run, Deploy, Settings)
- Glassmorphic treatment with subtle border-b

### File Explorer (Left Panel)
- Nested folder structure with disclosure triangles
- File icons by type, indented hierarchy (pl-4 per level)
- Context menu on right-click
- Search bar at top (h-10)
- Bottom status indicators (git branch, file count)

### Code Editor (Center)
- Monaco editor instance, full-height minus tabs
- Tab bar for open files (h-10), closeable with hover state
- Line numbers, minimap on right
- Status bar at bottom: cursor position, language, encoding

### AI Chat Panel (Right)
- Chat history (scrollable flex-1)
- Message bubbles: user (right-aligned), AI (left-aligned)
- Input area at bottom (min-h-24, auto-expanding)
- Quick action chips above input (Explain, Refactor, Debug)
- Suggested prompts when empty

## Component Specifications

### Glassmorphic Cards/Panels
- Translucent backgrounds with backdrop-blur-xl
- Subtle border treatment (border-opacity-20)
- Rounded corners: rounded-xl (12px)
- Shadow: shadow-2xl for depth

### Buttons
**Primary:** Gradient background with blur, px-6 py-2.5, rounded-lg
**Secondary:** Glass treatment with border, same padding
**Icon Buttons:** Square 40px (w-10 h-10), rounded-lg

### File Tree Items
- Height: 32px (h-8)
- Icon + label layout (gap-2)
- Hover state: subtle backdrop brightening
- Selected state: distinct glow treatment

### Chat Message Bubbles
- Max-width: 90% of panel
- Padding: px-4 py-3
- User messages: rounded-2xl rounded-br-md
- AI messages: rounded-2xl rounded-bl-md
- Code blocks within: rounded-lg, proper syntax highlighting

### Input Fields
- Height: 40px (h-10) for single-line
- Glass background with border
- Padding: px-4
- Focus: enhanced border glow, no ring

## Interaction Patterns

### Panel Resizing
- Draggable dividers between panels (w-1 hover area)
- Smooth resize with transition-all duration-200
- Min/max constraints per panel

### File Navigation
- Single-click: preview in editor
- Double-click: open permanent tab
- Smooth tab transitions (fade-in)

### AI Streaming Response
- Typing indicator: animated dots
- Streaming text: character-by-character reveal
- Code suggestions: inline diff view

### Collapsible Sections
- Smooth height transitions (duration-300)
- Rotate icon indicators (transform rotate-90)
- Preserve scroll position

## Glassmorphism Implementation Details

**Layer Stack (back to front):**
1. Deep gradient background (entire viewport)
2. Blur layers (backdrop-filter)
3. Content panels (translucent fills)
4. UI elements (slight elevation)
5. Floating elements (highest z-index)

**Depth Indicators:**
- Background panels: backdrop-blur-xl
- Elevated cards: backdrop-blur-2xl + shadow
- Modals/dropdowns: backdrop-blur-3xl + heavy shadow

## Grid & Spacing

**Container:** max-w-none (full viewport)
**Gaps:** gap-4 between major sections, gap-2 within components
**Padding:** p-6 for panels, p-4 for cards, p-3 for dense lists
**Margins:** Minimal - rely on gaps instead

## Animation Guidelines (Minimal)

**Only animate:**
- Panel transitions: transform, opacity (300ms ease)
- Button states: subtle scale(1.02) on hover
- Chat bubbles: slide-up entrance
- Notification toasts: slide-in from top-right

**Never animate:** Editor content, file tree updates, scroll

## Images Section

**No hero image needed** - This is an application interface, not a marketing page. 

**Icon Assets:**
- File type icons: Use VS Code icon set or similar
- UI icons: Heroicons (outline style) via CDN
- AI assistant avatar: Abstract geometric pattern (32x32px)

**Placeholder Graphics:**
- Empty state illustrations: Simple line art for "No files" and "Start chatting"
- Loading states: Skeleton screens with glass treatment

## Critical Layout Notes

- Viewport: Full screen (100vh), no scrolling on main container
- Responsive: Collapse right panel on <1280px, stack sidebar on <768px
- Z-index hierarchy: Modals (50), dropdowns (40), panels (10), base (0)
- Focus traps: Modal dialogs and command palette
- Keyboard shortcuts: Accessible via Cmd+K palette (glassmorphic overlay)