import React, {
  createContext,
  useState,
  ReactNode,
  useCallback,
  useMemo,
} from "react"
import { MessageLevel } from "../types/interfaces"

export interface MessageContextType {
  messageText: string
  messageLevel: MessageLevel
  messageOpen: boolean
  displayMessage: (msg: string, level?: MessageLevel) => void
  closeMessage: () => void
}

export const MessageContext = createContext<MessageContextType>({
  messageText: "",
  messageLevel: "info",
  messageOpen: false,
  displayMessage: () => {},
  closeMessage: () => {},
})

interface MessageContextProviderProps {
  children: ReactNode
}

function MessageContextProvider({ children }: MessageContextProviderProps) {
  const [messageText, setMessageText] = useState<string>("")
  const [messageLevel, setMessageLevel] = useState<MessageLevel>("info")
  const [messageOpen, setMessageOpen] = useState<boolean>(false)

  const displayMessage = useCallback((msg: string, level?: MessageLevel) => {
    if (level) {
      setMessageLevel(level)
    }
    setMessageOpen(true)
    setMessageText(msg)
  }, [])

  const closeMessage = useCallback(() => {
    setMessageOpen(false)
  }, [])

  const value = useMemo(
    () => ({
      messageText,
      messageLevel,
      messageOpen,
      displayMessage,
      closeMessage,
    }),
    [messageText, messageLevel, messageOpen, displayMessage, closeMessage],
  )

  return (
    <MessageContext.Provider value={value}>{children}</MessageContext.Provider>
  )
}
export default MessageContextProvider
