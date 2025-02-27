"use client";
import { useState } from "react";

const UploadDocument = ({ onUpload }: { onUpload: (text: string) => void }) => {
    const [fileName, setFileName] = useState("Select a document");
    
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setFileName(file.name);
            const text = await file.text();
            onUpload(text);
        }
    };

    return (
        <div className="w-full">
            <label className="block text-gray-700">Upload Document</label>
            <input type="file" accept=".txt,.pdf,.docx" onChange={handleFileUpload} className="hidden" id="file-upload" />
            <label htmlFor="file-upload" className="block w-full p-2 border rounded cursor-pointer text-center bg-gray-100 hover:bg-gray-200">
                {fileName}
            </label>
        </div>
    );
};

export default UploadDocument;