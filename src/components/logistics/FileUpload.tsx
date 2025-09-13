'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';

interface FileUploadProps {
  title: string;
  onFileSelect: (file: File | null) => void;
  file: File | null;
}

export default function FileUpload({ title, onFileSelect, file }: FileUploadProps) {

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      // You can add more robust error handling here if needed
      onFileSelect(null);
      return;
    }
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv']
    },
    maxFiles: 1,
  });

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-foreground text-center text-lg">{title}</h3>
      <div
        {...getRootProps()}
        className={cn(
          "relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-muted/50 transition-colors",
          isDragActive ? "border-primary bg-primary/10" : "border-border",
          file ? "border-green-500/50" : ""
        )}
      >
        <input {...getInputProps()} />
        {file ? (
          <div className="flex flex-col items-center text-center text-green-600 p-4">
            <CheckCircle className="w-12 h-12 mb-3" />
            <p className="font-semibold">Fichier sélectionné :</p>
            <p className="text-sm">{file.name}</p>
             <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                    e.stopPropagation();
                    onFileSelect(null);
                }}
             >
                <XCircle className="h-4 w-4" />
             </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center text-muted-foreground p-4">
            <UploadCloud className="w-12 h-12 mb-3" />
            {isDragActive ? (
              <p>Déposez le fichier ici...</p>
            ) : (
              <p>Glissez-déposez ou <span className="font-semibold text-primary">cliquez pour choisir</span></p>
            )}
            <p className="text-xs mt-1">Fichier .XLSX ou .CSV</p>
          </div>
        )}
      </div>
    </div>
  );
}
