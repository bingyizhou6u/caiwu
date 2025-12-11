export function createMimeMessage() {
    return {
        setSender: () => { },
        setRecipient: () => { },
        setSubject: () => { },
        addMessage: () => { },
        asRaw: () => 'mock-email-content'
    }
}
