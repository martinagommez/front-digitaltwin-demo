import { useState } from 'react'; 
import axios from 'axios';
import { PluginMeta } from '../models/requests/PluginApi';
import { FiImage, FiFile, FiPaperclip, FiTrash2, FiMinus, FiPlus, FiDownload, FiUpload, FiCheckSquare, FiX, FiSend, FiSidebar } from "react-icons/fi";
import { useLanguageContext } from './LanguageContext';
import './styles.css';
import { pdfjs } from "react-pdf";
import * as XLSX from "xlsx";
import { renderAsync } from "docx-preview";
import "react-data-grid/lib/styles.css";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface FilesProcessingProps {
    activedPlugin: PluginMeta | null;
    setActivedPlugin: React.Dispatch<React.SetStateAction<PluginMeta | null>>;
    debugMode: boolean;
    setDebugMode: React.Dispatch<React.SetStateAction<boolean>>; 
    isFilesSidebarOpen: boolean;
    setIsFilesSidebarOpen: (open: boolean) => void;
    selectedLanguage: string;
}

function FilesProcessing({ activedPlugin, setActivedPlugin, isFilesSidebarOpen, setIsFilesSidebarOpen, selectedLanguage }: FilesProcessingProps) {
    const [inputText, setInputText] = useState<string>('files');
    const [files, setFiles] = useState<File[]>([]);
    const [previewFile, setPreviewFile] = useState<File | null>(null);
    const [textPreview, setTextPreview] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1); // Initial zoom state
    const [loading, setLoading] = useState<boolean>(false);
    const [isShaking, setIsShaking] = useState<boolean>(false);
    const [receivedFiles, setReceivedFiles] = useState<File[]>([]);

    // Formatação TimeStamp
    function getFormattedTimestamp() {
        const date = new Date();
        const year = date.getFullYear();    
        const month = String(date.getMonth() + 1).padStart(2, '0');    
        const day = String(date.getDate()).padStart(2, '0');    
        const hours = String(date.getHours()).padStart(2, '0');    
        const minutes = String(date.getMinutes()).padStart(2, '0');    
        const seconds = String(date.getSeconds()).padStart(2, '0');    
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    }

    // Handle Zoom In and Zoom Out
    const zoomIn = () => setZoom((prevZoom) => Math.min(prevZoom + 0.1, 3)); // Max zoom level = 3
    const zoomOut = () => setZoom((prevZoom) => Math.max(prevZoom - 0.1, 0.5)); // Min zoom level = 0.5

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newFiles = e.target.files ? Array.from(e.target.files) : [];
        setFiles((prev) => [...prev, ...newFiles]);
    };

    const removeFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const droppedFiles = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
        setFiles((prev) => [...prev, ...droppedFiles]);
    };

    const handlePreviewFile = async (file: File) => {
        setPreviewFile(file);
        setTextPreview(null);
        setIsFilesSidebarOpen(true);
        if (file.type.startsWith("text/")) {
            const reader = new FileReader();
            reader.onload = (event) => setTextPreview(event.target?.result as string);
            reader.readAsText(file);
        } else if (file.type === "application/pdf") {
            return; // PDF preview (handled by react-pdf)
        } else if (file.type.includes("spreadsheet")) {
            // Excel preview
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = e.target?.result as ArrayBuffer;
                const wb = XLSX.read(data, { type: "array" });
                const html = XLSX.utils.sheet_to_html(wb.Sheets[wb.SheetNames[0]]);
                setTextPreview(html); // Display as HTML table
            };
            reader.readAsArrayBuffer(file);
        } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
            // DOCX preview using docx-preview
            const reader = new FileReader();
            reader.onload = async (e) => {
                const arrayBuffer = e.target?.result as ArrayBuffer;
                const container = document.createElement("div");
                await renderAsync(arrayBuffer, container);
                setTextPreview(container.innerHTML);
            };
            reader.readAsArrayBuffer(file);
        }
    };

    // Handle Send with endpoint
    const handleSendFiles = async () => {
        // Check if there are any files
        if (files.length === 0) {
            alert("No files selected for upload");
            return;
        }
        setLoading(true);
        if (!inputText.trim()) return;
        // Create FormData to append files for uploading
        const formData = new FormData();
        formData.append("user_input", inputText || "files");
        formData.append("timestamp", getFormattedTimestamp());
        formData.append("body","")
        if(files.length>0){
            files.forEach(file => formData.append('files[]', file));
        }
        // try {
        //     // Assuming the backend is set up to handle the files at the endpoint '/upload'
        //     const response = await fetch('/upload', {
        //         method: 'POST',
        //         body: formData,  // Send the form data with the files
        //     });
        //     if (!response.ok) {
        //         throw new Error('Failed to upload files');
        //     }
        //     alert("Files uploaded successfully!");
        //     setIsFilesSidebarOpen(false);
        //     setInputText("files");
        //     setFiles([]);  // Clear files after successful upload
        // } catch (error) {
        //     console.error("Error on Fetching Message:", error);
        // } finally {
        //     setLoading(false);
        // }
        console.log(formData);
        alert("Files uploaded successfully!");
        setIsFilesSidebarOpen(false);
        setInputText("files");
        setFiles([]);
        setLoading(false);
        await fetchFiles(formData);
        console.log("Handle Send", formData);
    };
    
    // SEND FILES DE TESTE
    // const handleSendFiles = () => {
    //     // Create a FormData instance to prepare the files
    //     if (files.length === 0) {
    //         alert("No files selected for upload");
    //         return;
    //     } else {
    //         setLoading(true);
    //         const formData = new FormData();
    //         files.forEach((file) => {
    //             formData.append("files", file); // "files" is the key used to send the file in the form data
    //         });
    //         // Simulate a file upload (instead of sending to the backend, we just log the data)
    //         console.log("Sending files to the backend...");
    //         files.forEach((file) => {
    //             console.log(`File: ${file.name}, Type: ${file.type}`);
    //         });
    //         // Optional: Simulate a successful response after the "upload" process
    //         setTimeout(() => {
    //             console.log("Files uploaded successfully!");
    //             // Optionally, clear the files after upload simulation
    //             setFiles([]);
    //             setIsFilesSidebarOpen(false);
    //             alert("Files uploaded successfully!");
    //             setLoading(false);
    //         }, 2000); // Simulate a delay of 2 seconds
    //     }
    // };

    const handleDownload = (file: File) => {
        // Create an anchor tag to download the file
        const link = document.createElement('a');
        link.href = URL.createObjectURL(file);
        link.download = file.name; // Set the download file name
        link.click();
    };

    const handleClearFiles = () => {
        setIsShaking(true); // Trigger shake effect
        setFiles([]); // Clear files
        setTimeout(() => setIsShaking(false), 500); // Remove animation after 0.5s
        setIsFilesSidebarOpen(false);
        setPreviewFile(null);
        setTextPreview(null);
    };       

    const closeSidebar = () => {
        setIsFilesSidebarOpen(false);
        setPreviewFile(null);
        setTextPreview(null);
    };

    const fetchFiles = async (formData: FormData) => {
        if (!activedPlugin) return;
        try {
            const url = activedPlugin.PluginHost.startsWith('https')
                ? activedPlugin.PluginHost
                : `https://${activedPlugin.PluginHost}`;
            console.log("Payload being sent to backend:", formData);
            for (const pair of formData.entries()) {
                console.log(pair[0], pair[1]);
            }
            const response = await axios.post(url + "/message", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                    'Access-Control-Allow-Origin': '*'
                },
            });
            const filesData = response.data;
            // Assuming filesData is an array of files or file metadata
            const files = filesData.map((file: any) => new File([file], file.name)); // Convert to File objects
            setReceivedFiles(files);
            console.log(response)
            console.log(filesData)
        } catch (error) {
            console.error("Error fetching files:", error);
        }
    };

    // Get language data and selected language from context
    const { languageData } = useLanguageContext();
    // localStorage.setItem('language', 'en');
    
    // Extract text values from JSON
    const uploadFilesText = languageData?.uploadFilesText?.[selectedLanguage] || "Upload Files";
    const uploadedFilesText = languageData?.uploadedFilesText?.[selectedLanguage] || "Uploaded Files";
    const processedFilesText = languageData?.processedFilesText?.[selectedLanguage] || "Processed Files";
    const dragDropText = languageData?.dragDropText?.[selectedLanguage] || "Drag and drop your files here or click to upload";
    const noUploadText = languageData?.noUploadText?.[selectedLanguage] || "No files uploaded";
    const noProcessText = languageData?.noProcessText?.[selectedLanguage] || "No files processed";
    const messageText = languageData?.messageText?.[selectedLanguage] || "Message";
    const noPreviewText = languageData?.noPreviewText?.[selectedLanguage] || "Preview not supported for this file type.";
    const deleteAllButton = languageData?.deleteAllButton?.[selectedLanguage] || "Delete all";

    return (
        <div className="flex w-full h-screen"> {/* Main flex container */}
            {/* Main UI */}
            <div
                className={`${isFilesSidebarOpen ? "w-1/2" : "w-full"} flex flex-col items-center justify-start p-4`}
            >
                {/* Upload Files */}
                <div className="flex flex-col items-center justify-center w-full md:h-[calc((100vh-7rem)/2-2rem)] h-[calc((100vh-6rem)/2-2rem)] p-4 border-2 border-neutral-300 dark:border-neutral-600 rounded-lg">
                    <div className="w-full flex flex-row md:h-[calc((100vh-7rem)/2-4rem)] h-[calc((100vh-6rem)/2-4rem)]">
                        {/* Upload Files area */}
                        <div className="flex flex-col items-left min-w-28">
                            <h1 className="flex items-center text-left md:text-lg text-xs font-bold mb-4 text-neutral-800 dark:text-neutral-200">
                                <FiUpload className="mr-2" /> {uploadFilesText}
                            </h1>
                            <div
                                onDragOver={handleDragOver}
                                onDrop={handleDrop}
                                className="relative rounded-lg w-full max-w-60 h-full max-h-full flex items-center justify-center border-2 border-dashed
                                border-neutral-300 dark:border-neutral-600 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer"
                            >
                                <label
                                    htmlFor="file-input"
                                    className="cursor-pointer flex md:text-base text-xs items-center justify-center p-4 w-full h-full"
                                >
                                    {dragDropText}
                                </label>
                                <input
                                    id="file-input"
                                    type="file"
                                    multiple
                                    className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={handleFileUpload}
                                />
                            </div>
                        </div>
                        {/* Uploaded Files area */}
                        <div className={`relative flex flex-col ml-6 w-full ${loading ? 'overflow-hidden' : 'overflow-auto'}`}>
                            <div className="flex flex-row justify-between w-full">
                                <h1 className="flex flex-wrap items-center justify-start md:text-lg text-xs font-bold mb-4 text-neutral-800 dark:text-neutral-200">
                                    <FiCheckSquare className="mr-2" /> {uploadedFilesText}
                                </h1>
                                <div className="absolute top-0 right-0 flex flex-row items-center justify-end">
                                    <button
                                        title={deleteAllButton}
                                        className={`flex items-center justify-center w-6 h-6 md:w-8 md:h-8 md:text-lg text-sm font-bold ml-1 mb-1 border-2 border-neutral-300 dark:border-neutral-500 rounded-full
                                            ${loading ? 'cursor-not-allowed' : ''} 
                                            text-neutral-800 dark:text-neutral-200 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-600 dark:hover:bg-neutral-500
                                            ${isShaking ? 'animate-shake' : ''}`}
                                        onClick={handleClearFiles}
                                        disabled={loading}
                                    >
                                        <FiTrash2 />
                                    </button>
                                    <button
                                        title={uploadFilesText}
                                        className={`flex items-center justify-center w-6 h-6 md:w-8 md:h-8 md:text-lg text-sm font-bold ml-1 mb-1 border-2 border-neutral-300 dark:border-neutral-500 rounded-full
                                            ${loading ? 'cursor-not-allowed' : ''} 
                                            text-neutral-800 dark:text-neutral-200 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-600 dark:hover:bg-neutral-500`}
                                        onClick={handleSendFiles}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <div className="animate-spin"><FiSend /></div>
                                        ) : (
                                            <><FiSend /></>
                                        )}
                                    </button>
                                </div>
                            </div>
                            <div className="w-full space-y-2
                                flex-1 pr-2 overflow-y-auto overflow-x-auto scroll-smooth
                                [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2
                                [&::-webkit-scrollbar-track]:rounded-full
                                [&::-webkit-scrollbar-track]:bg-[#d0d0d0]/20
                                dark:[&::-webkit-scrollbar-track]:bg-[#414141]/20
                                [&::-webkit-scrollbar-thumb]:rounded-full
                                [&::-webkit-scrollbar-thumb]:bg-[#d0d0d0]
                                dark:[&::-webkit-scrollbar-thumb]:bg-[#414141]
                                [&::-webkit-scrollbar-thumb]:hover:bg-[#acabab]
                                dark:[&::-webkit-scrollbar-thumb]:hover:bg-[#2a2a2a]">
                                {files.length === 0 ? (
                                    <p className="text-neutral-500 text-xs md:text-base">{noUploadText}</p>
                                ) : (
                                files.map((file, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between p-2 border rounded-lg transition cursor-pointer
                                        bg-white dark:bg-neutral-800 shadow hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                        onClick={ () => handlePreviewFile(file)}
                                    >
                                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                                            {file.type.startsWith("image/") ? (
                                                <FiImage className="text-blue-500 md:text-xl text-base" />
                                            ) : (
                                                <FiFile className="text-neutral-500 md:text-xl text-base" />
                                            )} 
                                            <span className="text-neutral-800 dark:text-neutral-200 md:text-sm text-xs text-left
                                                    overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0">
                                                {file.name}
                                            </span>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                                            className="text-red-500 hover:text-red-700 md:text-xl text-base"
                                        >
                                            <FiTrash2 />
                                        </button>
                                    </div>
                                )))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className='h-4'></div>
                {/* Processed Files */}
                <div className="flex flex-col items-start justify-start w-full md:h-[calc((100vh-7rem)/2-2rem)] h-[calc((100vh-6rem)/2-2rem)] p-4 border-2 border-neutral-300 dark:border-neutral-600 rounded-lg">
                    <h1 className="flex items-center md:text-lg text-xs font-bold mb-4 text-neutral-800 dark:text-neutral-200">
                        <FiPaperclip className="mr-2" /> {processedFilesText}
                    </h1>
                    <div className="flex flex-col w-full h-20 mb-2 bg-neutral-50 dark:bg-neutral-900 shadow-md">
                        <h2 className="flex items-center md:text-base text-xs font-bold ml-1 mr-1 text-neutral-800 dark:text-neutral-200">{messageText}</h2>
                        <p className="flex md:text-sm text-xs ml-1 mr-1 text-neutral-800 dark:text-white overflow-y-auto">Message from bot</p>
                    </div>
                    <div className="w-full space-y-2
                        flex-1 pr-2 overflow-y-auto overflow-x-auto scroll-smooth
                        [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2
                        [&::-webkit-scrollbar-track]:rounded-full
                        [&::-webkit-scrollbar-track]:bg-[#d0d0d0]/20
                        dark:[&::-webkit-scrollbar-track]:bg-[#414141]/20
                        [&::-webkit-scrollbar-thumb]:rounded-full
                        [&::-webkit-scrollbar-thumb]:bg-[#d0d0d0]
                        dark:[&::-webkit-scrollbar-thumb]:bg-[#414141]
                        [&::-webkit-scrollbar-thumb]:hover:bg-[#acabab]
                        dark:[&::-webkit-scrollbar-thumb]:hover:bg-[#2a2a2a]">
                        {files.length === 0 ? (
                            <p className="text-neutral-500 text-xs md:text-base">{noProcessText}</p>
                        ) : (
                        receivedFiles.map((file, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between p-2 border rounded-lg transition cursor-pointer
                                bg-white dark:bg-neutral-800 shadow hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                onClick={ () => handlePreviewFile(file)}
                            >
                                <div className="flex items-center space-x-2 flex-1 min-w-0">
                                    {file.type.startsWith("image/") ? (
                                        <FiImage className="text-blue-500 md:text-xl text-base" />
                                    ) : (
                                        <FiFile className="text-neutral-500 md:text-xl text-base" />
                                    )}
                                    <span className="text-neutral-800 dark:text-neutral-200 md:text-sm text-xs text-left
                                                    overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0">
                                        {file.name}
                                    </span>
                                </div>
                                <button
                                    onClick={() => handleDownload(file)}
                                    className="text-black hover:text-neutral-800 md:text-xl text-base"
                                >
                                    <FiDownload />
                                </button>
                            </div>
                        )))}
                    </div>
                </div>
            </div>
            {/* Sidebar */}
            {isFilesSidebarOpen && (
                <div className="w-1/2 h-screen bg-white dark:bg-neutral-800 border-l shadow-lg p-4 flex flex-col">
                    <div className="flex flex-row justify-between items-center w-full">
                        <h2 className="flex flex-row items-center md:text-lg text-sm font-bold text-neutral-800 dark:text-white p-0">
                            <FiSidebar className="mr-2" /> {previewFile?.name}
                        </h2>
                        <button onClick={closeSidebar} className="self-end text-neutral-600 dark:text-neutral-300 text-2xl">
                            <FiX />
                        </button>
                    </div>
                    <div className="mt-4 flex-1 overflow-auto">
                        {
                        //IMAGES
                        previewFile?.type.startsWith("image/") ? (
                            <div className="w-full h-[calc(100vh-10rem)] overflow-hidden border-none rounded-lg flex justify-start items-center relative">
                                {/* Buttons to zoom in and zoom out */}
                                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 flex space-x-4 z-10">
                                    <button onClick={zoomIn} className="p-2 bg-neutral-800 dark:bg-neutral-600 hover:bg-neutral-700 dark:hover:bg-neutral-500 text-white rounded-md">
                                        <FiPlus />
                                    </button>
                                    <button onClick={zoomOut} className="p-2 bg-neutral-800 dark:bg-neutral-600 hover:bg-neutral-700 dark:hover:bg-neutral-500 text-white rounded-md">
                                        <FiMinus />
                                    </button>
                                </div>
                                <div className="w-full h-[calc(100vh-16rem)] overflow-auto border border-neutral-300 dark:border-neutral-600 rounded-lg flex justify-center items-center">
                                    <img
                                        src={URL.createObjectURL(previewFile)}
                                        alt={previewFile.name}
                                        className="max-w-full max-h-full object-contain cursor-zoom-in"
                                        style={{
                                            transform: `scale(${zoom})`,
                                            // transition: "transform 0.2s",
                                            transformOrigin: "top left",
                                        }}
                                    />
                                </div>
                            </div>
                        // TEXT
                        ) : previewFile?.type.startsWith("text/") ? (
                            <textarea
                                readOnly
                                value={textPreview || "Loading"}
                                className="w-full h-[calc(100vh-13rem)] border border-neutral-300 dark:border-neutral-600 rounded-lg p-2 bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 overflow-auto"
                            />
                        // PDF
                        ) : previewFile?.type === "application/pdf" ? (
                            <iframe
                                src={URL.createObjectURL(previewFile)}
                                className="w-full h-[calc(100vh-13rem)] border rounded-lg"
                                title="PDF preview"
                            />
                        // EXCEL
                        ) : previewFile?.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
                        previewFile?.type === "application/vnd.ms-excel" ? (
                        <div
                            className="w-full overflow-y-auto h-[calc(100vh-13rem)] border-neutral-300 dark:border-neutral-600 rounded-lg p-2 bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200"
                            dangerouslySetInnerHTML={{ __html: textPreview || "" }}
                        />
                        // DOCX
                        ) : previewFile?.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ? (
                            <div
                                className="w-full overflow-y-auto h-[calc(100vh-13rem)] border-neutral-300 dark:border-neutral-600 rounded-lg p-2 bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200"
                                dangerouslySetInnerHTML={{ __html: textPreview || "" }}
                            />
                        ) : (
                            <p className="text-neutral-800 dark:text-neutral-200">
                                {noPreviewText}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default FilesProcessing;