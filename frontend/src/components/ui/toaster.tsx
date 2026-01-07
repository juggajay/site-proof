// Placeholder for shadcn/ui Toaster component
// Run: npx shadcn-ui@latest add toast

export function Toaster() {
  return null
}

export function useToast() {
  return {
    toast: (options: { title?: string; description?: string; variant?: string }) => {
      console.log('Toast:', options)
    },
  }
}
