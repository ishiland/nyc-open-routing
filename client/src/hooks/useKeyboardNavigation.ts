import { useState, useCallback } from "react"

interface UseKeyboardNavigationOptions<T> {
  items: T[]
  onSelect: (item: T) => void
}

/**
 * Hook to manage keyboard navigation (arrow keys and Enter) for dropdown/list components
 * @param options Configuration options with items array and selection callback
 * @returns Object containing highlighted index state and keyboard event handler
 */
const useKeyboardNavigation = <T>({
  items,
  onSelect,
}: UseKeyboardNavigationOptions<T>) => {
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault()
        setHighlightedIndex(prev => (prev < items.length - 1 ? prev + 1 : 0))
      } else if (event.key === "ArrowUp") {
        event.preventDefault()
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : items.length - 1))
      } else if (event.key === "Enter") {
        if (highlightedIndex >= 0 && highlightedIndex < items.length) {
          event.preventDefault()
          onSelect(items[highlightedIndex])
        }
      }
    },
    [items, highlightedIndex, onSelect],
  )

  const resetHighlight = useCallback(() => {
    setHighlightedIndex(-1)
  }, [])

  return {
    highlightedIndex,
    handleKeyDown,
    resetHighlight,
    setHighlightedIndex,
  }
}

export default useKeyboardNavigation
