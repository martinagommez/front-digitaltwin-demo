import { Spinner, SpinnerSize, MessageBar, MessageBarType, Link, IconButton } from "@fluentui/react";
import { useTranslation } from "react-i18next";
import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownViewerProps {
    src: string;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ src }) => {
    const [content, setContent] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);
    const { t } = useTranslation();

    const removeAnchorLinks = (markdown: string) => {
        const ancorLinksRegex = /\[.*?\]\(#.*?\)/g;
        return markdown.replace(ancorLinksRegex, "");
    };

    useEffect(() => {
        const fetchMarkdown = async () => {
            try {
                const response = await fetch(src);
                if (!response.ok) {
                    throw new Error("Failed loading markdown file.");
                }
                let markdownText = await response.text();
                markdownText = removeAnchorLinks(markdownText);
                setContent(markdownText);
            } catch (error: any) {
                setError(error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchMarkdown();
    }, [src]);

    return (
        <div>
            {isLoading ? (
                <div className="p-24 h-screen bg-white rounded-lg shadow-md">
                    <Spinner size={SpinnerSize.large} label="Loading file" />
                </div>
            ) : error ? (
                <div className="h-screen bg-white rounded-lg shadow-md">
                    <MessageBar messageBarType={MessageBarType.error} isMultiline={false}>
                        {error.message}
                        <Link href={src} download>
                            Download the file
                        </Link>
                    </MessageBar>
                </div>
            ) : (
                <div>
                    <IconButton
                        className="relative float-right text-black"
                        iconProps={{ iconName: "Save" }}
                        title={t("tooltips.save")}
                        ariaLabel={t("tooltips.save")}
                        href={src}
                        download
                    />
                    <ReactMarkdown
                        children={content}
                        remarkPlugins={[remarkGfm]}
                        className="p-7 bg-white rounded-lg shadow-md my-5"
                    />
                </div>
            )}
        </div>
    );
};