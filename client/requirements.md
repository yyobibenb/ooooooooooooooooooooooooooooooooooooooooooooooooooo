## Packages
@monaco-editor/react | Code editor component
react-resizable-panels | For the IDE layout (sidebar, editor, chat)
framer-motion | Smooth animations for UI elements
date-fns | Date formatting
clsx | Class name utility
tailwind-merge | Tailwind class merging

## Notes
- Theme: Dark mode "Liquid Glass" (Apple-style transparency and blur)
- Auth: Uses Replit Auth blueprint via useAuth hook
- Editor: Monaco Editor for code editing
- Chat: Uses server-side SSE streaming at /api/conversations/:id/messages
- Layout: Resizable panels for File Explorer / Editor / Chat
