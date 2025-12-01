import { useState, useEffect, useRef } from "react";
import { pdfjs } from "react-pdf";
import type { DocumentProps } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Document, Page } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const Loading = () => {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400 mb-4"></div>
        <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Loading PDF...</p>
      </div>
    </div>
  );
};

const PDFViewer: React.FC<{
  file: string;
  fileName?: string;
}> = ({ file }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>();

  const onDocumentLoadSuccess: DocumentProps["onLoadSuccess"] = payload => {
    const { numPages } = payload;
    setNumPages(numPages);
  };

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setWidth(containerRef.current.clientWidth);
      }
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(containerRef.current!);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="bg-white dark:bg-gray-900">
      <Document
        file={file}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={error => console.error("PDF load error:", error)}
        loading={Loading}
        className="react-pdf__Document"
      >
        {Array.from(new Array(numPages), (_, index) => (
          <Page
            key={`page_${index + 1}`}
            pageNumber={index + 1}
            width={width}
            className="mb-4"
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        ))}
      </Document>
    </div>
  );
};

export default PDFViewer;
