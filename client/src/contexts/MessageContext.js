import React, { createContext, useState } from "react";

export const MessageContext = createContext();

function MessageContextProvider(props) {

    const [messageText, setMessageText] = useState('');

    const [messageLevel, setMessageLevel] = useState('info');

    const [messageOpen, setMessageOpen] = useState(false);

    const displayMessage = (msg, level) => {
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
            {props.children}
        </MessageContext.Provider>
    );

}
export default MessageContextProvider;
