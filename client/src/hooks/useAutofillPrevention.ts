import { useState, useEffect, useRef } from "react"
import {
  SEARCH_READONLY_DELAY_MS,
  RANDOM_STRING_LENGTH,
} from "../utils/constants"

/**
 * Hook to prevent browser autofill on input fields
 * Uses readonly attribute and random autocomplete values as prevention strategy
 * @returns Object containing readonly state, focus handler, and autocomplete value
 */
const useAutofillPrevention = () => {
  const [isReadOnly, setIsReadOnly] = useState(true)

  // Generate a random autocomplete value to prevent browser autofill
  const randomAutoComplete = useRef(
    `field-${Math.random()
      .toString(36)
      .substring(2, RANDOM_STRING_LENGTH + 2)}`,
  )

  // Remove readonly after mount to prevent autofill
  useEffect(() => {
    const timer = setTimeout(
      () => setIsReadOnly(false),
      SEARCH_READONLY_DELAY_MS,
    )
    return () => clearTimeout(timer)
  }, [])

  // Handle focus - remove readonly and fix iOS keyboard issue
  const handleFocus = (inputRef: React.RefObject<HTMLInputElement>) => {
    setIsReadOnly(false)
    // iOS Safari fix - ensures keyboard appears correctly
    if (inputRef.current && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      const input = inputRef.current
      const value = input.value
      input.value = ""
      input.value = value
    }
  }

  return {
    isReadOnly,
    handleFocus,
    randomAutoComplete: randomAutoComplete.current,
  }
}

export default useAutofillPrevention
