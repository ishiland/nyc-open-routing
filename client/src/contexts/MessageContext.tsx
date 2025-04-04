import React, { createContext, useState, ReactNode } from "react";
import { MessageLevel } from "../types/interfaces";

interface MessageContextType {
    messageText: string;
    messageLevel: MessageLevel;
    messageOpen: boolean;
    displayMessage: (msg: string, level?: MessageLevel) => void;
    closeMessage: () => void;
}

export const MessageContext = createContext<MessageContextType>({
    messageText: '',
    messageLevel: 'info',
    messageOpen: false,
    displayMessage: () => { },
    closeMessage: () => { }
});

interface MessageContextProviderProps {
    children: ReactNode;
}

function MessageContextProvider({ children }: MessageContextProviderProps) {

    const [messageText, setMessageText] = useState<string>('');

    const [messageLevel, setMessageLevel] = useState<MessageLevel>('info');

    const [messageOpen, setMessageOpen] = useState<boolean>(false);

    const displayMessage = (msg: string, level?: MessageLevel) => {
        if (level) {
            setMessageLevel(level)
        }
        setMessageOpen(true);
        setMessageText(msg);
    };

    const closeMessage = () => {
        setMessageOpen(false)
    };

    return (
        <MessageContext.Provider
            value={{
                messageText,
                messageLevel,
                messageOpen,
                displayMessage,
                closeMessage
            }}
        >
            {children}
        </MessageContext.Provider>
    );

}
export default MessageContextProvider;
