export type MessageProps = {
    user: string;
    message: string;
};

export type ConversationProps = {
    id: number;
    title: string;
    messages: MessageProps[];
    connector: string;
};