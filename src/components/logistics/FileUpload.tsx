'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  title: string;
  onFileSelect: (file: File | null) => void;
  file: File | null;
}

export default function FileUpload({ title, onFileSelect, file }: FileUploadProps) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setError(null);
    if (rejectedFiles.length > 0) {
      setError('Format de fichier invalide. Veuillez utiliser .xlsx');
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
    },
    maxFiles: 1,
  });

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-foreground">{title}</h3>
      <div
        {...getRootProps()}
        className={cn(
          "flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-muted/50 transition-colors",
          isDragActive ? "border-primary bg-primary/10" : "border-border",
          file ? "border-green-500/50" : ""
        )}
      >
        <input {...getInputProps()} />
        {file ? (
          <div className="flex flex-col items-center text-center text-green-600">
            <CheckCircle className="w-12 h-12 mb-3" />
            <p className="font-semibold">Fichier chargé !</p>
            <p className="text-sm">{file.name}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center text-muted-foreground">
            <UploadCloud className="w-12 h-12 mb-3" />
            {isDragActive ? (
              <p>Déposez le fichier ici...</p>
            ) : (
              <p>Glissez-déposez ou <span className="font-semibold text-primary">cliquez pour choisir</span></p>
            )}
            <p className="text-xs mt-1">Fichier .XLSX uniquement</p>
          </div>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
