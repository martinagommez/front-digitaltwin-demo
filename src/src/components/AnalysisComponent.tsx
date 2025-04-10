import React, { useState, useEffect } from "react";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import json from "react-syntax-highlighter/dist/esm/languages/hljs/json";
import { a11yLight } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { FiExternalLink, FiDownload } from "react-icons/fi";
import DOMPurify from "dompurify";

import { ChatAppResponse } from '../api/models';
import { useLanguageContext } from './LanguageContext';
import { MarkdownViewer } from "./MarkdownViewer";

SyntaxHighlighter.registerLanguage("json", json);

type Tab = "thoughts" | "supporting" | "citations";

interface AnalysisComponentProps {
    answer: ChatAppResponse;
    selectedLanguage: string;
}

const AnalysisComponent: React.FC<AnalysisComponentProps> = ({ answer, selectedLanguage}) => {
    const [activeTab, setActiveTab] = useState<Tab>("thoughts");
	const [isConfigLoaded, setIsConfigLoaded] = useState<boolean>(false); // Track config load state
    const [featuresStates, setFeaturesStates] = useState({
		isThoughtProcess: true, // default values
		isSupportingContent: true,
		isCitations: true
	});

    // Get data from context
    const { languageData } = useLanguageContext();
    const thoughtProcess = languageData?.thoughtProcess?.[selectedLanguage] || languageData?.thoughtProcess?.['en-US'];
    const supportingContent = languageData?.supportingContent?.[selectedLanguage] || languageData?.supportingContent?.['en-US'];
    const citations = languageData?.citations?.[selectedLanguage] || languageData?.citations?.['en-US'];
    const citationDocument = languageData?.citationDocument?.[selectedLanguage] || languageData?.citationDocument?.['en-US'];
    const downloadDocument = languageData?.downloadDocument?.[selectedLanguage] || languageData?.downloadDocument?.['en-US'];
    const openLink = languageData?.openLink?.[selectedLanguage] || languageData?.openLink?.['en-US'];
    const noContentFound = languageData?.noContentFound?.[selectedLanguage] || languageData?.noContentFound?.['en-US'];

    const tabLabels: { [key in Tab]: string } = {
        thoughts: thoughtProcess,
        supporting: supportingContent,
        citations: citations,
    };


    // Update dos valores configuráveis no ficheiro json
    useEffect(() => {
        const updateAppConfig = async () => {
            try {
                const response = await fetch('/client.config.json');
                const clientData = await response.json();
                // Set general configuration
                if (clientData.enableFeatures) {
                    const config = {
                        isThoughtProcess: clientData.enableFeatures.isThoughtProcess ?? true,
                        isSupportingContent: clientData.enableFeatures.isSupportingContent ?? true,
                        isCitations: clientData.enableFeatures.isCitations ?? true,
                    };
                    setFeaturesStates(config);
                    // Auto-select first enabled tab
                    const tabPriority: Tab[] = ["thoughts", "supporting", "citations"];
                    const firstAvailable = tabPriority.find(tab => {
                        if (tab === "thoughts") return config.isThoughtProcess;
                        if (tab === "supporting") return config.isSupportingContent;
                        if (tab === "citations") return config.isCitations;
                        return false;
                    });
                    if (firstAvailable) {
                        setActiveTab(firstAvailable);
                    }
                }
            } catch (error) {
                console.error('Error fetching client configuration:', error);
            } finally {
                setIsConfigLoaded(true); // Mark configuration as loaded
            }
        };
        updateAppConfig();
    }, []);

    const renderThoughts = () => {
        return (
            <div className="flex flex-col h-full w-full">
                <div
                    className="flex-1 space-y-4 overflow-y-auto scroll-smooth p-2
                        [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2
                        [&::-webkit-scrollbar-track]:rounded-full
                        [&::-webkit-scrollbar-track]:bg-[#d0d0d0]/20
                        dark:[&::-webkit-scrollbar-track]:bg-[#414141]/20
                        [&::-webkit-scrollbar-thumb]:rounded-full
                        [&::-webkit-scrollbar-thumb]:bg-[#d0d0d0]
                        dark:[&::-webkit-scrollbar-thumb]:bg-[#414141]
                        [&::-webkit-scrollbar-thumb]:hover:bg-[#acabab]
                        dark:[&::-webkit-scrollbar-thumb]:hover:bg-[#2a2a2a]"
                >
                    <ul className="px-2 py-0 inline-block relative">
                        {/* Vertical line */}
                        <div className="absolute left-[25px] top-0 bottom-0 w-[2px] bg-neutral-700 dark:bg-neutral-300"></div>
                        {answer?.context?.thoughts?.map((thought, idx) => (
                            <li
                                key={idx}
                                className="relative list-none ml-5 min-h-[3.125em] pl-3 pb-8"
                            >
                                {/* Bullet circle */}
                                <span className="absolute left-[-14px] top-0 h-6 w-6 rounded-full border-4 border-white dark:border-neutral-800 bg-neutral-700 dark:bg-neutral-300 z-10"></span>
                                {/* Title */}
                                <div className="text-black dark:text-white text-sm md:text-base text-left mb-2 font-semibold pl-4">
                                    {thought.title || 'No title'}
                                </div>
                                {/* Properties if any */}
                                {thought.props && (
                                    <div className="flex flex-wrap gap-2 mb-2 pl-4">
                                        {Object.entries(thought.props).map(([key, value]) => (
                                            <span
                                                key={key}
                                                className="bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-white text-xs px-2 py-1 rounded-full"
                                            >
                                                {key}: {value}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {/* Description */}
                                {typeof thought.description === "string" ? (
                                    <p className="text-xs text-left text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap pl-4">
                                        {thought.description}
                                    </p>
                                ) : (
                                    <SyntaxHighlighter
                                        language="json"
                                        style={a11yLight}
                                        customStyle={{padding: "1em", borderRadius: "0.5em", maxHeight: "18.75em", overflow: "auto"}}
                                        wrapLongLines
                                    >
                                        {JSON.stringify(thought.description, null, 2)}
                                    </SyntaxHighlighter>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        );
    };
    

    // Parses "filename: actual content" into { title, content }
    const parseSupportingContentItem = (item: string): { title: string; content: string } => {
        const parts = item.split(": ");
        const title = parts[0];
        const content = DOMPurify.sanitize(parts.slice(1).join(": "));
        return { title, content };
    };

    const renderSupportingContent = () => {
        const points = answer?.context?.support ?? [];
        if (points.length === 0)
            return 
                <div className="text-gray-500 dark:text-gray-400">
                    {noContentFound}
                </div>;
        return (
            <div className="flex flex-col h-full w-full">
                <ul className="flex flex-col gap-2 p-2 overflow-y-auto overflow-x-hidden scroll-smooth
                    [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2
                    [&::-webkit-scrollbar-track]:rounded-full
                    [&::-webkit-scrollbar-track]:bg-[#d0d0d0]/20
                    dark:[&::-webkit-scrollbar-track]:bg-[#414141]/20
                    [&::-webkit-scrollbar-thumb]:rounded-full
                    [&::-webkit-scrollbar-thumb]:bg-[#d0d0d0]
                    dark:[&::-webkit-scrollbar-thumb]:bg-[#414141]
                    [&::-webkit-scrollbar-thumb]:hover:bg-[#acabab]
                    dark:[&::-webkit-scrollbar-thumb]:hover:bg-[#2a2a2a]"
                >
                    {points.map((point, idx) => {
                        const isMarkdown = point.toLowerCase().endsWith(".md");
                        if (isMarkdown) {
                            return (
                                <li
                                    key={idx}
                                    className="bg-neutral-50 dark:bg-neutral-700 rounded-lg border dark:border-neutral-600 shadow-lg p-5 text-sm text-gray-800 dark:text-gray-200"
                                >
                                    <MarkdownViewer src={point} />
                                </li>
                            );
                        }
                        // If the point contains ": ", treat it as a title + content
                        const hasContent = point.includes(": ");
                        const { title, content } = hasContent
                            ? parseSupportingContentItem(point)
                            : { title: "Info", content: DOMPurify.sanitize(point) };
                        return (
                            <li
                                key={idx}
                                className="bg-white dark:bg-neutral-700 rounded-lg border dark:border-neutral-600 shadow-lg p-4 m-2"
                            >
                                <h4 className="text-sm md:text-base text-left font-bold mb-1 text-black dark:text-white">{title}</h4>
                                <p
                                    className="text-xs md:text-sm text-left text-gray-800 dark:text-gray-200"
                                    dangerouslySetInnerHTML={{ __html: content }}
                                />
                                {point.startsWith("http") && (
                                    <a
                                        href={point}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 mt-2 text-blue-600 dark:text-blue-400 hover:underline hover:font-semibold text-xs md:text-sm"
                                    >
                                        {openLink} <FiExternalLink className="ml-1"/>
                                    </a>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    };


    const renderCitations = () => {
        const citations = answer?.context?.citations ?? [];
        if (citations.length === 0) {
            return <div className="text-gray-500 dark:text-gray-400">{noContentFound}</div>;
        }
        return (
            <div className="flex flex-col h-full">
                <div className="flex-1 space-y-6 pb-2 overflow-y-auto overflow-x-hidden scroll-smooth
                        [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2
                        [&::-webkit-scrollbar-track]:rounded-full
                        [&::-webkit-scrollbar-track]:bg-[#d0d0d0]/20
                        dark:[&::-webkit-scrollbar-track]:bg-[#414141]/20
                        [&::-webkit-scrollbar-thumb]:rounded-full
                        [&::-webkit-scrollbar-thumb]:bg-[#d0d0d0]
                        dark:[&::-webkit-scrollbar-thumb]:bg-[#414141]
                        [&::-webkit-scrollbar-thumb]:hover:bg-[#acabab]
                        dark:[&::-webkit-scrollbar-thumb]:hover:bg-[#2a2a2a]"
                >
                    {citations.map((url, idx) => {
                        const isMarkdown = url.endsWith(".md");
                        return (
                            <div key={idx} className="border dark:border-neutral-600 shadow p-3 mx-4 bg-white dark:bg-neutral-800">
                                <div className="mb-2 text-sm md:text-base font-medium text-neutral-800 dark:text-neutral-200">
                                    {citationDocument} {idx + 1}
                                </div>
                                {isMarkdown ? (
                                    <MarkdownViewer src={url} />
                                ) : (
                                    <div>
                                        <div className="flex justify-center items-center mb-2">
                                            <a
                                                href={url}
                                                download
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex flex-row items-center text-neutral-600 dark:text-neutral-400 hover:text-black hover:dark:text-white hover:font-semibold text-xs md:text-sm"
                                            >
                                                <FiDownload className="mr-1"/> {downloadDocument} 
                                            </a>
                                        </div>
                                        <iframe
                                            src={url}
                                            className="w-full h-[600px]"
                                        ></iframe>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };
    
    const renderContent = () => {
        if (!isConfigLoaded) return null;
        switch (activeTab) {
            case "thoughts":
                return featuresStates.isThoughtProcess ? renderThoughts() : null;
            case "supporting":
                return featuresStates.isSupportingContent ? renderSupportingContent() : null;
            case "citations":
                return featuresStates.isCitations ? renderCitations() : null;
            default:
                return null;
        }
    };
    

    return (
        <div className={"flex flex-col w-full h-full"}>
            {/* Tabs */}
            <div className="flex border-b border-gray-300 dark:border-neutral-700">
                {(Object.keys(tabLabels) as Tab[])
                    .filter((tab) => {
                        if (!isConfigLoaded) return false;
                        if (tab === "thoughts" && !featuresStates.isThoughtProcess) return false;
                        if (tab === "supporting" && !featuresStates.isSupportingContent) return false;
                        if (tab === "citations" && !featuresStates.isCitations) return false;
                        return true;
                    })
                    .map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`py-2 px-4 text-xs md:text-sm font-medium transition-colors ${
                            activeTab === tab
                                ? "border-b-2 border-black dark:border-white text-black dark:text-white"
                                : "text-neutral-500 hover:text-black dark:text-gray-400 dark:hover:text-white"
                        }`}
                    >
                        {tabLabels[tab]}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto pt-4 text-sm text-gray-800 dark:text-gray-200">
                {renderContent()}
            </div>
        </div>
    );
};

export default AnalysisComponent;
